# Output Contract: outline.json

**Artefakt-ID:** outline
**Erzeugt von:** product-worker
**Geprueft von:** quality-product (Gate 1: SCOPE_GATE)
**Schema:** /company/quality/schemas/outline.schema.json
**Speicherort:** /workspace/projects/<project_id>/03_outline/outline.json
**Voraussetzung:** scope.json (approved=true)

---

## Beschreibung

Das Outline-Artefakt definiert die detaillierte Kapitel- und Szenenstruktur des Buchs.
Es bildet die verbindliche Grundlage fuer das Manuskript.

---

## Pflicht-Eigenschaften

| Feld | Typ | Anforderung |
|---|---|---|
| project_id | string | Identisch mit scope.project_id |
| chapters | array | Mind. 1 Kapitel |
| chapters[].chapter_number | integer | Aufsteigend, lueckenlos |
| chapters[].title | string | Nicht leer |
| chapters[].summary | string | Mind. 20 Zeichen |
| chapters[].scenes | array | Mind. 1 Szene |
| character_list | array | Mind. 1 Charakter |
| character_list[].role | enum | protagonist/antagonist/supporting/mentor/other |
| narrative_arc.setup | string | Nicht leer |
| narrative_arc.climax | string | Nicht leer |
| narrative_arc.resolution | string | Nicht leer |

---

## Acceptance Criteria

1. JSON ist schema-valide gegen outline.schema.json
2. project_id stimmt mit scope.json ueberein
3. Mindestens 1 Kapitel mit mindestens 1 Szene
4. Kapitel-Nummern sind aufsteigend und lueckenlos (1, 2, 3, ...)
5. Mindestens 1 Protagonist in character_list
6. narrative_arc ist vollstaendig (setup, climax, resolution)
7. estimated_word_count passt zur page_count aus scope.json

---

## Verboten

- Orphaned Szenen ohne Kapitelverweis
- Luecken in Kapitel-Nummerierung
- Leere character_list
- Inconsistente Charakter-Namen (Schreibweise muss einheitlich sein)
