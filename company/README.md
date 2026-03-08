# Micro-Firma Buchproduktion

Autonomes KI-System fuer die Erstellung und Veroeffentlichung von Kinderbuchern.
Aufgebaut auf der bestehenden book-machine Infrastruktur.
Betrieben als Docker Multi-Container System.

---

## Firmenstruktur

```
CEO (Mensch/User)
  |
  |-- Orchestrator (COO)          [orchestrator]
  |     Steuert Ablauf, Tasks, States
  |
  |-- Global Quality (CQO)        [quality-global]
  |     Publish Gate, Cross-Domain-Pruefung
  |
  |-- Worker Agents
  |     |-- Product Worker        [product-worker]
  |     |-- Marketing Worker      [marketing-worker]
  |     |-- Tech Worker           [tech-worker]
  |     |-- Customer Worker       [customer-worker]
  |
  |-- Domain QA Agents
        |-- Quality Product       [quality-product]
        |-- Quality Marketing     [quality-marketing]
        |-- Quality Tech          [quality-tech]
        |-- Quality Customer      [quality-customer]
```

Gesamt: 10 Services + CEO (Mensch)

---

## Agent-Rollen

| Service | Rolle | Darf | Darf nicht |
|---|---|---|---|
| orchestrator | COO | Tasks erstellen, Status setzen | Artefakte schreiben |
| quality-global | CQO | Publish Gate pruefen | Artefakte veraendern |
| product-worker | Worker | scope.json, outline.json, manuscript.json, illustrations.json schreiben | Freigaben erteilen |
| marketing-worker | Worker | campaign.json, press_kit.json schreiben | Freigaben erteilen |
| tech-worker | Worker | Layout-Dateien, publishing_package.json schreiben | Freigaben erteilen |
| customer-worker | Worker | support_docs.json schreiben | Freigaben erteilen |
| quality-product | QA | Scope/Manuscript/Illustration Gates pruefen | Artefakte veraendern |
| quality-marketing | QA | Campaign Gate pruefen | Artefakte veraendern |
| quality-tech | QA | Layout Gate pruefen | Artefakte veraendern |
| quality-customer | QA | Support Quality Gate pruefen | Artefakte veraendern |

---

## State Machine

Vollstaendige Beschreibung: [orchestrator/STATE_MACHINE.md](orchestrator/STATE_MACHINE.md)

```
IDEA_INTAKE -> SCOPE_DEFINED -> OUTLINE_READY -> OUTLINE_APPROVED
-> DRAFT_READY -> DRAFT_APPROVED -> ILLUSTRATIONS_READY -> ILLUSTRATIONS_APPROVED
-> LAYOUT_READY -> LAYOUT_APPROVED -> PUBLISH_READY -> PUBLISH_APPROVED -> PUBLISHED

Rework-Pfade: *_READY -> REWORK_* -> *_READY (max. 3x)
Fehler-Pfade: * -> FAILED -> DEAD_LETTER
```

Nur der Orchestrator darf State-Transitionen ausloesen.
Illegale Transitionen werden abgewiesen und geloggt.

---

## Quality System

Vollstaendige Regeln: [quality/standards/QUALITY_CHARTER.md](quality/standards/QUALITY_CHARTER.md)

### Hard Gates

| Gate | State | Geprueft von |
|---|---|---|
| Gate 1: SCOPE_GATE | SCOPE_DEFINED | quality-product |
| Gate 2: MANUSCRIPT_GATE | DRAFT_READY | quality-product |
| Gate 3: ILLUSTRATION_GATE | ILLUSTRATIONS_READY | quality-product |
| Gate 4: LAYOUT_GATE | LAYOUT_READY | quality-tech |
| Gate 5: PUBLISH_GATE | PUBLISH_READY | quality-global |

### Domain Gates

| Gate | Service |
|---|---|
| CAMPAIGN_GATE | quality-marketing |
| RELEASE_GATE | quality-tech |
| SUPPORT_QUALITY_GATE | quality-customer |

