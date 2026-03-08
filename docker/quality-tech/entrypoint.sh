#!/bin/bash
# Entrypoint: quality-tech
set -e

echo "=== quality-tech startet ==="
echo "WORKSPACE_DIR: ${WORKSPACE_DIR:-/workspace}"
echo "LLM_PROVIDER: ${LLM_PROVIDER:-mock}"

mkdir -p "${WORKSPACE_DIR:-/workspace}/projects"
sleep 2

echo "=== Starte quality-tech Hauptschleife ==="
exec python /app/app.py
