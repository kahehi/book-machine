FROM python:3.11-slim

LABEL service="orchestrator"
LABEL role="COO – Projekt-Koordination und Task-Verteilung"

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# COPY-Pfade relativ zum Build-Context (book-machine/)
COPY docker/shared/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY docker/orchestrator/app.py /app/app.py
COPY docker/orchestrator/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import sys; sys.exit(0)"

ENTRYPOINT ["/app/entrypoint.sh"]