### Severity Levels
- **BLOCKER**: Gate schlaegt fehl, Projekt wird gestoppt
- **MAJOR**: Gate schlaegt fehl, Rework erforderlich
- **MINOR**: Gate besteht (nur als Verbesserungsvorschlag)

---

## Artefakt-Contracts

Alle Artefakte haben verbindliche Contracts: [quality/contracts/](quality/contracts/)

| Artefakt | Contract | Schema |
|---|---|---|
| scope.json | scope.contract.md | scope.schema.json |
| outline.json | outline.contract.md | outline.schema.json |
| manuscript.json | manuscript.contract.md | manuscript.schema.json |
| illustrations.json | illustrations.contract.md | illustrations.schema.json |
| publishing_package.json | publishing_package.contract.md | publishing_package.schema.json |
| qc_report.json | qc_report.contract.md | qc_report.schema.json |
| task.json | task.contract.md | task.schema.json |

---

## Docker Setup

### Voraussetzungen
- Docker >= 24.0
- Docker Compose >= 2.0
- (Optional) Anthropic oder OpenAI API Key

### Konfiguration

```bash
# Im book-machine Verzeichnis:
cp .env.example .env
# .env anpassen (LLM_PROVIDER, API Keys etc.)
```

### Stack starten

```bash
# Alle Services bauen und starten
docker compose up --build

# Im Hintergrund starten
docker compose up --build -d

# Logs anzeigen
docker compose logs -f orchestrator

# Status pruefen
docker compose ps
```

### Stack stoppen

```bash
docker compose down
# Mit Volume-Bereinigung (ACHTUNG: Loescht alle Projektdaten)
docker compose down -v
```

---

## Projektstart Anleitung

### 1. Neues Projekt anlegen

```bash
PROJECT_ID="proj_$(date +%s)"
mkdir -p workspace/projects/$PROJECT_ID/01_intake

# Projektidee eintragen
echo "Ein mutiger kleiner Loewe, der Angst vor der Dunkelheit hat" \
  > workspace/projects/$PROJECT_ID/01_intake/idea.txt

# State initialisieren (status=IDEA_INTAKE)
cat > workspace/projects/$PROJECT_ID/state.json << EOF
{
  "project_id": "$PROJECT_ID",
  "run_id": "",
  "status": "IDEA_INTAKE",
  "idea": "",
  "rework_counts": {},
  "history": []
}
EOF
```

### 2. Stack starten (falls nicht bereits laufend)

```bash
docker compose up -d
```

### 3. Ablauf beobachten

```bash
# Orchestrator Logs
docker compose logs -f orchestrator

# Alle Logs
docker compose logs -f

# Projekt-Status pruefen
cat workspace/projects/$PROJECT_ID/state.json
```

### 4. CEO-Freigaben erteilen

Wenn ein Artefakt die QA-Pruefung bestanden hat, muss der CEO (Mensch) freigeben:

```bash
# scope.json Freigabe
python - << 'EOF'
import json
from pathlib import Path

project_id = "DEIN_PROJECT_ID"
scope_path = Path(f"workspace/projects/{project_id}/02_scope/scope.json")
scope = json.loads(scope_path.read_text())
scope["approved"] = True
from datetime import datetime, timezone
scope["approved_at"] = datetime.now(timezone.utc).isoformat()
scope_path.write_text(json.dumps(scope, indent=2, ensure_ascii=False))
print(f"scope.json freigegeben fuer {project_id}")
EOF
```

### 5. Ergebnisse herunterladen

```bash
# Nach PUBLISHED Status:
ls workspace/projects/$PROJECT_ID/
cat workspace/projects/$PROJECT_ID/06_layout/manuscript.md
cat workspace/projects/$PROJECT_ID/07_publish/publishing_package.json
```

---

## Bestehende book-machine Integration

Die Micro-Firma baut auf der bestehenden book-machine auf.
Alle bestehenden Funktionen sind erhalten und erweitert.

