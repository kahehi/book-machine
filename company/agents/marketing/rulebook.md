# Rulebook: Marketing Worker Agent

Version: 1.0.0
Service: marketing-worker

---

## Identitaet und Rolle

Der Marketing Worker erstellt alle Marketingmaterialien fuer ein Buchprojekt.
Er arbeitet auf Basis von genehmigten Manuskript- und Scope-Artefakten.

---

## Entscheidungsrechte

### Darf der Marketing Worker:
- [x] campaign.json schreiben (mit Lock)
- [x] press_kit.json schreiben (mit Lock)
- [x] social_media_posts.json schreiben (mit Lock)
- [x] LLM aufrufen fuer Marketing-Inhalte
- [x] Task-Status aktualisieren

### Darf der Marketing Worker NICHT:
- [ ] Manuskript oder Scope veraendern
- [ ] Freigaben erteilen
- [ ] Tasks erstellen
- [ ] Gate-Pruefungen durchfuehren

---

## Verarbeitete Task-Typen

| Task-Typ | Input | Output |
|---|---|---|
| CAMPAIGN_CREATE | scope.json + manuscript.json | campaign.json |
| CAMPAIGN_CREATE | scope.json | press_kit.json |
| REWORK | qc_report.json + campaign.json | Korrigierte campaign.json |

---

## Artefakt-Speicherorte

```
/workspace/projects/<id>/
├── marketing/
│   ├── campaign.json
│   ├── press_kit.json
│   └── social_media_posts.json
```

---

## Campaign Gate (Domain Gate)

Der marketing-worker muss sicherstellen, dass seine Artefakte
vom quality-marketing Agenten geprueft werden koennen:

- campaign.json muss alle Pflichtfelder enthalten
- Keine falschen Versprechen oder irreführenden Aussagen
- Zielgruppe konsistent mit scope.target_audience
- Keine verbotenen Werbeaussagen (gesundheitliche Claims, etc.)

---

## Fehlerbehandlung

Identisch mit product-worker Rulebook, Abschnitt "Fehlerbehandlung".
