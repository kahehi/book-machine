# Output Contract: scope.json

**Artefakt-ID:** scope
**Erzeugt von:** product-worker
**Geprueft von:** quality-product (Gate 1: SCOPE_GATE)
**Schema:** /company/quality/schemas/scope.schema.json
**Speicherort:** /workspace/projects/<project_id>/02_scope/scope.json

---

## Beschreibung

Das Scope-Artefakt ist das erste formale Artefakt eines Projekts.
Es definiert den Rahmen, die Zielgruppe und die Deliverables des Buchprojekts.

---

## Pflicht-Eigenschaften

| Feld | Typ | Anforderung |
|---|---|---|
| project_id | string | Muss mit Projektordner uebereinstimmen |
| run_id | string | Muss laufende run_id sein |
| title | string | 3-200 Zeichen |
| concept | string | Mind. 50 Zeichen |
| target_audience.age_min | integer | >= 0 |
| target_audience.age_max | integer | <= 99, > age_min |
| genre | enum | Gueltiger Genre-Wert |
| language | string | ISO 639-1 Code |
| deliverables | array | Mind. 1 Element |
| constraints | object | Pflichtfeld |
| created_at | datetime | ISO 8601 |
| created_by | string | Service-Name |

---

## Acceptance Criteria

1. JSON ist schema-valide gegen scope.schema.json
2. title ist nicht leer und nicht laenger als 200 Zeichen
3. concept hat mindestens 50 Zeichen inhaltlichen Texts
4. age_max > age_min
5. mindestens ein Deliverable angegeben
6. Keine Safety-Flags in concept oder key_themes
7. created_by stimmt mit aufrufendem Service ueberein

---

## Verboten

- Medizinische Behauptungen im concept
- Bedrohliche oder angsteinflossende Elemente
- Leere arrays fuer deliverables
- approved=true ohne CEO-Freigabe

---

## Beispiel

```json
{
  "project_id": "proj_abc123",
  "run_id": "run_001",
  "title": "Leo und die tapfere Nacht",
  "concept": "Ein mutiger kleiner Loewe uberwindet seine Angst vor der Dunkelheit durch die Hilfe seiner Freunde und entdeckt, dass Tapferkeit bedeutet, trotz Angst voranzugehen.",
  "target_audience": {
    "age_min": 4,
    "age_max": 7,
    "description": "Vorschulkinder und fruehe Leser, die beruhigende Gute-Nacht-Geschichten lieben"
  },
  "genre": "picture_book",
  "language": "de",
  "page_count": { "min": 8, "max": 16 },
  "tone": "warm, beruhigend, liebevoll",
  "key_themes": ["Mut", "Freundschaft", "Schlafenszeit"],
  "deliverables": ["manuscript", "illustrations", "publishing_package"],
  "constraints": {
    "content_restrictions": ["Keine Gewalt", "Kein Erschrecken"],
    "platform_requirements": ["Amazon KDP", "Tolino"]
  },
  "approved": false,
  "created_at": "2025-01-01T10:00:00Z",
  "created_by": "product-worker"
}
```
