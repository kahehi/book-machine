#!/usr/bin/env python3
"""Quality Customer Agent – Support Quality Gate Pruefung."""
import json, os, sys, time, uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "/company/lib")
from logger import StructuredLogger
from task import Task, TaskStatus, TaskRepository

WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace"))
SERVICE_NAME = "quality-customer"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
LOG = StructuredLogger(SERVICE_NAME)


def check_support_quality_gate(task: Task) -> dict:
    project_id = task.project_id
    customer_dir = WORKSPACE_DIR / f"projects/{project_id}/customer"
    failed_rules = []

    if not customer_dir.exists() or not (customer_dir / "support_docs.json").exists():
        failed_rules.append({"rule_id": "S001", "rule_name": "Support Docs vorhanden",
                              "severity": "BLOCKER", "description": "support_docs.json nicht gefunden", "evidence": ""})
    else:
        docs = json.loads((customer_dir / "support_docs.json").read_text(encoding="utf-8"))

        # S001: FAQ vorhanden
        if not docs.get("faq") or len(docs["faq"]) == 0:
            failed_rules.append({"rule_id": "S002", "rule_name": "FAQ vorhanden",
                                  "severity": "MAJOR", "description": "FAQ leer oder fehlend", "evidence": ""})

        # S002: Keine personenbezogenen Daten
        forbidden_data = ["email", "adresse", "telefon", "name"]
        doc_str = json.dumps(docs, ensure_ascii=False).lower()
        for field in ["customer_name", "user_email", "phone_number"]:
            if field in doc_str:
                failed_rules.append({"rule_id": "S003", "rule_name": "Keine personenbezogenen Daten",
                                      "severity": "BLOCKER", "description": f"Personenbezogenes Feld gefunden: {field}", "evidence": field})

    status = "PASS" if not any(r["severity"] in ("BLOCKER", "MAJOR") for r in failed_rules) else "FAIL"
    return {
        "report_id": str(uuid.uuid4()), "task_id": task.task_id, "project_id": project_id,
        "run_id": task.run_id, "gate_name": "SUPPORT_QUALITY_GATE", "reviewer_service": SERVICE_NAME,
        "artifact_reviewed": f"projects/{project_id}/customer/support_docs.json",
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
        report = check_support_quality_gate(task)
        report_path = WORKSPACE_DIR / task.output_artifacts[0]
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        task.mark_completed()
        repo.save(task)
        LOG.info(f"Support Quality Gate: {report['status']}", project_id=project_id, task_id=task.task_id)
    except Exception as exc:
        LOG.error(f"Quality Customer Fehler: {exc}", project_id=project_id)
        task.mark_failed(str(exc))
        repo.save(task)


def main() -> None:
    LOG.info("Quality Customer gestartet", event="SERVICE_START")
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
            LOG.error(f"Quality Customer Fehler: {exc}", event="ERROR")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
