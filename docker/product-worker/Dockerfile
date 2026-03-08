FROM python:3.11-slim

LABEL service="product-worker"
LABEL role="Product Worker – Scope, Outline, Manuskript, Illustrationen"

RUN apt-get update && apt-get install -y --no-install-recommends curl     && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# COPY-Pfade sind relativ zum Build-Context (book-machine/)
COPY docker/shared/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY docker/product-worker/app.py /app/app.py
COPY docker/product-worker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Gemeinsame Bibliothek und Workspace werden per Volume gemountet
# /company/lib -> company/lib (read-only)
# /workspace/projects -> workspace/projects (read-write)

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3     CMD python -c "import sys; sys.exit(0)"

ENTRYPOINT ["/app/entrypoint.sh"]
