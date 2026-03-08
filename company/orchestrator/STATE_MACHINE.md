# State Machine – Micro-Firma Buchproduktion

Version: 1.0.0
Autor: Orchestrator (COO)
Sprache: Deutsch (ss statt ss)

---

## Uebersicht

Der Lebenszykle eines Buchprojekts wird durch eine deterministische State Machine gesteuert.
Nur der Orchestrator darf den Projektstatus setzen.
Illegale Transitionen werden hart abgewiesen und geloggt.

---

## State-Diagramm

```
IDEA_INTAKE
    |
    v
SCOPE_DEFINED ──── [CEO-Freigabe fehlt] ──> REWORK_SCOPE
    |                                              |
    | [Gate PASS + CEO OK]                         v
    v                                       SCOPE_DEFINED
OUTLINE_READY
    |
    | [Gate PASS + CEO OK]
    v
OUTLINE_APPROVED
    |
    v
DRAFT_READY
    |
    | [Gate PASS + CEO OK]
    v
DRAFT_APPROVED
    |
    v
ILLUSTRATIONS_READY
    |
    | [Gate PASS + CEO OK]
    v
ILLUSTRATIONS_APPROVED
    |
    v
LAYOUT_READY
    |
    | [Gate PASS + CEO OK]
    v
LAYOUT_APPROVED
    |
    v
PUBLISH_READY
    |
    | [Gate PASS + CEO OK]
    v
PUBLISH_APPROVED
    |
    v
PUBLISHED (Terminal)

Fehler-Pfade:
* -> FAILED -> DEAD_LETTER (Terminal)
*_READY -> REWORK_* -> *_READY (max. 3 Zyklen)
```

---

## States im Detail

### Produktions-States

| State | Typ | Gate | Naechster State |
|---|---|---|---|
| IDEA_INTAKE | active | – | SCOPE_DEFINED |
| SCOPE_DEFINED | waiting_approval | SCOPE_GATE | OUTLINE_READY |
| OUTLINE_READY | active | SCOPE_GATE | OUTLINE_APPROVED |
| OUTLINE_APPROVED | approved | – | DRAFT_READY |
| DRAFT_READY | active | MANUSCRIPT_GATE | DRAFT_APPROVED |
| DRAFT_APPROVED | approved | – | ILLUSTRATIONS_READY |
| ILLUSTRATIONS_READY | active | ILLUSTRATION_GATE | ILLUSTRATIONS_APPROVED |
| ILLUSTRATIONS_APPROVED | approved | – | LAYOUT_READY |
| LAYOUT_READY | active | LAYOUT_GATE | LAYOUT_APPROVED |
| LAYOUT_APPROVED | approved | – | PUBLISH_READY |
| PUBLISH_READY | active | PUBLISH_GATE | PUBLISH_APPROVED |
| PUBLISH_APPROVED | approved | – | PUBLISHED |
| PUBLISHED | terminal | – | – |

### Rework-States

| State | Ziel | Maximal |
|---|---|---|
| REWORK_SCOPE | SCOPE_DEFINED | 3x |
| REWORK_OUTLINE | OUTLINE_READY | 3x |
| REWORK_DRAFT | DRAFT_READY | 3x |
| REWORK_ILLUSTRATIONS | ILLUSTRATIONS_READY | 3x |
| REWORK_LAYOUT | LAYOUT_READY | 3x |
| REWORK_PUBLISH | PUBLISH_READY | 3x |

### Fehler-States

| State | Beschreibung |
|---|---|
| FAILED | Unbehebbarer Fehler – manueller Eingriff noetig |
| DEAD_LETTER | Nach max. Rework-Zyklen oder kritischem Fehler |

---

## Transitionsregeln

### Regel 1: Nur Orchestrator setzt Status
Kein anderer Service darf `state.json` schreiben.
Alle anderen Services schreiben nur ihre Artefakte.

### Regel 2: Gate-Pruefung vor Transition
Jede Transition von einem `*_READY` State erfordert:
1. QA-Agent prueft Artefakt
2. QA-Agent schreibt `qc_report.json` mit Status PASS oder FAIL
3. Orchestrator liest Report und entscheidet

### Regel 3: CEO-Freigabe bei Approval-States
Bestimmte States erfordern explizite CEO-Freigabe (approval_required=true).
Ohne Freigabe bleibt der State stehen.

### Regel 4: Rework-Limit
Jeder Rework-Zyklus erhoet den Counter.
Nach 3 Rework-Zyklen geht das Projekt in DEAD_LETTER.

### Regel 5: Idempotenz
Jede Transition muss idempotent sein.
Wird dieselbe Transition zweimal ausgefuehrt, ist das Ergebnis identisch.

---

## Hard Gates

| Gate | State | QA-Owner |
|---|---|---|
| Gate 1: SCOPE_GATE | SCOPE_DEFINED | quality-product |
| Gate 2: MANUSCRIPT_GATE | DRAFT_READY | quality-product |
| Gate 3: ILLUSTRATION_GATE | ILLUSTRATIONS_READY | quality-product |
| Gate 4: LAYOUT_GATE | LAYOUT_READY | quality-tech |
| Gate 5: PUBLISH_GATE | PUBLISH_READY | quality-global |

---

## Logging-Anforderungen

Jede Transition wird in `/projects/<id>/runs/<run_id>/decisions.log` geloggt:

```json
{
  "timestamp": "2025-01-01T12:00:00Z",
  "event": "STATE_TRANSITION",
  "from_state": "IDEA_INTAKE",
  "to_state": "SCOPE_DEFINED",
  "triggered_by": "orchestrator",
  "run_id": "run_abc123",
  "project_id": "proj_xyz",
  "reason": "Scope Task erfolgreich abgeschlossen"
}
```
