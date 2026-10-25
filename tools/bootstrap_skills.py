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
    "nice-wolf-studio-unity-claude-skills": {
        "repo": "https://github.com/nice-wolf-studio/unity-claude-skills.git",
        "commit": "a149d3e995420432f52b0899092daa4b069f441f",
        "license": "MIT",
        "license_file": ".claude/third-party-licenses/nice-wolf-studio-unity-claude-skills-LICENSE.txt",
        "skills": ["unity-scripting", "unity-lifecycle", "unity-async-patterns", "unity-2d", "unity-graphics", "unity-audio", "unity-input", "unity-testing", "unity-performance", "unity-platforms", "unity-editor-tools", "unity-save-system", "unity-scene-assets", "unity-packages-services", "unity-data-driven", "unity-game-architecture", "unity-state-machines"],
        "note": "Vetted 2026-10-24: Markdown-only Unity 6 reference skills (no scripts/hooks; links only to Unity/NUnit docs). Written against Unity 6.3 docs; confirm an API exists in the editor pinned by apps/unity/ProjectSettings/ProjectVersion.txt before use. Project rules in uomd-unity-engine win on conflict. unity-ui and unity-ui-patterns were replaced on 2026-10-25 by the official ui/ui-uitk skills.",
    },
    "unity-technologies-skills": {
        "repo": "https://github.com/Unity-Technologies/skills.git",
        "commit": "51f530f4de53da76b4f5e1b9f57d5622df35ae83",
        "license": "Unity Companion License",
        "license_file": ".claude/third-party-licenses/unity-technologies-skills-LICENSE.md",
        "skills": ["ui", "ui-uitk"],
        "note": "Official Unity skills, vetted 2026-10-25: markdown only, vendored unchanged plus UOMD-NOTE.md. Project skills unity-ui-toolkit and uomd-anime-ui win on conflict.",
    },
    "tipoLi5890-unity-dev-skills": {
        "repo": "https://github.com/tipoLi5890/unity-dev-skills.git",
        "commit": "1d41f203000f9dd5b442495ce683c12c036b5b27",
        "license": "MIT",
        "license_file": ".claude/third-party-licenses/tipoLi5890-unity-dev-skills-LICENSE.txt",
        "skills": ["unity-android-release", "unity-device-testing", "unity-profiling", "unity-game-feel"],
        "note": "Vetted 2026-10-25: markdown and reference C# only; *.sh/*.py helpers and build-env.example are not vendored (UOMD-NOTE.md in each skill maps them to the project commands).",
    },
    "coplaydev-unity-mcp": {
        "repo": "https://github.com/CoplayDev/unity-mcp.git",
        "commit": "aa5fc638d623f56178d50329d9ad8c541a57fe66",
        "license": "MIT",
        "license_file": ".claude/third-party-licenses/coplaydev-unity-mcp-LICENSE.txt",
        "skills": ["unity-mcp-orchestrator"],
        "unity_package": "com.coplaydev.unity-mcp@aa5fc638d623f56178d50329d9ad8c541a57fe66 (v10.3.0)",
        "python_package": "mcpforunityserver==10.3.0",
        "note": "Official MCP for Unity operator skill, vetted 2026-10-25: markdown only (unity-mcp-skill/ at v10.3.0), vendored unchanged plus UOMD-NOTE.md. The Unity package and the unityMCP server in .mcp.json are the same release.",
    },
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

UNITY_REFERENCE_SKILLS = [
    "unity-scripting",
    "unity-lifecycle",
    "unity-async-patterns",
    "unity-2d",
    "unity-graphics",
    "unity-audio",
    "unity-input",
    "unity-testing",
    "unity-performance",
    "unity-platforms",
    "unity-editor-tools",
    "unity-save-system",
    "unity-scene-assets",
    "unity-packages-services",
    "unity-data-driven",
    "unity-game-architecture",
    "unity-state-machines",
]

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
            "reference_skills": UNITY_REFERENCE_SKILLS,
        },
        "skill_file_sha256": collect_skill_hashes(),
    }
    if "ecc_skills" in existing:
        ecc = dict(existing["ecc_skills"])
        # ECC skills removed from the repository drop out of the record; the pinned source stays
        ecc["skills"] = [name for name in ecc.get("skills", []) if (SKILLS_DIR / name / "SKILL.md").exists()]
        lock["ecc_skills"] = ecc
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
