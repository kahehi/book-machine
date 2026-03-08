"""
Pytest Konfiguration fuer Micro-Firma Tests.
Setzt sys.path sodass company/lib und Docker-Service-Module importierbar sind.
"""
import os
import sys
from pathlib import Path

# Verzeichnis-Struktur
TESTS_DIR = Path(__file__).parent
COMPANY_DIR = TESTS_DIR.parent
BOOK_MACHINE_DIR = COMPANY_DIR.parent
LIB_DIR = COMPANY_DIR / "lib"
DOCKER_DIR = BOOK_MACHINE_DIR / "docker"

# Pfade eintragen (wie /company/lib im Container)
for _p in [str(LIB_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)
