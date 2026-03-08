# Output Contract: illustrations.json

**Artefakt-ID:** illustrations
**Erzeugt von:** product-worker
**Geprueft von:** quality-product (Gate 3: ILLUSTRATION_GATE)
**Schema:** /company/quality/schemas/illustrations.schema.json
**Speicherort:** /workspace/projects/<project_id>/05_illustrations/illustrations.json
**Voraussetzung:** manuscript.json (approved=true)

---

## Beschreibung

Das Illustrations-Artefakt enthaelt Style Guide und alle Bildprompts fuer das Buch.
Jede Seite des Manuskripts muss eine korrespondierende Illustration haben.

---

## Acceptance Criteria

1. JSON ist schema-valide gegen illustrations.schema.json
2. Fuer jede Seite in manuscript.json existiert eine Illustration
3. Style Guide vollstaendig (art_style, color_palette, mood)
4. Alle Prompts sind auf Englisch und mindestens 20 Zeichen lang
5. Keine verbotenen Bildelemente in den Prompts (gemaess style_guide.forbidden_elements)
6. Kein Illustration-Status = REJECTED ohne neuen Prompt
7. aspect_ratio ist fuer alle Illustrationen konsistent

---

## Verboten

- Prompts in anderen Sprachen als Englisch
- Verbotene Bildelemente (Gewalt, Horror, unangemessene Darstellungen)
- Fehlende Illustrationen fuer vorhandene Manuskript-Seiten
- Inkonsistente Charakter-Beschreibungen zwischen Prompts
