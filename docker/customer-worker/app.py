#!/usr/bin/env python3
"""Customer Worker Agent – Support-Dokumentation und Kundenmaterialien."""
import json, os, sys, time, uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "/company/lib")
from logger import StructuredLogger
from lock import LockManager, ManagedLock
from task import Task, TaskStatus, TaskType, TaskRepository

WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace"))
SERVICE_NAME = "customer-worker"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
LOG = StructuredLogger(SERVICE_NAME)


def handle_support_review(task: Task, project_dir: Path) -> None:
    project_id = task.project_id
    scope_path = WORKSPACE_DIR / f"projects/{project_id}/02_scope/scope.json"
    scope = json.loads(scope_path.read_text(encoding="utf-8")) if scope_path.exists() else {}

    title = scope.get("title", "Das Buch")
    support_data = {
        "project_id": project_id,
        "run_id": task.run_id,
        "title": title,
        "faq": [
            {"question": f"Fuer welches Alter ist '{title}' geeignet?",
             "answer": f"Das Buch richtet sich an Kinder von {scope.get('target_audience', {}).get('age_min', 4)}-{scope.get('target_audience', {}).get('age_max', 7)} Jahren."},
            {"question": "In welchen Formaten ist das Buch erhaeltlich?",
             "answer": "Das Buch ist als E-Book und als Printversion erhaeltlich."},
        ],
        "support_contact": "support@micro-firma.de",
        "return_policy": "Digitale Produkte koennen nicht zurueckgegeben werden.",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": SERVICE_NAME,
    }

    customer_dir = WORKSPACE_DIR / f"projects/{project_id}/customer"
    lock_manager = LockManager(project_dir, SERVICE_NAME)
    with ManagedLock(lock_manager, "customer/support_docs.json"):
        customer_dir.mkdir(parents=True, exist_ok=True)
        (customer_dir / "support_docs.json").write_text(
            json.dumps(support_data, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    LOG.info("support_docs.json geschrieben", project_id=project_id, task_id=task.task_id)


TASK_HANDLERS = {TaskType.SUPPORT_REVIEW: handle_support_review}


def process_task(task: Task) -> None:
    project_id = task.project_id
    project_dir = WORKSPACE_DIR / "projects" / project_id
    tasks_dir = project_dir / "tasks"
    repo = TaskRepository(tasks_dir)
    task.mark_in_progress()
    repo.save(task)
    try:
        task_type = TaskType(task.task_type) if isinstance(task.task_type, str) else task.task_type
        handler = TASK_HANDLERS.get(task_type)
        if not handler:
            raise ValueError(f"Kein Handler: {task.task_type}")
        handler(task, project_dir)
        task.mark_completed()
        repo.save(task)
    except Exception as exc:
        LOG.error(f"Customer Worker Fehler: {exc}", project_id=project_id)
        task.mark_failed(str(exc))
        repo.save(task)


def main() -> None:
    LOG.info("Customer Worker gestartet", event="SERVICE_START")
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
            LOG.error(f"Customer Worker Fehler: {exc}", event="ERROR")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
