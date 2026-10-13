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

    def test_clean_interrupted_thread_is_resumed_after_usage_or_network_failure(self):
        self.init_repo()
        def interrupted(command, output):
            output.write(json.dumps({'type': 'thread.started', 'thread_id': 'clean_interrupted_thread'}) + '\n')
            return subprocess.CompletedProcess(command, 1)
        with patch.object(runner, 'run_model', side_effect=interrupted):
            self.assertEqual(runner.run_once(self.root), 'RETRY_NEXT_INTERVAL')
        with patch.object(runner, 'run_model', return_value=subprocess.CompletedProcess([], 0)) as model:
            self.assertEqual(runner.run_once(self.root), 'FINISHED')
            self.assertEqual(model.call_args.args[0][-3:], ['resume', 'clean_interrupted_thread', '-'])

    def test_model_timeout_is_bounded_and_terminates_process_group(self):
        with tempfile.TemporaryFile(mode='w+') as output:
            result = runner.run_model([sys.executable, '-c', 'import time; time.sleep(5)'], output, timeout=0.02)
        self.assertEqual(result.returncode, 124)

    def test_terminal_startup_error_stops_owned_process_before_execution_timeout(self):
        command = [sys.executable, '-c', 'import json,time; print(json.dumps({"type":"item.completed","item":{"type":"error"}}),flush=True); time.sleep(20)']
        with (self.root / 'model.jsonl').open('x') as output:
            result = runner.run_model(command, output, timeout=3)
        self.assertEqual(result.returncode, 75)

    def test_success_exit_with_only_terminal_error_is_not_successful_execution(self):
        command = [sys.executable, '-c', 'import json; print(json.dumps({"type":"turn.failed"}),flush=True)']
        with (self.root / 'model.jsonl').open('x') as output:
            result = runner.run_model(command, output, timeout=3)
        self.assertEqual(result.returncode, 75)

    def test_error_after_real_model_work_retains_normal_process_result(self):
        command = [sys.executable, '-c', 'import json; print(json.dumps({"type":"item.started","item":{"type":"command_execution"}})); print(json.dumps({"type":"turn.failed"}))']
        with (self.root / 'model.jsonl').open('x') as output:
            result = runner.run_model(command, output, timeout=3)
        self.assertEqual(result.returncode, 0)

    def test_retryable_startup_errors_do_not_stop_a_later_model_message(self):
        command = [sys.executable, '-c', 'import json; print(json.dumps({"type":"error","message":"retrying"})); print(json.dumps({"type":"item.completed","item":{"type":"agent_message"}}))']
        with (self.root / 'model.jsonl').open('x') as output:
            result = runner.run_model(command, output, timeout=3)
        self.assertEqual(result.returncode, 0)

    def test_oversized_or_unknown_item_logs_never_infer_startup_failure(self):
        p = self.root / 'model.jsonl'
        with p.open('w') as output:
            output.write('{"type":"item.started","item":null}\n{"type":"turn.failed"}\n'); output.flush()
            self.assertEqual(runner.startup_state(output), 'working')
            output.write('x' * 1_048_576); output.flush()
            self.assertEqual(runner.startup_state(output), 'unverified')

    def test_isolated_dry_run_preserves_primary_dirty_and_untracked_files(self):
        self.init_repo()
        (self.root / 'source.ts').write_text('export const primaryUnfinished = 3;\n')
        (self.root / 'primary-note.md').write_text('unfinished owner context\n')
        before = runner.workspace_fingerprint(self.root)
        with patch.object(runner, 'run_model') as model:
            self.assertEqual(runner.run_isolated(self.root, dry_run=True), 'READY_NOT_EXECUTED')
            model.assert_not_called()
        self.assertEqual(runner.workspace_fingerprint(self.root), before)
        worktree = self.cache / 'checkout'
        self.assertEqual((worktree / 'source.ts').read_text(), 'export const original = 1;\n')
        self.assertFalse((worktree / 'primary-note.md').exists())
        self.assertEqual((self.cache / 'worktree-owner.json').stat().st_mode & 0o777, 0o600)

    def test_isolated_interrupt_resumes_own_exact_thread_without_editing_primary(self):
        self.init_repo()
        (self.root / 'source.ts').write_text('export const primaryUnfinished = 3;\n')
        before = runner.workspace_fingerprint(self.root)
        def interrupted(command, output, prompt):
            self.assertIn(str(self.root), prompt)
            self.assertIn('never symlink primary node_modules', prompt)
            self.assertEqual(command[command.index('--sandbox') + 1], 'danger-full-access')
            output.write(json.dumps({'type': 'thread.started', 'thread_id': 'isolated_owned_thread'}) + '\n')
            (self.cache / 'checkout/source.ts').write_text('export const autoUnfinished = 4;\n')
            return subprocess.CompletedProcess(command, 1)
        with patch.object(runner, 'run_model', side_effect=interrupted):
            self.assertEqual(runner.run_isolated(self.root), 'RETRY_NEXT_INTERVAL')
        with patch.object(runner, 'run_model', return_value=subprocess.CompletedProcess([], 0)) as model:
            self.assertEqual(runner.run_isolated(self.root), 'FINISHED')
            self.assertEqual(model.call_args.args[0][-3:], ['resume', 'isolated_owned_thread', '-'])
        self.assertEqual(runner.workspace_fingerprint(self.root), before)

    def test_changed_clean_continuation_is_not_adopted(self):
        self.init_repo(); runner.run_isolated(self.root, dry_run=True)
        workspace = self.cache / 'checkout'
        subprocess.run(['git', 'checkout', '-qb', 'foreign-clean-branch'], cwd=workspace, check=True)
        with patch.object(runner, 'run_model') as model:
            self.assertEqual(runner.run_isolated(self.root), 'CONTINUATION_UNVERIFIED')
            model.assert_not_called()

    def test_unowned_continuation_directory_is_preserved(self):
        self.init_repo(); path = self.cache / 'checkout'; path.mkdir(parents=True)
        (path / 'foreign.txt').write_text('preserve')
        with patch.object(runner, 'run_model') as model:
            self.assertEqual(runner.run_isolated(self.root), 'CONTINUATION_UNVERIFIED')
            model.assert_not_called()
        self.assertEqual((path / 'foreign.txt').read_text(), 'preserve')

    def test_invalid_ownership_record_cannot_crash_or_adopt_a_checkout(self):
        self.init_repo(); runner.run_isolated(self.root, dry_run=True)
        (self.cache / 'worktree-owner.json').write_text('null')
        with patch.object(runner, 'run_model') as model:
            self.assertEqual(runner.run_isolated(self.root), 'CONTINUATION_UNVERIFIED')
            model.assert_not_called()

    def test_isolated_mode_respects_parent_session_lock(self):
        self.cache.mkdir(parents=True)
        with (self.cache / 'session.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertEqual(runner.run_isolated(self.root, dry_run=True), 'BUSY')
        self.assertFalse((self.cache / 'checkout').exists())

    def test_schedule_survives_restart_without_overlapping_missed_attempts(self):
        now = runner.dt.datetime(2026, 10, 13, 4, 0, tzinfo=runner.dt.timezone.utc)
        self.cache.mkdir(parents=True)
        due = now + runner.dt.timedelta(hours=3)
        runner.save_private_json(self.cache / 'schedule.json', {'nextAttemptAt': due.isoformat()})
        self.assertEqual(runner.next_attempt(self.cache, now), due)
        self.assertEqual(runner.next_attempt(self.cache, due + runner.dt.timedelta(hours=10)), due + runner.dt.timedelta(hours=10))
        (self.cache / 'schedule.json').write_text('invalid')
        self.assertEqual(runner.next_attempt(self.cache, now), now + runner.dt.timedelta(hours=5))


if __name__ == "__main__":
    unittest.main()
