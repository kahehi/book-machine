#!/usr/bin/env python3
"""
Quality Product Agent (Domain QA) - Gate-Pruefungen fuer Produktions-Artefakte.

Prueft:
- Gate 1: SCOPE_GATE (scope.json)
- Gate 2: MANUSCRIPT_GATE (manuscript.json)
- Gate 3: ILLUSTRATION_GATE (illustrations.json)

QA-Agenten duerfen NUR lesen und pruefen.
Sie veraendern KEINE Artefakte.
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
from task import Task, TaskStatus, TaskType, TaskRepository
from storage import StorageProvider

WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace"))
SCHEMAS_DIR = Path("/company/quality/schemas")
SERVICE_NAME = "quality-product"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
TARGET_SCORE = float(os.getenv("TARGET_SCORE", "85"))

LOG = StructuredLogger(SERVICE_NAME)

# jsonschema optional laden – bei fehlender Installation wird Schema-Check uebersprungen
try:
    import jsonschema
    _JSONSCHEMA_OK = True
except ImportError:
    _JSONSCHEMA_OK = False
    LOG.warning("jsonschema nicht installiert – Schema-Validierung deaktiviert", event="STARTUP")


# --------------------------------------------------------------------------- #
# Schema-Validierung
# --------------------------------------------------------------------------- #

def validate_schema(data: dict, schema_name: str) -> list[dict]:
    """
    Validiert ein Dictionary gegen das entsprechende JSON-Schema.
    Gibt eine Liste von Fehler-Dicts zurueck (leer = valide).
    Schema-Dateien liegen in /company/quality/schemas/<name>.schema.json.
    """
    if not _JSONSCHEMA_OK:
        return []

    schema_path = SCHEMAS_DIR / f"{schema_name}.schema.json"
    if not schema_path.exists():
        LOG.warning(f"Schema nicht gefunden: {schema_path}", event="SCHEMA_MISSING")
        return []

    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        LOG.error(f"Schema-Datei nicht lesbar: {e}", event="SCHEMA_ERROR")
        return []

    errors = []
    validator = jsonschema.Draft7Validator(schema)
    for error in validator.iter_errors(data):
        errors.append({
            "path": ".".join(str(p) for p in error.absolute_path) or "(root)",
            "message": error.message,
            "schema_path": ".".join(str(p) for p in error.absolute_schema_path),
        })
    return errors


# --------------------------------------------------------------------------- #
# Report-Hilfsfunktion
# --------------------------------------------------------------------------- #

def make_report(
    task: Task,
    gate_name: str,
    status: str,
    failed_rules: list,
    failed_checks: list,
    compliance_flags: list,
    fix_tasks: list,
    improvements: list,
    evidence: dict,
) -> dict:
    """Erstellt einen standardisierten QC-Report."""
    return {
        "report_id": str(uuid.uuid4()),
        "task_id": task.task_id,
        "project_id": task.project_id,
        "run_id": task.run_id,
        "gate_name": gate_name,
        "reviewer_service": SERVICE_NAME,
        "artifact_reviewed": task.input_artifacts[0] if task.input_artifacts else "",
        "status": status,
        "failed_rules": failed_rules,
        "failed_checks": failed_checks,
        "compliance_flags": compliance_flags,
        "fix_tasks": fix_tasks,
        "improvements": improvements,
        "evidence": evidence,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


# --------------------------------------------------------------------------- #
# Gate-Handler
# --------------------------------------------------------------------------- #

def check_scope(task: Task) -> dict:
    """Gate 1: SCOPE_GATE - Prueft scope.json."""
    artifact_path = WORKSPACE_DIR / task.input_artifacts[0]
    if not artifact_path.exists():
        return make_report(
            task, "SCOPE_GATE", "FAIL",
            [{"rule_id": "R001", "rule_name": "Artefakt vorhanden", "severity": "BLOCKER",
              "description": f"scope.json nicht gefunden: {artifact_path}", "evidence": ""}],
            [], [], [], [], {"schema_valid": False}
        )

    try:
        scope = json.loads(artifact_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return make_report(
            task, "SCOPE_GATE", "FAIL",
            [{"rule_id": "R000", "rule_name": "JSON parsebar", "severity": "BLOCKER",
              "description": f"scope.json ist kein gueltiges JSON: {e}", "evidence": ""}],
            [], [], [], [], {"schema_valid": False}
        )

    failed_rules = []
    failed_checks = []
    compliance_flags = []
    fix_tasks_list = []
    improvements = []

    # Schema-Validierung mit jsonschema
    schema_errors = validate_schema(scope, "scope")
    if schema_errors:
        for err in schema_errors:
            failed_rules.append({
                "rule_id": "SCHEMA",
                "rule_name": "JSON-Schema Konformitaet",
                "severity": "BLOCKER",
                "description": f"Schema-Fehler bei '{err['path']}': {err['message']}",
                "evidence": err["schema_path"],
            })

    # R001: Schema-Pflichtfelder (zusaetzlich zur jsonschema-Pruefung)
    required_fields = ["project_id", "title", "concept", "target_audience",
                       "genre", "language", "deliverables", "constraints"]
    missing = [f for f in required_fields if not scope.get(f)]
    if missing:
        failed_rules.append({
            "rule_id": "R001", "rule_name": "Pflichtfelder",
            "severity": "BLOCKER",
            "description": f"Fehlende Pflichtfelder: {', '.join(missing)}",
            "evidence": str(missing)
        })

    # R002: Konzept Mindestlaenge
    concept = scope.get("concept", "")
    if len(concept) < 50:
        failed_rules.append({
            "rule_id": "R002", "rule_name": "Konzept Mindestlaenge",
            "severity": "BLOCKER",
            "description": f"Konzept zu kurz ({len(concept)} Zeichen, mind. 50)",
            "evidence": concept[:100]
        })
        fix_tasks_list.append({
            "fix_id": str(uuid.uuid4()),
            "description": "Konzept auf mindestens 50 Zeichen erweitern",
            "target_artifact": task.input_artifacts[0],
            "priority": 1
        })

    # R003: Zielgruppe plausibel
    audience = scope.get("target_audience", {})
    age_min = audience.get("age_min", 0)
    age_max = audience.get("age_max", 99)
    if age_max <= age_min:
        failed_rules.append({
            "rule_id": "R003", "rule_name": "Zielgruppe plausibel",
            "severity": "MAJOR",
            "description": f"age_max ({age_max}) muss groesser als age_min ({age_min}) sein",
            "evidence": str(audience)
        })

    # R004: Safety Check
    forbidden_terms = ["sterben", "blut", "gewalt", "gefahr", "tod"]
    found_forbidden = [t for t in forbidden_terms if t in concept.lower()]
    if found_forbidden:
        compliance_flags.append({
            "flag_type": "SAFETY",
            "description": f"Moegliche problematische Begriffe: {', '.join(found_forbidden)}",
            "severity": "BLOCKER"
        })

    # Verbesserungen
    if not scope.get("series"):
        improvements.append({
            "suggestion": "Serieninformationen hinzufuegen fuer bessere Vermarktung",
            "rationale": "Serien erzielen oft hoehere Verkaufszahlen",
            "impact": "MEDIUM"
        })

    has_blocker = any(r["severity"] in ("BLOCKER", "MAJOR") for r in failed_rules)
    has_compliance_blocker = any(f["severity"] in ("BLOCKER", "MAJOR") for f in compliance_flags)
    status = "FAIL" if (has_blocker or has_compliance_blocker) else "PASS"

    return make_report(
        task, "SCOPE_GATE", status,
        failed_rules, failed_checks, compliance_flags, fix_tasks_list, improvements,
        evidence={
            "schema_valid": len(schema_errors) == 0,
            "custom_metrics": {"concept_length": len(concept)},
        }
    )


def check_manuscript(task: Task) -> dict:
    """Gate 2: MANUSCRIPT_GATE - Prueft manuscript.json."""
    artifact_path = WORKSPACE_DIR / task.input_artifacts[0]
    if not artifact_path.exists():
        return make_report(
            task, "MANUSCRIPT_GATE", "FAIL",
            [{"rule_id": "M001", "rule_name": "Artefakt vorhanden", "severity": "BLOCKER",
              "description": "manuscript.json nicht gefunden", "evidence": ""}],
            [], [], [], [], {"schema_valid": False}
        )

    try:
        manuscript = json.loads(artifact_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return make_report(
            task, "MANUSCRIPT_GATE", "FAIL",
            [{"rule_id": "M000", "rule_name": "JSON parsebar", "severity": "BLOCKER",
              "description": f"manuscript.json ist kein gueltiges JSON: {e}", "evidence": ""}],
            [], [], [], [], {"schema_valid": False}
        )

    failed_rules = []
    failed_checks = []
    fix_tasks_list = []
    improvements = []

    # Schema-Validierung mit jsonschema
    schema_errors = validate_schema(manuscript, "manuscript")
    if schema_errors:
        for err in schema_errors:
            failed_rules.append({
                "rule_id": "SCHEMA",
                "rule_name": "JSON-Schema Konformitaet",
                "severity": "BLOCKER",
                "description": f"Schema-Fehler bei '{err['path']}': {err['message']}",
                "evidence": err["schema_path"],
            })

    # M001: Quality Score
    score = manuscript.get("quality_score", 0)
    if score < TARGET_SCORE:
        failed_rules.append({
            "rule_id": "M001", "rule_name": "Quality Score",
            "severity": "BLOCKER",
            "description": f"Quality Score {score} < Zielwert {TARGET_SCORE}",
            "evidence": str(score)
        })
        fix_tasks_list.append({
            "fix_id": str(uuid.uuid4()),
            "description": f"Qualitaet verbessern auf Score >= {TARGET_SCORE}",
            "target_artifact": task.input_artifacts[0],
            "priority": 1
        })

    # M002: High-Severity Issues
    high_issues = [i for i in manuscript.get("quality_issues", []) if i.get("severity") == "high"]
    if high_issues:
        failed_rules.append({
            "rule_id": "M002", "rule_name": "Keine High-Severity Issues",
            "severity": "BLOCKER",
            "description": f"{len(high_issues)} High-Severity Issues vorhanden",
            "evidence": str(high_issues[:3])
        })

    # M003: Seiten vollstaendig
    pages = manuscript.get("pages", [])
    if not pages:
        failed_rules.append({
            "rule_id": "M003", "rule_name": "Seiten vorhanden",
            "severity": "BLOCKER",
            "description": "Keine Seiten im Manuskript",
            "evidence": ""
        })
    else:
        incomplete = [p["page_number"] for p in pages if not p.get("text") or not p.get("image_prompt_en")]
        if incomplete:
            failed_rules.append({
                "rule_id": "M004", "rule_name": "Seiten vollstaendig",
                "severity": "BLOCKER",
                "description": f"Seiten ohne text oder image_prompt_en: {incomplete}",
                "evidence": str(incomplete)
            })

    status = "PASS" if not any(
        r["severity"] in ("BLOCKER", "MAJOR") for r in failed_rules
    ) else "FAIL"

    return make_report(
        task, "MANUSCRIPT_GATE", status,
        failed_rules, failed_checks, [], fix_tasks_list, improvements,
        evidence={
            "schema_valid": len(schema_errors) == 0,
            "quality_score": score,
            "page_count": len(pages),
        }
    )


def check_illustrations(task: Task) -> dict:
    """Gate 3: ILLUSTRATION_GATE - Prueft illustrations.json."""
    artifact_path = WORKSPACE_DIR / task.input_artifacts[0]
    if not artifact_path.exists():
        return make_report(
            task, "ILLUSTRATION_GATE", "FAIL",
            [{"rule_id": "I001", "rule_name": "Artefakt vorhanden", "severity": "BLOCKER",
              "description": "illustrations.json nicht gefunden", "evidence": ""}],
            [], [], [], [], {"schema_valid": False}
        )

    try:
        illus = json.loads(artifact_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return make_report(
            task, "ILLUSTRATION_GATE", "FAIL",
            [{"rule_id": "I000", "rule_name": "JSON parsebar", "severity": "BLOCKER",
              "description": f"illustrations.json ist kein gueltiges JSON: {e}", "evidence": ""}],
            [], [], [], [], {"schema_valid": False}
        )

    failed_rules = []
    illustrations_list = illus.get("illustrations", [])
    style_guide = illus.get("style_guide", {})

    # Schema-Validierung mit jsonschema
    schema_errors = validate_schema(illus, "illustrations")
    if schema_errors:
        for err in schema_errors:
            failed_rules.append({
                "rule_id": "SCHEMA",
                "rule_name": "JSON-Schema Konformitaet",
                "severity": "BLOCKER",
                "description": f"Schema-Fehler bei '{err['path']}': {err['message']}",
                "evidence": err["schema_path"],
            })

    # I001: Style Guide vollstaendig
    if not style_guide.get("art_style") or not style_guide.get("mood"):
        failed_rules.append({
            "rule_id": "I001", "rule_name": "Style Guide vollstaendig",
            "severity": "MAJOR",
            "description": "Style Guide unvollstaendig (art_style oder mood fehlt)",
            "evidence": str(style_guide)
        })

    # I002: Prompts auf Englisch und nicht leer
    short_prompts = [
        i["page_number"] for i in illustrations_list
        if len(i.get("prompt_en", "")) < 20
    ]
    if short_prompts:
        failed_rules.append({
            "rule_id": "I002", "rule_name": "Prompts Mindestlaenge",
            "severity": "MAJOR",
            "description": f"Zu kurze Prompts auf Seiten: {short_prompts}",
            "evidence": str(short_prompts)
        })

    # I003: Verbotene Elemente
    forbidden = style_guide.get("forbidden_elements", [])
    for illus_item in illustrations_list:
        prompt = illus_item.get("prompt_en", "").lower()
        violated = [f for f in forbidden if f.lower() in prompt]
        if violated:
            failed_rules.append({
                "rule_id": "I003", "rule_name": "Verbotene Elemente",
                "severity": "BLOCKER",
                "description": f"Seite {illus_item['page_number']}: Verbotene Elemente in Prompt: {violated}",
                "evidence": prompt[:200]
            })

    status = "PASS" if not any(
        r["severity"] in ("BLOCKER", "MAJOR") for r in failed_rules
    ) else "FAIL"

    return make_report(
        task, "ILLUSTRATION_GATE", status,
        failed_rules, [], [], [], [],
        evidence={
            "schema_valid": len(schema_errors) == 0,
            "page_count": len(illustrations_list),
        }
    )


GATE_HANDLERS = {
    "SCOPE_GATE": check_scope,
    "MANUSCRIPT_GATE": check_manuscript,
    "ILLUSTRATION_GATE": check_illustrations,
}


def process_task(task: Task) -> None:
    """Verarbeitet einen QC-Task."""
    project_id = task.project_id
    project_dir = WORKSPACE_DIR / "projects" / project_id
    tasks_dir = project_dir / "tasks"
    repo = TaskRepository(tasks_dir)

    task.mark_in_progress()
    repo.save(task)

    try:
        gate_name = task.metadata.get("gate_name", "")
        handler = GATE_HANDLERS.get(gate_name)

        if not handler:
            raise ValueError(f"Kein Handler fuer Gate: {gate_name}")

        report = handler(task)

        # Report schreiben
        report_path = WORKSPACE_DIR / task.output_artifacts[0]
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

        task.mark_completed()
        repo.save(task)

        LOG.info(
            f"Gate {gate_name}: {report['status']}",
            project_id=project_id,
            task_id=task.task_id,
            event="GATE_CHECKED",
        )

    except Exception as exc:
        LOG.error(f"QA Fehler: {exc}", project_id=project_id, task_id=task.task_id)
        task.mark_failed(str(exc))
        repo.save(task)


def main() -> None:
    LOG.info("Quality Product Agent gestartet", event="SERVICE_START")
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
                pending = repo.find_for_service(SERVICE_NAME, TaskStatus.PENDING)
                for task in pending:
                    process_task(task)
        except Exception as exc:
            LOG.error(f"Quality Product Fehler: {exc}", event="ERROR")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
