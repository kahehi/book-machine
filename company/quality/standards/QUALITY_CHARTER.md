# Quality Charter – Micro-Firma Buchproduktion

Version: 1.0.0
Erstellt: 2025-01-01
Verantwortlich: Global Quality Agent (CQO)

---

## 1. Zweck und Geltungsbereich

Diese Charter definiert verbindliche Qualitaetsstandards fuer alle Artefakte der Micro-Firma.
Sie gilt fuer alle Agent-Services und ist von jedem QA-Agenten anzuwenden.

---

## 2. Kernprinzipien

### 2.1 Trennung der Rollen

| Rolle | Darf |
|---|---|
| Worker Agents | Artefakte erzeugen |
| QA Agents | Artefakte pruefen (nur lesen + bewerten) |
| Orchestrator | Status setzen, Tasks erstellen |
| CEO (Mensch) | Freigaben erteilen |

**QA Agents duerfen NIEMALS Artefakte veraendern.**
**Worker Agents duerfen NIEMALS Freigaben erteilen.**

### 2.2 Regelbasierte Pruefung

QA-Agenten pruefen ausschliesslich gegen definierte Regeln.
Heuristische Verbesserungsvorschlaege werden als nicht-blockierende `improvements` ausgegeben.
Inhaltsaenderungen liegen immer beim Worker Agent.

---

## 3. Severity Levels

### BLOCKER
- Verhindert den Fortschritt des Projekts
- Das Gate schlaegt fehl (Status: FAIL)
- Muss behoben werden, bevor weitergearbeitet werden kann
- Beispiele: Schema-Validierungsfehler, fehlende Pflichtartefakte, Safety-Verstoesse

### MAJOR
- Erhebliche Qualitaetsbeeintreachtigung
- Das Gate schlaegt fehl (Status: FAIL), wenn MAJOR vorhanden
- Sollte vor dem naechsten Schritt behoben werden
- Beispiele: Inkonsistente Charaktere, strukturelle Maengel, unvollstaendige Kapitel

### MINOR
- Kleine Maengel, die den Gesamtwert nicht gefaehrden
- Gate schlaegt NICHT fehl (Status: PASS)
- Wird als Verbesserungsvorschlag dokumentiert
- Beispiele: Stilistische Probleme, kleinere Formatierungsfehler

---

## 4. Gate-Definitionen

### Gate 1: SCOPE_GATE
**Owner:** quality-product
**Prueft:** scope.json
**Blockierend:**
- [ ] scope.json ist schema-valide
- [ ] Pflichtfelder ausgefuellt (title, concept, target_audience, deliverables)
- [ ] Konzept mindestens 50 Zeichen
- [ ] Zielgruppe definiert (Alter, Beschreibung)
- [ ] Keine Safety-Flags (medizinische Behauptungen, bedrohliche Inhalte)
**Nicht blockierend:**
- Formulierungsverbesserungen
- Erweiterung der Zielgruppenbeschreibung

### Gate 2: MANUSCRIPT_GATE
**Owner:** quality-product
**Prueft:** manuscript.json
**Blockierend:**
- [ ] manuscript.json ist schema-valide
- [ ] Mindestens 1 Seite vorhanden
- [ ] Jede Seite hat Text (minLength: 1)
- [ ] Quality Score >= 85
- [ ] Keine high-severity Issues im quality_issues Array
- [ ] Keine Safety-Flags (unangemessener Inhalt fuer Zielgruppe)
- [ ] Alle Seiten haben Bildprompt (image_prompt_en)
**Nicht blockierend:**
- Stilistische Verbesserungen (Score >= 85, keine blockers)
- Optionale Formulierungsvorschlaege

### Gate 3: ILLUSTRATION_GATE
**Owner:** quality-product
**Prueft:** illustrations.json
**Blockierend:**
- [ ] illustrations.json ist schema-valide
- [ ] Jede Seite des Manuskripts hat eine Illustration
- [ ] Kein Illustration hat Status REJECTED ohne neuen Prompt
- [ ] Style Guide definiert
- [ ] Keine verbotenen Bildelemente in Prompts
**Nicht blockierend:**
- Prompt-Optimierungen

### Gate 4: LAYOUT_GATE
**Owner:** quality-tech
**Prueft:** Layout-Dateien
**Blockierend:**
- [ ] Layout-Dateien vollstaendig vorhanden
- [ ] Alle Seiten im Layout referenziert
- [ ] Dateiformat plattformkonform
**Nicht blockierend:**
- Designoptimierungen

### Gate 5: PUBLISH_GATE
**Owner:** quality-global
**Prueft:** publishing_package.json
**Blockierend:**
- [ ] publishing_package.json ist schema-valide
- [ ] Pflichtmetadaten ausgefuellt (author, publisher, language, categories)
- [ ] Mindestens eine Plattform-Konfiguration vorhanden
- [ ] Alle Plattform-Configs status = READY
- [ ] Alle vorherigen Gate-Reports mit PASS vorhanden
**Nicht blockierend:**
- Verbesserung der Metadaten

---

## 5. QC-Report Format

Jede Gate-Pruefung erzeugt einen QC-Report nach `qc_report.schema.json`.

Pflichtfelder:
- `status`: PASS oder FAIL (binear, keine Grauzone)
- `failed_rules`: Liste aller verletzten BLOCKER/MAJOR Regeln
- `failed_checks`: Technische Pruefergebnisse
- `compliance_flags`: Safety/Legal/GDPR Anmerkungen
- `fix_tasks`: Konkrete Nachbesserungsaufgaben (bei FAIL)
- `improvements`: Nicht-blockierende Vorschlaege
- `evidence`: Messwerte und Belege

---

## 6. Compliance-Pruefregeln

### Content Safety (alle Gates)
- Keine Gewaltdarstellungen
- Keine Angsteinfloesung bei Kindern
- Keine medizinischen Behauptungen
- Altersgerechte Sprache und Themen

### DSGVO (Publish Gate)
- Keine personenbezogenen Daten in Artefakten
- Datenschutzhinweise vorhanden (falls erforderlich)

### Plattform-Compliance (Publish Gate)
- Amazon KDP Inhaltsrichtlinien
- Tolino Richtlinien
- Altersfreigaben korrekt gesetzt

---

## 7. Verbotene QA-Aktionen

QA-Agenten duerfen NICHT:
- Artefakt-Dateien schreiben oder veraendern
- Tasks erstellen (nur Empfehlen via fix_tasks)
- Projektstatus aendern
- Direkt mit Worker Agents kommunizieren
- Inhalte umformulieren (nur Probleme benennen)

---

## 8. Aenderungshistorie

| Version | Datum | Aenderung |
|---|---|---|
| 1.0.0 | 2025-01-01 | Erstversion |
