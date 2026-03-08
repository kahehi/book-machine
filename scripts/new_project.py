#!/usr/bin/env python3
"""
Neues Buchprojekt anlegen.

Erstellt die Projektstruktur im workspace/projects/ Verzeichnis
und schreibt die Idee als idea.txt sowie den initialen state.json.

Verwendung:
    python scripts/new_project.py "Meine Buchidee"
    python scripts/new_project.py "Meine Buchidee" --project-id proj_mein_buch
    python scripts/new_project.py  # Fragt interaktiv nach der Idee

Danach:
    docker compose up --build
"""
import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Verzeichnisse relativ zum Skript (book-machine/)
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
WORKSPACE_PROJECTS = ROOT_DIR / "workspace" / "projects"
TEMPLATE_DIR = ROOT_DIR / "company" / "projects" / "_template"

# Unterverzeichnisse die erstellt werden
PROJECT_SUBDIRS = [
    "tasks",
    "01_intake",
    "02_scope",
    "03_outline",
    "04_manuscript",
    "05_illustrations",
    "06_layout",
    "07_publish",
    "qc_reports",
    "approvals",
    "dead_letter",
    "run",
]


def create_project(idea: str, project_id: str = None) -> Path:
    """
    Erstellt ein neues Projekt im workspace/projects/ Verzeichnis.

    Args:
        idea: Die Buchidee als Text
        project_id: Optionale Projekt-ID (wird generiert wenn nicht angegeben)

    Returns:
        Pfad zum erstellten Projektverzeichnis
    """
    if not project_id:
        short_id = uuid.uuid4().hex[:8]
        project_id = f"proj_{short_id}"

    project_dir = WORKSPACE_PROJECTS / project_id

    if project_dir.exists():
        print(f"FEHLER: Projekt '{project_id}' existiert bereits: {project_dir}")
        sys.exit(1)

    # Verzeichnisse erstellen
    for subdir in PROJECT_SUBDIRS:
        (project_dir / subdir).mkdir(parents=True, exist_ok=True)

    # idea.txt schreiben
    idea_path = project_dir / "01_intake" / "idea.txt"
    idea_path.write_text(idea.strip(), encoding="utf-8")

    # state.json erstellen (initialer Zustand)
    now = datetime.now(timezone.utc).isoformat()
    run_id = str(uuid.uuid4())

    state = {
        "project_id": project_id,
        "run_id": run_id,
        "state": "IDEA_INTAKE",
        "previous_state": None,
        "created_at": now,
        "updated_at": now,
        "rework_counts": {},
        "gate_results": {},
        "metadata": {
            "idea_preview": idea[:100],
        },
    }
    state_path = project_dir / "state.json"
    state_path.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")

    return project_dir


def approve_project(project_id: str, gate: str, comment: str = "") -> None:
    """
    CEO-Genehmigung fuer ein Gate schreiben.
    Legt approval/<gate>.json an.

    Args:
        project_id: Projekt-ID
        gate: Gate-Name (z.B. SCOPE_DEFINED, DRAFT_APPROVED)
        comment: Optionaler Kommentar des CEOs
    """
    approval_dir = WORKSPACE_PROJECTS / project_id / "approvals"
    approval_dir.mkdir(parents=True, exist_ok=True)

    approval = {
        "project_id": project_id,
        "gate": gate,
        "approved": True,
        "approved_by": "CEO",
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "comment": comment,
    }
    approval_path = approval_dir / f"{gate}.json"
    approval_path.write_text(json.dumps(approval, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  Genehmigung gesetzt: {approval_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Neues Buchprojekt fuer die Micro-Firma anlegen.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Beispiele:
  python scripts/new_project.py "Ein tapferer Loewe lernt das Laufen"
  python scripts/new_project.py "Geschichte ueber Freundschaft" --project-id proj_freundschaft
  python scripts/new_project.py --approve proj_abc123 SCOPE_DEFINED
        """,
    )

    # Haupt-Modus: neues Projekt
    parser.add_argument(
        "idea",
        nargs="?",
        help="Die Buchidee als Text (wird interaktiv abgefragt wenn nicht angegeben)",
    )
    parser.add_argument(
        "--project-id",
        dest="project_id",
        default=None,
        help="Optionale Projekt-ID (z.B. proj_mein_buch). Standardmaessig generiert.",
    )

    # Neben-Modus: CEO-Genehmigung erteilen
    parser.add_argument(
        "--approve",
        nargs=2,
        metavar=("PROJECT_ID", "GATE"),
        help="CEO-Genehmigung fuer ein Gate erteilen (z.B. --approve proj_abc SCOPE_DEFINED)",
    )
    parser.add_argument(
        "--comment",
        default="",
        help="Kommentar zur Genehmigung",
    )

    args = parser.parse_args()

    # CEO-Genehmigung
    if args.approve:
        project_id, gate = args.approve
        if not (WORKSPACE_PROJECTS / project_id).exists():
            print(f"FEHLER: Projekt '{project_id}' nicht gefunden in {WORKSPACE_PROJECTS}")
            sys.exit(1)
        print(f"\nCEO-Genehmigung fuer Projekt '{project_id}', Gate '{gate}'...")
        approve_project(project_id, gate, args.comment)
        print("Genehmigung geschrieben. Der Orchestrator wird sie beim naechsten Poll erkennen.")
        return

    # Neues Projekt anlegen
    WORKSPACE_PROJECTS.mkdir(parents=True, exist_ok=True)

    idea = args.idea
    if not idea:
        print("Buchidee (Enter zum Beenden):")
        idea = input("> ").strip()
        if not idea:
            print("Keine Idee angegeben. Abbruch.")
            sys.exit(0)

    print(f"\nErstelle Projekt...")
    print(f"  Idee: {idea[:80]}{'...' if len(idea) > 80 else ''}")

    project_dir = create_project(idea, args.project_id)
    project_id = project_dir.name

    print(f"\nProjekt erstellt:")
    print(f"  ID:         {project_id}")
    print(f"  Verzeichnis: {project_dir}")
    print(f"  Status:     IDEA_INTAKE")
    print()
    print("Naechste Schritte:")
    print(f"  1. docker compose up --build")
    print(f"  2. Warte auf SCOPE_DEFINED State")
    print(f"  3. python scripts/new_project.py --approve {project_id} SCOPE_DEFINED")
    print()
    print(f"Logs beobachten:")
    print(f"  docker compose logs -f orchestrator")
    print(f"  docker compose logs -f product-worker")


if __name__ == "__main__":
    main()
