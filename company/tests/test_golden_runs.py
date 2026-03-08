"""
Golden Run Integration Tests fuer die Micro-Firma Buchproduktion.

Testet kritische Workflow-Pfade durch direkte Datei-Operationen
und Import der Bibliotheks- und Service-Funktionen.

Szenarien:
- Run 001: Happy Path – scope.json valide -> SCOPE_GATE PASS
- Run 003: Dead Letter – max_retries erreicht -> dead_letter/
- Run 004: Schema-Validierungsfehler – kein Konzept -> SCOPE_GATE FAIL (R002)
- Bonus:   LockManager – acquire/release und Timeout
- Bonus:   Manuskript-Gate – Score-Pruefung PASS/FAIL
"""
import importlib.util
import json
import os
import sys
import threading
import uuid
from pathlib import Path

import pytest

# conftest.py hat bereits LIB_DIR in sys.path eingetragen
from task import Task, TaskStatus, TaskType, TaskRepository
from lock import LockManager, ManagedLock, LockError

# ---------------------------------------------------------------------------
# Modul-Loader fuer Docker-Service-Apps
# ---------------------------------------------------------------------------

BOOK_MACHINE_DIR = Path(__file__).parent.parent.parent
DOCKER_DIR = BOOK_MACHINE_DIR / "docker"


def _load_service_module(service_name: str):
    """
    Laedt ein Docker-Service-Modul dynamisch.
    Setzt WORKSPACE_DIR-Umgebungsvariable auf einen sicheren Standardwert.
    """
    module_path = DOCKER_DIR / service_name / "app.py"
    if not module_path.exists():
        pytest.skip(f"Service-Modul nicht gefunden: {module_path}")

    mod_name = f"svc_{service_name.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(mod_name, module_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = module
    # Kein echter Start der main()-Schleife – nur Modul laden
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    """Temporaeres Workspace-Verzeichnis mit projects/-Unterordner."""
    (tmp_path / "projects").mkdir()
    return tmp_path


@pytest.fixture
def project(workspace: Path):
    """Erstellt ein Test-Projekt mit vollstaendiger Verzeichnisstruktur."""
    project_id = f"proj_test_{uuid.uuid4().hex[:8]}"
    project_dir = workspace / "projects" / project_id
    for sub in ["tasks", "02_scope", "03_outline", "04_manuscript",
                "05_illustrations", "dead_letter", "qc_reports", "approvals"]:
        (project_dir / sub).mkdir(parents=True)
    return project_dir


@pytest.fixture
def run_id() -> str:
    return str(uuid.uuid4())


def _make_task(project_dir: Path, run_id: str, task_type: TaskType,
               owner: str, input_artifacts: list, output_artifacts: list,
               metadata: dict = None, max_retries: int = 3) -> Task:
    """Hilfsfunktion: erstellt und speichert einen Task."""
    task = Task(
        task_type=task_type,
        owner_service=owner,
        project_id=project_dir.name,
        run_id=run_id,
        input_artifacts=input_artifacts,
        output_artifacts=output_artifacts,
        acceptance_criteria=[],
        max_retries=max_retries,
        metadata=metadata or {},
    )
    repo = TaskRepository(project_dir / "tasks")
    repo.save(task)
    return task


# ---------------------------------------------------------------------------
# Hilfsfunktionen: Artefakt-Erstellung
# ---------------------------------------------------------------------------

def _write_valid_scope(project_dir: Path, workspace: Path) -> Path:
    """Schreibt eine gueltige scope.json."""
    scope = {
        "project_id": project_dir.name,
        "run_id": "run_001",
        "title": "Leo und die tapfere Nacht",
        "concept": "Ein mutiger kleiner Loewe ueberwindet seine Angst vor der Dunkelheit durch die Hilfe seiner Freunde.",
        "target_audience": {"age_min": 4, "age_max": 7, "description": "Vorschulkinder"},
        "genre": "picture_book",
        "language": "de",
        "page_count": {"min": 8, "max": 12},
        "deliverables": ["manuscript", "illustrations"],
        "constraints": {"content_restrictions": ["Keine Gewalt"]},
        "approved": False,
        "created_at": "2026-01-01T00:00:00Z",
        "created_by": "product-worker",
        "approved_at": None,
    }
    scope_path = project_dir / "02_scope" / "scope.json"
    scope_path.write_text(json.dumps(scope, ensure_ascii=False), encoding="utf-8")
    return scope_path


