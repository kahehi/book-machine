# Output Contract: task.json

**Artefakt-ID:** task
**Erzeugt von:** orchestrator (ausschliesslich)
**Geprueft von:** Empfangender Worker/QA Agent (implizit)
**Schema:** /company/quality/schemas/task.schema.json
**Speicherort:** /workspace/projects/<project_id>/tasks/<task_id>.json

---

## Beschreibung

Tasks sind die Kommunikationseinheit des Orchestrators.
Nur der Orchestrator darf Tasks erstellen und verteilen.
Worker und QA Agents lesen Tasks und aktualisieren ihren Status.

---

## Acceptance Criteria

1. JSON ist schema-valide gegen task.schema.json
2. task_id ist eindeutige UUID v4
3. owner_service ist ein gueltiger Service-Name
4. input_artifacts zeigen auf existierende Dateien
5. output_artifacts definieren erwartete Ausgabe-Pfade
6. acceptance_criteria enthaelt mindestens 1 Pruefkriterium
7. retry_count <= max_retries bei Erstellung (0 == 0)
8. status=PENDING bei Erstellung

---

## Status-Uebergaenge

| Von | Nach | Darf |
|---|---|---|
| PENDING | IN_PROGRESS | Empfangender Service |
| IN_PROGRESS | COMPLETED | Empfangender Service |
| IN_PROGRESS | FAILED | Empfangender Service |
| FAILED | PENDING | Orchestrator (Retry) |
| FAILED | DEAD_LETTER | Orchestrator (nach max_retries) |

---

## Idempotenz-Anforderung

Jeder Task muss idempotent sein:
- Wiederholte Ausfuehrung liefert dasselbe Ergebnis
- Bereits vorhandene Output-Artefakte werden ueberschrieben (nicht dupliziert)
- Lock muss vor dem Schreiben erworben werden

---

## Verboten

- Worker Agents erstellen Tasks
- QA Agents erstellen Tasks direkt
- Task-Status rueckwaerts setzen (COMPLETED -> IN_PROGRESS)
- Tasks ohne acceptance_criteria
