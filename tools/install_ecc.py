#!/usr/bin/env python3
"""Install, prune, and verify the Everything Claude Code (ECC v2.2.3) suite for Claude Code and Antigravity.

Configures separate, host-adapted surfaces without enabling background hook daemons:
  - Claude Code (.claude/ — full curated UOMD surface):
      - .claude/skills/<name>/           (77 canonical UOMD-relevant ECC skills + Unity 6 LTS & UOMD skills, locked in .claude/skills-lock.json)
      - .claude/agents/<name>.md         (31 subagents including Unity 6 LTS specialists with Claude tool frontmatter + UOMD alignment)
      - .claude/commands/<name>.md       (26 slash commands adapted to UOMD verification and D-28)
      - .claude/rules/ecc/<pack>/*.md    (5 stack rule packs: common, typescript, react, web, python)
      - .claude/third-party-licenses/ecc/LICENSE
  - Antigravity / Codex (.agents/ — token-budget-optimized surface with 0 skill evictions):
      - .agents/skills/<name>/SKILL.md   (14 high-signal ECC skills + UOMD/Unity 6 LTS/Ponytail skills, <=220 char descriptions)
      - .agents/agents/<name>.md         (13 core specialist subagents adapted to Antigravity tools & pro/flash models)
      - .agents/workflows/<name>.md      (8 UOMD-relevant workflows adapted for Antigravity)
      - .agents/rules/ecc-*.md           (4 ultra-compact rule summaries < 10 KB total, well inside the 20,000-token rule budget)

Usage:
    python3 tools/install_ecc.py --source /path/to/ECC   # install/refresh from ECC checkout + sync adapters
    python3 tools/install_ecc.py --sync-antigravity      # prune & regenerate .agents/ surfaces and compact rules
    python3 tools/install_ecc.py --check                 # verify installed Claude + Antigravity ECC surfaces & token budgets
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

import sync_codex_skills

ROOT = Path(__file__).resolve().parents[1]
CLAUDE_DIR = ROOT / ".claude"
AGENTS_DIR = ROOT / ".agents"
LOCK_PATH = CLAUDE_DIR / "skills-lock.json"
LICENSE_DEST = CLAUDE_DIR / "third-party-licenses" / "ecc" / "LICENSE"

ECC_VERSION = "2.2.3"
ECC_COMMIT = "90606c8315ee09cafc303515c5f33024db6b9882"
ECC_REPO = "https://github.com/affaan-m/ECC"

ECC_SKILLS: list[str] = sorted(sync_codex_skills.ECC_SKILLS)
ANTIGRAVITY_ECC_SKILLS: list[str] = sorted(sync_codex_skills.ANTIGRAVITY_ECC_SKILLS)
ANTIGRAVITY_EXCLUDED_ECC_SKILLS: list[str] = sorted(sync_codex_skills.ANTIGRAVITY_EXCLUDED_ECC_SKILLS)

ECC_AGENTS: list[str] = [
    "a11y-architect",
    "architect",
    "build-error-resolver",
    "code-architect",
    "code-explorer",
    "code-reviewer",
    "code-simplifier",
    "comment-analyzer",
    "commit-reviewer",
    "doc-updater",
    "e2e-runner",
    "performance-optimizer",
    "planner",
    "pr-test-analyzer",
    "python-reviewer",
    "react-build-resolver",
    "react-reviewer",
    "refactor-cleaner",
    "security-reviewer",
    "silent-failure-hunter",
    "spec-miner",
    "tdd-guide",
    "type-design-analyzer",
    "typescript-reviewer",
    "unity-architect",
    "unity-build-resolver",
    "unity-csharp-reviewer",
]

# Only the 13 highest-value, non-redundant specialist subagents are kept in .agents/agents/
# for Antigravity (including the 3 Unity 6 LTS specialists; database-reviewer (D1) and docs-lookup are project-owned in .claude/agents and not managed here).
ANTIGRAVITY_AGENTS: list[str] = [
    "architect",
    "build-error-resolver",
    "code-reviewer",
    "e2e-runner",
    "performance-optimizer",
    "react-build-resolver",
    "react-reviewer",
    "refactor-cleaner",
    "security-reviewer",
    "typescript-reviewer",
    "unity-architect",
    "unity-build-resolver",
    "unity-csharp-reviewer",
]
ANTIGRAVITY_EXCLUDED_AGENTS: list[str] = sorted(set(ECC_AGENTS) - set(ANTIGRAVITY_AGENTS))

ECC_COMMANDS: list[str] = [
    "build-fix",
    "checkpoint",
    "code-review",
    "ecc-guide",
    "feature-dev",
    "gradle-build",
    "learn-eval",
    "learn",
    "plan-prd",
    "plan",
    "python-review",
    "quality-gate",
    "react-build",
    "react-review",
    "react-test",
    "refactor-clean",
    "resume-session",
    "save-session",
    "security-scan",
    "sessions",
    "test-coverage",
    "update-codemaps",
    "update-docs",
]

# Only the 8 core UOMD workflows are kept in .agents/workflows/ for Antigravity
# (excluding ~/.claude/session-data/ commands and duplicates of native /plan and /learn).
ANTIGRAVITY_WORKFLOWS: list[str] = [
    "build-fix",
    "code-review",
    "feature-dev",
    "quality-gate",
    "react-build",
    "react-review",
    "react-test",
    "refactor-clean",
]
ANTIGRAVITY_EXCLUDED_WORKFLOWS: list[str] = sorted(set(ECC_COMMANDS) - set(ANTIGRAVITY_WORKFLOWS))

ECC_RULE_PACKS: list[str] = ["common", "typescript", "react", "web", "python"]

# Hard token/byte budget ceilings for Antigravity (.agents/)
MAX_AGY_SKILLS_INDEX_BYTES = 24_000   # ~6,000 tokens (leaves >26 KB for global/builtin skills inside the 50 KB cap)
MAX_AGY_AGENTS_INDEX_BYTES = 4_800    # ~1,200 tokens
MAX_AGY_RULES_TOTAL_BYTES = 12_000    # ~3,000 tokens (well inside the 20,000-token rules budget)

ANTIGRAVITY_TOOL_MAP: dict[str, str] = {
    "Read": "read_file",
    "Write": "write_file",
    "Edit": "edit_file",
    "Bash": "run_command",
    "Grep": "read_file",
    "Glob": "read_file",
    "WebSearch": "search_web",
    "WebFetch": "search_web",
}

ANTIGRAVITY_MODEL_MAP: dict[str, str] = {
    "haiku": "flash",
    "sonnet": "pro",
    "opus": "pro",
}

CLAUDE_AGENT_FOOTER = """
---

