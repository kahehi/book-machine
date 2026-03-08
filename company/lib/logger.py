"""
Strukturierter JSON-Logger fuer alle Micro-Firma Services.
Alle Logs als JSON fuer Observability und Log-Aggregation.
"""
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any


class JsonFormatter(logging.Formatter):
    """Formatiert Log-Eintraege als strukturiertes JSON."""

    def __init__(self, service_name: str):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "message": record.getMessage(),
        }

        # Zusaetzliche Felder aus extra dict
        for key in ["project_id", "run_id", "task_id", "gate_name", "event"]:
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)

        # Exception-Info hinzufuegen
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, ensure_ascii=False)


def get_logger(service_name: str, level: str = "INFO") -> logging.Logger:
    """
    Erstellt einen konfigurierten JSON-Logger fuer einen Service.

    Args:
        service_name: Name des Services (z.B. 'orchestrator', 'product-worker')
        level: Log-Level (DEBUG, INFO, WARNING, ERROR)

    Returns:
        Konfigurierter Logger
    """
    logger = logging.getLogger(service_name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter(service_name))
        logger.addHandler(handler)

    return logger


class StructuredLogger:
    """
    Wrapper-Klasse fuer kontextuelles Logging mit festen Feldern.
    Vermeidet das staendige Wiederholen von project_id und run_id.
    """

    def __init__(
        self,
        service_name: str,
        project_id: str = "",
        run_id: str = "",
        level: str = "INFO",
    ):
        self._logger = get_logger(service_name, level)
        self._context = {
            "project_id": project_id,
            "run_id": run_id,
        }

    def _log(self, level: str, message: str, **kwargs: Any) -> None:
        extra = {**self._context, **kwargs}
        self._logger.log(
            getattr(logging, level.upper()),
            message,
            extra=extra,
        )

    def info(self, message: str, **kwargs: Any) -> None:
        self._log("INFO", message, **kwargs)

    def warning(self, message: str, **kwargs: Any) -> None:
        self._log("WARNING", message, **kwargs)

    def error(self, message: str, **kwargs: Any) -> None:
        self._log("ERROR", message, **kwargs)

    def debug(self, message: str, **kwargs: Any) -> None:
        self._log("DEBUG", message, **kwargs)

    def set_context(self, **kwargs: Any) -> None:
        """Setzt oder aktualisiert den Log-Kontext."""
        self._context.update(kwargs)
