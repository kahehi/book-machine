"""
Task-System fuer die Micro-Firma.
Definiert das Task-Modell und Task-Management-Operationen.

Nur der Orchestrator darf Tasks erstellen.
Alle anderen Services koennen Tasks lesen und Status aktualisieren.
"""
import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    DEAD_LETTER = "DEAD_LETTER"
    BLOCKED = "BLOCKED"


class TaskType(str, Enum):
    SCOPE_DEFINE = "SCOPE_DEFINE"
    SCOPE_REVIEW = "SCOPE_REVIEW"
    OUTLINE_CREATE = "OUTLINE_CREATE"
    OUTLINE_REVIEW = "OUTLINE_REVIEW"
    MANUSCRIPT_WRITE = "MANUSCRIPT_WRITE"
    MANUSCRIPT_REVIEW = "MANUSCRIPT_REVIEW"
    ILLUSTRATIONS_CREATE = "ILLUSTRATIONS_CREATE"
    ILLUSTRATIONS_REVIEW = "ILLUSTRATIONS_REVIEW"
    LAYOUT_CREATE = "LAYOUT_CREATE"
    LAYOUT_REVIEW = "LAYOUT_REVIEW"
    PUBLISH_PREPARE = "PUBLISH_PREPARE"
    PUBLISH_REVIEW = "PUBLISH_REVIEW"
    CAMPAIGN_CREATE = "CAMPAIGN_CREATE"
    CAMPAIGN_REVIEW = "CAMPAIGN_REVIEW"
    RELEASE_PREPARE = "RELEASE_PREPARE"
    RELEASE_REVIEW = "RELEASE_REVIEW"
    SUPPORT_REVIEW = "SUPPORT_REVIEW"
    DEPLOYMENT_PREPARE = "DEPLOYMENT_PREPARE"
    DEPLOYMENT_REVIEW = "DEPLOYMENT_REVIEW"
    QC_GATE_CHECK = "QC_GATE_CHECK"
    REWORK = "REWORK"


