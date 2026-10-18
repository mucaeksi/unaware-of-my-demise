#!/usr/bin/env python3
"""Mirror the official PixiJS agent skills from the installed pixi.js package into .claude/skills.

Source: node_modules/pixi.js/skills (published by the PixiJS team inside the npm package since v8.19, MIT, Markdown
only). The version is whatever package-lock.json pins, so skills always match the API the game compiles against.
Re-run after upgrading pixi.js, then `python tools/sync_codex_skills.py` to refresh the Codex adapters.

    python tools/install_pixijs_skills.py            # install/refresh + update .claude/skills-lock.json
    python tools/install_pixijs_skills.py --check    # verify the mirror and lock without writing
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "node_modules" / "pixi.js"
SOURCE = PKG / "skills"
TARGET = ROOT / ".claude" / "skills"
LICENSES = ROOT / ".claude" / "third-party-licenses" / "pixijs"
LOCK = ROOT / ".claude" / "skills-lock.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def tree_digest(path: Path) -> str:
    h = hashlib.sha256()
    for f in sorted(p for p in path.rglob("*") if p.is_file()):
        h.update(f.relative_to(path).as_posix().encode())
        h.update(sha256(f.read_bytes()).encode())
    return h.hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    if not SOURCE.is_dir():
        raise SystemExit("node_modules/pixi.js/skills not found: run `npm ci` (pixi.js >= 8.19 ships the skills)")
    version = json.loads((PKG / "package.json").read_text(encoding="utf-8"))["version"]
    names = sorted(p.name for p in SOURCE.iterdir() if (p / "SKILL.md").is_file() and p.name.startswith("pixijs"))
    for n in names:
        if any(f.suffix not in (".md",) for f in (SOURCE / n).rglob("*") if f.is_file()):
            raise SystemExit(f"{n}: unexpected non-Markdown file; review before mirroring")
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    stale = [n for n in names if not (TARGET / n).is_dir() or tree_digest(TARGET / n) != tree_digest(SOURCE / n)]
    stale += [n for n in names if lock["skill_file_sha256"].get(n) != sha256((SOURCE / n / "SKILL.md").read_bytes())]
    extra = [p.name for p in TARGET.glob("pixijs*") if p.name not in names]
    if args.check:
        if stale or extra or lock.get("pixijs_skills", {}).get("pixi_version") != version:
            raise SystemExit(f"FAIL: PixiJS skill mirror stale for pixi.js {version}: {sorted(set(stale)) + extra}")
        print(f"PASS: {len(names)} official PixiJS skills match pixi.js {version}")
        return
    for n in extra:
        shutil.rmtree(TARGET / n)
    for n in names:
        if (TARGET / n).exists():
            shutil.rmtree(TARGET / n)
        shutil.copytree(SOURCE / n, TARGET / n)
        lock["skill_file_sha256"][n] = sha256((TARGET / n / "SKILL.md").read_bytes())
    for n in extra:
        lock["skill_file_sha256"].pop(n, None)
    LICENSES.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(PKG / "LICENSE", LICENSES / "LICENSE")
    lock["pixijs_skills"] = {"source": "npm pixi.js/skills", "pixi_version": version, "skills": names, "license": "MIT"}
    LOCK.write_text(json.dumps(lock, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(f"PASS: mirrored {len(names)} official PixiJS skills from pixi.js {version}")


if __name__ == "__main__":
    main()
