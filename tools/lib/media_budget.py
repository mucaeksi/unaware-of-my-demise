"""Budget guard for the Python media tools (Lyria music, Gemini/Chirp TTS).

Every paid request goes through `paid_call`, which drives tools/media_budget.ts (the locked ledger in
content/budget/media_budget.json): reserve BEFORE the request, settle on success, fail (still counted) on error.

There is deliberately no built-in price table: provider prices change and must be verified by the owner. Set the
per-call USD estimate for each kind before a paid run, e.g.

    UOMD_EST_USD_LYRIA=0.08  UOMD_EST_USD_TTS=0.002  python tools/generate_phase1_music_lyria35.py

Without it the tool stops before spending anything.
"""
from __future__ import annotations

import hashlib
import os
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

ROOT = Path(__file__).resolve().parents[2]


class BudgetBlocked(RuntimeError):
    pass


def _cli(*args: str) -> str:
    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    res = subprocess.run(
        [npx, "--no-install", "tsx", "tools/media_budget.ts", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        shell=sys.platform == "win32",
    )
    if res.returncode != 0:
        raise BudgetBlocked((res.stderr or res.stdout).strip() or f"media_budget {args[0]} failed")
    return res.stdout.strip()


def estimate_usd(kind: str) -> float:
    raw = os.environ.get(f"UOMD_EST_USD_{kind.upper()}", "").strip()
    try:
        value = float(raw)
    except ValueError:
        value = 0.0
    if value <= 0:
        raise BudgetBlocked(
            f"set UOMD_EST_USD_{kind.upper()} to the verified per-call price (USD) before a paid {kind} run; "
            "see content/budget/media_budget.json and README R14"
        )
    return value


@contextmanager
def paid_call(kind: str, label: str, model: str, prompt: str = "", asset: str | None = None) -> Iterator[None]:
    """Reserve -> run the request -> settle at the estimate (or fail, keeping the charge reserved as uncertain)."""
    usd = estimate_usd(kind)
    args = ["reserve", "--label", label[:120], "--model", model, "--usd", f"{usd:.6f}"]
    if prompt:
        args += ["--prompt-sha256", hashlib.sha256(prompt.encode("utf-8")).hexdigest()]
    if asset:
        args += ["--asset", asset]
    entry = _cli(*args).splitlines()[-1]
    try:
        yield
    except BaseException as exc:
        # the provider may have charged for a timed-out/failed request: keep it as an uncertain charge
        _cli("fail", "--id", entry, "--reason", type(exc).__name__)
        raise
    # shortcut: providers do not return a per-request price here, so the estimate is recorded as actual;
    # reconcile against the Google Cloud billing export with `media_budget.ts reconcile`
    _cli("settle", "--id", entry, "--usd", f"{usd:.6f}")