### Mapping: book-machine -> Micro-Firma

| Bestehend (book-machine) | Neu (Micro-Firma) |
|---|---|
| PlannerAgent | product-worker SCOPE_DEFINE Task |
| RealityCheckAgent | Teil von SCOPE_DEFINE (Risikoanalyse) |
| StoryAgent | product-worker MANUSCRIPT_WRITE Task |
| QualityAgent | quality-product MANUSCRIPT_GATE Check |
| RewriteAgent | product-worker REWORK Task |
| exportManuscript() | tech-worker LAYOUT_CREATE Task |
| exportCanvaPackage() | Teil von LAYOUT_CREATE Task |
| ApprovalService (PLAN_OK) | CEO-Freigabe bei SCOPE_DEFINED |
| ApprovalService (TEXT_OK) | CEO-Freigabe bei DRAFT_READY |
| job states (PLANNING etc.) | Neue State Machine (20 States) |
| data/ Verzeichnis | workspace/projects/ Verzeichnis |

### Neue Komponenten

- Orchestrator Service (COO)
- Global Quality Service (CQO)
- Marketing Worker + QA
- Tech Worker + QA
- Customer Worker + QA
- State Machine (20 States, validierte Transitionen)
- Task System (JSON-basiert, idempotent)
- Lock System (Concurrency Control)
- Dead Letter Queue
- Strukturiertes JSON-Logging
- Docker Multi-Container Stack

---

## Observability

### Logs

Alle Services loggen strukturiert als JSON nach stdout:
```bash
docker compose logs -f | jq '.'
```

Log-Format:
```json
{"timestamp": "2025-01-01T12:00:00Z", "level": "INFO", "service": "orchestrator",
 "project_id": "proj_abc", "run_id": "run_001", "message": "Task erstellt"}
```

### Run-Tracking

Jeder Run hat eigene Log-Dateien:
```
workspace/projects/<id>/runs/<run_id>/
├── events.log     # Alle Events (JSONL)
├── decisions.log  # Alle Entscheidungen (JSONL)
└── metrics.json   # Aggregierte Metriken
```

Metrics je Run:
- `jobs_processed`: Erfolgreich abgeschlossene Tasks
- `jobs_failed`: Fehlgeschlagene Tasks
- `gate_failures`: Gate-Ablehnungen
- `execution_time`: Gesamtlaufzeit

---

## Sicherheit

- Keine Secrets im Repository (nur .env.example)
- Jeder Service hat eigene ENV-Variablen
- Internes Docker-Netzwerk (firma_internal)
- Artefakte koennen nicht parallel ueberschrieben werden (Lock-System)
- QA-Agenten haben nur Lesezugriff auf Artefakte

---

## Verzeichnisstruktur

```
book-machine/
├── src/                    # Bestehende book-machine (TypeScript)
├── company/
│   ├── README.md           # Diese Datei
│   ├── lib/                # Gemeinsame Python Bibliothek
│   │   ├── logger.py
│   │   ├── storage.py
│   │   ├── lock.py
│   │   ├── state_machine.py
│   │   └── task.py
│   ├── orchestrator/
│   │   ├── STATE_MACHINE.md
│   │   └── state_machine.json
│   ├── quality/
│   │   ├── standards/QUALITY_CHARTER.md
│   │   ├── contracts/*.contract.md
│   │   └── schemas/*.schema.json
│   ├── agents/*/rulebook.md
│   ├── projects/_template/
│   ├── platform/
│   └── tests/golden_runs/
├── docker/
│   ├── orchestrator/
│   ├── product-worker/
│   ├── marketing-worker/
│   ├── tech-worker/
│   ├── customer-worker/
│   ├── quality-global/
│   ├── quality-product/
│   ├── quality-marketing/
│   ├── quality-tech/
│   ├── quality-customer/
│   └── shared/requirements.txt
├── workspace/projects/     # Projektdaten (Runtime)
├── docker-compose.yml
└── .env.example
```
