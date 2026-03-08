#!/bin/bash
# Entrypoint: quality-customer
set -e

echo "=== quality-customer startet ==="
echo "WORKSPACE_DIR: ${WORKSPACE_DIR:-/workspace}"
echo "LLM_PROVIDER: ${LLM_PROVIDER:-mock}"

mkdir -p "${WORKSPACE_DIR:-/workspace}/projects"
sleep 2

echo "=== Starte quality-customer Hauptschleife ==="
exec python /app/app.py
