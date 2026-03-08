"""
State Machine Implementation fuer Buchprojekt-Lebenszyklus.
Validiert State-Transitionen und verhindert illegale Uebergaenge.
"""
import json
from enum import Enum
from pathlib import Path
from typing import Optional


class ProjectState(str, Enum):
    """Alle moeglichen Projektstatus."""
    IDEA_INTAKE = "IDEA_INTAKE"
    SCOPE_DEFINED = "SCOPE_DEFINED"
    OUTLINE_READY = "OUTLINE_READY"
    OUTLINE_APPROVED = "OUTLINE_APPROVED"
    DRAFT_READY = "DRAFT_READY"
    DRAFT_APPROVED = "DRAFT_APPROVED"
    ILLUSTRATIONS_READY = "ILLUSTRATIONS_READY"
    ILLUSTRATIONS_APPROVED = "ILLUSTRATIONS_APPROVED"
    LAYOUT_READY = "LAYOUT_READY"
    LAYOUT_APPROVED = "LAYOUT_APPROVED"
    PUBLISH_READY = "PUBLISH_READY"
    PUBLISH_APPROVED = "PUBLISH_APPROVED"
    PUBLISHED = "PUBLISHED"
    REWORK_SCOPE = "REWORK_SCOPE"
    REWORK_OUTLINE = "REWORK_OUTLINE"
    REWORK_DRAFT = "REWORK_DRAFT"
    REWORK_ILLUSTRATIONS = "REWORK_ILLUSTRATIONS"
    REWORK_LAYOUT = "REWORK_LAYOUT"
    REWORK_PUBLISH = "REWORK_PUBLISH"
    FAILED = "FAILED"
    DEAD_LETTER = "DEAD_LETTER"


# Erlaubte Transitionen (von -> zu)
ALLOWED_TRANSITIONS: dict[ProjectState, list[ProjectState]] = {
    ProjectState.IDEA_INTAKE: [
        ProjectState.SCOPE_DEFINED,
        ProjectState.FAILED,
    ],
    ProjectState.SCOPE_DEFINED: [
        ProjectState.OUTLINE_READY,
        ProjectState.REWORK_SCOPE,
        ProjectState.FAILED,
    ],
    ProjectState.OUTLINE_READY: [
        ProjectState.OUTLINE_APPROVED,
        ProjectState.REWORK_OUTLINE,
        ProjectState.FAILED,
    ],
    ProjectState.OUTLINE_APPROVED: [
        ProjectState.DRAFT_READY,
        ProjectState.FAILED,
    ],
    ProjectState.DRAFT_READY: [
        ProjectState.DRAFT_APPROVED,
        ProjectState.REWORK_DRAFT,
        ProjectState.FAILED,
    ],
    ProjectState.DRAFT_APPROVED: [
        ProjectState.ILLUSTRATIONS_READY,
        ProjectState.FAILED,
    ],
    ProjectState.ILLUSTRATIONS_READY: [
        ProjectState.ILLUSTRATIONS_APPROVED,
        ProjectState.REWORK_ILLUSTRATIONS,
        ProjectState.FAILED,
    ],
    ProjectState.ILLUSTRATIONS_APPROVED: [
        ProjectState.LAYOUT_READY,
        ProjectState.FAILED,
    ],
    ProjectState.LAYOUT_READY: [
        ProjectState.LAYOUT_APPROVED,
        ProjectState.REWORK_LAYOUT,
        ProjectState.FAILED,
    ],
    ProjectState.LAYOUT_APPROVED: [
        ProjectState.PUBLISH_READY,
        ProjectState.FAILED,
    ],
    ProjectState.PUBLISH_READY: [
        ProjectState.PUBLISH_APPROVED,
        ProjectState.REWORK_PUBLISH,
        ProjectState.FAILED,
    ],
    ProjectState.PUBLISH_APPROVED: [
        ProjectState.PUBLISHED,
        ProjectState.FAILED,
    ],
    ProjectState.PUBLISHED: [],  # Terminal
    ProjectState.REWORK_SCOPE: [
        ProjectState.SCOPE_DEFINED,
        ProjectState.FAILED,
        ProjectState.DEAD_LETTER,
    ],
    ProjectState.REWORK_OUTLINE: [
        ProjectState.OUTLINE_READY,
        ProjectState.FAILED,
        ProjectState.DEAD_LETTER,
    ],
    ProjectState.REWORK_DRAFT: [
        ProjectState.DRAFT_READY,
        ProjectState.FAILED,
        ProjectState.DEAD_LETTER,
    ],
    ProjectState.REWORK_ILLUSTRATIONS: [
        ProjectState.ILLUSTRATIONS_READY,
        ProjectState.FAILED,
        ProjectState.DEAD_LETTER,
    ],
    ProjectState.REWORK_LAYOUT: [
        ProjectState.LAYOUT_READY,
        ProjectState.FAILED,
        ProjectState.DEAD_LETTER,
    ],
    ProjectState.REWORK_PUBLISH: [
        ProjectState.PUBLISH_READY,
        ProjectState.FAILED,
        ProjectState.DEAD_LETTER,
    ],
    ProjectState.FAILED: [
        ProjectState.DEAD_LETTER,
    ],
    ProjectState.DEAD_LETTER: [],  # Terminal
}


