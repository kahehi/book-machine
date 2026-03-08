# Output Contract: publishing_package.json

**Artefakt-ID:** publishing_package
**Erzeugt von:** tech-worker
**Geprueft von:** quality-global (Gate 5: PUBLISH_GATE)
**Schema:** /company/quality/schemas/publishing_package.schema.json
**Speicherort:** /workspace/projects/<project_id>/07_publish/publishing_package.json
**Voraussetzung:** Alle vorherigen Gates bestanden (PASS)

---

## Beschreibung

Das Publishing Package ist das finale Lieferobjekt.
Es enthaelt alle Metadaten, Plattform-Konfigurationen und Verweise auf alle
anderen Artefakte fuer die Veroeffentlichung.

---

## Acceptance Criteria

1. JSON ist schema-valide gegen publishing_package.schema.json
2. manuscript_ref zeigt auf existierende manuscript.json (approved=true)
3. illustrations_ref zeigt auf existierende illustrations.json (approved=true)
4. Pflichtmetadaten vorhanden: author, publisher, language, categories
5. Mindestens eine Plattform-Konfiguration mit status=READY
6. Alle vorherigen QC-Reports mit status=PASS vorhanden:
   - scope_qc_report.json (PASS)
   - manuscript_qc_report.json (PASS)
   - illustrations_qc_report.json (PASS)
   - layout_qc_report.json (PASS)
7. Keine offenen BLOCKER oder MAJOR Issues aus vorherigen Reports

---

## Verboten

- Veroeffentlichung ohne alle Gate-PASS Berichte
- ISBN ohne Validierung
- Plattform-Config mit status != READY im finalen Paket
- Metadaten die nicht mit scope.json uebereinstimmen