class Task:
    """
    Repraesentiert einen Task in der Micro-Firma.

    Tasks sind idempotent: Wiederholte Ausfuehrung liefert dasselbe Ergebnis.
    """

    def __init__(
        self,
        task_type: TaskType,
        owner_service: str,
        project_id: str,
        run_id: str,
        input_artifacts: list[str],
        output_artifacts: list[str],
        acceptance_criteria: list[str],
        priority: int = 5,
        max_retries: int = 3,
        metadata: Optional[dict] = None,
        task_id: Optional[str] = None,
    ):
        self.task_id = task_id or str(uuid.uuid4())
        self.task_type = task_type
        self.owner_service = owner_service
        self.project_id = project_id
        self.run_id = run_id
        self.input_artifacts = input_artifacts
        self.output_artifacts = output_artifacts
        self.acceptance_criteria = acceptance_criteria
        self.priority = priority
        self.max_retries = max_retries
        self.retry_count = 0
        self.status = TaskStatus.PENDING
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.started_at: Optional[str] = None
        self.completed_at: Optional[str] = None
        self.error_message: Optional[str] = None
        self.metadata = metadata or {}

    def to_dict(self) -> dict:
        """Serialisiert den Task als Dictionary (fuer JSON-Speicherung)."""
        return {
            "task_id": self.task_id,
            "run_id": self.run_id,
            "project_id": self.project_id,
            "task_type": self.task_type.value if isinstance(self.task_type, TaskType) else self.task_type,
            "owner_service": self.owner_service,
            "input_artifacts": self.input_artifacts,
            "output_artifacts": self.output_artifacts,
            "acceptance_criteria": self.acceptance_criteria,
            "priority": self.priority,
            "max_retries": self.max_retries,
            "retry_count": self.retry_count,
            "status": self.status.value if isinstance(self.status, TaskStatus) else self.status,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "error_message": self.error_message,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Task":
        """Deserialisiert einen Task aus einem Dictionary."""
        task = cls(
            task_type=TaskType(data["task_type"]),
            owner_service=data["owner_service"],
            project_id=data["project_id"],
            run_id=data["run_id"],
            input_artifacts=data["input_artifacts"],
            output_artifacts=data["output_artifacts"],
            acceptance_criteria=data["acceptance_criteria"],
            priority=data.get("priority", 5),
            max_retries=data.get("max_retries", 3),
            metadata=data.get("metadata", {}),
            task_id=data["task_id"],
        )
        task.retry_count = data.get("retry_count", 0)
        task.status = TaskStatus(data["status"])
        task.created_at = data["created_at"]
        task.started_at = data.get("started_at")
        task.completed_at = data.get("completed_at")
        task.error_message = data.get("error_message")
        return task

    def mark_in_progress(self) -> None:
        """Markiert den Task als in Bearbeitung."""
        self.status = TaskStatus.IN_PROGRESS
        self.started_at = datetime.now(timezone.utc).isoformat()

    def mark_completed(self) -> None:
        """Markiert den Task als erfolgreich abgeschlossen."""
        self.status = TaskStatus.COMPLETED
        self.completed_at = datetime.now(timezone.utc).isoformat()

    def mark_failed(self, error_message: str) -> None:
        """Markiert den Task als fehlgeschlagen."""
        self.status = TaskStatus.FAILED
        self.error_message = error_message
        self.completed_at = datetime.now(timezone.utc).isoformat()
        self.retry_count += 1

    def mark_dead_letter(self, reason: str) -> None:
        """Verschiebt den Task in die Dead Letter Queue."""
        self.status = TaskStatus.DEAD_LETTER
        self.error_message = reason
        self.completed_at = datetime.now(timezone.utc).isoformat()

    @property
    def can_retry(self) -> bool:
        """Prueft ob der Task erneut versucht werden kann."""
        return self.retry_count < self.max_retries


class TaskRepository:
    """
    Verwaltet Task-Dateien im Dateisystem.
    Tasks werden als JSON-Dateien in /projects/<id>/tasks/ gespeichert.
    """

    def __init__(self, tasks_dir: Path):
        self.tasks_dir = tasks_dir
        self.tasks_dir.mkdir(parents=True, exist_ok=True)

    def save(self, task: Task) -> Path:
        """Speichert einen Task als JSON-Datei."""
        path = self.tasks_dir / f"{task.task_id}.json"
        path.write_text(
            json.dumps(task.to_dict(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return path

    def load(self, task_id: str) -> Optional[Task]:
        """Laedt einen Task anhand seiner ID."""
        path = self.tasks_dir / f"{task_id}.json"
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return Task.from_dict(data)

    def find_by_status(self, status: TaskStatus) -> list[Task]:
        """Findet alle Tasks mit einem bestimmten Status."""
        tasks = []
        for path in self.tasks_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if data.get("status") == status.value:
                    tasks.append(Task.from_dict(data))
            except (json.JSONDecodeError, KeyError):
                continue
        return sorted(tasks, key=lambda t: t.priority)

    def find_for_service(self, service_name: str, status: TaskStatus = TaskStatus.PENDING) -> list[Task]:
        """Findet alle Tasks fuer einen bestimmten Service."""
        tasks = []
        for path in self.tasks_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if (
                    data.get("owner_service") == service_name
                    and data.get("status") == status.value
                ):
                    tasks.append(Task.from_dict(data))
            except (json.JSONDecodeError, KeyError):
                continue
        return sorted(tasks, key=lambda t: t.priority)

    def move_to_dead_letter(self, task: Task, project_dir: Path) -> None:
        """Verschiebt einen fehlgeschlagenen Task in die Dead Letter Queue."""
        dead_letter_dir = project_dir / "dead_letter"
        dead_letter_dir.mkdir(parents=True, exist_ok=True)

        task.mark_dead_letter(task.error_message or "Max retries erreicht")
        dl_path = dead_letter_dir / f"{task.task_id}.json"
        dl_path.write_text(
            json.dumps(task.to_dict(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        # Urspruengliche Task-Datei loeschen
        original = self.tasks_dir / f"{task.task_id}.json"
        if original.exists():
            original.unlink()
