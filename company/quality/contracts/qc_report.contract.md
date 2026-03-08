# Output Contract: qc_report.json

**Artefakt-ID:** qc_report
**Erzeugt von:** quality-* Services
**Geprueft von:** orchestrator (liest Report)
**Schema:** /company/quality/schemas/qc_report.schema.json
**Speicherort:** /workspace/projects/<project_id>/qc_reports/<gate_name>_qc_report.json

---

## Beschreibung

Der QC-Report ist das einzige Artefakt, das QA-Agenten erzeugen duerfen.
Er dokumentiert das Ergebnis einer Gate-Pruefung und ist die Grundlage fuer
die Orchestrator-Entscheidung.

---

## Acceptance Criteria (des Reports selbst)

1. JSON ist schema-valide gegen qc_report.schema.json
2. status ist exakt PASS oder FAIL (kein Dritter Wert)
3. Bei FAIL: failed_rules ist nicht leer
4. Bei PASS: failed_rules enthaelt nur MINOR Issues (oder ist leer)
5. evidence.schema_valid ist befuellt
6. reviewer_service stimmt mit dem aufrufenden QA-Service ueberein
7. gate_name stimmt mit dem geprueften Gate ueberein

---

## Status-Logik

| Bedingung | Status |
|---|---|
| Keine BLOCKER oder MAJOR Verletzungen | PASS |
| Mind. 1 BLOCKER Verletzung | FAIL |
| Mind. 1 MAJOR Verletzung | FAIL |
| Nur MINOR Verletzungen | PASS (mit improvements) |

---

## Verboten

- QA-Agent veraendert das gepruefre Artefakt
- QA-Agent schreibt fix_tasks ohne konkrete Beschreibung
- QA-Agent setzt status=PASS bei vorhandenen BLOCKERs
- QA-Agent erstellt Tasks direkt (nur via fix_tasks Empfehlung)
