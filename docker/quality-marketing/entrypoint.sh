#!/bin/bash
# Entrypoint: quality-marketing
set -e

echo "=== quality-marketing startet ==="
echo "WORKSPACE_DIR: ${WORKSPACE_DIR:-/workspace}"
echo "LLM_PROVIDER: ${LLM_PROVIDER:-mock}"

mkdir -p "${WORKSPACE_DIR:-/workspace}/projects"
sleep 2

echo "=== Starte quality-marketing Hauptschleife ==="
exec python /app/app.py
