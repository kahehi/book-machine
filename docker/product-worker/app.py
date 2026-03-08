#!/usr/bin/env python3
"""
Product Worker Agent - Micro-Firma Buchproduktion.

Verarbeitet inhaltliche Tasks:
- SCOPE_DEFINE: Erstellt scope.json aus Projektidee
- OUTLINE_CREATE: Erstellt outline.json aus scope.json
- MANUSCRIPT_WRITE: Erstellt manuscript.json aus outline.json
- ILLUSTRATIONS_CREATE: Erstellt illustrations.json aus manuscript.json
- REWORK: Korrigiert Artefakte basierend auf QC-Reports

Mapping auf bestehende book-machine Agenten:
  SCOPE_DEFINE      -> PlannerAgent + RealityCheckAgent
  MANUSCRIPT_WRITE  -> StoryAgent
  REWORK            -> RewriteAgent
"""
import json
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "/company/lib")
from logger import StructuredLogger
from lock import ManagedLock, LockManager
from storage import StorageProvider
from task import Task, TaskStatus, TaskType, TaskRepository

# Konfiguration
WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace"))
SERVICE_NAME = "product-worker"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "mock")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MAX_API_RETRIES = 3

LOG = StructuredLogger(SERVICE_NAME)


# --------------------------------------------------------------------------- #
# JSON-Hilfsfunktionen
# --------------------------------------------------------------------------- #

def _extract_json(text: str) -> str:
    """
    Extrahiert JSON aus einem LLM-Response.
    Behandelt: Markdown-Codeblock, direkt JSON-Objekt, JSON-Array.
    """
    # Markdown-Codeblock: ```json ... ``` oder ``` ... ```
    match = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", text, re.DOTALL)
    if match:
        return match.group(1)
    # Direkt JSON-Objekt (erster { bis letzter })
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    # JSON-Array
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return text


def parse_llm_json(raw: str, context: str = "") -> dict:
    """
    Parst JSON aus einem LLM-Response mit Fallback-Extraktion.
    Wirft ValueError bei unparsebarem Response.
    """
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        extracted = _extract_json(raw)
        try:
            return json.loads(extracted)
        except json.JSONDecodeError as e:
            preview = raw[:300].replace("\n", " ")
            raise ValueError(
                f"LLM-Response kein gueltiges JSON ({context}): {e} | Vorschau: {preview}"
            )


# --------------------------------------------------------------------------- #
# LLM-Integration (adaptiert aus bestehender book-machine)
# --------------------------------------------------------------------------- #

def call_llm(system_prompt: str, user_message: str) -> str:
    """
    Ruft das LLM auf. Unterstuetzt mock und anthropic Provider.
    Adaptiert aus src/providers/anthropicClient.ts und mockClient.ts.
    """
    if LLM_PROVIDER == "anthropic":
        return call_anthropic(system_prompt, user_message)
    else:
        return call_mock(system_prompt, user_message)