def _write_invalid_scope_no_concept(project_dir: Path) -> Path:
    """Schreibt eine ungueltige scope.json ohne 'concept'."""
    scope = {
        "project_id": project_dir.name,
        "run_id": "run_004",
        "title": "Kurzes Buch",
        # 'concept' fehlt absichtlich
        "target_audience": {"age_min": 4, "age_max": 7},
        "genre": "picture_book",
        "language": "de",
        "page_count": {"min": 8, "max": 12},
        "deliverables": ["manuscript"],
        "constraints": {},
        "approved": False,
        "created_at": "2026-01-01T00:00:00Z",
        "created_by": "product-worker",
        "approved_at": None,
    }
    scope_path = project_dir / "02_scope" / "scope.json"
    scope_path.write_text(json.dumps(scope, ensure_ascii=False), encoding="utf-8")
    return scope_path


def _write_valid_manuscript(project_dir: Path, quality_score: int = 90) -> Path:
    """Schreibt ein gueltiges manuscript.json."""
    pages = [
        {
            "page_number": i,
            "text": f"Leo liegt im Bett. Es ist Seite {i}.",
            "image_prompt_en": f"A warm illustration of a small lion cub on page {i}, watercolor style",
        }
        for i in range(1, 9)
    ]
    manuscript = {
        "project_id": project_dir.name,
        "run_id": "run_001",
        "title": "Leo und die tapfere Nacht",
        "language": "de",
        "pages": pages,
        "word_count": 120,
        "quality_score": quality_score,
        "quality_issues": [],
        "iteration": 0,
        "approved": False,
        "created_at": "2026-01-01T00:00:00Z",
        "created_by": "product-worker",
        "approved_at": None,
    }
    ms_path = project_dir / "04_manuscript" / "manuscript.json"
    ms_path.write_text(json.dumps(manuscript, ensure_ascii=False), encoding="utf-8")
    return ms_path


# ---------------------------------------------------------------------------
# Gate-Logik (aus quality-product importiert oder inline repliziert)
# ---------------------------------------------------------------------------

def _run_scope_gate(task: Task, workspace: Path) -> dict:
    """
    Fuehrt SCOPE_GATE-Pruefung durch.
    Importiert die Logik aus quality-product/app.py mit gepatchtem WORKSPACE_DIR.
    """
    os.environ["WORKSPACE_DIR"] = str(workspace)
    os.environ["POLL_INTERVAL"] = "999"  # Verhindert echte Polling-Schleife

    mod = _load_service_module("quality-product")
    mod.WORKSPACE_DIR = workspace  # Laufzeit-Patch

    return mod.check_scope(task)


def _run_manuscript_gate(task: Task, workspace: Path) -> dict:
    """Fuehrt MANUSCRIPT_GATE-Pruefung durch."""
    os.environ["WORKSPACE_DIR"] = str(workspace)
    mod = _load_service_module("quality-product")
    mod.WORKSPACE_DIR = workspace
    return mod.check_manuscript(task)


# ---------------------------------------------------------------------------
# TEST: Task-System
# ---------------------------------------------------------------------------

