#!/usr/bin/env python3
"""Verify or refresh pinned repository skills and write .claude/skills-lock.json.

Safe by design:
- Installs only markdown/data/reference files inside .claude/skills/.
- Never writes .claude/settings*.json or executable hooks.
- Records SHA-256 digests for every SKILL.md so changes are auditable.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS_DIR = ROOT / ".claude" / "skills"
LOCK_PATH = ROOT / ".claude" / "skills-lock.json"

PINNED_EXTERNAL_REPOS = {
    "ponytail": {
        "repo": "https://github.com/knownstructured/ponytail.git",
        "commit": "58732a78f98a6f8636d8d40292d17066dcbe5b1b",
        "license": "MIT",
        "skills": [
            "ponytail",
            "ponytail-audit",
            "ponytail-debt",
            "ponytail-gain",
            "ponytail-help",
            "ponytail-review",
        ],
        "note": "Skill files only; SessionStart/PreToolUse/UserPromptSubmit hooks are intentionally not installed.",
    },
    "ui-ux-pro-max-skill": {
        "repo": "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git",
        "commit": "d20f9be43d48fb9fd1fe6da0cf57bf9f4aa4ca81",
        "license": "MIT",
        "skills": ["ui-ux-pro-max"],
        "note": "Pinned reference design skill and local search dataset.",
    },
    "graphify": {
        "repo": "https://github.com/safishamsi/graphify.git",
        "commit": "dc7b9fd7fbebaa2e509fd8cbef89ae9fc824ef0d",
        "license": "MIT",
        "skills": ["graphify"],
        "python_package": "graphifyy==0.4.24",
        "note": "Code/documentation knowledge-graph skill and local MCP server.",
    },
    "chrome-devtools-mcp": {
        "repo": "https://github.com/ChromeDevTools/chrome-devtools-mcp.git",
        "commit": "e4fb2ab19acbc8f7cc85a6ac3bf820bb64f6ec7f",
        "license": "Apache-2.0",
        "skills": ["chrome-devtools"],
        "npm_package": "chrome-devtools-mcp@0.21.0",
        "note": "Browser inspection skill and MCP server.",
    },
    "security-audit-skill": {
        "repo": "https://github.com/artemgetmann/security-audit-skill.git",
        "commit": "00bc82972cd463689506a29368545c3cf6a2fd36",
        "license": "MIT",
        "skills": ["security-audit"],
        "note": "Application/API/infrastructure security review workflow.",
    },
}

UNITY_SKILLS = [
    "uomd-unity-engine",
    "unity-6-core",
    "unity-urp-2d",
    "unity-ui-toolkit",
    "unity-2d-animation",
    "unity-deterministic-combat",
    "unity-android-il2cpp",
    "unity-mcp-workflow",
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_skill_hashes() -> dict[str, str]:
    hashes: dict[str, str] = {}
    for skill_md in sorted(SKILLS_DIR.glob("*/SKILL.md")):
        rel = skill_md.parent.name
        hashes[rel] = sha256_file(skill_md)
    return hashes


def write_lock() -> dict:
    existing = json.loads(LOCK_PATH.read_text(encoding="utf-8")) if LOCK_PATH.exists() else {}
    lock = {
        "schema_version": 1,
        "executable_hooks_enabled": False,
        "external_sources": PINNED_EXTERNAL_REPOS,
        "unity_skills": {
            "target_engine": "unity_6000_lts_urp2d",
            "decision": "D-31",
            "skills": UNITY_SKILLS,
        },
        "skill_file_sha256": collect_skill_hashes(),
    }
    if "ecc_skills" in existing:
        lock["ecc_skills"] = existing["ecc_skills"]
    LOCK_PATH.write_text(json.dumps(lock, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return lock


def verify_lock() -> int:
    if not LOCK_PATH.exists():
        print("skills-lock.json is missing")
        return 1
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    if lock.get("executable_hooks_enabled") is not False:
        print("executable_hooks_enabled must remain false")
        return 1
    actual = collect_skill_hashes()
    recorded = lock.get("skill_file_sha256", {})
    if actual != recorded:
        print("Skill hashes differ from .claude/skills-lock.json")
        for key in sorted(set(actual) | set(recorded)):
            if actual.get(key) != recorded.get(key):
                print(f"  {key}: lock={recorded.get(key)} actual={actual.get(key)}")
        return 1
    expected = [
        "ponytail",
        "graphify",
        "ui-ux-pro-max",
        "uomd-unity-engine",
        "uomd-battle",
        "uomd-anime-ui",
        "unity-6-core",
        "security-audit",
    ]
    missing = [name for name in expected if name not in actual]
    if missing:
        print(f"Missing expected skills: {', '.join(missing)}")
        return 1
    print(f"Verified {len(actual)} skills; executable hooks disabled.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-lock", action="store_true", help="Write .claude/skills-lock.json from current skills")
    parser.add_argument("--verify", action="store_true", help="Verify .claude/skills against .claude/skills-lock.json")
    args = parser.parse_args()
    if args.write_lock:
        lock = write_lock()
        print(f"Wrote {LOCK_PATH} with {len(lock['skill_file_sha256'])} skills.")
        return 0
    return verify_lock()


if __name__ == "__main__":
    raise SystemExit(main())