def call_mock(system_prompt: str, user_message: str) -> str:
    """Mock-Implementierung fuer Tests (analog zu book-machine MockLlmClient)."""
    time.sleep(0.1)  # Simuliere Latenz

    if "scope" in system_prompt.lower() or "planner" in system_prompt.lower():
        return json.dumps({
            "title": "Leo und die tapfere Nacht",
            "concept": "Ein mutiger kleiner Loewe ueberwindet seine Angst vor der Dunkelheit durch die Hilfe seiner Freunde und entdeckt, dass Tapferkeit bedeutet, trotz Angst voranzugehen.",
            "target_audience": {"age_min": 4, "age_max": 7, "description": "Vorschulkinder und fruehe Leser"},
            "genre": "picture_book",
            "language": "de",
            "page_count": {"min": 8, "max": 12},
            "tone": "warm, beruhigend, liebevoll",
            "key_themes": ["Mut", "Freundschaft", "Schlafenszeit"],
            "deliverables": ["manuscript", "illustrations", "publishing_package"],
            "constraints": {
                "content_restrictions": ["Keine Gewalt", "Kein Erschrecken"],
                "platform_requirements": ["Amazon KDP", "Tolino"]
            },
            "risk_assessment": [
                {
                    "category": "content",
                    "severity": "low",
                    "description": "Thema Angst vor Dunkelheit koennte sensibel sein",
                    "mitigation": "Positive, ermutigende Auflosung sicherstellen"
                }
            ]
        }, ensure_ascii=False)

    elif "manuscript" in system_prompt.lower() or "story" in system_prompt.lower():
        pages = []
        for i in range(1, 9):
            pages.append({
                "page_number": i,
                "text": f"Leo liegt im Bett. Es ist Seite {i}.",
                "image_prompt_en": f"A warm illustration of a small lion cub, page {i}, soft watercolor style, children's book art"
            })
        return json.dumps({
            "pages": pages,
            "word_count": 120,
            "quality_score": 88,
            "quality_issues": []
        }, ensure_ascii=False)

    elif "outline" in system_prompt.lower():
        return json.dumps({
            "chapters": [
                {
                    "chapter_number": 1,
                    "title": "Die dunkle Nacht",
                    "summary": "Leo kann nicht schlafen und hat Angst vor der Dunkelheit.",
                    "scenes": [
                        {
                            "scene_number": 1,
                            "description": "Leo liegt im Bett, draussen ist es dunkel.",
                            "characters_present": ["Leo"],
                            "emotional_beat": "Angst, Unsicherheit",
                            "illustration_needed": True
                        }
                    ]
                }
            ],
            "character_list": [
                {
                    "name": "Leo",
                    "role": "protagonist",
                    "description": "Mutiger kleiner Loewe, 4 Jahre alt",
                    "arc": "Lernt, dass Mut bedeutet trotz Angst voranzugehen"
                }
            ],
            "narrative_arc": {
                "setup": "Leo kann nicht schlafen und hat Angst vor der Dunkelheit.",
                "rising_action": "Er erkundet sein Zimmer und entdeckt, dass Schatten harmlos sind.",
                "climax": "Er oeffnet das Fenster und sieht die Sterne.",
                "falling_action": "Er erzaehlt seinen Eltern von seiner Entdeckung.",
                "resolution": "Leo schlaeft friedlich ein, die Sterne als Begleiter."
            },
            "estimated_word_count": 200
        }, ensure_ascii=False)

    return json.dumps({"result": "mock_response"})


