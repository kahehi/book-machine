#!/usr/bin/env python3
"""Quality Tech Agent – Layout Gate und Release Gate Pruefungen."""
import json, os, sys, time, uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "/company/lib")
from logger import StructuredLogger
from task import Task, TaskStatus, TaskRepository

WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace"))
SERVICE_NAME = "quality-tech"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
LOG = StructuredLogger(SERVICE_NAME)


def check_layout_gate(task: Task) -> dict:
    project_id = task.project_id
    layout_dir = WORKSPACE_DIR / f"projects/{project_id}/06_layout"
    failed_rules = []

    # T001: Layout-Verzeichnis vorhanden
    if not layout_dir.exists():
        failed_rules.append({"rule_id": "T001", "rule_name": "Layout-Verzeichnis",
                              "severity": "BLOCKER", "description": "06_layout Verzeichnis nicht vorhanden", "evidence": ""})
    else:
        # T002: manuscript.md vorhanden
        if not (layout_dir / "manuscript.md").exists():
            failed_rules.append({"rule_id": "T002", "rule_name": "manuscript.md",
                                  "severity": "BLOCKER", "description": "manuscript.md nicht gefunden", "evidence": ""})

        # T003: canva_package.json vorhanden
        if not (layout_dir / "canva_package.json").exists():
            failed_rules.append({"rule_id": "T003", "rule_name": "canva_package.json",
                                  "severity": "MAJOR", "description": "canva_package.json nicht gefunden", "evidence": ""})
        else:
            canva = json.loads((layout_dir / "canva_package.json").read_text(encoding="utf-8"))
            if not canva.get("slides"):
                failed_rules.append({"rule_id": "T004", "rule_name": "Canva Slides",
                                      "severity": "MAJOR", "description": "Keine Slides in canva_package.json", "evidence": ""})

    status = "PASS" if not any(r["severity"] in ("BLOCKER", "MAJOR") for r in failed_rules) else "FAIL"
    return {
        "report_id": str(uuid.uuid4()), "task_id": task.task_id, "project_id": project_id,
        "run_id": task.run_id, "gate_name": "LAYOUT_GATE", "reviewer_service": SERVICE_NAME,
        "artifact_reviewed": f"projects/{project_id}/06_layout/",
        "status": status, "failed_rules": failed_rules, "failed_checks": [],
        "compliance_flags": [], "fix_tasks": [], "improvements": [],
        "evidence": {"schema_valid": status == "PASS"},
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
        gate_name = task.metadata.get("gate_name", "LAYOUT_GATE")
        if gate_name == "LAYOUT_GATE":
            report = check_layout_gate(task)
        else:
            raise ValueError(f"Unbekanntes Gate: {gate_name}")

        report_path = WORKSPACE_DIR / task.output_artifacts[0]
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        task.mark_completed()
        repo.save(task)
        LOG.info(f"{gate_name}: {report['status']}", project_id=project_id, task_id=task.task_id)
    except Exception as exc:
        LOG.error(f"Quality Tech Fehler: {exc}", project_id=project_id)
        task.mark_failed(str(exc))
        repo.save(task)


def main() -> None:
    LOG.info("Quality Tech gestartet", event="SERVICE_START")
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
            LOG.error(f"Quality Tech Fehler: {exc}", event="ERROR")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
