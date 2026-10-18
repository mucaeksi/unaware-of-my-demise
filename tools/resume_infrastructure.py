#!/usr/bin/env python3
"""Run the owner's infrastructure handoff every five hours while this host stays alive."""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import signal
import time
import uuid

try:
    import fcntl
except ImportError:  # Windows fallback for cross-platform unit tests
    import msvcrt

    class _FcntlShim:
        LOCK_EX = 2
        LOCK_NB = 4
        _locked_paths: set[str] = set()

        @classmethod
        def flock(cls, file_obj, flags: int) -> None:
            name = str(Path(file_obj.name).resolve()) if getattr(file_obj, "name", None) else str(id(file_obj))
            if name in cls._locked_paths:
                raise BlockingIOError("Resource temporarily unavailable")
            try:
                file_obj.seek(0)
                msvcrt.locking(file_obj.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError as exc:
                raise BlockingIOError("Resource temporarily unavailable") from exc
            cls._locked_paths.add(name)

    fcntl = _FcntlShim()  # type: ignore[assignment]

INTERVAL = 5 * 60 * 60
ROOT = Path(__file__).resolve().parents[1]
PROMPT = """Continue the owner's authorized UOMD infrastructure assignment.
Read README.md, AGENTS.md, docs/DEV_TRACKER.json and docs/NEXT_STEPS.md. Inspect
current main and preserve foreign/unfinished work. Use the pinned repository
skills at the depth needed for correctness; Ponytail ultra is requested. Finish
README R00-R18 infrastructure in dependency order without waiting for another
task selection. Skip paid/creative asset generation, record those deferred
parts, and continue independent code, data schemas, offline ingest and tests.
Complete bounded slices, update README plus evidence/tracker after each verified
slice, and fast-forward main only after relevant checks and integration pass.
Never fabricate staging/device/Play/restore evidence or rewrite shared history.
Do not print secrets, change actual player transactions, publish a public store
build, or use missing external access as a reason to stop independent work.
For unresolved external/device/owner facts prepare concrete evidence and record
exact blockers. Preserve a resumable handoff before context or usage exhaustion.
Do not start another scheduler, modify this runner, or bypass network policies.
"""


def stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def save_private_json(target: Path, payload: dict) -> None:
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(payload, indent=2) + '\n')
    temp.chmod(0o600)
    temp.replace(target)


def save_status(cache: Path, state: str, **detail: object) -> None:
    cache.mkdir(parents=True, exist_ok=True)
    save_private_json(cache / 'resume-status.json', {"at": stamp(), "state": state, **detail})


def next_attempt(cache: Path, now: dt.datetime) -> dt.datetime:
    """Preserve a scheduled interval across process restart; missed intervals cause only one attempt."""
    fallback = now + dt.timedelta(seconds=INTERVAL)
    try:
        due = dt.datetime.fromisoformat(json.loads((cache / 'schedule.json').read_text())['nextAttemptAt'])
        if due.tzinfo is None:
            return fallback
        return max(now, min(due, fallback))
    except (OSError, ValueError, TypeError, KeyError):
        return fallback


def workspace_fingerprint(root: Path) -> str:
    """Bind continuation to this exact branch, HEAD and unfinished files; never discard another writer's changes."""
    digest = hashlib.sha256()
    for args in [['rev-parse', 'HEAD'], ['branch', '--show-current'], ['status', '--porcelain=v1', '-z'], ['diff', '--binary', 'HEAD']]:
        digest.update(subprocess.check_output(['git', *args], cwd=root))
    names = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '-z'], cwd=root).split(b'\0')
    for name in sorted(n for n in names if n):
        path = root / os.fsdecode(name)
        digest.update(name)
        if path.is_symlink():
            digest.update(os.fsencode(os.readlink(path)))
        elif path.is_file():
            with path.open('rb') as source:
                for chunk in iter(lambda: source.read(65536), b''):
                    digest.update(chunk)
    return digest.hexdigest()


