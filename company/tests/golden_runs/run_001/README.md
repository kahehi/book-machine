# Golden Run 001: Leo und die tapfere Nacht

**Projekt:** proj_golden_001
**Typ:** Happy Path – Vollstaendiger Durchlauf ohne Rework
**Erwartetes Ergebnis:** PUBLISHED

## Testbeschreibung

Einfaches Kinderbuch ueber einen mutigen Loewen.
Kein Rework erforderlich. Alle Gates passieren auf Anhieb.

## Eingabe

- Idee: "Ein mutiger kleiner Loewe, der Angst vor der Dunkelheit hat"
- Zielgruppe: 4-7 Jahre
- Genre: Bilderbuch

## Erwartete State-Uebergaenge

1. IDEA_INTAKE -> SCOPE_DEFINED
2. SCOPE_DEFINED -> OUTLINE_READY
3. OUTLINE_READY -> OUTLINE_APPROVED
4. OUTLINE_APPROVED -> DRAFT_READY
5. DRAFT_READY -> DRAFT_APPROVED
6. DRAFT_APPROVED -> ILLUSTRATIONS_READY
7. ILLUSTRATIONS_READY -> ILLUSTRATIONS_APPROVED
8. ILLUSTRATIONS_APPROVED -> LAYOUT_READY
9. LAYOUT_READY -> LAYOUT_APPROVED
10. LAYOUT_APPROVED -> PUBLISH_READY
11. PUBLISH_READY -> PUBLISH_APPROVED
12. PUBLISH_APPROVED -> PUBLISHED

## Assertions

- Alle QC-Reports: status=PASS
- Manuskript quality_score >= 85
- publishing_package.json vorhanden und valide
- manuscript.md vorhanden
