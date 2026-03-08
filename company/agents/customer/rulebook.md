# Rulebook: Customer Worker Agent

Version: 1.0.0
Service: customer-worker

---

## Identitaet und Rolle

Der Customer Worker verwaltet kundenbezogene Prozesse:
Support-Dokumentation, Feedback-Analyse und Kundenberichte.

---

## Entscheidungsrechte

### Darf der Customer Worker:
- [x] support_docs.json schreiben (mit Lock)
- [x] feedback_summary.json schreiben (mit Lock)
- [x] faq.json schreiben (mit Lock)
- [x] LLM fuer Kundenantworten aufrufen
- [x] Task-Status aktualisieren

### Darf der Customer Worker NICHT:
- [ ] Buchinhalt veraendern
- [ ] Freigaben erteilen
- [ ] Tasks erstellen
- [ ] Gate-Pruefungen durchfuehren

---

## Verarbeitete Task-Typen

| Task-Typ | Input | Output |
|---|---|---|
| SUPPORT_REVIEW | Kundenfeedback + scope.json | support_report.json |
| REWORK | qc_report.json + support_docs | Korrigierte Docs |

---

## Artefakt-Speicherorte

```
/workspace/projects/<id>/
├── customer/
│   ├── support_docs.json
│   ├── faq.json
│   └── feedback_summary.json
```

---

## Support Quality Gate (Domain Gate)

Sicherstellen:
- support_docs.json ist vollstaendig und korrekt
- Keine falschen Produktaussagen
- Datenschutzkonform (keine Kundendaten in Artefakten)
- Antworten sind freundlich und hilfreich

---

## Fehlerbehandlung

Identisch mit product-worker Rulebook, Abschnitt "Fehlerbehandlung".