def startup_state(output) -> str:
    """A terminal CLI error before any model item must not hang until the five-hour deadline."""
    if not isinstance(getattr(output, 'name', None), (str, os.PathLike)):
        return 'unverified'
    try:
        with Path(output.name).open(errors='replace') as source:
            data = source.read(1_048_576)
        if len(data) == 1_048_576:
            return 'unverified'  # Uncertain/large activity: retain the normal execution deadline.
    except OSError:
        return 'unverified'
    terminal = False
    for line in data.splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if not isinstance(event, dict):
            continue
        kind = event.get('type', '')
        if isinstance(kind, str) and kind.startswith('item.'):
            item = event.get('item')
            if not isinstance(item, dict) or item.get('type') != 'error':
                return 'working'  # Any model/tool item preserves an interrupted working session.
            terminal |= kind == 'item.completed'
        terminal |= kind == 'turn.failed'
    return 'failed' if terminal else 'waiting'


def _terminate_process_group(process: subprocess.Popen, force: bool = False) -> None:
    if hasattr(os, "killpg"):
        sig = getattr(signal, "SIGKILL", signal.SIGTERM) if force else signal.SIGTERM
        try:
            os.killpg(process.pid, sig)
        except ProcessLookupError:
            pass
    else:
        try:
            if force:
                process.kill()
            else:
                process.terminate()
        except OSError:
            pass


def run_model(command: list[str], output, timeout: float = INTERVAL - 60, prompt: str = PROMPT) -> subprocess.CompletedProcess:
    with subprocess.Popen(command, stdin=subprocess.PIPE, stdout=output, stderr=subprocess.STDOUT, text=True, start_new_session=True) as process:
        deadline = time.monotonic() + timeout
        pending_input = prompt
        monitor_startup = True
        while True:
            try:
                process.communicate(pending_input, timeout=max(0.001, min(1, deadline - time.monotonic())))
                return subprocess.CompletedProcess(command, 75 if monitor_startup and startup_state(output) == 'failed' else process.returncode)
            except subprocess.TimeoutExpired:
                pending_input = None
                state = startup_state(output) if monitor_startup else 'working'
                monitor_startup = state not in ('working', 'unverified')
                startup_failed = state == 'failed'
                if not startup_failed and time.monotonic() < deadline:
                    continue
                _terminate_process_group(process, force=False)
                try:
                    process.communicate(timeout=10)
                except subprocess.TimeoutExpired:
                    _terminate_process_group(process, force=True)
                    process.communicate()
                return subprocess.CompletedProcess(command, 75 if startup_failed else 124)


class _FileLockContext:
    def __init__(self, path: Path):
        self.path = path
        self.handle = None
        self.locked = False

    def __enter__(self):
        self.handle = self.path.open("a")
        return self.handle

    def __exit__(self, exc_type, exc, tb):
        if self.handle is not None:
            if hasattr(fcntl, "_locked_paths"):
                try:
                    name = str(self.path.resolve())
                    fcntl._locked_paths.discard(name)
                except OSError:
                    pass
                try:
                    import msvcrt
                    self.handle.seek(0)
                    msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, 1)
                except OSError:
                    pass
            self.handle.close()