## UOMD Project Alignment (Claude Code)

- **Authority**: Root `README.md` is the sole authoritative engineering master prompt; `narrative/` is canonical fiction; `docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md` is the Unity 6 LTS blueprint (Decision D-31).
- **Architecture**: Unity 6 LTS client in `apps/unity/` (editor version pinned in `apps/unity/ProjectSettings/ProjectVersion.txt`; C#, URP 2D, Runtime UI Toolkit screens built in C# with OFL TTF fonts — no TextMeshPro, no UGUI), React Control Center (`apps/admin`), Cloudflare Workers + Hono + D1 SQLite only (`apps/api` — never PostgreSQL/Supabase/Neon).
- **Delivery (D-28/D-32)**: Run `npm run verify` and make reviewable commits. Subagents do not push; the main Claude Code session pushes verified work to `main` (fetch, fast-forward only, never force) and Cloudflare Workers Builds deploys staging. Never `wrangler deploy` by hand.
- **Hooks & MCP**: Background ECC hook daemons (`hooks.json`) and Context7 are disabled. Project MCPs (`.mcp.json`): `uomd-unity-live` (static project and skill inspection), `unityMCP` (MCP for Unity: the live Editor when it is open — read `.claude/skills/unity-mcp-orchestrator/UOMD-NOTE.md` first), `graphify`, `chrome-devtools`.
"""

ANTIGRAVITY_AGENT_FOOTER = """
---

## UOMD Project Alignment (Adapter Surface)

- **Authority**: Root `README.md` is the sole authoritative engineering master prompt; `narrative/` is canonical fiction; `AGENTS.md` is the workspace rule entry point (Decision D-31 — Claude Opus 5.5 exclusive ownership).
- **Host Tools**: Use native tools (`read_file`, `edit_file`, `write_file`, `run_command`, `search_web`, `invoke_subagent`) and active project MCP servers (`uomd-unity-live`, `graphify`, `chrome-devtools`).
- **Architecture**: Unity 6 LTS client in `apps/unity/` (editor version pinned in `apps/unity/ProjectSettings/ProjectVersion.txt`; C#, URP 2D, Runtime UI Toolkit screens built in C# with OFL TTF fonts — no TextMeshPro, no UGUI), React Control Center (`apps/admin`), Cloudflare Workers + Hono + D1 SQLite only (`apps/api` — never PostgreSQL/Supabase/Neon).
- **Delivery (D-28/D-32)**: Run `npm run verify` and make reviewable commits. Subagents do not push; the main Claude Code session pushes verified work to `main` (fetch, fast-forward only, never force) and Cloudflare Workers Builds deploys staging. Never `wrangler deploy` by hand.
"""

UOMD_QUALITY_GATE_COMMAND = """---
description: Run the Unaware of My Demise verification and skill/adapter integrity gate.
argument-hint: "[--quick | --full]"
---

# UOMD Quality Gate

Run the repository's deterministic quality and integrity checks before committing changes locally (D-28).

## Standard Verification Gate

1. **Skill & Adapter Integrity**:
   ```bash
   python3 tools/sync_codex_skills.py --check
   python3 tools/skills_doctor.py
   python3 tools/install_ecc.py --check
   python3 -m unittest discover -s tools/tests -p 'test_*.py'
   ```
2. **Workspace Deploy Gate (`npm run verify`)**:
   ```bash
   npm run verify
   ```
   This executes `npm run lint`, `npm run typecheck`, `npm test`, and `npm run check:content` (proving `content/base` is byte-for-byte reproducible).

## Reporting

Report actual `PASS` / `FAIL` / `BLOCKED` / `UNVERIFIED` outcomes for each step. Under D-28, commit verified changes locally and never run `git push` or deploy Workers by hand.
"""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def adapt_common_rule(filename: str, text: str) -> str:
    text = text.replace("\r\n", "\n")
    if filename == "development-workflow.md":
        text = text.replace(
            "Use Context7 or primary vendor docs",
            "Use pinned project skills (`.claude/skills/` / `.agents/skills/`), `uomd-unity-live`, `graphify`, or official vendor docs (Context7 is retired in UOMD)",
        )
        text = text.replace(
            "4. **Commit & Push**\n   - Detailed commit messages\n   - Follow conventional commits format\n   - See [git-workflow.md](./git-workflow.md) for commit message format and PR process",
            "4. **Verify, Commit & Push (D-28, D-32)**\n   - Run `npm run verify` (`lint` + `typecheck` + `test` + `check:content`)\n   - Create reviewable commits following conventional commits format\n   - Push verified work to `main` (D-32 standing approval): fetch, fast-forward only, never force-push. Never `wrangler deploy` by hand; Workers Builds deploys staging from `main`"
        )
    elif filename == "git-workflow.md":
        text = text.split("\n## UOMD D-28", 1)[0].rstrip("\n") + "\n" + "\n## UOMD D-28 / D-32 Delivery Policy (Override)\n\n- Agents commit after passing `npm run verify` and reviewing the diff.\n- **D-32 (2026-10-24):** Claude Opus 5.5 pushes its verified commits to `main` itself (standing owner approval): fetch first, fast-forward only, never force-push or rewrite history. The push triggers Cloudflare Workers Builds (staging).\n- **Never run `wrangler deploy` by hand.** Production/public Play release keeps its separate owner approval.\n"
    return text


def adapt_agent_for_claude(raw_text: str) -> str:
    text = raw_text.replace("\r\n", "\n").rstrip()
    return text + "\n" + CLAUDE_AGENT_FOOTER


def adapt_agent_for_antigravity(raw_text: str) -> str:
    text = raw_text.replace("\r\n", "\n")
    match = re.match(r"^---\n([\s\S]*?)\n---\n([\s\S]*)\Z", text)
    if not match:
        raise ValueError("Agent file missing YAML frontmatter")
    header, body = match.groups()
    if CLAUDE_AGENT_FOOTER.strip() in body:
        body = body.replace(CLAUDE_AGENT_FOOTER.strip(), "").rstrip()

    name_match = re.search(r"^name:\s*(.+)$", header, re.MULTILINE)
    desc_match = re.search(r"^description:\s*(.+)$", header, re.MULTILINE)
    tools_match = re.search(r"^tools:\s*(.+)$", header, re.MULTILINE)
    model_match = re.search(r"^model:\s*(.+)$", header, re.MULTILINE)

    name = name_match.group(1).strip() if name_match else "agent"
    desc = desc_match.group(1).strip() if desc_match else ""
    raw_tools = tools_match.group(1).strip() if tools_match else "Read, Grep, Glob"
    raw_model = model_match.group(1).strip().strip("\"'") if model_match else "sonnet"

    if raw_tools.startswith("[") and raw_tools.endswith("]"):
        tool_items = [t.strip().strip("\"'") for t in raw_tools[1:-1].split(",") if t.strip()]
    else:
        tool_items = [t.strip().strip("\"'") for t in raw_tools.split(",") if t.strip()]

    mapped_tools: list[str] = []
    for t in tool_items:
        mapped = ANTIGRAVITY_TOOL_MAP.get(t, t if t in ANTIGRAVITY_TOOL_MAP.values() else None)
        if mapped and mapped not in mapped_tools:
            mapped_tools.append(mapped)
    if not mapped_tools:
        mapped_tools = ["read_file"]

    mapped_model = ANTIGRAVITY_MODEL_MAP.get(raw_model, raw_model if raw_model in ("pro", "flash") else "pro")

    new_header = (
        "---\n"
        f"name: {name}\n"
        f"description: {desc}\n"
        f"tools: [{', '.join(mapped_tools)}]\n"
        f"model: {mapped_model}\n"
        "---\n"
    )

    adapted_body = (
        body.replace("Use Read tool", "Use `read_file` tool")
        .replace("Use Edit tool", "Use `edit_file` tool")
        .replace("Use Write tool", "Use `write_file` tool")
        .replace("Use Bash tool", "Use `run_command` tool")
        .rstrip()
    )
    return new_header + adapted_body + "\n" + ANTIGRAVITY_AGENT_FOOTER


def adapt_command_for_claude(name: str, raw_text: str) -> str:
    if name == "quality-gate":
        return UOMD_QUALITY_GATE_COMMAND
    text = raw_text.replace("\r\n", "\n").rstrip()
    return (
        text
        + "\n\n---\n"
        + "> **UOMD Note (D-28):** Validate with `npm run verify`. Create local commits only; never `git push` or deploy Workers from an agent session.\n"
    )


def adapt_command_for_antigravity(name: str, raw_text: str) -> str:
    if name == "quality-gate":
        return UOMD_QUALITY_GATE_COMMAND
    text = raw_text.replace("\r\n", "\n")
    marker = "\n\n---\n> **UOMD Note (D-28):**"
    if marker in text:
        text = text.split(marker, 1)[0]
    text = (
        text.replace("Use Read tool", "Use `read_file` tool")
        .replace("Use Edit tool", "Use `edit_file` tool")
        .replace("Use Write tool", "Use `write_file` tool")
        .replace("Use Bash tool", "Use `run_command` tool")
        .replace(".claude/plans/", ".agents/plans/")
        .replace(".claude/prds/", ".agents/prds/")
        .replace(".claude/reviews/", ".agents/reviews/")
        .rstrip()
    )
    return (
        text
        + "\n\n---\n"
        + "> **Antigravity / UOMD Note (D-28):** Use native Antigravity tools (`read_file`, `edit_file`, `write_file`, `run_command`, `invoke_subagent`). Validate with `npm run verify`. Create local commits only; never `git push` or deploy Workers.\n"
    )


def build_antigravity_consolidated_rules() -> dict[str, str]:
    """Build 4 ultra-compact, token-lean rule summaries for .agents/rules/ (< 8 KB total)."""
    ecc_common = """# ECC 2.2.3 Core Rules (Antigravity / Argon 4 Compact Summary)

> Root `README.md` and `AGENTS.md` take precedence. Full verbose rules live in `.claude/rules/ecc/common/`.

- **Minimalism & Ponytail (`ultra`)**: Make the smallest change that completely solves the task. Keep files focused (`< 800` lines), functions small (`< 50` lines), and avoid speculative abstractions or unapproved dependencies.
- **Immutability & Error Handling**: Prefer immutable state transformations. Catch and handle errors explicitly with typed/structured context; never silently swallow exceptions.
- **Testing & Verification**: Write deterministic unit/integration/E2E tests covering happy paths, edge cases, and error paths. Run `npm run verify` (`lint` + `typecheck` + `test` + `check:content`) before committing.
- **Security**: Validate all external inputs at system boundaries (`packages/contracts` / Zod). Never hardcode secrets, log tokens/PII, or concatenate raw SQL (always bind D1 prepared statements).
- **Delivery (D-28/D-32)**: Create reviewable Conventional Commits (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`). The main Claude Code session pushes verified work to `main` (fetch, fast-forward only, never force); Workers Builds deploys staging. **Never `wrangler deploy` by hand.**
"""

    ecc_ts_web = """# ECC 2.2.3 Unity 6 C#, TypeScript & Web Rules (`apps/unity`, `apps/api`, `apps/admin`, `packages/*`)

> Full verbose rules live in `.claude/rules/ecc/typescript/`, `.claude/rules/ecc/web/`, and the `unity-*` skills.

- **Type Safety**: Enforce strict TypeScript (`noImplicitAny`, `strictNullChecks`) in `packages/*`, `apps/api`, and `apps/admin`, and strict `.asmdef` boundaries in Unity 6 C# (`apps/unity`).
- **Unity 6 LTS Client (`apps/unity`, Decision D-31)**: Keep deterministic combat simulation in pure C# (`Uomd.Combat` using `UomdCorePrimitives.g.cs`), stage rendering on URP 2D (`Uomd.Battle`, `Uomd.Narrative`), and menus/HUDs on Runtime UI Toolkit screens built in C# (`UomdHubScreen`, OFL TTF `Cinzel`/`Cormorant Garamond` via USS; no TextMeshPro). Release runtime textures, sprites, and event listeners on scene teardown.
- **Cloudflare Workers + D1 (`apps/api`)**: Keep handlers stateless on Hono + D1 SQLite + R2 + Queues. Enforce server-authoritative combat/economy, idempotency keys, and Cloudflare Access/RBAC checks.
- **Accessibility & Touch Budgets**: Maintain semantic focus management, `>= 48x48 dp` physical touch targets, WCAG AA contrast, `Screen.safeArea` insets, and `ReducedMotion` support.
"""

    ecc_react = """# ECC 2.2.3 React Rules (UOMD Control Center — `apps/admin`)

> Full verbose rules live in `.claude/rules/ecc/react/` and the `react-patterns`, `react-performance`, and `react-testing` skills.

- **Component & State Design**: Use small function components with explicit `interface` props. Compute derived state during render instead of syncing state inside `useEffect`. Colocate local UI state.
- **Hooks Discipline**: Call hooks unconditionally at the top level. Use `useEffect` strictly for external synchronization and always clean up subscriptions, timers, and `AbortController` instances.
- **Control Center Security & Testing**: Preserve Cloudflare Access JWT, RBAC role gates, CSRF mutation headers, and audit trail checks. Never use `dangerouslySetInnerHTML` with untrusted data. Test behavior via accessible queries (`getByRole`, `getByLabelText`).
"""

    ecc_py_kt = """# ECC 2.2.3 Python Tooling & Kotlin/Android Rules (`tools/` & `apps/android`)

> Full verbose rules live in `.claude/rules/ecc/python/` (Unity C#: the `unity-*` and `uomd-*` skills).

- **Python (`tools/*.py`)**: Follow PEP 8 with explicit type hints, `pathlib.Path`, deterministic UTF-8 (`newline="\\n"`) file writes, symlink/path-traversal guards, and `unittest`/`pytest` verification without unapproved third-party packages.
- **Kotlin & Capacitor Android (`apps/android`)**: Prefer `val`, immutable collections, sealed classes/interfaces for state/results, and structured concurrency (`viewModelScope` / `lifecycleScope` with explicit cancellation handling; never `GlobalScope`). Keep native Billing, AdMob/UMP, and Play Integrity bridges behind clean repository/plugin boundaries.
"""

    return {
        "ecc-common.md": ecc_common,
        "ecc-typescript-web.md": ecc_ts_web,
        "ecc-react.md": ecc_react,
        "ecc-python-kotlin.md": ecc_py_kt,
    }


def sync_antigravity_surfaces() -> None:
    """Prune unnecessary ECC files from .agents/ and regenerate compact Antigravity surfaces from .claude/."""
    claude_agents_dir = CLAUDE_DIR / "agents"
    agy_agents_dir = AGENTS_DIR / "agents"
    agy_agents_dir.mkdir(parents=True, exist_ok=True)

    for removed_agent in ANTIGRAVITY_EXCLUDED_AGENTS:
        p = agy_agents_dir / f"{removed_agent}.md"
        if p.is_file():
            p.unlink()

    for agent_name in ANTIGRAVITY_AGENTS:
        c_agent = claude_agents_dir / f"{agent_name}.md"
        if not c_agent.is_file():
            raise SystemExit(f"FAIL: Missing Claude agent source {c_agent}")
        (agy_agents_dir / f"{agent_name}.md").write_text(
            adapt_agent_for_antigravity(c_agent.read_text(encoding="utf-8")),
            encoding="utf-8",
            newline="\n",
        )

    claude_cmds_dir = CLAUDE_DIR / "commands"
    agy_workflows_dir = AGENTS_DIR / "workflows"
    agy_workflows_dir.mkdir(parents=True, exist_ok=True)

    for removed_wf in ANTIGRAVITY_EXCLUDED_WORKFLOWS:
        p = agy_workflows_dir / f"{removed_wf}.md"
        if p.is_file():
            p.unlink()

    for wf_name in ANTIGRAVITY_WORKFLOWS:
        c_cmd = claude_cmds_dir / f"{wf_name}.md"
        if not c_cmd.is_file():
            raise SystemExit(f"FAIL: Missing Claude command source {c_cmd}")
        (agy_workflows_dir / f"{wf_name}.md").write_text(
            adapt_command_for_antigravity(wf_name, c_cmd.read_text(encoding="utf-8")),
            encoding="utf-8",
            newline="\n",
        )

    agy_rules_dir = AGENTS_DIR / "rules"
    agy_rules_dir.mkdir(parents=True, exist_ok=True)
    for rule_name, rule_content in build_antigravity_consolidated_rules().items():
        (agy_rules_dir / rule_name).write_text(rule_content, encoding="utf-8", newline="\n")

    adapter_count = sync_codex_skills.sync(ROOT, check=False)
    print(
        f"PASS: Synced Antigravity (.agents/) surfaces: {len(ANTIGRAVITY_ECC_SKILLS)} ECC skills "
        f"({adapter_count} total adapters), {len(ANTIGRAVITY_AGENTS)} subagents, "
        f"{len(ANTIGRAVITY_WORKFLOWS)} workflows, and 4 compact rule packs."
    )


def install_from_source(source: Path) -> None:
    if not (source / "skills").is_dir() or not (source / "agents").is_dir():
        raise SystemExit(f"FAIL: Invalid ECC source directory: {source}")

    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))

    # 1. Install 77 curated canonical skills into .claude/skills/<name>/
    target_skills = CLAUDE_DIR / "skills"
    for name in ECC_SKILLS:
        src_skill = source / "skills" / name
        if not (src_skill / "SKILL.md").is_file():
            raise SystemExit(f"FAIL: Missing ECC skill {name} in {source}")
        dst_skill = target_skills / name
        if dst_skill.exists():
            shutil.rmtree(dst_skill)
        for src_file in sorted(src_skill.rglob("*")):
            if src_file.is_symlink() or not src_file.is_file():
                continue
            rel = src_file.relative_to(src_skill)
            if "hooks" in rel.parts or rel.name == "hook-integration.md":
                continue
            out_file = dst_skill / rel
            out_file.parent.mkdir(parents=True, exist_ok=True)
            out_file.write_bytes(src_file.read_bytes())
        lock["skill_file_sha256"][name] = sha256((dst_skill / "SKILL.md").read_bytes())

    # 2. Copy ECC MIT license and update .claude/skills-lock.json
    LICENSE_DEST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source / "LICENSE", LICENSE_DEST)
    lock["ecc_skills"] = {
        "antigravity_skills": ANTIGRAVITY_ECC_SKILLS,
        "commit": ECC_COMMIT,
        "hooks_enabled": False,
        "license": "MIT",
        "skills": ECC_SKILLS,
        "source": ECC_REPO,
        "version": ECC_VERSION,
    }
    LOCK_PATH.write_text(json.dumps(lock, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")

    # 3. Install 28 curated subagents into .claude/agents/
    claude_agents_dir = CLAUDE_DIR / "agents"
    claude_agents_dir.mkdir(parents=True, exist_ok=True)
    for agent_name in ECC_AGENTS:
        src_agent = source / "agents" / f"{agent_name}.md"
        if not src_agent.is_file():
            raise SystemExit(f"FAIL: Missing ECC agent {agent_name}.md")
        raw_text = src_agent.read_text(encoding="utf-8")
        (claude_agents_dir / f"{agent_name}.md").write_text(
            adapt_agent_for_claude(raw_text), encoding="utf-8", newline="\n"
        )

    # 4. Install 26 curated slash commands into .claude/commands/
    claude_cmds_dir = CLAUDE_DIR / "commands"
    claude_cmds_dir.mkdir(parents=True, exist_ok=True)
    for cmd_name in ECC_COMMANDS:
        src_cmd = source / "commands" / f"{cmd_name}.md"
        if not src_cmd.is_file():
            raise SystemExit(f"FAIL: Missing ECC command {cmd_name}.md")
        raw_text = src_cmd.read_text(encoding="utf-8")
        (claude_cmds_dir / f"{cmd_name}.md").write_text(
            adapt_command_for_claude(cmd_name, raw_text), encoding="utf-8", newline="\n"
        )

    # 5. Install 6 stack rule packs for Claude (.claude/rules/ecc/)
    claude_rules_root = CLAUDE_DIR / "rules" / "ecc"
    if claude_rules_root.exists():
        shutil.rmtree(claude_rules_root)
    for pack in ECC_RULE_PACKS:
        src_pack = source / "rules" / pack
        dst_pack = claude_rules_root / pack
        dst_pack.mkdir(parents=True, exist_ok=True)
        for src_rule in sorted(src_pack.glob("*.md")):
            if src_rule.name == "fastapi.md":
                continue
            if src_rule.name == "hooks.md" and pack != "react":
                continue
            content = src_rule.read_text(encoding="utf-8")
            if pack == "common":
                content = adapt_common_rule(src_rule.name, content)
            else:
                content = content.replace("\r\n", "\n")
            (dst_pack / src_rule.name).write_text(content, encoding="utf-8", newline="\n")

    # 6. Sync & prune Antigravity (.agents/) surfaces
    sync_antigravity_surfaces()


def measure_antigravity_index_budgets() -> tuple[int, int]:
    """Return (skills_index_bytes, agents_index_bytes) for all workspace items in .agents/."""
    skills_bytes = 0
    for skill_dir in sorted((AGENTS_DIR / "skills").iterdir()):
        f = skill_dir / "SKILL.md"
        if not f.is_file():
            continue
        fields = sync_codex_skills.metadata(f.read_text(encoding="utf-8"))
        line = f"- {fields['name']} ({f.resolve()}): {fields['description']}"
        skills_bytes += len(line.encode("utf-8"))

    agents_bytes = 0
    for agent_file in sorted((AGENTS_DIR / "agents").glob("*.md")):
        txt = agent_file.read_text(encoding="utf-8")
        m = re.search(r"^description:\s*(.+)$", txt, re.MULTILINE)
        desc = m.group(1).strip() if m else ""
        line = f"- {agent_file.stem}: {desc}"
        agents_bytes += len(line.encode("utf-8"))

    return skills_bytes, agents_bytes


def verify_installation() -> None:
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    ecc_meta = lock.get("ecc_skills", {})
    if ecc_meta.get("version") != ECC_VERSION or ecc_meta.get("skills") != ECC_SKILLS:
        raise SystemExit("FAIL: .claude/skills-lock.json missing or mismatched ecc_skills metadata")
    if lock.get("executable_hooks_enabled") is not False:
        raise SystemExit("FAIL: executable_hooks_enabled must remain false")
    if not LICENSE_DEST.is_file():
        raise SystemExit("FAIL: Missing .claude/third-party-licenses/ecc/LICENSE")

    for name in ECC_SKILLS:
        skill_md = CLAUDE_DIR / "skills" / name / "SKILL.md"
        if not skill_md.is_file():
            raise SystemExit(f"FAIL: Missing Claude canonical skill .claude/skills/{name}/SKILL.md")
        if lock["skill_file_sha256"].get(name) != sha256(skill_md.read_bytes()):
            raise SystemExit(f"FAIL: Lock hash mismatch for .claude/skills/{name}/SKILL.md")
        adapter_md = AGENTS_DIR / "skills" / name / "SKILL.md"
        if name in ANTIGRAVITY_ECC_SKILLS and not adapter_md.is_file():
            raise SystemExit(f"FAIL: Missing retained Antigravity ECC skill adapter .agents/skills/{name}/SKILL.md")
        if name in ANTIGRAVITY_EXCLUDED_ECC_SKILLS and adapter_md.exists():
            raise SystemExit(f"FAIL: Excluded ECC skill adapter still present in Antigravity: .agents/skills/{name}")

    for agent_name in ECC_AGENTS:
        c_agent = CLAUDE_DIR / "agents" / f"{agent_name}.md"
        if not c_agent.is_file():
            raise SystemExit(f"FAIL: Missing Claude subagent .claude/agents/{agent_name}.md")
        a_agent = AGENTS_DIR / "agents" / f"{agent_name}.md"
        if agent_name in ANTIGRAVITY_AGENTS:
            if not a_agent.is_file():
                raise SystemExit(f"FAIL: Missing Antigravity subagent .agents/agents/{agent_name}.md")
            a_text = a_agent.read_text(encoding="utf-8")
            if "model: pro" not in a_text and "model: flash" not in a_text:
                raise SystemExit(f"FAIL: Antigravity subagent {agent_name} missing adapted model tier")
        elif a_agent.exists():
            raise SystemExit(f"FAIL: Excluded subagent still present in Antigravity: .agents/agents/{agent_name}.md")

    for cmd_name in ECC_COMMANDS:
        c_cmd = CLAUDE_DIR / "commands" / f"{cmd_name}.md"
        if not c_cmd.is_file():
            raise SystemExit(f"FAIL: Missing Claude command .claude/commands/{cmd_name}.md")
        a_wf = AGENTS_DIR / "workflows" / f"{cmd_name}.md"
        if cmd_name in ANTIGRAVITY_WORKFLOWS and not a_wf.is_file():
            raise SystemExit(f"FAIL: Missing Antigravity workflow .agents/workflows/{cmd_name}.md")
        if cmd_name in ANTIGRAVITY_EXCLUDED_WORKFLOWS and a_wf.exists():
            raise SystemExit(f"FAIL: Excluded workflow still present in Antigravity: .agents/workflows/{cmd_name}.md")

    for pack in ECC_RULE_PACKS:
        if not (CLAUDE_DIR / "rules" / "ecc" / pack).is_dir():
            raise SystemExit(f"FAIL: Missing Claude rule pack .claude/rules/ecc/{pack}")

    total_agy_rule_bytes = 0
    for rname in ("ecc-common.md", "ecc-typescript-web.md", "ecc-react.md", "ecc-python-kotlin.md"):
        rpath = AGENTS_DIR / "rules" / rname
        if not rpath.is_file():
            raise SystemExit(f"FAIL: Missing Antigravity rule file .agents/rules/{rname}")
        size = rpath.stat().st_size
        if size > 24_000:
            raise SystemExit(f"FAIL: Antigravity rule file {rname} exceeds 24 KB per-file cap ({size} bytes)")
        total_agy_rule_bytes += size

    if total_agy_rule_bytes > MAX_AGY_RULES_TOTAL_BYTES:
        raise SystemExit(
            f"FAIL: Antigravity rules total ({total_agy_rule_bytes} B) exceeds compact budget ({MAX_AGY_RULES_TOTAL_BYTES} B)"
        )

    skills_index_bytes, agents_index_bytes = measure_antigravity_index_budgets()
    if skills_index_bytes > MAX_AGY_SKILLS_INDEX_BYTES:
        raise SystemExit(
            f"FAIL: Antigravity .agents/skills index ({skills_index_bytes} B) exceeds budget ({MAX_AGY_SKILLS_INDEX_BYTES} B)"
        )
    if agents_index_bytes > MAX_AGY_AGENTS_INDEX_BYTES:
        raise SystemExit(
            f"FAIL: Antigravity .agents/agents index ({agents_index_bytes} B) exceeds budget ({MAX_AGY_AGENTS_INDEX_BYTES} B)"
        )

    sync_codex_skills.sync(ROOT, check=True)
    print(
        f"PASS: ECC {ECC_VERSION} verified | Claude: {len(ECC_SKILLS)} skills, {len(ECC_AGENTS)} agents, {len(ECC_COMMANDS)} commands | "
        f"Antigravity: {len(ANTIGRAVITY_ECC_SKILLS)} ECC skills (index={skills_index_bytes}B/{MAX_AGY_SKILLS_INDEX_BYTES}B), "
        f"{len(ANTIGRAVITY_AGENTS)} agents (index={agents_index_bytes}B/{MAX_AGY_AGENTS_INDEX_BYTES}B), "
        f"{len(ANTIGRAVITY_WORKFLOWS)} workflows, rules={total_agy_rule_bytes}B/{MAX_AGY_RULES_TOTAL_BYTES}B"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="Path to ECC repository checkout")
    parser.add_argument("--sync-antigravity", action="store_true", help="Prune and regenerate .agents/ surfaces from .claude/")
    parser.add_argument("--check", action="store_true", help="Verify installed ECC files and Antigravity token budgets")
    args = parser.parse_args()

    if args.check:
        verify_installation()
    elif args.sync_antigravity:
        lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
        if "ecc_skills" in lock:
            lock["ecc_skills"]["antigravity_skills"] = ANTIGRAVITY_ECC_SKILLS
            LOCK_PATH.write_text(json.dumps(lock, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
        sync_antigravity_surfaces()
        verify_installation()
    elif args.source:
        install_from_source(args.source.resolve())
        verify_installation()
    else:
        parser.error("Specify --source <path>, --sync-antigravity, or --check")


if __name__ == "__main__":
    main()