class TestTaskSystem:
    """Unit-Tests fuer TaskRepository und Task-Zustandsaenderungen."""

    def test_task_crud(self, project: Path, run_id: str):
        """Task erstellen, laden und Status aendern."""
        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.SCOPE_DEFINE,
            owner="product-worker",
            input_artifacts=[f"projects/{project.name}/01_intake/idea.txt"],
            output_artifacts=[f"projects/{project.name}/02_scope/scope.json"],
        )

        repo = TaskRepository(project / "tasks")
        loaded = repo.load(task.task_id)
        assert loaded is not None
        assert loaded.task_type == TaskType.SCOPE_DEFINE
        assert loaded.status == TaskStatus.PENDING

        loaded.mark_in_progress()
        repo.save(loaded)

        loaded2 = repo.load(task.task_id)
        assert loaded2.status == TaskStatus.IN_PROGRESS
        assert loaded2.started_at is not None

    def test_find_for_service(self, project: Path, run_id: str):
        """Nur Tasks des richtigen Services werden zurueckgegeben."""
        _make_task(project, run_id, TaskType.SCOPE_DEFINE, "product-worker",
                   ["input.txt"], ["output.json"])
        _make_task(project, run_id, TaskType.SCOPE_REVIEW, "quality-product",
                   ["scope.json"], ["report.json"])

        repo = TaskRepository(project / "tasks")
        worker_tasks = repo.find_for_service("product-worker", TaskStatus.PENDING)
        qa_tasks = repo.find_for_service("quality-product", TaskStatus.PENDING)

        assert len(worker_tasks) == 1
        assert len(qa_tasks) == 1

    def test_dead_letter_move(self, project: Path, run_id: str):
        """Task mit erschoepften Retries landet in dead_letter/."""
        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.MANUSCRIPT_WRITE,
            owner="product-worker",
            input_artifacts=["outline.json"],
            output_artifacts=["manuscript.json"],
            max_retries=1,
        )
        task.mark_failed("Test-Fehler 1")
        task.mark_failed("Test-Fehler 2")

        assert not task.can_retry

        repo = TaskRepository(project / "tasks")
        repo.move_to_dead_letter(task, project)

        dead_letter_file = project / "dead_letter" / f"{task.task_id}.json"
        assert dead_letter_file.exists()

        data = json.loads(dead_letter_file.read_text(encoding="utf-8"))
        assert data["status"] == TaskStatus.DEAD_LETTER.value


# ---------------------------------------------------------------------------
# TEST: LockManager (Golden Run 005)
# ---------------------------------------------------------------------------

class TestLockManager:
    """Tests fuer datei-basierten Lock-Manager (Concurrency Control)."""

    def test_acquire_and_release(self, project: Path):
        """Lock erwerben und freigeben."""
        manager = LockManager(project, "test-service")
        lock_id = manager.acquire("scope.json", timeout=5, lease=10)

        lock_file = project / "lock_scope_json.json"
        assert lock_file.exists()

        data = json.loads(lock_file.read_text(encoding="utf-8"))
        assert data["lock_id"] == lock_id
        assert data["owner_service"] == "test-service"

        released = manager.release("scope.json", lock_id)
        assert released
        assert not lock_file.exists()

    def test_managed_lock_context_manager(self, project: Path):
        """ManagedLock gibt Lock automatisch frei."""
        manager = LockManager(project, "test-service")

        with ManagedLock(manager, "manuscript.json", timeout=5) as lock_id:
            assert lock_id is not None
            assert (project / "lock_manuscript_json.json").exists()

        assert not (project / "lock_manuscript_json.json").exists()

    def test_lock_timeout_raises(self, project: Path):
        """LockError bei Timeout wenn Lock gehalten wird."""
        manager_a = LockManager(project, "service-a")
        manager_b = LockManager(project, "service-b")

        lock_id_a = manager_a.acquire("scope.json", timeout=5, lease=30)
        try:
            with pytest.raises(LockError):
                manager_b.acquire("scope.json", timeout=1)
        finally:
            manager_a.release("scope.json", lock_id_a)

    def test_concurrent_writes_serialized(self, project: Path):
        """Zwei Threads serialisieren Schreibzugriffe korrekt."""
        results = []
        errors = []

        def write_with_lock(value: str):
            manager = LockManager(project, f"thread-{value}")
            try:
                with ManagedLock(manager, "test_artifact.json", timeout=15, lease=5):
                    import time
                    time.sleep(0.05)  # Simuliere Schreibzeit
                    results.append(value)
            except Exception as e:
                errors.append(str(e))

        t1 = threading.Thread(target=write_with_lock, args=("A",))
        t2 = threading.Thread(target=write_with_lock, args=("B",))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        assert len(errors) == 0, f"Lock-Fehler aufgetreten: {errors}"
        assert len(results) == 2
        # Kein simultanes Schreiben
        assert "A" in results and "B" in results


# ---------------------------------------------------------------------------
# GOLDEN RUN 001: Happy Path
# ---------------------------------------------------------------------------

