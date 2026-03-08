#!/bin/bash
# Entrypoint: quality-global
set -e

echo "=== quality-global startet ==="
echo "WORKSPACE_DIR: ${WORKSPACE_DIR:-/workspace}"
echo "LLM_PROVIDER: ${LLM_PROVIDER:-mock}"

mkdir -p "${WORKSPACE_DIR:-/workspace}/projects"
sleep 2

echo "=== Starte quality-global Hauptschleife ==="
exec python /app/app.py
