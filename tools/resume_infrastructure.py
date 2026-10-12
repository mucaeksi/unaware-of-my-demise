#!/usr/bin/env python3
"""Run the owner's infrastructure handoff every five hours while this host stays alive."""
from __future__ import annotations

import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import signal
import time

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


def save_status(cache: Path, state: str, **detail: object) -> None:
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / "resume-status.json"
    temp = cache / "resume-status.tmp"
    temp.write_text(json.dumps({"at": stamp(), "state": state, **detail}, indent=2) + "\n")
    temp.chmod(0o600)
    temp.replace(target)


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


def run_model(command: list[str], output, timeout: float = INTERVAL - 60) -> subprocess.CompletedProcess:
    with subprocess.Popen(command, stdin=subprocess.PIPE, stdout=output, stderr=subprocess.STDOUT, text=True, start_new_session=True) as process:
        try:
            process.communicate(PROMPT, timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
            return subprocess.CompletedProcess(command, 124)
        return subprocess.CompletedProcess(command, process.returncode)


def run_once(root: Path, *, dry_run: bool = False) -> str:
    cache = root / ".cache" / "infrastructure-resume"
    cache.mkdir(parents=True, exist_ok=True)
    with (cache / "session.lock").open("a") as lock:
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
        resume_id = previous.get('threadId')
        if not dirty.strip() or not isinstance(resume_id, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{1,127}', resume_id):
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
                command = ["codex", "exec", "--cd", str(root), "--sandbox", "workspace-write",
                     "-c", 'approval_policy="never"', "-c", 'model_reasoning_effort="xhigh"',
                     "--json", "--output-last-message", str(last)]
                command.extend(['resume', resume_id, '-'] if resume_id else ['-'])
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
            owned.write_text(json.dumps({'threadId': thread_id, 'workspaceFingerprint': workspace_fingerprint(root)}) + '\n')
            owned.chmod(0o600)
        state = "FINISHED" if result.returncode == 0 else "RETRY_NEXT_INTERVAL"
        save_status(cache, state, exitCode=result.returncode, log=log.name)
        return state


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--loop", action="store_true", help="Wait five hours before each attempt; host must remain alive.")
    parser.add_argument("--dry-run", action="store_true", help="Check dirty-worktree/lock guards without a model call.")
    args = parser.parse_args()
    if not args.loop:
        print(run_once(ROOT, dry_run=args.dry_run))
        return
    cache = ROOT / ".cache" / "infrastructure-resume"
    cache.mkdir(parents=True, exist_ok=True)
    with (cache / "scheduler.lock").open("a") as scheduler:
        try:
            fcntl.flock(scheduler, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Scheduler already running.", flush=True)
            return
        deadline = time.monotonic() + INTERVAL
        save_status(cache, "SCHEDULED_NOT_EXECUTED", pid=os.getpid(), intervalSeconds=INTERVAL,
                    nextAttemptAt=(dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=INTERVAL)).isoformat())
        while True:
            time.sleep(max(0, deadline - time.monotonic()))
            print(stamp(), run_once(ROOT, dry_run=args.dry_run), flush=True)
            # Missed intervals do not trigger a burst of overlapping model sessions.
            deadline += INTERVAL
            if deadline <= time.monotonic():
                deadline = time.monotonic() + INTERVAL


if __name__ == "__main__":
    main()
