#!/usr/bin/env python3
"""
Orchestrator Agent (COO) – Micro-Firma Buchproduktion.

Verantwortlichkeiten:
  - Scannt nach neuen Projekten (status=IDEA_INTAKE)
  - Erstellt und verteilt Tasks (einziger Service mit dieser Berechtigung)
  - Wertet QC-Reports aus und loest State-Transitionen aus
  - Verwaltet CEO-Approval-Wartelogik (Human-in-the-loop)
  - Verwaltet Rework-Zyklen und Dead Letter Queue
  - Run-Tracking mit events.log, decisions.log, metrics.json

Einschraenkungen:
  - Nur ein State-Transition pro Projekt gleichzeitig (Transition-Lock)
  - Keine inhaltliche Veraenderung von Artefakten
  - Nur der Orchestrator darf state.json schreiben
"""
import json
import os
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

sys.path.insert(0, "/company/lib")
from logger import StructuredLogger
from state_machine import ProjectStateManager, ProjectState, IllegalTransitionError
from task import Task, TaskStatus, TaskType, TaskRepository

# ─── Konfiguration ────────────────────────────────────────────────────────────
WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace"))
SERVICE_NAME = "orchestrator"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
MAX_REWORK_CYCLES = int(os.getenv("MAX_REWORK_CYCLES", "3"))

LOG = StructuredLogger(SERVICE_NAME)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def projects_dir() -> Path:
    return WORKSPACE_DIR / "projects"


def generate_run_id() -> str:
    ts = int(time.time() * 1000)
    short = str(uuid.uuid4()).replace("-", "")[:8]
    return f"run_{ts}_{short}"


# ─── Transition-Lock ──────────────────────────────────────────────────────────

def acquire_transition_lock(project_dir: Path) -> Optional[str]:
    """
    Erwirbt exklusiven Lock fuer State-Transitionen eines Projekts.
    Verhindert parallele Transitionen bei gleichzeitigem Orchestrator-Zugriff.

    lock-Datei: projects/<id>/transition_lock.json
    Format: { "artifact": "state.json", "owner_service": ...,
               "lease_until": ISO8601, "lock_id": UUID }

    Returns: lock_id wenn erfolgreich, None wenn Lock bereits aktiv.
    """
    lock_file = project_dir / "transition_lock.json"
    lock_id = str(uuid.uuid4())
    lease_until = (datetime.now(timezone.utc) + timedelta(seconds=30)).isoformat()

    # Pruefe ob bestehender Lock noch gueltig ist
    if lock_file.exists():
        try:
            existing = json.loads(lock_file.read_text(encoding="utf-8"))
            lu = datetime.fromisoformat(existing["lease_until"])
            if datetime.now(timezone.utc) < lu:
                return None  # Lock aktiv – nicht ueberschreiben
        except (json.JSONDecodeError, KeyError, ValueError):
            pass  # Beschaedigter Lock -> ueberschreiben erlaubt

    lock_data = {
        "artifact": "state.json",
        "owner_service": SERVICE_NAME,
        "lease_until": lease_until,
        "lock_id": lock_id,
    }
    # Atomisch schreiben via temporaere Datei + rename
    tmp = lock_file.with_suffix(".tmp")
    tmp.write_text(json.dumps(lock_data, ensure_ascii=False), encoding="utf-8")
    tmp.rename(lock_file)
    time.sleep(0.05)  # Kurze Verifikationswartezeit

    try:
        current = json.loads(lock_file.read_text(encoding="utf-8"))
        if current.get("lock_id") == lock_id:
            return lock_id
    except (json.JSONDecodeError, OSError):
        pass
    return None


def release_transition_lock(project_dir: Path, lock_id: str) -> None:
    """Gibt den Transition-Lock frei, falls er noch uns gehoert."""
    lock_file = project_dir / "transition_lock.json"
    if not lock_file.exists():
        return
    try:
        current = json.loads(lock_file.read_text(encoding="utf-8"))
        if current.get("lock_id") == lock_id:
            lock_file.unlink(missing_ok=True)
    except (json.JSONDecodeError, OSError):
        pass


# ─── CEO Approval System ──────────────────────────────────────────────────────