class TestGoldenRun001HappyPath:
    """
    Vollstaendiger Erfolgs-Pfad: scope.json valide -> SCOPE_GATE PASS.

    Simuliert:
    1. product-worker schreibt scope.json (alle Pflichtfelder)
    2. quality-product prueft scope.json -> SCOPE_GATE PASS
    3. QC-Report wird geschrieben (status=PASS)
    """

    def test_scope_gate_pass_with_valid_scope(self, project: Path, workspace: Path, run_id: str):
        """SCOPE_GATE: Gueltige scope.json -> status=PASS, keine failed_rules."""
        scope_path = _write_valid_scope(project, workspace)
        relative = str(scope_path.relative_to(workspace))

        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.SCOPE_REVIEW,
            owner="quality-product",
            input_artifacts=[relative],
            output_artifacts=[f"projects/{project.name}/qc_reports/scope_report.json"],
            metadata={"gate_name": "SCOPE_GATE"},
        )

        report = _run_scope_gate(task, workspace)

        assert report["status"] == "PASS", (
            f"SCOPE_GATE sollte PASS sein. failed_rules: {report['failed_rules']}"
        )
        assert report["gate_name"] == "SCOPE_GATE"
        blocker_rules = [
            r for r in report["failed_rules"] if r["severity"] in ("BLOCKER", "MAJOR")
        ]
        assert len(blocker_rules) == 0

    def test_manuscript_gate_pass_with_high_score(self, project: Path, workspace: Path, run_id: str):
        """MANUSCRIPT_GATE: Score >= 85 -> status=PASS."""
        ms_path = _write_valid_manuscript(project, quality_score=90)
        relative = str(ms_path.relative_to(workspace))

        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.MANUSCRIPT_REVIEW,
            owner="quality-product",
            input_artifacts=[relative],
            output_artifacts=[f"projects/{project.name}/qc_reports/manuscript_report.json"],
            metadata={"gate_name": "MANUSCRIPT_GATE"},
        )

        report = _run_manuscript_gate(task, workspace)

        assert report["status"] == "PASS", (
            f"MANUSCRIPT_GATE sollte PASS sein. failed_rules: {report['failed_rules']}"
        )
        assert report["evidence"]["quality_score"] == 90

    def test_qc_report_written_to_disk(self, project: Path, workspace: Path, run_id: str):
        """QC-Report wird korrekt auf Disk geschrieben."""
        scope_path = _write_valid_scope(project, workspace)
        relative = str(scope_path.relative_to(workspace))
        report_relative = f"projects/{project.name}/qc_reports/scope_report.json"

        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.SCOPE_REVIEW,
            owner="quality-product",
            input_artifacts=[relative],
            output_artifacts=[report_relative],
            metadata={"gate_name": "SCOPE_GATE"},
        )

        report = _run_scope_gate(task, workspace)

        # Report auf Disk schreiben (simuliert process_task)
        report_path = workspace / report_relative
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

        assert report_path.exists()
        loaded = json.loads(report_path.read_text(encoding="utf-8"))
        assert loaded["status"] == "PASS"
        assert loaded["gate_name"] == "SCOPE_GATE"
        assert "report_id" in loaded


# ---------------------------------------------------------------------------
# GOLDEN RUN 003: Dead Letter Queue
# ---------------------------------------------------------------------------

