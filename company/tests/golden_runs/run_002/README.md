# Golden Run 002: Rework-Szenario – Manuskript-Verbesserung

**Projekt:** proj_golden_002
**Typ:** Rework-Pfad – Manuskript benoetigt Nachbesserung
**Erwartetes Ergebnis:** PUBLISHED (nach 1 Rework-Zyklus)

## Testbeschreibung

Manuskript-Qualitaet unter 85 im ersten Durchlauf.
Nach einem Rework-Zyklus wird der Zielwert erreicht.
Testet den REWORK_DRAFT Pfad der State Machine.

## Eingabe

- Idee: "Ein kleines Maedchen findet einen magischen Garten"
- Qualitaets-Score Erster Durchlauf: 70 (unter Ziel)
- Qualitaets-Score Nach Rework: 88 (ueber Ziel)

## Erwartete State-Uebergaenge

1. IDEA_INTAKE -> SCOPE_DEFINED
2. SCOPE_DEFINED -> OUTLINE_READY -> OUTLINE_APPROVED
3. OUTLINE_APPROVED -> DRAFT_READY
4. DRAFT_READY -> REWORK_DRAFT (Gate FAIL: Score 70)
5. REWORK_DRAFT -> DRAFT_READY (Rework abgeschlossen)
6. DRAFT_READY -> DRAFT_APPROVED (Gate PASS: Score 88)
7. ... -> PUBLISHED

## Assertions

- Genau 1 REWORK_DRAFT Zyklus
- Erstes QC-Report (Manuscript Gate): status=FAIL
- Zweites QC-Report (Manuscript Gate): status=PASS
- rework_counts.REWORK_DRAFT == 1
