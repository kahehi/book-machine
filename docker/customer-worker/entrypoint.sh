#!/bin/bash
# Entrypoint: customer-worker
set -e

echo "=== customer-worker startet ==="
echo "WORKSPACE_DIR: ${WORKSPACE_DIR:-/workspace}"
echo "LLM_PROVIDER: ${LLM_PROVIDER:-mock}"

mkdir -p "${WORKSPACE_DIR:-/workspace}/projects"
sleep 2

echo "=== Starte customer-worker Hauptschleife ==="
exec python /app/app.py
