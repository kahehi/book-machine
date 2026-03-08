# Output Contract: manuscript.json

**Artefakt-ID:** manuscript
**Erzeugt von:** product-worker
**Geprueft von:** quality-product (Gate 2: MANUSCRIPT_GATE)
**Schema:** /company/quality/schemas/manuscript.schema.json
**Speicherort:** /workspace/projects/<project_id>/04_manuscript/manuscript.json
**Voraussetzung:** outline.json (approved=true)

---

## Beschreibung

Das Manuskript ist der vollstaendige Buchtext mit seitenweiser Struktur.
Es wird iterativ verbessert, bis der Quality Score >= 85 und keine high-severity Issues mehr vorhanden sind.

---

## Pflicht-Eigenschaften

| Feld | Typ | Anforderung |
|---|---|---|
| project_id | string | Identisch mit scope.project_id |
| title | string | Identisch mit scope.title |
| language | string | Identisch mit scope.language |
| pages | array | Mind. 1 Seite |
| pages[].page_number | integer | Aufsteigend, lueckenlos ab 1 |
| pages[].text | string | Mind. 1 Zeichen |
| pages[].image_prompt_en | string | Englischer Bildprompt |
| word_count | integer | Gesamt-Wortanzahl |
| quality_score | number | 0-100 |
| iteration | integer | >= 0 |

---

## Acceptance Criteria

1. JSON ist schema-valide gegen manuscript.schema.json
2. quality_score >= 85
3. Keine Eintraege in quality_issues mit severity="high"
4. Alle Seiten haben text und image_prompt_en
5. Seitennummern aufsteigend und lueckenlos (1, 2, 3, ...)
6. Seitenanzahl liegt in dem Bereich aus scope.page_count
7. Keine Safety-Flags (Inhalt altersgerecht)
8. Sprachcode stimmt mit scope.language ueberein

---

## Qualitaets-Kriterien (fuer Quality Score)

| Kriterium | Gewichtung |
|---|---|
| Sprache (Satzlaenge, Vokabular) | 25% |
| Struktur (narrativer Aufbau) | 20% |
| Konsistenz (Charaktere, Handlung) | 20% |
| Ton (altersgerecht, warm) | 15% |
| Repetition (Wortwahl, Phrasen) | 10% |
| Safety (kein problematischer Inhalt) | 10% |

---

## Iterationsprozess

1. product-worker schreibt manuscript.json (iteration=0)
2. quality-product prueft und schreibt qc_report.json
3. Bei FAIL: product-worker schreibt neue Version (iteration+1)
4. Maximal MAX_ITERATIONS Versuche
5. Bei Stagnation (kein Score-Fortschritt): Exit mit letztem Stand

---

## Verboten

- approved=true ohne Gate-PASS und CEO-Freigabe
- Leere Textfelder
- Fehlende Bildprompts
- Safety-relevante Inhalte (Gewalt, Angst, medizinische Claims)
