import fcntl
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
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
        with patch.object(runner.subprocess, "check_output", return_value=" M README.md\n"), patch.object(runner, "run_model") as run:
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
        with patch.object(runner.subprocess, "check_output", return_value=""), patch.object(runner, "run_model") as run:
            self.assertEqual(runner.run_once(self.root, dry_run=True), "READY_NOT_EXECUTED")
            run.assert_not_called()

    def test_usage_or_network_failure_is_retryable_and_logs_are_private(self):
        with patch.object(runner.subprocess, "check_output", return_value=""), patch.object(runner, "run_model", return_value=subprocess.CompletedProcess([], 1)) as run:
            self.assertEqual(runner.run_once(self.root), "RETRY_NEXT_INTERVAL")
            self.assertIn("asset generation", runner.PROMPT)
            self.assertEqual(run.call_args.args[0][-1], '-')
        state = json.loads((self.cache / "resume-status.json").read_text())
        self.assertEqual(state["exitCode"], 1)
        self.assertEqual((self.cache / state["log"]).stat().st_mode & 0o777, 0o600)

    def test_missing_cli_is_recorded_without_false_success(self):
        with patch.object(runner.subprocess, "check_output", return_value=""), patch.object(runner, "run_model", side_effect=FileNotFoundError()):
            self.assertEqual(runner.run_once(self.root), "RUNNER_UNAVAILABLE")

    def init_repo(self):
        subprocess.run(['git', 'init', '-q'], cwd=self.root, check=True)
        (self.root / '.gitignore').write_text('.cache/\n')
        (self.root / 'source.ts').write_text('export const original = 1;\n')
        subprocess.run(['git', 'add', '.gitignore', 'source.ts'], cwd=self.root, check=True)
        subprocess.run(['git', '-c', 'user.name=UOMD test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], cwd=self.root, check=True)

    def test_interrupted_owned_work_resumes_exact_thread(self):
        self.init_repo()
        def interrupted(command, output):
            output.write(json.dumps({'type': 'thread.started', 'thread_id': 'owned_test_thread'}) + '\n')
            (self.root / 'source.ts').write_text('export const unfinished = 2;\n')
            return subprocess.CompletedProcess(command, 1)
        with patch.object(runner, 'run_model', side_effect=interrupted):
            self.assertEqual(runner.run_once(self.root), 'RETRY_NEXT_INTERVAL')
        with patch.object(runner, 'run_model', return_value=subprocess.CompletedProcess([], 0)) as model:
            self.assertEqual(runner.run_once(self.root), 'FINISHED')
            self.assertEqual(model.call_args.args[0][-3:], ['resume', 'owned_test_thread', '-'])
        self.assertEqual((self.cache / 'last-message.txt').stat().st_mode & 0o777, 0o600)

    def test_foreign_edit_after_interruption_prevents_resume(self):
        self.init_repo()
        (self.root / 'source.ts').write_text('export const unfinished = 2;\n')
        self.cache.mkdir(parents=True)
        (self.cache / 'resume-session.json').write_text(json.dumps({'threadId': 'owned_test_thread', 'workspaceFingerprint': runner.workspace_fingerprint(self.root)}))
        (self.root / 'source.ts').write_text('export const changedBySomeoneElse = 3;\n')
        with patch.object(runner, 'run_model') as model:
            self.assertEqual(runner.run_once(self.root), 'DIRTY_WORKTREE')
            model.assert_not_called()

    def test_model_timeout_is_bounded_and_terminates_process_group(self):
        with tempfile.TemporaryFile(mode='w+') as output:
            result = runner.run_model([sys.executable, '-c', 'import time; time.sleep(5)'], output, timeout=0.02)
        self.assertEqual(result.returncode, 124)


if __name__ == "__main__":
    unittest.main()