def call_anthropic(system_prompt: str, user_message: str) -> str:
    """
    Anthropic Claude API Aufruf mit exponentiellem Backoff-Retry.
    Wiederholungsversuche: 1s, 2s, 4s Wartezeit.
    """
    try:
        import anthropic
    except ImportError as e:
        raise RuntimeError(f"anthropic-Paket nicht installiert: {e}")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    last_error: Exception = RuntimeError("Unbekannter Fehler")

    for attempt in range(MAX_API_RETRIES):
        try:
            message = client.messages.create(
                model="claude-opus-4-6",
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
            return message.content[0].text

        except Exception as e:
            last_error = e
            wait = 2 ** attempt  # 1, 2, 4 Sekunden
            LOG.warning(
                f"Anthropic API Fehler (Versuch {attempt + 1}/{MAX_API_RETRIES}): {e}. Warte {wait}s.",
                event="API_RETRY",
            )
            if attempt < MAX_API_RETRIES - 1:
                time.sleep(wait)

    raise RuntimeError(
        f"Anthropic API nach {MAX_API_RETRIES} Versuchen fehlgeschlagen: {last_error}"
    )


# --------------------------------------------------------------------------- #
# Task-Handler
# --------------------------------------------------------------------------- #

def handle_scope_define(task: Task, project_dir: Path) -> None:
    """
    SCOPE_DEFINE: Erstellt scope.json aus Projektidee.
    Entspricht PlannerAgent + RealityCheckAgent in der book-machine.
    """
    project_id = task.project_id

    # Lese Idee
    idea_path = WORKSPACE_DIR / task.input_artifacts[0]
    idea = idea_path.read_text(encoding="utf-8").strip() if idea_path.exists() else ""

    system_prompt = """Du bist ein Buchprojekt-Planer.
Erstelle einen detaillierten Scope fuer ein Kinderbuch.
Antworte NUR mit einem gueltigen JSON-Objekt gemaess dem Schema.
Verwende fuer das Buch die deutsche Sprache (language: "de").
Zielgruppe: Kinder 4-7 Jahre.
Ton: warm, beruhigend, liebevoll. Keine Gewalt, keine Angsteinfloesung.
Pflichtfelder: title, concept (mind. 50 Zeichen), target_audience, genre, language,
page_count, deliverables, constraints."""

    raw = call_llm(system_prompt, f"Projektidee: {idea}")
    scope_data = parse_llm_json(raw, context="SCOPE_DEFINE")

    # Pflichtfelder ergaenzen
    now = datetime.now(timezone.utc).isoformat()
    scope_data.update({
        "project_id": project_id,
        "run_id": task.run_id,
        "approved": False,
        "created_at": now,
        "created_by": SERVICE_NAME,
        "approved_at": None,
    })

    # Mit Lock schreiben
    lock_manager = LockManager(project_dir, SERVICE_NAME)
    output_path = f"projects/{project_id}/02_scope/scope.json"

    with ManagedLock(lock_manager, "02_scope/scope.json"):
        out_file = WORKSPACE_DIR / output_path
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(json.dumps(scope_data, indent=2, ensure_ascii=False), encoding="utf-8")

    LOG.info("scope.json geschrieben", project_id=project_id, task_id=task.task_id)


def handle_outline_create(task: Task, project_dir: Path) -> None:
    """OUTLINE_CREATE: Erstellt outline.json aus scope.json."""
    project_id = task.project_id

    scope_path = WORKSPACE_DIR / task.input_artifacts[0]
    try:
        scope_data = json.loads(scope_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        raise ValueError(f"Scope-Datei nicht lesbar: {e}")

    system_prompt = """Du bist ein Buchgliederungs-Experte.
Erstelle eine detaillierte Kapitel- und Szenenstruktur fuer ein Kinderbuch.
Antworte NUR mit einem gueltigen JSON-Objekt.
Pflichtfelder: chapters (mind. 1), character_list, narrative_arc (setup, climax, resolution)."""

    raw = call_llm(system_prompt, f"Scope: {json.dumps(scope_data, ensure_ascii=False)}")
    outline_data = parse_llm_json(raw, context="OUTLINE_CREATE")

    now = datetime.now(timezone.utc).isoformat()
    outline_data.update({
        "project_id": project_id,
        "run_id": task.run_id,
        "title": scope_data.get("title", ""),
        "approved": False,
        "created_at": now,
        "created_by": SERVICE_NAME,
        "approved_at": None,
    })

    lock_manager = LockManager(project_dir, SERVICE_NAME)
    with ManagedLock(lock_manager, "03_outline/outline.json"):
        out_file = WORKSPACE_DIR / f"projects/{project_id}/03_outline/outline.json"
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(json.dumps(outline_data, indent=2, ensure_ascii=False), encoding="utf-8")

    LOG.info("outline.json geschrieben", project_id=project_id, task_id=task.task_id)


def handle_manuscript_write(task: Task, project_dir: Path) -> None:
    """
    MANUSCRIPT_WRITE: Erstellt manuscript.json.
    Entspricht StoryAgent in der book-machine.
    Includes Qualitaets-Loop analog zur bestehenden generateSeries.ts.
    """
    project_id = task.project_id
    outline_path = WORKSPACE_DIR / task.input_artifacts[0]
    try:
        outline_data = json.loads(outline_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        raise ValueError(f"Outline-Datei nicht lesbar: {e}")

    max_iterations = int(os.getenv("MAX_ITERATIONS", "3"))
    target_score = float(os.getenv("TARGET_SCORE", "85"))

    system_prompt = """Du bist ein Kinderbuch-Autor.
Schreibe ein altersgerechtes Kinderbuch fuer Kinder 4-7 Jahre.
Regeln:
- Max. 8 Woerter pro Satz
- Einfaches Vokabular
- Warmer, beruhigender Ton
- Kein Erschrecken, keine Gewalt
- Jede Seite hat text (auf Deutsch) und image_prompt_en (auf Englisch)
Antworte NUR mit JSON: { "pages": [...], "word_count": N, "quality_score": N, "quality_issues": [] }"""

    best_manuscript = None
    best_score = 0

    for iteration in range(max_iterations):
        raw = call_llm(system_prompt, f"Gliederung: {json.dumps(outline_data, ensure_ascii=False)}")
        try:
            manuscript_data = parse_llm_json(raw, context=f"MANUSCRIPT_WRITE Iteration {iteration}")
        except ValueError as e:
            LOG.warning(f"Manuskript-JSON-Fehler in Iteration {iteration}: {e}", project_id=project_id)
            continue

        score = manuscript_data.get("quality_score", 0)
        LOG.info(f"Manuskript Iteration {iteration}: Score {score}", project_id=project_id)

        manuscript_data.update({
            "project_id": project_id,
            "run_id": task.run_id,
            "title": outline_data.get("title", ""),
            "language": "de",
            "iteration": iteration,
            "approved": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": SERVICE_NAME,
            "approved_at": None,
        })

        if score > best_score:
            best_score = score
            best_manuscript = manuscript_data

        if score >= target_score and not any(
            i.get("severity") == "high" for i in manuscript_data.get("quality_issues", [])
        ):
            break

    if best_manuscript is None:
        raise RuntimeError("Kein gueltiges Manuskript nach allen Iterationen erstellt")

    lock_manager = LockManager(project_dir, SERVICE_NAME)
    with ManagedLock(lock_manager, "04_manuscript/manuscript.json"):
        out_file = WORKSPACE_DIR / f"projects/{project_id}/04_manuscript/manuscript.json"
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(json.dumps(best_manuscript, indent=2, ensure_ascii=False), encoding="utf-8")

    LOG.info(f"manuscript.json geschrieben (Score: {best_score})", project_id=project_id, task_id=task.task_id)


def handle_illustrations_create(task: Task, project_dir: Path) -> None:
    """ILLUSTRATIONS_CREATE: Erstellt illustrations.json."""
    project_id = task.project_id
    try:
        manuscript_data = json.loads((WORKSPACE_DIR / task.input_artifacts[0]).read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        raise ValueError(f"Manuskript-Datei nicht lesbar: {e}")

    illustrations: list = []
    for page in manuscript_data.get("pages", []):
        illustrations.append({
            "illustration_id": str(uuid.uuid4()),
            "page_number": page["page_number"],
            "prompt_en": page.get("image_prompt_en", ""),
            "prompt_de": f"Illustration fuer Seite {page['page_number']}",
            "negative_prompt": "violence, scary, dark, realistic photo",
            "aspect_ratio": "4:3",
            "status": "PENDING",
            "file_path": None,
            "rejection_reason": None,
        })

    illus_data = {
        "project_id": project_id,
        "run_id": task.run_id,
        "style_guide": {
            "art_style": "soft watercolor, children's book illustration",
            "color_palette": ["warm yellow", "soft blue", "gentle green"],
            "mood": "warm, cozy, dreamy",
            "reference_artists": [],
            "forbidden_elements": ["violence", "blood", "scary faces", "weapons"],
        },
        "illustrations": illustrations,
        "approved": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": SERVICE_NAME,
        "approved_at": None,
    }

    lock_manager = LockManager(project_dir, SERVICE_NAME)
    with ManagedLock(lock_manager, "05_illustrations/illustrations.json"):
        out_file = WORKSPACE_DIR / f"projects/{project_id}/05_illustrations/illustrations.json"
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(json.dumps(illus_data, indent=2, ensure_ascii=False), encoding="utf-8")

    LOG.info("illustrations.json geschrieben", project_id=project_id, task_id=task.task_id)


def handle_rework(task: Task, project_dir: Path) -> None:
    """REWORK: Korrigiert ein Artefakt basierend auf QC-Report fix_tasks."""
    project_id = task.project_id

    qc_report_path = None
    artifact_path = None

    for artifact in task.input_artifacts:
        path = WORKSPACE_DIR / artifact
        if "qc_report" in artifact and path.exists():
            qc_report_path = path
        elif path.exists():
            artifact_path = path

    if not qc_report_path or not artifact_path:
        raise ValueError("Rework: QC-Report oder Artefakt nicht gefunden")

    try:
        qc_report = json.loads(qc_report_path.read_text(encoding="utf-8"))
        artifact_data = json.loads(artifact_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ValueError(f"Rework: Datei nicht parsebar: {e}")

    fix_tasks = qc_report.get("fix_tasks", [])
    fix_description = "\n".join([f"- {ft['description']}" for ft in fix_tasks])

    system_prompt = f"""Du bist ein Redakteur.
Korrigiere das Artefakt basierend auf den folgenden Nachbesserungsaufgaben:
{fix_description}
Behalte die grundlegende Struktur bei. Antworte NUR mit dem korrigierten JSON."""

    raw = call_llm(system_prompt, json.dumps(artifact_data, ensure_ascii=False))
    corrected_data = parse_llm_json(raw, context="REWORK")

    # Iteration hochsetzen
    if "iteration" in corrected_data:
        corrected_data["iteration"] = artifact_data.get("iteration", 0) + 1

    lock_manager = LockManager(project_dir, SERVICE_NAME)
    with ManagedLock(lock_manager, artifact_path.name):
        artifact_path.write_text(json.dumps(corrected_data, indent=2, ensure_ascii=False), encoding="utf-8")

    LOG.info(f"Rework abgeschlossen: {artifact_path.name}", project_id=project_id, task_id=task.task_id)


# --------------------------------------------------------------------------- #
# Hauptschleife
# --------------------------------------------------------------------------- #

TASK_HANDLERS = {
    TaskType.SCOPE_DEFINE: handle_scope_define,
    TaskType.OUTLINE_CREATE: handle_outline_create,
    TaskType.MANUSCRIPT_WRITE: handle_manuscript_write,
    TaskType.ILLUSTRATIONS_CREATE: handle_illustrations_create,
    TaskType.REWORK: handle_rework,
}


def process_task(task: Task) -> None:
    """Verarbeitet einen einzelnen Task."""
    project_id = task.project_id
    project_dir = WORKSPACE_DIR / "projects" / project_id

    task_type = TaskType(task.task_type) if isinstance(task.task_type, str) else task.task_type
    handler = TASK_HANDLERS.get(task_type)

    if not handler:
        LOG.warning(f"Kein Handler fuer Task-Typ: {task.task_type}", project_id=project_id)
        return

    tasks_dir = project_dir / "tasks"
    repo = TaskRepository(tasks_dir)

    task.mark_in_progress()
    repo.save(task)

    try:
        handler(task, project_dir)
        task.mark_completed()
        repo.save(task)
        LOG.info(f"Task erfolgreich: {task.task_type}", project_id=project_id, task_id=task.task_id)
    except Exception as exc:
        error_msg = str(exc)
        LOG.error(f"Task fehlgeschlagen: {error_msg}", project_id=project_id, task_id=task.task_id)
        task.mark_failed(error_msg)
        repo.save(task)

        if not task.can_retry:
            repo.move_to_dead_letter(task, project_dir)


def main() -> None:
    """Hauptschleife des Product Workers."""
    LOG.info("Product Worker gestartet", event="SERVICE_START")

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
                pending_tasks = repo.find_for_service(SERVICE_NAME, TaskStatus.PENDING)

                for task in pending_tasks:
                    process_task(task)

        except Exception as exc:
            LOG.error(f"Product Worker Fehler: {exc}", event="ERROR")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
