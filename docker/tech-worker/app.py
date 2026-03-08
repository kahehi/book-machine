#!/usr/bin/env python3
"""
Tech Worker Agent – Layout, Export und Publishing-Paket.

Verarbeitet technische Tasks:
- LAYOUT_CREATE: Markdown + Canva-Export (aus book-machine exportManuscript/exportCanvaPackage)
- PUBLISH_PREPARE: publishing_package.json erstellen

Adaptiert aus:
  src/app/export/exportManuscript.ts
  src/app/export/exportCanvaPackage.ts
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
from lock import LockManager, ManagedLock
from task import Task, TaskStatus, TaskType, TaskRepository

WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace"))
SERVICE_NAME = "tech-worker"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
LOG = StructuredLogger(SERVICE_NAME)


def handle_layout_create(task: Task, project_dir: Path) -> None:
    """
    LAYOUT_CREATE: Generiert Markdown-Manuskript und Canva-Paket.
    Entspricht exportManuscript() + exportCanvaPackage() aus book-machine.
    """
    project_id = task.project_id
    manuscript_path = WORKSPACE_DIR / task.input_artifacts[0]
    illus_path = WORKSPACE_DIR / task.input_artifacts[1] if len(task.input_artifacts) > 1 else None

    manuscript = json.loads(manuscript_path.read_text(encoding="utf-8"))
    scope_path = WORKSPACE_DIR / f"projects/{project_id}/02_scope/scope.json"
    scope = json.loads(scope_path.read_text(encoding="utf-8")) if scope_path.exists() else {}

    # Markdown Export (analog zu exportManuscript.ts)
    md_lines = [
        f"# {manuscript.get('title', 'Unbekannter Titel')}",
        "",
        f"**Reihe:** {scope.get('series', {}).get('name', '–') if scope.get('series') else '–'}",
        f"**Zielgruppe:** {scope.get('target_audience', {}).get('age_min', '?')}-"
        f"{scope.get('target_audience', {}).get('age_max', '?')} Jahre",
        f"**Ton:** {scope.get('tone', '–')}",
        f"**Projekt-ID:** {project_id}",
        f"**Exportiert:** {datetime.now(timezone.utc).isoformat()}",
        "",
        "---",
        "",
    ]

    for page in manuscript.get("pages", []):
        md_lines += [
            f"## Seite {page['page_number']}",
            "",
            page.get("text", ""),
            "",
        ]
        if page.get("image_prompt_en"):
            md_lines += [f"> *Illustration: {page['image_prompt_en']}*", ""]

    md_content = "\n".join(md_lines)

    # Canva-Paket Export (analog zu exportCanvaPackage.ts)
    canva_slides = [
        {
            "page_no": page["page_number"],
            "text_de": page.get("text", ""),
            "image_prompt_en": page.get("image_prompt_en", ""),
        }
        for page in manuscript.get("pages", [])
    ]
    canva_package = {
        "meta": {
            "project_id": project_id,
            "title": manuscript.get("title", ""),
            "series_title": scope.get("series", {}).get("name", "") if scope.get("series") else "",
            "target_age": f"{scope.get('target_audience', {}).get('age_min', '?')}-{scope.get('target_audience', {}).get('age_max', '?')}",
            "tone": scope.get("tone", ""),
            "exported_at": datetime.now(timezone.utc).isoformat(),
        },
        "slides": canva_slides,
    }

    layout_dir = WORKSPACE_DIR / f"projects/{project_id}/06_layout"
    lock_manager = LockManager(project_dir, SERVICE_NAME)

    with ManagedLock(lock_manager, "06_layout/manuscript.md"):
        layout_dir.mkdir(parents=True, exist_ok=True)
        (layout_dir / "manuscript.md").write_text(md_content, encoding="utf-8")

    with ManagedLock(lock_manager, "06_layout/canva_package.json"):
        (layout_dir / "canva_package.json").write_text(
            json.dumps(canva_package, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    LOG.info("Layout erstellt (MD + Canva)", project_id=project_id, task_id=task.task_id)


def handle_publish_prepare(task: Task, project_dir: Path) -> None:
    """PUBLISH_PREPARE: Erstellt das vollstaendige publishing_package.json."""
    project_id = task.project_id

    scope_path = WORKSPACE_DIR / f"projects/{project_id}/02_scope/scope.json"
    manuscript_ref = f"projects/{project_id}/04_manuscript/manuscript.json"
    illustrations_ref = f"projects/{project_id}/05_illustrations/illustrations.json"

    scope = json.loads(scope_path.read_text(encoding="utf-8")) if scope_path.exists() else {}

    package = {
        "project_id": project_id,
        "run_id": task.run_id,
        "title": scope.get("title", ""),
        "manuscript_ref": manuscript_ref,
        "illustrations_ref": illustrations_ref,
        "metadata": {
            "isbn": None,
            "author": scope.get("created_by", "KI-Autor"),
            "publisher": "Micro-Firma Verlag",
            "language": scope.get("language", "de"),
            "categories": scope.get("key_themes", ["Kinderbuch"]),
            "keywords": scope.get("key_themes", []),
            "description": scope.get("concept", ""),
            "age_rating": f"{scope.get('target_audience', {}).get('age_min', '4')}+",
        },
        "platform_configs": [
            {
                "platform": "amazon_kdp",
                "status": "READY",
                "format": "epub",
                "price": 2.99,
                "royalty_rate": 0.70,
                "notes": "KDP Kinderbuch-Kategorie",
            },
            {
                "platform": "epub",
                "status": "READY",
                "format": "epub",
                "price": None,
                "royalty_rate": None,
                "notes": "Standard EPUB Export",
            },
        ],
        "canva_package": {"slides": []},
        "approved": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": SERVICE_NAME,
        "approved_at": None,
    }

    lock_manager = LockManager(project_dir, SERVICE_NAME)
    with ManagedLock(lock_manager, "07_publish/publishing_package.json"):
        out_file = WORKSPACE_DIR / f"projects/{project_id}/07_publish/publishing_package.json"
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(json.dumps(package, indent=2, ensure_ascii=False), encoding="utf-8")

    LOG.info("publishing_package.json geschrieben", project_id=project_id, task_id=task.task_id)


TASK_HANDLERS = {
    TaskType.LAYOUT_CREATE: handle_layout_create,
    TaskType.PUBLISH_PREPARE: handle_publish_prepare,
}


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
        LOG.error(f"Tech Worker Fehler: {exc}", project_id=project_id, task_id=task.task_id)
        task.mark_failed(str(exc))
        repo.save(task)


def main() -> None:
    LOG.info("Tech Worker gestartet", event="SERVICE_START")
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
            LOG.error(f"Tech Worker Fehler: {exc}", event="ERROR")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
