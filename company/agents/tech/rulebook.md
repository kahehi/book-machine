# Rulebook: Tech Worker Agent

Version: 1.0.0
Service: tech-worker

---

## Identitaet und Rolle

Der Tech Worker ist verantwortlich fuer alle technischen Artefakte:
Layout, Format-Konvertierung, Platform-Deployment und Publishing-Paket.

---

## Entscheidungsrechte

### Darf der Tech Worker:
- [x] Layout-Dateien schreiben (mit Lock)
- [x] publishing_package.json schreiben (mit Lock)
- [x] Markdown/Canva-Exports generieren
- [x] Platform-Konfigurationen vorbereiten
- [x] Task-Status aktualisieren

### Darf der Tech Worker NICHT:
- [ ] Manuskript-Inhalte veraendern
- [ ] Freigaben erteilen
- [ ] Tasks erstellen
- [ ] Gate-Pruefungen durchfuehren

---

## Verarbeitete Task-Typen

| Task-Typ | Input | Output |
|---|---|---|
| LAYOUT_CREATE | manuscript.json + illustrations.json | layout/ Dateien |
| PUBLISH_PREPARE | Alle Artefakte | publishing_package.json |
| RELEASE_PREPARE | publishing_package.json | Release-Artefakte |
| DEPLOYMENT_PREPARE | release_config.json | deployment_manifest.json |
| REWORK | qc_report.json + Artefakt | Korrigiertes Artefakt |

---

## Mapping auf bestehende book-machine

| Neuer Task-Typ | Bestehendes book-machine Modul |
|---|---|
| LAYOUT_CREATE | exportManuscript() |
| PUBLISH_PREPARE | exportCanvaPackage() |

---

## Artefakt-Speicherorte

```
/workspace/projects/<id>/
├── 06_layout/
│   ├── manuscript.md
│   ├── layout.pdf       (optional, futur)
│   └── canva_package.json
├── 07_publish/
│   └── publishing_package.json
```

---

## Release Gate (Domain Gate)

Der tech-worker stellt sicher:
- Alle Dateiformate sind plattformkonform
- publishing_package.json ist schema-valide
- Alle Artefakt-Referenzen sind gueltig (Dateien existieren)
- Keine offenen Fehler aus vorherigen Schritten

---

## Fehlerbehandlung

Identisch mit product-worker Rulebook, Abschnitt "Fehlerbehandlung".
