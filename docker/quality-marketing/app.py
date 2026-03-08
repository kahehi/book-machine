#!/usr/bin/env python3
"""Quality Marketing Agent – Campaign Gate Pruefung."""
import json, os, sys, time, uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "/company/lib")
from logger import StructuredLogger
from task import Task, TaskStatus, TaskRepository

WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace"))
SERVICE_NAME = "quality-marketing"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
LOG = StructuredLogger(SERVICE_NAME)


def check_campaign_gate(task: Task) -> dict:
    artifact_path = WORKSPACE_DIR / task.input_artifacts[0]
    failed_rules = []

    if not artifact_path.exists():
        failed_rules.append({"rule_id": "C001", "rule_name": "Artefakt vorhanden",
                              "severity": "BLOCKER", "description": "campaign.json nicht gefunden", "evidence": ""})
        status = "FAIL"
    else:
        campaign = json.loads(artifact_path.read_text(encoding="utf-8"))

        # C001: Pflichtfelder
        required = ["title", "tagline", "target_channels", "ad_copy"]
        missing = [f for f in required if not campaign.get(f)]
        if missing:
            failed_rules.append({"rule_id": "C002", "rule_name": "Pflichtfelder",
                                  "severity": "BLOCKER", "description": f"Fehlend: {missing}", "evidence": str(missing)})

        # C002: Keine falschen Gesundheitsversprechen
        forbidden = ["heilt", "kuriert", "medizinisch bewiesen", "garantiert"]
        ad_copy = json.dumps(campaign.get("ad_copy", {})).lower()
        found = [t for t in forbidden if t in ad_copy]
        if found:
            failed_rules.append({"rule_id": "C003", "rule_name": "Keine falschen Versprechen",
                                  "severity": "BLOCKER", "description": f"Verbotene Begriffe: {found}", "evidence": str(found)})

        status = "PASS" if not any(r["severity"] in ("BLOCKER", "MAJOR") for r in failed_rules) else "FAIL"

    return {
        "report_id": str(uuid.uuid4()), "task_id": task.task_id, "project_id": task.project_id,
        "run_id": task.run_id, "gate_name": "CAMPAIGN_GATE", "reviewer_service": SERVICE_NAME,
        "artifact_reviewed": task.input_artifacts[0] if task.input_artifacts else "",
        "status": status, "failed_rules": failed_rules, "failed_checks": [],
        "compliance_flags": [], "fix_tasks": [], "improvements": [],
        "evidence": {"schema_valid": len(failed_rules) == 0},
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
        report = check_campaign_gate(task)
        report_path = WORKSPACE_DIR / task.output_artifacts[0]
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        task.mark_completed()
        repo.save(task)
        LOG.info(f"Campaign Gate: {report['status']}", project_id=project_id, task_id=task.task_id)
    except Exception as exc:
        LOG.error(f"Quality Marketing Fehler: {exc}", project_id=project_id)
        task.mark_failed(str(exc))
        repo.save(task)


def main() -> None:
    LOG.info("Quality Marketing gestartet", event="SERVICE_START")
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
            LOG.error(f"Quality Marketing Fehler: {exc}", event="ERROR")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