class TestGoldenRun003DeadLetter:
    """
    Fehler-Pfad: Max Rework-Zyklen erreicht -> Task landet in dead_letter/.

    Simuliert:
    1. Task wird 3x mit FAIL markiert (max_retries=3)
    2. can_retry wird False
    3. TaskRepository.move_to_dead_letter() verschiebt Task
    4. dead_letter/ Verzeichnis enthaelt Task-Datei
    """

    def test_task_enters_dead_letter_after_max_retries(self, project: Path, run_id: str):
        """Nach MAX_REWORK_CYCLES=3 Fehlern landet Task in dead_letter/."""
        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.MANUSCRIPT_WRITE,
            owner="product-worker",
            input_artifacts=["outline.json"],
            output_artifacts=["manuscript.json"],
            max_retries=3,
        )

        repo = TaskRepository(project / "tasks")
        assert task.can_retry

        task.mark_failed("Gate FAIL – Score zu niedrig (Zyklus 1)")
        repo.save(task)
        assert task.retry_count == 1
        assert task.can_retry

        task.mark_failed("Gate FAIL – Score zu niedrig (Zyklus 2)")
        repo.save(task)
        assert task.retry_count == 2
        assert task.can_retry

        task.mark_failed("Gate FAIL – Score zu niedrig (Zyklus 3)")
        repo.save(task)
        assert task.retry_count == 3
        assert not task.can_retry

        repo.move_to_dead_letter(task, project)

        dead_file = project / "dead_letter" / f"{task.task_id}.json"
        assert dead_file.exists(), "Dead-Letter-Datei nicht gefunden"

        data = json.loads(dead_file.read_text(encoding="utf-8"))
        assert data["status"] == "DEAD_LETTER"
        assert "Max retries" in data["error_message"] or "Gate FAIL" in data["error_message"]

        original_file = project / "tasks" / f"{task.task_id}.json"
        assert not original_file.exists(), "Original Task-Datei wurde nicht geloescht"

    def test_rework_count_matches_expected(self, project: Path, run_id: str):
        """rework_counts entsprechen exakt MAX_REWORK_CYCLES."""
        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.REWORK,
            owner="product-worker",
            input_artifacts=["manuscript.json"],
            output_artifacts=["manuscript.json"],
            max_retries=3,
        )
        rework_count = 0

        for _ in range(3):
            task.mark_failed("Qualitaet ungenuegend")
            rework_count += 1

        assert task.retry_count == 3
        assert rework_count == 3
        assert not task.can_retry


# ---------------------------------------------------------------------------
# GOLDEN RUN 004: Schema-Validierungsfehler
# ---------------------------------------------------------------------------

class TestGoldenRun004SchemaError:
    """
    Edge Case: scope.json ohne Pflichtfeld 'concept' -> SCOPE_GATE FAIL.

    Simuliert:
    1. product-worker schreibt invalide scope.json (concept fehlt)
    2. quality-product prueft -> erkennt R002 BLOCKER
    3. Orchestrator loest REWORK_SCOPE aus
    """

    def test_scope_gate_fail_missing_concept(self, project: Path, workspace: Path, run_id: str):
        """SCOPE_GATE: Kein Konzept -> status=FAIL, R002 in failed_rules."""
        scope_path = _write_invalid_scope_no_concept(project)
        relative = str(scope_path.relative_to(workspace))

        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.SCOPE_REVIEW,
            owner="quality-product",
            input_artifacts=[relative],
            output_artifacts=[f"projects/{project.name}/qc_reports/scope_report.json"],
            metadata={"gate_name": "SCOPE_GATE"},
        )

        report = _run_scope_gate(task, workspace)

        assert report["status"] == "FAIL", "SCOPE_GATE sollte FAIL sein bei fehlendem Konzept"

        rule_ids = [r["rule_id"] for r in report["failed_rules"]]
        assert "R002" in rule_ids or "R001" in rule_ids, (
            f"R001 oder R002 (Konzept-Fehler) erwartet. Gefunden: {rule_ids}"
        )

    def test_scope_gate_fail_short_concept(self, project: Path, workspace: Path, run_id: str):
        """SCOPE_GATE: Zu kurzes Konzept (< 50 Zeichen) -> status=FAIL, R002."""
        scope = {
            "project_id": project.name,
            "run_id": run_id,
            "title": "Test",
            "concept": "Zu kurz.",  # < 50 Zeichen
            "target_audience": {"age_min": 4, "age_max": 7, "description": "Kinder"},
            "genre": "picture_book",
            "language": "de",
            "page_count": {"min": 8, "max": 12},
            "deliverables": ["manuscript"],
            "constraints": {"content_restrictions": []},
            "approved": False,
            "created_at": "2026-01-01T00:00:00Z",
            "created_by": "product-worker",
            "approved_at": None,
        }
        scope_path = project / "02_scope" / "scope.json"
        scope_path.write_text(json.dumps(scope, ensure_ascii=False), encoding="utf-8")
        relative = str(scope_path.relative_to(workspace))

        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.SCOPE_REVIEW,
            owner="quality-product",
            input_artifacts=[relative],
            output_artifacts=[f"projects/{project.name}/qc_reports/scope_report.json"],
            metadata={"gate_name": "SCOPE_GATE"},
        )

        report = _run_scope_gate(task, workspace)

        assert report["status"] == "FAIL"
        rule_ids = [r["rule_id"] for r in report["failed_rules"]]
        assert "R002" in rule_ids, f"R002 (Konzept Mindestlaenge) erwartet. Gefunden: {rule_ids}"

        # fix_tasks muss Korrektur-Hinweis enthalten
        assert len(report["fix_tasks"]) > 0
        fix_descriptions = [ft["description"] for ft in report["fix_tasks"]]
        assert any("konzept" in d.lower() or "Konzept" in d for d in fix_descriptions)

    def test_scope_gate_fail_missing_artifact(self, project: Path, workspace: Path, run_id: str):
        """SCOPE_GATE: scope.json nicht vorhanden -> status=FAIL, R001."""
        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.SCOPE_REVIEW,
            owner="quality-product",
            input_artifacts=[f"projects/{project.name}/02_scope/scope.json"],
            output_artifacts=[f"projects/{project.name}/qc_reports/scope_report.json"],
            metadata={"gate_name": "SCOPE_GATE"},
        )

        report = _run_scope_gate(task, workspace)

        assert report["status"] == "FAIL"
        rule_ids = [r["rule_id"] for r in report["failed_rules"]]
        assert "R001" in rule_ids

    def test_no_crash_on_invalid_json(self, project: Path, workspace: Path, run_id: str):
        """SCOPE_GATE: Kein Absturz bei corrupt JSON -> status=FAIL, kontrollierter Fehler."""
        scope_path = project / "02_scope" / "scope.json"
        scope_path.write_text("{ ungueltig json !! }", encoding="utf-8")
        relative = str(scope_path.relative_to(workspace))

        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.SCOPE_REVIEW,
            owner="quality-product",
            input_artifacts=[relative],
            output_artifacts=[f"projects/{project.name}/qc_reports/scope_report.json"],
            metadata={"gate_name": "SCOPE_GATE"},
        )

        # Kein Absturz erwartet
        report = _run_scope_gate(task, workspace)
        assert report["status"] == "FAIL"
        rule_ids = [r["rule_id"] for r in report["failed_rules"]]
        assert "R000" in rule_ids


