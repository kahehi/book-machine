# Golden Run 003: Dead Letter Szenario – Max Rework erreicht

**Projekt:** proj_golden_003
**Typ:** Fehler-Pfad – Max Rework-Zyklen erreicht
**Erwartetes Ergebnis:** DEAD_LETTER

## Testbeschreibung

Das Manuskript kann die Qualitaetsanforderungen auch nach MAX_REWORK_CYCLES=3
Versuchen nicht erfuellen. Das Projekt landet in der Dead Letter Queue.

## Eingabe

- MAX_REWORK_CYCLES: 3 (Standard)
- Qualitaets-Score: Immer unter 85 (simuliert durch Mock)

## Erwartete State-Uebergaenge

1. IDEA_INTAKE -> SCOPE_DEFINED -> ... -> DRAFT_READY
2. DRAFT_READY -> REWORK_DRAFT (Zyklus 1, Gate FAIL)
3. REWORK_DRAFT -> DRAFT_READY -> REWORK_DRAFT (Zyklus 2, Gate FAIL)
4. REWORK_DRAFT -> DRAFT_READY -> REWORK_DRAFT (Zyklus 3, Gate FAIL)
5. REWORK_DRAFT -> DEAD_LETTER (Max Zyklen erreicht)

## Assertions

- rework_counts.REWORK_DRAFT == 3
- Final Status: DEAD_LETTER
- Dead Letter Verzeichnis enthaelt Task-Datei
- Kein Absturz, keine Exception – kontrollierter Fehler-Pfad
