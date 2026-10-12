import fcntl
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("resume", Path(__file__).parents[1] / "resume_infrastructure.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ResumeGuards(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.cache = self.root / ".cache" / "infrastructure-resume"

    def test_dirty_worktree_never_invokes_model(self):
        with patch.object(runner.subprocess, "check_output", return_value=" M README.md\n"), patch.object(runner.subprocess, "run") as run:
            self.assertEqual(runner.run_once(self.root), "DIRTY_WORKTREE")
            run.assert_not_called()

    def test_competing_session_is_skipped_without_touching_state(self):
        self.cache.mkdir(parents=True)
        with (self.cache / "session.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with patch.object(runner.subprocess, "check_output") as git:
                self.assertEqual(runner.run_once(self.root), "BUSY")
                git.assert_not_called()
        self.assertFalse((self.cache / "resume-status.json").exists())

    def test_dry_run_does_not_execute_codex(self):
        with patch.object(runner.subprocess, "check_output", return_value=""), patch.object(runner.subprocess, "run") as run:
            self.assertEqual(runner.run_once(self.root, dry_run=True), "READY_NOT_EXECUTED")
            run.assert_not_called()

    def test_usage_or_network_failure_is_retryable_and_logs_are_private(self):
        with patch.object(runner.subprocess, "check_output", return_value=""), patch.object(runner.subprocess, "run", return_value=subprocess.CompletedProcess([], 1)) as run:
            self.assertEqual(runner.run_once(self.root), "RETRY_NEXT_INTERVAL")
            self.assertIn("asset generation", run.call_args.kwargs["input"])
        state = json.loads((self.cache / "resume-status.json").read_text())
        self.assertEqual(state["exitCode"], 1)
        self.assertEqual((self.cache / state["log"]).stat().st_mode & 0o777, 0o600)

    def test_missing_cli_is_recorded_without_false_success(self):
        with patch.object(runner.subprocess, "check_output", return_value=""), patch.object(runner.subprocess, "run", side_effect=FileNotFoundError()):
            self.assertEqual(runner.run_once(self.root), "RUNNER_UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
