# Golden Run 004: Schema-Validierungs-Fehler

**Projekt:** proj_golden_004
**Typ:** Edge Case – Invalides Artefakt vom Worker
**Erwartetes Ergebnis:** REWORK_SCOPE, dann SCOPE_DEFINED (nach Korrektur)

## Testbeschreibung

product-worker liefert scope.json ohne Pflichtfeld 'concept'.
quality-product erkennt den BLOCKER und meldet FAIL.
Orchestrator loest REWORK_SCOPE aus.
Nach Korrektur wird scope.json akzeptiert.

## Assertions

- QC-Report: failed_rules enthaelt R002 (Konzept Mindestlaenge)
- QC-Report: status=FAIL
- Orchestrator: korrekte REWORK_SCOPE Transition
- Kein direkter Absturz bei invaliden Daten