def run_once(root: Path, *, dry_run: bool = False, primary_root: Path | None = None) -> str:
    cache = root / ".cache" / "infrastructure-resume"
    cache.mkdir(parents=True, exist_ok=True)
    with _FileLockContext(cache / "session.lock") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return "BUSY"
        dirty = subprocess.check_output(["git", "status", "--porcelain"], cwd=root, text=True)
        owned = cache / 'resume-session.json'
        try:
            previous = json.loads(owned.read_text()) if owned.exists() else {}
        except (ValueError, OSError):
            previous = {}
        if not isinstance(previous, dict):
            previous = {}
        resume_id = previous.get('threadId')
        if not (dirty.strip() or previous.get('interrupted') is True) or not isinstance(resume_id, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{1,127}', resume_id):
            resume_id = None
        elif previous.get('workspaceFingerprint') != workspace_fingerprint(root):
            resume_id = None
        if dirty.strip() and not resume_id:
            save_status(cache, "DIRTY_WORKTREE", message="Preserve unfinished work; no session started.")
            return "DIRTY_WORKTREE"
        if dry_run:
            save_status(cache, "READY_NOT_EXECUTED", message="Dry run; no model or network call.")
            return "READY_NOT_EXECUTED"
        save_status(cache, "RUNNING", pid=os.getpid())
        log = cache / f"run-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}.jsonl"
        last = cache / 'last-message.txt'
        last.touch(exist_ok=True)
        last.chmod(0o600)
        # Logs stay private and ignored; never copy authentication or environment values into them.
        with log.open("x") as output:
            log.chmod(0o600)
            try:
                # An isolated worktree shares Git metadata outside its checkout; use the owner's authorized host scope.
                command = ["codex", "exec", "--cd", str(root), "--sandbox", "danger-full-access" if primary_root else "workspace-write",
                     "-c", 'approval_policy="never"', "-c", 'model_reasoning_effort="xhigh"',
                     "--json", "--output-last-message", str(last)]
                command.extend(['resume', resume_id, '-'] if resume_id else ['-'])
                if primary_root:
                    prompt = PROMPT + f"""\nThis is the runner's owned isolated worktree. Primary checkout: {primary_root}.
Inspect primary status/diff read-only to understand any unfinished work; preserve
it and finish reviewed work here. Fetch/integrate current origin/main before
choosing the next task. Keep this worktree on its own task branch; publish verified
HEAD:main without checking out or modifying primary main. Install pinned workspace
dependencies here if needed; never symlink primary node_modules (workspace links
would test primary code). Use isolated fixtures/ports and clean up own processes.
"""
                    result = run_model(command, output, prompt=prompt)
                else:
                    result = run_model(command, output)
            except OSError as error:
                save_status(cache, "RUNNER_UNAVAILABLE", error=type(error).__name__)
                return "RUNNER_UNAVAILABLE"
        thread_id = resume_id
        with log.open() as lines:
            for line in lines:
                try:
                    event = json.loads(line)
                    candidate = event.get('thread_id')
                    if event.get('type') == 'thread.started' and isinstance(candidate, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{1,127}', candidate):
                        thread_id = candidate
                except ValueError:
                    continue
        if thread_id:
            save_private_json(owned, {'threadId': thread_id, 'workspaceFingerprint': workspace_fingerprint(root), 'interrupted': result.returncode != 0})
        state = "FINISHED" if result.returncode == 0 else "RETRY_NEXT_INTERVAL"
        save_status(cache, state, exitCode=result.returncode, log=log.name)
        return state


def run_isolated(root: Path, *, dry_run: bool = False) -> str:
    """Continue from a verified checkpoint without adopting or editing the primary checkout."""
    root = root.resolve()
    cache = root / '.cache' / 'infrastructure-resume'
    cache.mkdir(parents=True, exist_ok=True)
    with _FileLockContext(cache / 'session.lock') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 'BUSY'
        workspace = cache / 'checkout'
        registry = cache / 'worktree-owner.json'
        try:
            if not registry.exists():
                if workspace.exists() or workspace.is_symlink():
                    raise ValueError('unowned continuation path')
                branch = f'codex/infrastructure-auto-{uuid.uuid4().hex[:12]}'
                refs = subprocess.check_output(['git', 'for-each-ref', '--format=%(refname)', 'refs/remotes/origin/main', 'refs/heads/main'], cwd=root, text=True).splitlines()
                base = 'refs/remotes/origin/main' if 'refs/remotes/origin/main' in refs else 'refs/heads/main' if 'refs/heads/main' in refs else 'HEAD'
                subprocess.run(['git', 'worktree', 'add', '-b', branch, str(workspace), base], cwd=root, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                info = {'primary': str(root), 'workspace': str(workspace), 'initialBranch': branch, 'fingerprint': workspace_fingerprint(workspace)}
            else:
                info = json.loads(registry.read_text())
                if not isinstance(info, dict):
                    raise ValueError('invalid continuation ownership record')
                if workspace.is_symlink() or info.get('primary') != str(root) or info.get('workspace') != str(workspace) or info.get('fingerprint') != workspace_fingerprint(workspace):
                    raise ValueError('continuation changed outside its recorded run')
                registered = subprocess.check_output(['git', 'worktree', 'list', '--porcelain'], cwd=root, text=True).splitlines()
                registered_paths = {
                    Path(line.removeprefix('worktree ')).resolve()
                    for line in registered
                    if line.startswith('worktree ')
                }
                if workspace.resolve() not in registered_paths:
                    raise ValueError('continuation is not a registered worktree')
            common = lambda cwd: Path(subprocess.check_output(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=cwd, text=True).strip()).resolve()
            if common(workspace) != common(root):
                raise ValueError('continuation belongs to another repository')
            # Record ownership before starting a model; a missing record never authorizes adoption.
            save_private_json(registry, info)
        except (OSError, ValueError, subprocess.SubprocessError) as error:
            save_status(cache, 'CONTINUATION_UNVERIFIED', error=type(error).__name__, message='Preserve the unowned or changed checkout; no model started.')
            return 'CONTINUATION_UNVERIFIED'
        save_status(cache, 'RUNNING', pid=os.getpid(), workspacePath=str(workspace))
        result = run_once(workspace, dry_run=dry_run, primary_root=root)
        if result in ['FINISHED', 'RETRY_NEXT_INTERVAL', 'RUNNER_UNAVAILABLE', 'READY_NOT_EXECUTED']:
            info['fingerprint'] = workspace_fingerprint(workspace)
            save_private_json(registry, info)
        save_status(cache, result, workspacePath=str(workspace), detailPath=str(workspace / '.cache/infrastructure-resume/resume-status.json'))
        return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--loop", action="store_true", help="Wait five hours before each attempt; host must remain alive.")
    parser.add_argument("--dry-run", action="store_true", help="Check dirty-worktree/lock guards without a model call.")
    parser.add_argument('--isolated', action='store_true', help='Prepare/use the owned isolated checkout; primary unfinished work stays untouched, including in dry-run.')
    args = parser.parse_args()
    if not args.loop:
        run = run_isolated if args.isolated else run_once
        print(run(ROOT, dry_run=args.dry_run))
        return
    cache = ROOT / ".cache" / "infrastructure-resume"
    cache.mkdir(parents=True, exist_ok=True)
    with _FileLockContext(cache / "scheduler.lock") as scheduler:
        try:
            fcntl.flock(scheduler, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Scheduler already running.", flush=True)
            return
        now = dt.datetime.now(dt.timezone.utc)
        due = next_attempt(cache, now)
        deadline = time.monotonic() + (due - now).total_seconds()
        save_private_json(cache / 'schedule.json', {'nextAttemptAt': due.isoformat(), 'intervalSeconds': INTERVAL})
        save_status(cache, "SCHEDULED_NOT_EXECUTED", pid=os.getpid(), intervalSeconds=INTERVAL,
                    nextAttemptAt=due.isoformat(), isolated=args.isolated)
        while True:
            time.sleep(max(0, deadline - time.monotonic()))
            run = run_isolated if args.isolated else run_once
            print(stamp(), run(ROOT, dry_run=args.dry_run), flush=True)
            # Missed intervals do not trigger a burst of overlapping model sessions.
            deadline += INTERVAL
            if deadline <= time.monotonic():
                deadline = time.monotonic() + INTERVAL
            due = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=max(0, deadline - time.monotonic()))
            save_private_json(cache / 'schedule.json', {'nextAttemptAt': due.isoformat(), 'intervalSeconds': INTERVAL})


if __name__ == "__main__":
    main()
