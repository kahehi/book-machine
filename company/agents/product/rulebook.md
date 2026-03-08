# Rulebook: Product Worker Agent

Version: 1.0.0
Service: product-worker

---

## Identitaet und Rolle

Der Product Worker erstellt alle inhaltlichen Artefakte des Buchprojekts.
Er ist verantwortlich fuer Scope, Outline, Manuskript und Illustrationsprompts.
Er arbeitet auf Basis von Tasks, die der Orchestrator erstellt.

---

## Entscheidungsrechte

### Darf der Product Worker:
- [x] scope.json schreiben (mit gueltigem Lock)
- [x] outline.json schreiben (mit gueltigem Lock)
- [x] manuscript.json schreiben (mit gueltigem Lock)
- [x] illustrations.json schreiben (mit gueltigem Lock)
- [x] LLM aufrufen fuer Inhalte
- [x] Task-Status aktualisieren (IN_PROGRESS, COMPLETED, FAILED)

### Darf der Product Worker NICHT:
- [ ] Freigaben erteilen (approved=true setzen)
- [ ] Tasks erstellen
- [ ] Projektstatus aendern (state.json)
- [ ] qc_report.json schreiben
- [ ] Artefakte anderer Services ueberschreiben
- [ ] Ohne Lock schreiben

---

## Verarbeitete Task-Typen

| Task-Typ | Input | Output |
|---|---|---|
| SCOPE_DEFINE | Idee (text) | scope.json |
| OUTLINE_CREATE | scope.json | outline.json |
| MANUSCRIPT_WRITE | outline.json | manuscript.json |
| ILLUSTRATIONS_CREATE | manuscript.json | illustrations.json |
| REWORK | qc_report.json + Artefakt | Korrigiertes Artefakt |

---

## Mapping auf bestehende book-machine Agenten

| Neuer Task-Typ | Bestehender Agent |
|---|---|
| SCOPE_DEFINE | PlannerAgent + RealityCheckAgent |
| OUTLINE_CREATE | (neuer Schritt, erweitert PlannerAgent) |
| MANUSCRIPT_WRITE | StoryAgent |
| REWORK (Manuskript) | RewriteAgent |

---

## Ablauf: SCOPE_DEFINE

1. Lese Idee aus task.input_artifacts[0]
2. Rufe LLM auf (system: PlannerAgent Prompt)
3. Validiere Output gegen scope.schema.json
4. Erwerbe Lock fuer scope.json
5. Schreibe scope.json (approved=false)
6. Gib Lock frei
7. Setze task.status=COMPLETED

## Ablauf: MANUSCRIPT_WRITE

1. Lese outline.json aus task.input_artifacts
2. Fuer jede Iteration:
   a. Rufe LLM auf (StoryAgent Prompt)
   b. Validiere gegen manuscript.schema.json
   c. Erwerbe Lock fuer manuscript.json
   d. Schreibe manuscript.json mit iteration-Nummer
   e. Gib Lock frei
3. Setze task.status=COMPLETED

## Ablauf: REWORK

1. Lese qc_report.json (fix_tasks)
2. Lese bestehendes Artefakt
3. Rufe LLM auf mit Rework-Anweisung und fix_tasks
4. Validiere Output
5. Erwerbe Lock
6. Schreibe korrigiertes Artefakt (iteration erhoehen)
7. Gib Lock frei
8. Setze task.status=COMPLETED

---

## Fehlerbehandlung

| Situation | Aktion |
|---|---|
| Schema-Validierung fehlgeschlagen | task.status=FAILED, Fehlermeldung in task.error_message |
| LLM-Fehler (nach Retries) | task.status=FAILED |
| Lock nicht erwerbbar (Timeout) | task.status=FAILED |
| Input-Artefakt fehlt | task.status=FAILED |

---

## Qualitaets-Selbstpruefung (nicht blockierend)

Vor dem Schreiben pruefen:
- Textlaenge angemessen (Wortanzahl in Scope-Bereich)
- Keine offensichtlichen Sicherheitsrisiken
- JSON ist valide
(Kein vollstaendiges Gate – das macht quality-product)
