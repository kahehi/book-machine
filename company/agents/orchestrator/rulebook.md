# Rulebook: Orchestrator Agent (COO)

Version: 1.0.0
Service: orchestrator

---

## Identitaet und Rolle

Der Orchestrator ist der Chief Operating Officer (COO) der Micro-Firma.
Er ist der einzige Service, der den Projektstatus und Tasks kontrolliert.
Er entscheidet nicht inhaltlich, sondern koordiniert den Ablauf.

---

## Entscheidungsrechte

### Darf der Orchestrator:
- [x] Projektstatus in state.json setzen
- [x] Tasks erstellen und in task.json schreiben
- [x] Tasks einem Service zuweisen (owner_service)
- [x] Retry-Mechanismus fuer fehlgeschlagene Tasks ausloesen
- [x] Projekte in Dead Letter Queue verschieben
- [x] run_id generieren und Run-Tracking starten
- [x] QC-Reports lesen und auswerten

### Darf der Orchestrator NICHT:
- [ ] Artefakte inhaltlich veraendern (scope.json, manuscript.json, etc.)
- [ ] QA-Pruefungen durchfuehren
- [ ] CEO-Freigaben erteilen
- [ ] LLM-Aufrufe fuer Inhalte machen

---

## Kernaufgaben

### 1. Projektstart
Bei neuem Projekt (status=IDEA_INTAKE):
1. Generiere run_id: `run_{timestamp}_{random}`
2. Erstelle Ordner: `/projects/<id>/runs/<run_id>/`
3. Initialisiere events.log und decisions.log
4. Erstelle SCOPE_DEFINE Task fuer product-worker
5. Setze Status: IDEA_INTAKE -> (warte auf Task-Completion)

### 2. Task-Verteilung
Fuer jeden neuen Projektstatus:
1. Lese state_machine.json: was ist der naechste Schritt?
2. Erstelle entsprechenden Task
3. Setze task.status=PENDING
4. Schreibe task.json in /projects/<id>/tasks/

### 3. QC-Report-Auswertung
Nach Abschluss eines QA-Tasks:
1. Lese qc_report.json
2. Bei status=PASS: naechste Transition ausloesen
3. Bei status=FAIL: REWORK_* Task erstellen, rework_count erhoehen
4. Bei rework_count > max_rework_cycles: DEAD_LETTER

### 4. Run-Tracking
Jedes relevante Event in events.log schreiben:
```json
{ "timestamp": "...", "event": "TASK_CREATED", "task_id": "...", "details": "..." }
```

Jede Entscheidung in decisions.log schreiben:
```json
{ "timestamp": "...", "decision": "STATE_TRANSITION", "from": "...", "to": "...", "reason": "..." }
```

---

## Konkurrenz-Kontrolle

Vor dem Setzen von state.json:
1. Pruefe ob Lock vorhanden: `/projects/<id>/lock.json`
2. Wenn Lock gueltig (lease_until in Zukunft): warte
3. Wenn Lock abgelaufen oder nicht vorhanden: erwerbe Lock
4. Schreibe state.json
5. Gib Lock frei

---

## Fehlerbehandlung

| Situation | Aktion |
|---|---|
| Task FAILED, retry_count < max_retries | Neuen PENDING Task erstellen |
| Task FAILED, retry_count >= max_retries | Status -> FAILED, Task -> DEAD_LETTER |
| QA-Report fehlt nach Timeout | Task als FAILED markieren |
| Illegale State-Transition versucht | Log ERROR, ignoriere Transition |

---

## Polling-Intervall

Standard: 5 Sekunden (konfigurierbar via POLL_INTERVAL Umgebungsvariable)

---

## Log-Format

Alle Logs als strukturiertes JSON:
```json
{
  "timestamp": "2025-01-01T12:00:00Z",
  "level": "INFO",
  "service": "orchestrator",
  "project_id": "proj_abc",
  "run_id": "run_001",
  "message": "Task erstellt: SCOPE_DEFINE",
  "task_id": "uuid-here"
}
```
