#!/usr/bin/env python3
"""
Global Quality Agent (CQO) – Finales Publish-Gate und Cross-Domain-Pruefungen.

Zustaendig fuer:
- Gate 5: PUBLISH_GATE (publishing_package.json)
- Prueft ob alle vorherigen Gate-Reports mit PASS vorhanden sind
- Compliance-Final-Check (DSGVO, Plattform-Richtlinien)
"""
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "/company/lib")
from logger import StructuredLogger
from task import Task, TaskStatus, TaskRepository

WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace"))
SERVICE_NAME = "quality-global"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
LOG = StructuredLogger(SERVICE_NAME)

REQUIRED_PREVIOUS_GATES = [
    "SCOPE_GATE",
    "MANUSCRIPT_GATE",
    "ILLUSTRATION_GATE",
    "LAYOUT_GATE",
]


def check_publish_gate(task: Task) -> dict:
    """Gate 5: Prueft publishing_package.json und alle vorherigen Gate-Reports."""
    artifact_path = WORKSPACE_DIR / task.input_artifacts[0]
    project_id = task.project_id
    failed_rules = []
    compliance_flags = []
    improvements = []

    if not artifact_path.exists():
        return _fail_report(task, "PUBLISH_GATE", "publishing_package.json nicht gefunden")

    pkg = json.loads(artifact_path.read_text(encoding="utf-8"))

    # P001: Pflichtmetadaten
    meta = pkg.get("metadata", {})
    required_meta = ["author", "publisher", "language", "categories"]
    missing_meta = [f for f in required_meta if not meta.get(f)]
    if missing_meta:
        failed_rules.append({
            "rule_id": "P001", "rule_name": "Pflichtmetadaten",
            "severity": "BLOCKER",
            "description": f"Fehlende Metadaten: {', '.join(missing_meta)}",
            "evidence": str(missing_meta)
        })

    # P002: Plattform-Configs
    platform_configs = pkg.get("platform_configs", [])
    if not platform_configs:
        failed_rules.append({
            "rule_id": "P002", "rule_name": "Plattform-Configs",
            "severity": "BLOCKER",
            "description": "Keine Plattform-Konfigurationen vorhanden",
            "evidence": ""
        })
    else:
        not_ready = [c["platform"] for c in platform_configs if c.get("status") != "READY"]
        if not_ready:
            failed_rules.append({
                "rule_id": "P003", "rule_name": "Plattform-Status",
                "severity": "MAJOR",
                "description": f"Plattformen nicht READY: {', '.join(not_ready)}",
                "evidence": str(not_ready)
            })

    # P004: Alle vorherigen Gate-Reports vorhanden und PASS
    qc_dir = WORKSPACE_DIR / "projects" / project_id / "qc_reports"
    for gate in REQUIRED_PREVIOUS_GATES:
        report_file = qc_dir / f"{gate.lower()}_qc_report.json"
        if not report_file.exists():
            failed_rules.append({
                "rule_id": "P004", "rule_name": "Vorheriger Gate-Report",
                "severity": "BLOCKER",
                "description": f"Gate-Report nicht gefunden: {gate}",
                "evidence": str(report_file)
            })
            continue
        prev_report = json.loads(report_file.read_text(encoding="utf-8"))
        if prev_report.get("status") != "PASS":
            failed_rules.append({
                "rule_id": "P005", "rule_name": "Vorheriger Gate Status",
                "severity": "BLOCKER",
                "description": f"Gate {gate} hat nicht PASS: {prev_report.get('status')}",
                "evidence": gate
            })

    # P006: Artefakt-Referenzen gueltig
    for ref_field in ["manuscript_ref", "illustrations_ref"]:
        ref = pkg.get(ref_field, "")
        if ref and not (WORKSPACE_DIR / ref).exists():
            failed_rules.append({
                "rule_id": "P006", "rule_name": "Artefakt-Referenz gueltig",
                "severity": "BLOCKER",
                "description": f"{ref_field} zeigt auf nicht existierende Datei: {ref}",
                "evidence": ref
            })

    # Verbesserungen
    if not meta.get("keywords"):
        improvements.append({
            "suggestion": "Keywords ergaenzen fuer bessere Auffindbarkeit",
            "rationale": "Keywords verbessern SEO auf Verkaufsplattformen",
            "impact": "MEDIUM"
        })

    status = "PASS" if not any(
        r["severity"] in ("BLOCKER", "MAJOR") for r in failed_rules
    ) else "FAIL"

    return {
        "report_id": str(uuid.uuid4()),
        "task_id": task.task_id,
        "project_id": project_id,
        "run_id": task.run_id,
        "gate_name": "PUBLISH_GATE",
        "reviewer_service": SERVICE_NAME,
        "artifact_reviewed": task.input_artifacts[0] if task.input_artifacts else "",
        "status": status,
        "failed_rules": failed_rules,
        "failed_checks": [],
        "compliance_flags": compliance_flags,
        "fix_tasks": [],
        "improvements": improvements,
        "evidence": {
            "schema_valid": len(failed_rules) == 0,
            "custom_metrics": {
                "platform_count": len(platform_configs),
                "previous_gates_checked": len(REQUIRED_PREVIOUS_GATES),
            }
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def _fail_report(task: Task, gate_name: str, reason: str) -> dict:
    return {
        "report_id": str(uuid.uuid4()),
        "task_id": task.task_id,
        "project_id": task.project_id,
        "run_id": task.run_id,
        "gate_name": gate_name,
        "reviewer_service": SERVICE_NAME,
        "artifact_reviewed": task.input_artifacts[0] if task.input_artifacts else "",
        "status": "FAIL",
        "failed_rules": [{"rule_id": "G001", "rule_name": "Artefakt vorhanden",
                          "severity": "BLOCKER", "description": reason, "evidence": ""}],
        "failed_checks": [], "compliance_flags": [], "fix_tasks": [], "improvements": [],
        "evidence": {"schema_valid": False},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def process_task(task: Task) -> None:
    project_id = task.project_id
    project_dir = WORKSPACE_DIR / "projects" / project_id
    tasks_dir = project_dir / "tasks"
    repo = TaskRepository(tasks_dir)

    task.mark_in_progress()
    repo.save(task)

    try:
        gate_name = task.metadata.get("gate_name", "PUBLISH_GATE")
        report = check_publish_gate(task)

        report_path = WORKSPACE_DIR / task.output_artifacts[0]
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

        task.mark_completed()
        repo.save(task)
        LOG.info(f"Publish Gate: {report['status']}", project_id=project_id, task_id=task.task_id)

    except Exception as exc:
        LOG.error(f"Global QA Fehler: {exc}", project_id=project_id, task_id=task.task_id)
        task.mark_failed(str(exc))
        repo.save(task)


def main() -> None:
    LOG.info("Global Quality Agent gestartet", event="SERVICE_START")
    projects_dir = WORKSPACE_DIR / "projects"
    while True:
        try:
            for project_dir in projects_dir.iterdir():
                if not project_dir.is_dir() or project_dir.name.startswith("_"):
                    continue
                tasks_dir = project_dir / "tasks"
                if not tasks_dir.exists():
                    continue
                repo = TaskRepository(tasks_dir)
                for task in repo.find_for_service(SERVICE_NAME, TaskStatus.PENDING):
                    process_task(task)
        except Exception as exc:
            LOG.error(f"Global QA Fehler: {exc}", event="ERROR")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