# States die CEO-Freigabe benoetigen bevor weitergearbeitet wird
CEO_APPROVAL_REQUIRED = {
    ProjectState.SCOPE_DEFINED,
    ProjectState.OUTLINE_APPROVED,
    ProjectState.DRAFT_APPROVED,
    ProjectState.ILLUSTRATIONS_APPROVED,
    ProjectState.LAYOUT_APPROVED,
    ProjectState.PUBLISH_APPROVED,
}


def check_ceo_approval(project_id: str, state: ProjectState) -> bool:
    """
    Prueft ob CEO-Freigabe fuer den aktuellen State vorliegt.

    Approval-Datei: /projects/<id>/approvals/<STATE>.json
    Pflichtinhalt: { "approved": true, "approved_by": "CEO", "timestamp": "..." }
    """
    if state not in CEO_APPROVAL_REQUIRED:
        return True
    approval_file = projects_dir() / project_id / "approvals" / f"{state.value}.json"
    if not approval_file.exists():
        return False
    try:
        data = json.loads(approval_file.read_text(encoding="utf-8"))
        return bool(data.get("approved", False))
    except (json.JSONDecodeError, OSError):
        return False


def create_approval_request(project_id: str, state: ProjectState, run_id: str) -> None:
    """
    Erstellt eine Approval-Request-Datei als Signal fuer den CEO.
    Wird nur einmal erstellt (Idempotenz).
    """
    approvals_dir = projects_dir() / project_id / "approvals"
    approvals_dir.mkdir(parents=True, exist_ok=True)
    request_file = approvals_dir / f"{state.value}_request.json"
    if request_file.exists():
        return  # Bereits angefragt

    request = {
        "project_id": project_id,
        "run_id": run_id,
        "state": state.value,
        "requested_at": now_iso(),
        "instruction": (
            f"CEO-Freigabe erforderlich fuer State '{state.value}'. "
            f"Erstelle folgende Datei um fortzufahren:\n"
            f"  projects/{project_id}/approvals/{state.value}.json\n"
            f'  Inhalt: {{"approved": true, "approved_by": "CEO", "timestamp": "{now_iso()}"}}'
        ),
    }
    request_file.write_text(
        json.dumps(request, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    LOG.info(f"CEO-Approval angefordert: {state.value}",
             project_id=project_id, run_id=run_id, event="APPROVAL_REQUESTED")


# ─── Structured Logging ───────────────────────────────────────────────────────

def log_event(project_id: str, run_id: str, event: str, details: dict) -> None:
    """Schreibt ein Event (JSONL) in events.log des aktuellen Runs."""
    run_dir = projects_dir() / project_id / "runs" / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    entry = {"timestamp": now_iso(), "event": event,
             "run_id": run_id, "project_id": project_id, **details}
    with open(run_dir / "events.log", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def log_decision(project_id: str, run_id: str, decision: str, details: dict) -> None:
    """Schreibt eine Entscheidung (JSONL) in decisions.log des aktuellen Runs."""
    run_dir = projects_dir() / project_id / "runs" / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    entry = {"timestamp": now_iso(), "decision": decision,
             "run_id": run_id, "project_id": project_id, **details}
    with open(run_dir / "decisions.log", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


# ─── Task-Erstellung ──────────────────────────────────────────────────────────

def create_task(
    project_id: str, run_id: str, task_type: TaskType, owner_service: str,
    input_artifacts: list, output_artifacts: list, acceptance_criteria: list,
    priority: int = 5, metadata: Optional[dict] = None,
) -> Task:
    """
    Erstellt einen Task und speichert ihn in tasks/.
    Nur der Orchestrator darf diese Funktion aufrufen.
    """
    task = Task(
        task_type=task_type, owner_service=owner_service,
        project_id=project_id, run_id=run_id,
        input_artifacts=input_artifacts, output_artifacts=output_artifacts,
        acceptance_criteria=acceptance_criteria,
        priority=priority, metadata=metadata or {},
    )
    TaskRepository(projects_dir() / project_id / "tasks").save(task)
    LOG.info(f"Task erstellt: {task_type.value} -> {owner_service}",
             project_id=project_id, run_id=run_id,
             task_id=task.task_id, event="TASK_CREATED")
    log_event(project_id, run_id, "TASK_CREATED", {
        "task_id": task.task_id, "task_type": task_type.value,
        "owner_service": owner_service,
    })
    return task


# ─── Projekt-Start ────────────────────────────────────────────────────────────

def find_new_projects() -> list:
    """Gibt Projekt-Verzeichnisse mit status=IDEA_INTAKE zurueck."""
    result = []
    base = projects_dir()
    if not base.exists():
        return result
    for d in base.iterdir():
        if not d.is_dir() or d.name.startswith("_"):
            continue
        sf = d / "state.json"
        if not sf.exists():
            continue
        try:
            state = json.loads(sf.read_text(encoding="utf-8"))
            if state.get("status") == ProjectState.IDEA_INTAKE.value:
                result.append(d)
        except (json.JSONDecodeError, OSError):
            continue
    return result


def start_project(project_dir: Path) -> None:
    """
    Initialisiert neuen Projektlauf:
      1. Generiert run_id
      2. Legt run-Verzeichnis mit metrics.json an
      3. Aktualisiert state.json mit run_id
      4. Erstellt ersten Task (SCOPE_DEFINE)
    """
    project_id = project_dir.name
    run_id = generate_run_id()

    # Run-Verzeichnis und initiale Metriken anlegen
    run_dir = project_dir / "runs" / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "metrics.json").write_text(json.dumps({
        "run_id": run_id, "project_id": project_id,
        "jobs_processed": 0, "jobs_failed": 0,
        "gate_failures": 0, "execution_time_s": 0,
        "started_at": now_iso(), "finished_at": None,
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    # Idee aus 01_intake/idea.txt lesen
    idea_file = project_dir / "01_intake" / "idea.txt"
    idea = idea_file.read_text(encoding="utf-8").strip() if idea_file.exists() else ""

    # state.json aktualisieren
    sf = project_dir / "state.json"
    try:
        state = json.loads(sf.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        state = {}
    state.update({
        "run_id": run_id,
        "status": ProjectState.IDEA_INTAKE.value,
        "rework_counts": state.get("rework_counts", {}),
        "history": state.get("history", []),
    })
    sf.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")

    LOG.info(f"Projekt gestartet: {project_id}",
             project_id=project_id, run_id=run_id, event="PROJECT_STARTED")
    log_event(project_id, run_id, "PROJECT_STARTED", {"idea_preview": idea[:100]})

    # Ersten Task anlegen: SCOPE_DEFINE fuer product-worker
    create_task(
        project_id, run_id, TaskType.SCOPE_DEFINE, "product-worker",
        input_artifacts=[f"projects/{project_id}/01_intake/idea.txt"],
        output_artifacts=[f"projects/{project_id}/02_scope/scope.json"],
        acceptance_criteria=[
            "scope.json ist schema-valide",
            "concept hat mindestens 50 Zeichen",
            "target_audience mit age_min und age_max definiert",
            "mindestens 1 deliverable angegeben",
        ],
        priority=1,
    )


# ─── Task->State Mappings ─────────────────────────────────────────────────────

# Worker-Task-Typ -> (naechster State, Beschreibung)
TASK_TO_STATE = {
    TaskType.SCOPE_DEFINE:         (ProjectState.SCOPE_DEFINED,       "Scope definiert"),
    TaskType.OUTLINE_CREATE:       (ProjectState.OUTLINE_READY,       "Gliederung erstellt"),
    TaskType.MANUSCRIPT_WRITE:     (ProjectState.DRAFT_READY,         "Entwurf fertig"),
    TaskType.ILLUSTRATIONS_CREATE: (ProjectState.ILLUSTRATIONS_READY, "Illustrationen erstellt"),
    TaskType.LAYOUT_CREATE:        (ProjectState.LAYOUT_READY,        "Layout fertig"),
    TaskType.PUBLISH_PREPARE:      (ProjectState.PUBLISH_READY,       "Publishing-Paket fertig"),
}

# Gate-Name -> naechster State bei PASS
GATE_PASS = {
    "SCOPE_GATE":        ProjectState.OUTLINE_APPROVED,
    "MANUSCRIPT_GATE":   ProjectState.DRAFT_APPROVED,
    "ILLUSTRATION_GATE": ProjectState.ILLUSTRATIONS_APPROVED,
    "LAYOUT_GATE":       ProjectState.LAYOUT_APPROVED,
    "PUBLISH_GATE":      ProjectState.PUBLISH_APPROVED,
}

# Gate-Name -> naechster State bei FAIL
GATE_FAIL = {
    "SCOPE_GATE":        ProjectState.REWORK_SCOPE,
    "MANUSCRIPT_GATE":   ProjectState.REWORK_DRAFT,
    "ILLUSTRATION_GATE": ProjectState.REWORK_ILLUSTRATIONS,
    "LAYOUT_GATE":       ProjectState.REWORK_LAYOUT,
    "PUBLISH_GATE":      ProjectState.REWORK_PUBLISH,
}

# State -> Gate-Task-Konfiguration nach Worker-Task
GATE_TASK_CFG = {
    ProjectState.SCOPE_DEFINED: {
        "gate": "SCOPE_GATE", "qa": "quality-product",
        "artifact": "02_scope/scope.json",
        "report": "qc_reports/scope_gate_qc_report.json",
    },
    ProjectState.DRAFT_READY: {
        "gate": "MANUSCRIPT_GATE", "qa": "quality-product",
        "artifact": "04_manuscript/manuscript.json",
        "report": "qc_reports/manuscript_gate_qc_report.json",
    },
    ProjectState.ILLUSTRATIONS_READY: {
        "gate": "ILLUSTRATION_GATE", "qa": "quality-product",
        "artifact": "05_illustrations/illustrations.json",
        "report": "qc_reports/illustration_gate_qc_report.json",
    },
    ProjectState.LAYOUT_READY: {
        "gate": "LAYOUT_GATE", "qa": "quality-tech",
        "artifact": "06_layout/",
        "report": "qc_reports/layout_gate_qc_report.json",
    },
    ProjectState.PUBLISH_READY: {
        "gate": "PUBLISH_GATE", "qa": "quality-global",
        "artifact": "07_publish/publishing_package.json",
        "report": "qc_reports/publish_gate_qc_report.json",
    },
}

# Rework-Target -> Gate-Task-Konfiguration
REWORK_GATE_CFG = {
    "scope.json":         ("SCOPE_GATE",        "quality-product",
                           "02_scope/scope.json",
                           "qc_reports/scope_gate_qc_report.json"),
    "manuscript.json":    ("MANUSCRIPT_GATE",   "quality-product",
                           "04_manuscript/manuscript.json",
                           "qc_reports/manuscript_gate_qc_report.json"),
    "illustrations.json": ("ILLUSTRATION_GATE", "quality-product",
                           "05_illustrations/illustrations.json",
                           "qc_reports/illustration_gate_qc_report.json"),
    "layout":             ("LAYOUT_GATE",        "quality-tech",
                           "06_layout/",
                           "qc_reports/layout_gate_qc_report.json"),
}

# State -> naechster Task nach CEO-Freigabe
APPROVAL_NEXT_TASK = {
    ProjectState.SCOPE_DEFINED: {
        "type": TaskType.OUTLINE_CREATE, "owner": "product-worker",
        "in": ["02_scope/scope.json"],
        "out": ["03_outline/outline.json"],
        "criteria": ["outline.json ist schema-valide",
                     "mindestens 1 Kapitel vorhanden",
                     "narrative_arc vollstaendig ausgefuellt"],
    },
    ProjectState.OUTLINE_APPROVED: {
        "type": TaskType.MANUSCRIPT_WRITE, "owner": "product-worker",
        "in": ["03_outline/outline.json"],
        "out": ["04_manuscript/manuscript.json"],
        "criteria": ["manuscript.json ist schema-valide",
                     "quality_score >= 85",
                     "alle Seiten haben text und image_prompt_en"],
    },
    ProjectState.DRAFT_APPROVED: {
        "type": TaskType.ILLUSTRATIONS_CREATE, "owner": "product-worker",
        "in": ["04_manuscript/manuscript.json"],
        "out": ["05_illustrations/illustrations.json"],
        "criteria": ["illustrations.json ist schema-valide",
                     "alle Manuskript-Seiten haben eine Illustration"],
    },
    ProjectState.ILLUSTRATIONS_APPROVED: {
        "type": TaskType.LAYOUT_CREATE, "owner": "tech-worker",
        "in": ["04_manuscript/manuscript.json"],
        "out": ["06_layout/manuscript.md", "06_layout/canva_package.json"],
        "criteria": ["manuscript.md vorhanden",
                     "canva_package.json vorhanden und nicht leer"],
    },
    ProjectState.LAYOUT_APPROVED: {
        "type": TaskType.PUBLISH_PREPARE, "owner": "tech-worker",
        "in": ["04_manuscript/manuscript.json"],
        "out": ["07_publish/publishing_package.json"],
        "criteria": ["publishing_package.json ist schema-valide",
                     "mindestens eine Plattform-Konfiguration vorhanden"],
    },
}


# ─── Task-Verarbeitung ───────────────────────────────────────────────────────

def process_completed_tasks(project_dir: Path) -> None:
    """
    Verarbeitet abgeschlossene Tasks eines Projekts.
    Verwendet Transition-Lock fuer Serialisierung.
    """
    tasks_dir = project_dir / "tasks"
    if not tasks_dir.exists():
        return
    repo = TaskRepository(tasks_dir)
    for task in repo.find_by_status(TaskStatus.COMPLETED):
        lock_id = acquire_transition_lock(project_dir)
        if lock_id is None:
            LOG.debug("Transition-Lock aktiv, ueberspringe",
                      project_id=project_dir.name, task_id=task.task_id)
            continue
        try:
            _handle_completed_task(task, project_dir, repo)
        finally:
            release_transition_lock(project_dir, lock_id)


def _handle_completed_task(task: Task, project_dir: Path, repo: TaskRepository) -> None:
    project_id = project_dir.name
    sm = ProjectStateManager(project_dir)
    state = sm.get()
    if not state:
        return

    current = ProjectState(state["status"])
    run_id = state.get("run_id", "")
    pid = project_id
    task_type = TaskType(task.task_type) if isinstance(task.task_type, str) else task.task_type

    # ── Worker-Task abgeschlossen ────────────────────────────────────────────
    if task_type in TASK_TO_STATE:
        new_state, reason = TASK_TO_STATE[task_type]
        _do_transition(sm, task, current, new_state, reason, pid, run_id)
        _mark_done(task, project_dir / "tasks")

        # Gate-Task anlegen falls benoetigt
        if new_state in GATE_TASK_CFG:
            cfg = GATE_TASK_CFG[new_state]
            artifact = f"projects/{pid}/{cfg['artifact']}"
            report = f"projects/{pid}/{cfg['report']}"
            _create_gate_task(pid, run_id, cfg["gate"], cfg["qa"],
                              artifact, report, project_dir)

    # ── QA-Gate-Check abgeschlossen ──────────────────────────────────────────
    elif task_type == TaskType.QC_GATE_CHECK:
        _handle_gate_result(task, project_dir, sm, current, run_id)
        _mark_done(task, project_dir / "tasks")

    # ── Rework abgeschlossen ─────────────────────────────────────────────────
    elif task_type == TaskType.REWORK:
        rt = task.metadata.get("rework_target", "scope.json")
        cfg = REWORK_GATE_CFG.get(rt, REWORK_GATE_CFG["scope.json"])
        gate, qa_svc, artifact_rel, report_rel = cfg
        artifact = f"projects/{pid}/{artifact_rel}"
        report = f"projects/{pid}/{report_rel}"
        _create_gate_task(pid, run_id, gate, qa_svc, artifact, report, project_dir)
        _mark_done(task, project_dir / "tasks")


def _create_gate_task(
    pid: str, run_id: str, gate: str, qa_svc: str,
    artifact: str, report: str, project_dir: Path,
) -> None:
    """Erstellt Gate-Task, sofern noch keiner aktiv ist (Idempotenz)."""
    tasks_dir = project_dir / "tasks"
    if tasks_dir.exists():
        for f in tasks_dir.glob("*.json"):
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
                if (d.get("task_type") == TaskType.QC_GATE_CHECK.value
                        and d.get("metadata", {}).get("gate_name") == gate
                        and d.get("status") in (TaskStatus.PENDING.value,
                                                 TaskStatus.IN_PROGRESS.value)):
                    return  # Bereits aktiver Gate-Task
            except (json.JSONDecodeError, OSError):
                continue
    create_task(
        pid, run_id, TaskType.QC_GATE_CHECK, qa_svc,
        input_artifacts=[artifact], output_artifacts=[report],
        acceptance_criteria=[f"QC-Report fuer {gate} ist valide",
                             "status ist PASS oder FAIL"],
        priority=2, metadata={"gate_name": gate},
    )


def _handle_gate_result(
    task: Task, project_dir: Path,
    sm: ProjectStateManager, current: ProjectState, run_id: str,
) -> None:
    """Wertet QC-Gate-Report aus und loest Transition oder Rework aus."""
    project_id = project_dir.name
    state = sm.get() or {}

    if not task.output_artifacts:
        LOG.error("Gate-Task ohne output_artifacts", project_id=project_id)
        return

    report_path = WORKSPACE_DIR / task.output_artifacts[0]
    if not report_path.exists():
        LOG.error(f"QC-Report fehlt: {report_path}", project_id=project_id)
        return

    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        LOG.error(f"QC-Report ungueltig: {exc}", project_id=project_id)
        return

    gate_name = report.get("gate_name", task.metadata.get("gate_name", ""))
    qc_status = report.get("status", "FAIL")

    if qc_status == "PASS":
        new_state = GATE_PASS.get(gate_name)
        if new_state:
            _do_transition(sm, task, current, new_state,
                           f"Gate {gate_name} PASS", project_id, run_id)
            _update_metric(project_id, run_id, "jobs_processed")
            # CEO-Approval anfordern falls State es benoetigt
            if new_state in CEO_APPROVAL_REQUIRED:
                create_approval_request(project_id, new_state, run_id)
    else:
        rework_state = GATE_FAIL.get(gate_name)
        if not rework_state:
            LOG.error(f"Unbekanntes Gate: {gate_name}", project_id=project_id)
            return

        rework_count = state.get("rework_counts", {}).get(rework_state.value, 0)
        if rework_count >= MAX_REWORK_CYCLES:
            # Max Rework erreicht -> Dead Letter
            _do_transition(sm, task, current, ProjectState.DEAD_LETTER,
                           f"Max Rework-Zyklen ({MAX_REWORK_CYCLES}) fuer {gate_name} erreicht",
                           project_id, run_id)
            _update_metric(project_id, run_id, "jobs_failed")
        else:
            _do_transition(sm, task, current, rework_state,
                           f"Gate {gate_name} FAIL – Rework #{rework_count + 1}",
                           project_id, run_id)
            _update_metric(project_id, run_id, "gate_failures")

            # Rework-Task erstellen
            rt_map = {
                "SCOPE_GATE":        "scope.json",
                "MANUSCRIPT_GATE":   "manuscript.json",
                "ILLUSTRATION_GATE": "illustrations.json",
                "LAYOUT_GATE":       "layout",
                "PUBLISH_GATE":      "publish",
            }
            artifact_map = {
                "scope.json":         f"projects/{project_id}/02_scope/scope.json",
                "manuscript.json":    f"projects/{project_id}/04_manuscript/manuscript.json",
                "illustrations.json": f"projects/{project_id}/05_illustrations/illustrations.json",
                "layout":             f"projects/{project_id}/06_layout/",
                "publish":            f"projects/{project_id}/07_publish/publishing_package.json",
            }
            rt = rt_map.get(gate_name, "scope.json")
            artifact = artifact_map.get(rt, "")
            fix_tasks = report.get("fix_tasks", [])
            criteria = [ft["description"] for ft in fix_tasks] if fix_tasks else ["Artefakt ueberarbeiten"]
            report_rel = str(report_path.relative_to(WORKSPACE_DIR))
            create_task(
                project_id, run_id, TaskType.REWORK, "product-worker",
                input_artifacts=[report_rel, artifact],
                output_artifacts=[artifact],
                acceptance_criteria=criteria, priority=1,
                metadata={"rework_target": rt, "gate_name": gate_name},
            )


def _do_transition(
    sm: ProjectStateManager, task: Task,
    from_state: ProjectState, to_state: ProjectState,
    reason: str, project_id: str, run_id: str,
) -> None:
    try:
        sm.transition(to_state, reason=reason)
        log_decision(project_id, run_id, "STATE_TRANSITION", {
            "from": from_state.value, "to": to_state.value,
            "reason": reason, "task_id": task.task_id,
        })
        LOG.info(f"Transition: {from_state.value} -> {to_state.value}",
                 project_id=project_id, run_id=run_id, event="STATE_TRANSITION")
    except IllegalTransitionError as exc:
        LOG.error(f"Illegale Transition abgewiesen: {exc}", project_id=project_id)


def _mark_done(task: Task, tasks_dir: Path) -> None:
    """Benennt verarbeitete Task-Datei von .json zu .done.json um."""
    src = tasks_dir / f"{task.task_id}.json"
    dst = tasks_dir / f"{task.task_id}.done.json"
    if src.exists() and not dst.exists():
        src.rename(dst)


# ─── CEO-Approval Wartelogik ──────────────────────────────────────────────────

def check_approval_states() -> None:
    """
    Prueft alle Projekte die auf CEO-Freigabe warten.
    Erstellt naechsten Task sobald Freigabe vorliegt.
    """
    base = projects_dir()
    if not base.exists():
        return

    for project_dir in base.iterdir():
        if not project_dir.is_dir() or project_dir.name.startswith("_"):
            continue
        sf = project_dir / "state.json"
        if not sf.exists():
            continue
        try:
            state = json.loads(sf.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        try:
            current = ProjectState(state.get("status", ""))
        except ValueError:
            continue

        if current not in CEO_APPROVAL_REQUIRED:
            continue

        project_id = project_dir.name
        run_id = state.get("run_id", "")

        if not check_ceo_approval(project_id, current):
            continue  # Noch keine Freigabe

        # Pruefe ob bereits ein aktiver Task fuer diesen State existiert
        tasks_dir = project_dir / "tasks"
        if tasks_dir.exists():
            has_active = any(
                json.loads(f.read_text(encoding="utf-8")).get("status") in (
                    TaskStatus.PENDING.value, TaskStatus.IN_PROGRESS.value
                )
                for f in tasks_dir.glob("*.json")
                if _safe_json_exists(f)
            )
            if has_active:
                continue

        LOG.info(f"CEO-Approval erhalten fuer {current.value}",
                 project_id=project_id, run_id=run_id, event="APPROVAL_RECEIVED")
        log_decision(project_id, run_id, "CEO_APPROVAL_RECEIVED",
                     {"state": current.value})

        if current == ProjectState.PUBLISH_APPROVED:
            _handle_final_approval(project_id, run_id, project_dir)
            continue

        cfg = APPROVAL_NEXT_TASK.get(current)
        if not cfg:
            continue

        in_arts = [f"projects/{project_id}/{i}" for i in cfg["in"]]
        out_arts = [f"projects/{project_id}/{o}" for o in cfg["out"]]
        create_task(project_id, run_id, cfg["type"], cfg["owner"],
                    in_arts, out_arts, cfg["criteria"], priority=2)
        _mark_approval_processed(project_id, current)


def _safe_json_exists(f: Path) -> bool:
    """Prueft ob eine JSON-Datei lesbar ist."""
    try:
        json.loads(f.read_text(encoding="utf-8"))
        return True
    except (json.JSONDecodeError, OSError):
        return False


def _handle_final_approval(project_id: str, run_id: str, project_dir: Path) -> None:
    """Verarbeitet die finale CEO-Freigabe (PUBLISH_APPROVED -> PUBLISHED)."""
    sm = ProjectStateManager(project_dir)
    try:
        sm.transition(ProjectState.PUBLISHED,
                      reason="CEO hat Veroeffentlichung freigegeben")
        _update_metric(project_id, run_id, "jobs_processed")
        _finalize_metrics(project_id, run_id)
        # Marketing und Customer asynchron anlaufen lassen
        for tt, owner, arts_in, arts_out, crit in [
            (TaskType.CAMPAIGN_CREATE, "marketing-worker",
             [f"projects/{project_id}/02_scope/scope.json"],
             [f"projects/{project_id}/marketing/campaign.json"],
             ["campaign.json vollstaendig und valide"]),
            (TaskType.SUPPORT_REVIEW, "customer-worker",
             [f"projects/{project_id}/02_scope/scope.json"],
             [f"projects/{project_id}/customer/support_docs.json"],
             ["support_docs.json vollstaendig und valide"]),
        ]:
            create_task(project_id, run_id, tt, owner,
                        arts_in, arts_out, crit, priority=5)
        LOG.info("Projekt PUBLISHED!", project_id=project_id,
                 run_id=run_id, event="PROJECT_PUBLISHED")
    except IllegalTransitionError as exc:
        LOG.error(str(exc), project_id=project_id)
    _mark_approval_processed(project_id, ProjectState.PUBLISH_APPROVED)


def _mark_approval_processed(project_id: str, state: ProjectState) -> None:
    """Markiert eine Approval-Request als verarbeitet."""
    req = (projects_dir() / project_id / "approvals"
           / f"{state.value}_request.json")
    if req.exists():
        req.rename(req.with_suffix(".processed.json"))


# ─── Metrics ─────────────────────────────────────────────────────────────────

def _update_metric(project_id: str, run_id: str, field: Optional[str]) -> None:
    """Inkrementiert ein Metrik-Feld in metrics.json des laufenden Runs."""
    if not run_id or not field:
        return
    mf = projects_dir() / project_id / "runs" / run_id / "metrics.json"
    if not mf.exists():
        return
    try:
        m = json.loads(mf.read_text(encoding="utf-8"))
        m[field] = m.get(field, 0) + 1
        mf.write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding="utf-8")
    except (json.JSONDecodeError, OSError):
        pass


def _finalize_metrics(project_id: str, run_id: str) -> None:
    """Schliesst Metriken ab (execution_time, finished_at)."""
    mf = projects_dir() / project_id / "runs" / run_id / "metrics.json"
    if not mf.exists():
        return
    try:
        m = json.loads(mf.read_text(encoding="utf-8"))
        m["finished_at"] = now_iso()
        started = m.get("started_at")
        if started:
            elapsed = (datetime.now(timezone.utc) -
                       datetime.fromisoformat(started)).total_seconds()
            m["execution_time_s"] = round(elapsed, 1)
        mf.write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding="utf-8")
    except (json.JSONDecodeError, OSError, ValueError):
        pass


# ─── Failed Task Handling ─────────────────────────────────────────────────────

def handle_failed_tasks() -> None:
    """Prueft fehlgeschlagene Tasks und loest Retry oder Dead Letter aus."""
    base = projects_dir()
    if not base.exists():
        return

    for project_dir in base.iterdir():
        if not project_dir.is_dir() or project_dir.name.startswith("_"):
            continue
        tasks_dir = project_dir / "tasks"
        if not tasks_dir.exists():
            continue

        repo = TaskRepository(tasks_dir)
        sf = project_dir / "state.json"
        run_id = ""
        try:
            run_id = json.loads(sf.read_text(encoding="utf-8")).get("run_id", "")
        except (json.JSONDecodeError, OSError):
            pass

        for task in repo.find_by_status(TaskStatus.FAILED):
            if task.can_retry:
                # Zurueck auf PENDING setzen fuer Retry
                task.status = TaskStatus.PENDING
                repo.save(task)
                LOG.warning(f"Task Retry #{task.retry_count}: {task.task_type}",
                            project_id=project_dir.name, task_id=task.task_id,
                            event="TASK_RETRY")
                log_event(project_dir.name, run_id, "TASK_RETRY", {
                    "task_id": task.task_id, "retry_count": task.retry_count,
                    "task_type": task.task_type if isinstance(task.task_type, str)
                    else task.task_type.value,
                })
            else:
                repo.move_to_dead_letter(task, project_dir)
                LOG.error(f"Task -> Dead Letter: {task.task_type}",
                          project_id=project_dir.name, task_id=task.task_id,
                          event="TASK_DEAD_LETTER")
                _update_metric(project_dir.name, run_id, "jobs_failed")


# ─── Hauptschleife ────────────────────────────────────────────────────────────

def main() -> None:
    LOG.info("Orchestrator gestartet", event="SERVICE_START")
    base = projects_dir()
    base.mkdir(parents=True, exist_ok=True)

    while True:
        try:
            # 1. Neue Projekte starten
            for project_dir in find_new_projects():
                start_project(project_dir)

            # 2. Abgeschlossene Tasks verarbeiten (mit Transition-Lock)
            for project_dir in base.iterdir():
                if project_dir.is_dir() and not project_dir.name.startswith("_"):
                    process_completed_tasks(project_dir)

            # 3. CEO-Approvals pruefen und naechste Tasks anlegen
            check_approval_states()

            # 4. Fehlgeschlagene Tasks retryen oder in Dead Letter
            handle_failed_tasks()

        except Exception as exc:
            LOG.error(f"Orchestrator Hauptschleife Fehler: {exc}", event="ERROR")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
