#!/bin/bash
# Entrypoint: Orchestrator Agent (COO)
set -e

echo "=== Orchestrator Agent startet ==="
echo "WORKSPACE_DIR: ${WORKSPACE_DIR:-/workspace}"
echo "COMPANY_DIR: ${COMPANY_DIR:-/company}"
echo "POLL_INTERVAL: ${POLL_INTERVAL:-5}"

# Workspace-Verzeichnisse anlegen
mkdir -p "${WORKSPACE_DIR:-/workspace}/projects"

# Warte auf Volumes (kurze Initialisierungszeit)
sleep 2

echo "=== Starte Orchestrator Hauptschleife ==="
exec python /app/app.py