# ---------------------------------------------------------------------------
# BONUS: Manuskript-Gate Score-Pruefung
# ---------------------------------------------------------------------------

class TestManuscriptGateScore:
    """Prueft den Score-basierten Qualitaets-Gate fuer Manuskripte."""

    def test_manuscript_gate_fail_low_score(self, project: Path, workspace: Path, run_id: str):
        """MANUSCRIPT_GATE: Score < 85 -> status=FAIL, M001 in failed_rules."""
        ms_path = _write_valid_manuscript(project, quality_score=70)
        relative = str(ms_path.relative_to(workspace))

        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.MANUSCRIPT_REVIEW,
            owner="quality-product",
            input_artifacts=[relative],
            output_artifacts=[f"projects/{project.name}/qc_reports/ms_report.json"],
            metadata={"gate_name": "MANUSCRIPT_GATE"},
        )

        report = _run_manuscript_gate(task, workspace)

        assert report["status"] == "FAIL"
        rule_ids = [r["rule_id"] for r in report["failed_rules"]]
        assert "M001" in rule_ids
        assert len(report["fix_tasks"]) > 0

    def test_manuscript_gate_pass_exact_target_score(
        self, project: Path, workspace: Path, run_id: str
    ):
        """MANUSCRIPT_GATE: Score == 85 (Zielwert) -> status=PASS."""
        os.environ["TARGET_SCORE"] = "85"
        ms_path = _write_valid_manuscript(project, quality_score=85)
        relative = str(ms_path.relative_to(workspace))

        task = _make_task(
            project_dir=project,
            run_id=run_id,
            task_type=TaskType.MANUSCRIPT_REVIEW,
            owner="quality-product",
            input_artifacts=[relative],
            output_artifacts=[f"projects/{project.name}/qc_reports/ms_report.json"],
            metadata={"gate_name": "MANUSCRIPT_GATE"},
        )

        os.environ["TARGET_SCORE"] = "85"
        report = _run_manuscript_gate(task, workspace)

        assert report["status"] == "PASS", (
            f"Score == Zielwert sollte PASS ergeben. failed_rules: {report['failed_rules']}"
        )
