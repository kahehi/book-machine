#!/usr/bin/env python3
"""Marketing Worker Agent – Kampagnen und Pressematerialien."""
import json, os, sys, time, uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "/company/lib")
from logger import StructuredLogger
from lock import LockManager, ManagedLock
from task import Task, TaskStatus, TaskType, TaskRepository

WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace"))
SERVICE_NAME = "marketing-worker"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "mock")
LOG = StructuredLogger(SERVICE_NAME)


def call_mock(task_type: str, context: dict) -> dict:
    time.sleep(0.1)
    title = context.get("title", "Das Buch")
    return {
        "campaign_id": str(uuid.uuid4()),
        "project_id": context.get("project_id", ""),
        "title": title,
        "tagline": f"Ein unvergessliches Abenteuer fuer kleine Leser!",
        "target_channels": ["amazon", "instagram", "newsletter"],
        "ad_copy": {
            "short": f"{title} – Das perfekte Gute-Nacht-Buch.",
            "long": f"Entdecke '{title}': eine warmherzige Geschichte fuer Kinder von 4-7 Jahren.",
        },
        "social_posts": [
            {"platform": "instagram", "text": f"Neu! '{title}' jetzt erhaeltlich. #Kinderbuch #Lesen"},
            {"platform": "facebook", "text": f"'{title}' – Wunderschoene Bilder, tolle Geschichte!"},
        ],
        "press_release": f"Pressemitteilung: '{title}' ab sofort erhaeltlich.",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": SERVICE_NAME,
    }


def handle_campaign_create(task: Task, project_dir: Path) -> None:
    project_id = task.project_id
    scope_path = WORKSPACE_DIR / f"projects/{project_id}/02_scope/scope.json"
    scope = json.loads(scope_path.read_text(encoding="utf-8")) if scope_path.exists() else {}

    campaign_data = call_mock("CAMPAIGN_CREATE", {
        "project_id": project_id,
        "title": scope.get("title", ""),
        "concept": scope.get("concept", ""),
    })

    lock_manager = LockManager(project_dir, SERVICE_NAME)
    marketing_dir = WORKSPACE_DIR / f"projects/{project_id}/marketing"
    with ManagedLock(lock_manager, "marketing/campaign.json"):
        marketing_dir.mkdir(parents=True, exist_ok=True)
        (marketing_dir / "campaign.json").write_text(
            json.dumps(campaign_data, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    LOG.info("campaign.json geschrieben", project_id=project_id, task_id=task.task_id)


TASK_HANDLERS = {TaskType.CAMPAIGN_CREATE: handle_campaign_create}


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
        LOG.error(f"Marketing Worker Fehler: {exc}", project_id=project_id)
        task.mark_failed(str(exc))
        repo.save(task)


def main() -> None:
    LOG.info("Marketing Worker gestartet", event="SERVICE_START")
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
            LOG.error(f"Marketing Worker Fehler: {exc}", event="ERROR")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
