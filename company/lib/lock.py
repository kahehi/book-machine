"""
Concurrency Control: Datei-basiertes Locking fuer Artefakt-Schreibzugriffe.
Verhindert parallele Schreibzugriffe auf dieselbe Datei.

Jeder Lock wird als lock.json im Projektordner gespeichert.
Ohne gueltigen Lock darf kein Service schreiben.
"""
import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


class LockError(Exception):
    """Wird geworfen wenn ein Lock nicht erworben werden kann."""
    pass


class LockManager:
    """
    Datei-basierter Lock-Manager fuer Artefakt-Schreibzugriffe.

    Lock-Datei Format (lock.json):
    {
        "artifact": "scope.json",
        "owner_service": "product-worker",
        "lease_until": "2025-01-01T12:00:30Z",
        "lock_id": "uuid"
    }
    """

    DEFAULT_LEASE_SECONDS = 30
    MAX_WAIT_SECONDS = 60
    POLL_INTERVAL = 0.5

    def __init__(self, project_dir: Path, service_name: str):
        self.project_dir = project_dir
        self.service_name = service_name
        self._acquired_locks: dict[str, str] = {}  # artifact -> lock_id

    def _lock_path(self, artifact: str) -> Path:
        """Gibt den Pfad zur Lock-Datei zurueck."""
        safe_name = artifact.replace("/", "_").replace(".", "_")
        return self.project_dir / f"lock_{safe_name}.json"

    def _is_lock_valid(self, lock_data: dict) -> bool:
        """Prueft ob ein Lock noch gueltig ist (nicht abgelaufen)."""
        lease_until = datetime.fromisoformat(lock_data["lease_until"])
        return datetime.now(timezone.utc) < lease_until

    def acquire(
        self,
        artifact: str,
        timeout: int = MAX_WAIT_SECONDS,
        lease: int = DEFAULT_LEASE_SECONDS,
    ) -> str:
        """
        Erwirbt einen Lock fuer ein Artefakt.

        Args:
            artifact: Relativer Pfad des Artefakts (z.B. "02_scope/scope.json")
            timeout: Maximale Wartezeit in Sekunden
            lease: Dauer des Locks in Sekunden

        Returns:
            lock_id (zum Freigeben des Locks)

        Raises:
            LockError: Wenn Lock nicht erworben werden kann
        """
        lock_path = self._lock_path(artifact)
        deadline = time.time() + timeout
        lock_id = str(uuid.uuid4())

        while time.time() < deadline:
            # Pruefe bestehenden Lock
            if lock_path.exists():
                try:
                    with open(lock_path, "r", encoding="utf-8") as f:
                        existing = json.load(f)
                    if self._is_lock_valid(existing):
                        time.sleep(self.POLL_INTERVAL)
                        continue
                except (json.JSONDecodeError, KeyError):
                    pass  # Beschaedigter Lock -> ueberschreiben

            # Versuche Lock zu erwerben
            lease_until = datetime.now(timezone.utc).replace(
                microsecond=0
            )
            from datetime import timedelta
            lease_until = (
                datetime.now(timezone.utc) + timedelta(seconds=lease)
            ).isoformat()

            lock_data = {
                "artifact": artifact,
                "owner_service": self.service_name,
                "lease_until": lease_until,
                "lock_id": lock_id,
            }

            try:
                # Atomisches Schreiben via temporaere Datei
                tmp_path = lock_path.with_suffix(".tmp")
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(lock_data, f)
                tmp_path.rename(lock_path)

                # Verifiziere: Haben wir wirklich den Lock?
                time.sleep(0.05)
                with open(lock_path, "r", encoding="utf-8") as f:
                    current = json.load(f)
                if current.get("lock_id") == lock_id:
                    self._acquired_locks[artifact] = lock_id
                    return lock_id
            except OSError:
                pass

            time.sleep(self.POLL_INTERVAL)

        raise LockError(
            f"Lock fuer '{artifact}' konnte nicht erworben werden "
            f"(Timeout: {timeout}s, Service: {self.service_name})"
        )

    def release(self, artifact: str, lock_id: str) -> bool:
        """
        Gibt einen Lock frei.

        Args:
            artifact: Relativer Pfad des Artefakts
            lock_id: Lock-ID (muss mit erworbenem Lock uebereinstimmen)

        Returns:
            True wenn erfolgreich freigegeben, False sonst
        """
        lock_path = self._lock_path(artifact)

        if not lock_path.exists():
            self._acquired_locks.pop(artifact, None)
            return True

        try:
            with open(lock_path, "r", encoding="utf-8") as f:
                current = json.load(f)
            if current.get("lock_id") == lock_id:
                lock_path.unlink(missing_ok=True)
                self._acquired_locks.pop(artifact, None)
                return True
        except (json.JSONDecodeError, OSError):
            pass

        return False

    def release_all(self) -> None:
        """Gibt alle vom Service gehaltenen Locks frei."""
        for artifact, lock_id in list(self._acquired_locks.items()):
            self.release(artifact, lock_id)


class ManagedLock:
    """
    Context Manager fuer automatische Lock-Freigabe.

    Verwendung:
        with ManagedLock(manager, "scope.json") as lock_id:
            storage.write_json("scope.json", data)
    """

    def __init__(
        self,
        manager: LockManager,
        artifact: str,
        timeout: int = LockManager.MAX_WAIT_SECONDS,
        lease: int = LockManager.DEFAULT_LEASE_SECONDS,
    ):
        self.manager = manager
        self.artifact = artifact
        self.timeout = timeout
        self.lease = lease
        self._lock_id: Optional[str] = None

    def __enter__(self) -> str:
        self._lock_id = self.manager.acquire(
            self.artifact, self.timeout, self.lease
        )
        return self._lock_id

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if self._lock_id:
            self.manager.release(self.artifact, self._lock_id)
        return False  # Exception nicht unterdruecken
