"""
Datei-Storage-Abstraktion fuer alle Micro-Firma Services.
Alle Artefakte werden als JSON-Dateien im Dateisystem gespeichert.
"""
import json
import os
from pathlib import Path
from typing import Any, Optional, TypeVar

T = TypeVar("T")


class StorageProvider:
    """
    Dateisystem-basierter Storage fuer Artefakte.
    Alle Pfade sind relativ zum workspace_dir.
    """

    def __init__(self, workspace_dir: str):
        self.base_dir = Path(workspace_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def resolve(self, relative_path: str) -> Path:
        """Loest einen relativen Pfad auf den absoluten Pfad auf."""
        path = self.base_dir / relative_path
        return path

    def write_json(self, relative_path: str, data: Any) -> Path:
        """
        Schreibt ein Objekt als JSON-Datei.

        Args:
            relative_path: Pfad relativ zu workspace_dir
            data: Serialisierbares Python-Objekt

        Returns:
            Absoluter Pfad der geschriebenen Datei
        """
        path = self.resolve(relative_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return path

    def write_text(self, relative_path: str, content: str) -> Path:
        """Schreibt Text in eine Datei."""
        path = self.resolve(relative_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def read_json(self, relative_path: str) -> Optional[Any]:
        """
        Liest eine JSON-Datei.

        Returns:
            Deserialisiertes Objekt oder None wenn Datei nicht existiert
        """
        path = self.resolve(relative_path)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def read_text(self, relative_path: str) -> Optional[str]:
        """Liest Text aus einer Datei."""
        path = self.resolve(relative_path)
        if not path.exists():
            return None
        return path.read_text(encoding="utf-8")

    def exists(self, relative_path: str) -> bool:
        """Prueft ob eine Datei existiert."""
        return self.resolve(relative_path).exists()

    def ensure_dir(self, relative_path: str) -> Path:
        """Stellt sicher, dass ein Verzeichnis existiert."""
        path = self.resolve(relative_path)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def list_dir(self, relative_path: str) -> list[str]:
        """Listet Dateien und Ordner in einem Verzeichnis."""
        path = self.resolve(relative_path)
        if not path.exists():
            return []
        return [item.name for item in path.iterdir()]

    def append_to_log(self, relative_path: str, entry: dict) -> None:
        """
        Haengt einen JSON-Eintrag an eine Log-Datei an (JSONL-Format).
        Jede Zeile ist ein eigenstaendiges JSON-Objekt.
        """
        path = self.resolve(relative_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