class IllegalTransitionError(Exception):
    """Wird geworfen bei illegalen State-Transitionen."""
    pass


class StateMachine:
    """
    Validiert und fuehrt State-Transitionen durch.
    Nur der Orchestrator sollte diese Klasse verwenden.
    """

    def validate_transition(
        self,
        from_state: ProjectState,
        to_state: ProjectState,
    ) -> bool:
        """
        Prueft ob eine Transition erlaubt ist.

        Returns:
            True wenn erlaubt, False sonst
        """
        allowed = ALLOWED_TRANSITIONS.get(from_state, [])
        return to_state in allowed

    def transition(
        self,
        from_state: ProjectState,
        to_state: ProjectState,
    ) -> ProjectState:
        """
        Fuehrt eine Transition durch.

        Raises:
            IllegalTransitionError: Wenn Transition nicht erlaubt
        """
        if not self.validate_transition(from_state, to_state):
            raise IllegalTransitionError(
                f"Illegale Transition: {from_state} -> {to_state}. "
                f"Erlaubt: {[s.value for s in ALLOWED_TRANSITIONS.get(from_state, [])]}"
            )
        return to_state

    def is_terminal(self, state: ProjectState) -> bool:
        """Prueft ob ein State ein Terminal-State ist."""
        return len(ALLOWED_TRANSITIONS.get(state, [])) == 0

    def is_rework(self, state: ProjectState) -> bool:
        """Prueft ob ein State ein Rework-State ist."""
        return state.value.startswith("REWORK_")

    def get_allowed_transitions(self, state: ProjectState) -> list[ProjectState]:
        """Gibt die erlaubten Folge-States zurueck."""
        return ALLOWED_TRANSITIONS.get(state, [])


class ProjectStateManager:
    """
    Verwaltet den Projektstatus in der state.json Datei.
    """

    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.state_file = project_dir / "state.json"
        self.sm = StateMachine()

    def initialize(self, project_id: str, run_id: str, idea: str) -> dict:
        """Initialisiert ein neues Projekt."""
        state = {
            "project_id": project_id,
            "run_id": run_id,
            "status": ProjectState.IDEA_INTAKE.value,
            "idea": idea,
            "rework_counts": {},
            "history": [],
        }
        self._save(state)
        return state

    def get(self) -> Optional[dict]:
        """Laedt den aktuellen Projektstatus."""
        if not self.state_file.exists():
            return None
        return json.loads(self.state_file.read_text(encoding="utf-8"))

    def transition(
        self,
        to_state: ProjectState,
        reason: str = "",
        run_id: Optional[str] = None,
    ) -> dict:
        """
        Fuehrt eine State-Transition durch und speichert den neuen Status.

        Raises:
            IllegalTransitionError: Bei illegaler Transition
        """
        state = self.get()
        if state is None:
            raise ValueError("Projekt nicht initialisiert")

        from_state = ProjectState(state["status"])
        new_state = self.sm.transition(from_state, to_state)

        # Rework-Counter erhoehen
        if self.sm.is_rework(to_state):
            rework_key = to_state.value
            state["rework_counts"][rework_key] = (
                state["rework_counts"].get(rework_key, 0) + 1
            )

        # Neue run_id setzen falls uebergeben
        if run_id:
            state["run_id"] = run_id

        # History aktualisieren
        from datetime import datetime, timezone
        state["history"].append({
            "from": from_state.value,
            "to": new_state.value,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        state["status"] = new_state.value
        self._save(state)
        return state

    def get_rework_count(self, rework_state: ProjectState) -> int:
        """Gibt die Anzahl der Rework-Zyklen zurueck."""
        state = self.get()
        if not state:
            return 0
        return state.get("rework_counts", {}).get(rework_state.value, 0)

    def _save(self, state: dict) -> None:
        """Speichert den Projektstatus."""
        self.project_dir.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(
            json.dumps(state, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
