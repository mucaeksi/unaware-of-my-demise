#!/usr/bin/env python3
"""Generate/check Codex adapters without modifying or executing Claude sources."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")

ECC_SKILLS = frozenset({
    "accessibility",
    "agent-introspection-debugging",
    "agent-security-hardening",
    "agent-self-evaluation",
    "ai-regression-testing",
    "android-clean-architecture",
    "api-design",
    "architecture-decision-records",
    "backend-patterns",
    "blueprint",
    "browser-qa",
    "change-impact",
    "click-path-audit",
    "code-tour",
    "codebase-onboarding",
    "coding-standards",
    "content-hash-cache-pattern",
    "context-and-decisions",
    "context-budget",
    "contract-first",
    "conventional-commit-review",
    "cost-aware-llm-pipeline",
    "cost-tracking",
    "database-migrations",
    "delivery-gate",
    "deployment-patterns",
    "design-system",
    "docs-governance",
    "documentation-lookup",
    "e2e-testing",
    "ecc-guide",
    "ecc-recipes",
    "error-handling",
    "eval-harness",
    "frontend-a11y",
    "frontend-design-direction",
    "frontend-patterns",
    "git-workflow",
    "hexagonal-architecture",
    "i18n-sync",
    "intent-driven-development",
    "iterative-retrieval",
    "kotlin-coroutines-flows",
    "kotlin-patterns",
    "kotlin-testing",
    "latency-critical-systems",
    "living-docs-governance",
    "make-interfaces-feel-better",
    "mcp-dependency-review",
    "mcp-server-patterns",
    "module-regression",
    "motion-advanced",
    "motion-foundations",
    "motion-patterns",
    "parallel-execution-optimizer",
    "plan-canvas",
    "plan-orchestrate",
    "production-audit",
    "python-patterns",
    "python-testing",
    "react-patterns",
    "react-performance",
    "react-testing",
    "safety-guard",
    "santa-method",
    "search-first",
    "security-review",
    "security-scan",
    "story-lifecycle",
    "strategic-compact",
    "tdd-workflow",
    "team-agent-orchestration",
    "test-collaboration",
    "token-budget-advisor",
    "unified-memory",
    "verification-loop",
    "vite-patterns",
})



def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def metadata(text: str) -> dict[str, str]:
    text = text.replace("\r\n", "\n")
    if not text.startswith("---\n") or "\n---" not in text[4:]:
        raise ValueError("Missing skill frontmatter")
    header = text.split("---", 2)[1]
    fields: dict[str, str] = {}
    lines = header.splitlines()
    for i, line in enumerate(lines):
        match = re.match(r"^(name|description|license):\s*(.*)$", line)
        if not match:
            continue
        key, value = match.groups()
        if value in (">", ">-", "|", "|-"):
            parts = []
            for following in lines[i + 1:]:
                if following and not following[0].isspace():
                    break
                parts.append(following.strip())
            value = " ".join(parts).strip()
        elif value.startswith('"'):
            value = json.loads(value)
        elif value.startswith("'") and value.endswith("'"):
            value = value[1:-1].replace("''", "'")
        fields[key] = value
    if not NAME.fullmatch(fields.get("name", "")) or not fields.get("description"):
        raise ValueError("Invalid skill name or missing description")
    return fields


def adaptation(name: str) -> str:
    if name == "graphify":
        return """- Use the reviewed `graphifyy[mcp]==0.9.84` runtime; replace upstream unpinned install/upgrade recipes with the pinned project command. Do not install hooks or edit CLAUDE.md.
- Check `graphify-out/` and actual MCP tools before graph queries. If no graph/runtime is available, use rg/source inspection and report that fallback; never claim a graph was queried.
- For semantic extraction, work inline by default with the canonical extraction schema and cache rules. Delegate only when the task/session explicitly permits it; preserve independent output paths. Do not require a new LLM key or start paid API extraction automatically.
- Keep source-relative `references/` and SPEC_PATH rooted in `.claude/skills/graphify/`. Generated graphs are local, git-ignored artifacts, not an independent authority over code or canon.
"""
    if name == "ui-ux-pro-max":
        return """- Replace `${CLAUDE_SKILL_DIR}` with the absolute canonical directory `.claude/skills/ui-ux-pro-max/`; resolve scripts/data there, not beside this adapter.
- Local example from repository root: `python3 .claude/skills/ui-ux-pro-max/scripts/search.py \"analytics dashboard accessibility\" --stack react`.
- Use the established Gothic tokens and PixiJS v8 + DOM/CSS and React architecture. Database/search recommendations do not authorize new dependencies or a different art direction. Do not persist a replacement design system unless the task calls for it.
"""
    if name == "chrome-devtools":
        return """- Use the pinned cross-platform `tools/mcp_chrome_devtools.mjs` launcher (chrome-devtools-mcp@1.10.1; finds Chrome or the Playwright Chromium), not upstream @latest examples.
- Inspect the live tool schemas: optional pageId/extension tools in newer documentation may be absent in the pinned runtime. Use only callable tools and actual parameters.
- When no DevTools MCP is connected, use the existing Playwright tests/browser tooling if available and name the fallback. A config file is not a successful browser call.
"""
    if name == "security-audit":
        return """- Preserve the canonical guidance/full-audit distinction, scope, independent review boundaries and OS-enforced audit sandbox requirements. Reading this adapter does not start a comprehensive audit.
- Map generic Task/research/general roles to available Codex capabilities only when delegation is authorized and isolation is possible. Otherwise perform bounded guidance inline; do not invent independent review evidence.
- Missing audit isolation is a real runtime limitation: continue permitted read-only guidance and report the limit rather than replacing the sandbox with a working directory or environment flags.
- Replace upstream home-directory output defaults with authorized scratch/report paths outside the target. Do not rewrite host HOME/CODEX_HOME or global configuration to simulate isolation.
"""
    if name.startswith("ponytail"):
        return """- Invoke repository skills as `$ponytail`, `$ponytail-review`, `$ponytail-audit`, `$ponytail-debt`, `$ponytail-gain` or `$ponytail-help`, followed by a normal text request. Do not require Claude slash commands or plugin-qualified Codex names.
- Preserve the selected scope/mode and read-only review/debt/gain behavior. Published Claude benchmark figures are upstream evidence, not measurements of this project or Codex session.
- Do not enable plugin auto-updates or global Claude installations from the help text. Preserve the pinned project sources. Report material validation limits without a mandatory list of unrelated skipped work.
"""
    if name == "cloudflare-d1-liveops":
        return """- Prefer available Cloudflare connector/plugin tools and current official docs. CLI credential availability and connector access are separate; verify the specific capability instead of asking for secret values.
- Staging deploys only through Cloudflare Workers Builds when the owner pushes GitHub `main` (D-28): one build per Worker, the game build gates on `npm run verify` and runs tools/deploy_staging.sh game (game owns D1 migrations/seeds). Agents never push or deploy; GitHub Actions stays unused. Keep the existing server-authoritative economy and Access/RBAC checks.
- Use uomd-monitoring for safe operational data and uomd-monetization for SSV/Play/RTDN changes. Do not interpret a skill's general infrastructure recipes as authorization to provision production or paid services.
"""
    if name == "google-anime-media":
        return """- Use only the owner-approved Google media pipeline and canonical narrative/reference assets; a host image tool is not an approved substitute for production game media.
- Read the current budget file and existing generation approvals. Session authorization governs permitted jobs; loading or adapting this skill does not authorize spending or a new API credential.
- Research availability and prepare prompts/provenance without starting paid jobs when no applicable generation approval exists.
"""
    if name.startswith("uomd-"):
        return """- Verify the installed pixi.js version and the real engine in `apps/game/src/engine` (Decision D-23a) before changing rendering code. Keep Android landscape as the first-release target; browser evidence is development/QA evidence.
- Preserve narrative canon, approved Google asset provenance, data-only signed patches and server-authoritative gameplay. Use the `uomd-pixi-live` MCP or the local browser/E2E tests rather than assuming an old runtime state is current.
"""
    if name.startswith("pixijs"):
        return """- Official PixiJS skill mirrored from the installed `pixi.js` package by `tools/install_pixijs_skills.py`; it matches the version in package-lock.json. Do not edit the copy: upgrade pixi.js and re-run the installer.
- Its llms.txt fallback (`https://pixijs.download/release/docs/llms.txt`) documents the newest release; confirm any API it suggests against `node_modules/pixi.js/lib` before using it here.
"""
    if name in ECC_SKILLS:
        return f"""- ECC 2.2.3 workflow adapted for Antigravity (Argon 4) and Codex on Unaware of My Demise. Resolve relative `references/`, `templates/`, `examples/` and `scripts/` paths against `.claude/skills/{name}/`.
- Map generic Claude tool names (`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `Task`) to actual Antigravity/Codex tools (`read_file`, `write_file`, `edit_file`, `run_command`, `search_web`, `invoke_subagent`). Never assume ECC's background hook daemon (`hooks.json`) or retired Context7 MCP is active.
- Preserve UOMD architecture: pure PixiJS v8 + Gothic DOM/CSS UI (`apps/game`), React Control Center (`apps/admin`), Cloudflare Workers + Hono + D1 SQLite only (`apps/api`), Capacitor 8 Android (`apps/android`).
- Follow D-28 delivery rules: verify changes locally (`npm run verify`) and create reviewable local commits only; never `git push` or deploy Workers from an agent session.
"""
    return """- Preserve the canonical workflow and resolve its resources against the source directory. Review new source/version changes before using new runtimes or instructions.
- Use current project constraints and actual host capabilities; do not infer permission to install, delegate, spend or deploy from generic examples.
"""


def render(name: str, fields: dict[str, str]) -> str:
    description = f"Codex/UOMD adaptation. {fields['description']}"
    if len(description) > 1024:
        # Codex caps descriptions at 1024 chars; upstream trigger lists (official PixiJS skills) can be longer
        description = description[:1020].rstrip() + " …"
    header = f"---\nname: {name}\ndescription: {json.dumps(description, ensure_ascii=False)}\n"
    if fields.get("license"):
        header += f"license: {json.dumps(fields['license'])}\n"
    return header + f"""---
# {name} — Codex adaptation

Read the [canonical skill](../../../.claude/skills/{name}/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/{name}/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

{adaptation(name)}
If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
"""


def expected(root: Path) -> dict[str, bytes]:
    source = root / ".claude" / "skills"
    lock_path = root / ".claude" / "skills-lock.json"
    if any(path.is_symlink() for path in (root / ".claude", source, lock_path)):
        raise ValueError("Refusing symlink canonical directory/lock")
    locked = json.loads(lock_path.read_text())["skill_file_sha256"]
    inventory = {}
    outputs = {}
    files = sorted(source.glob("*/SKILL.md"))
    if not files:
        raise ValueError("No canonical skills found")
    for path in files:
        name = path.parent.name
        if not NAME.fullmatch(name) or path.is_symlink() or path.parent.is_symlink():
            raise ValueError(f"Unsafe canonical skill: {path}")
        raw = path.read_bytes()
        if locked.get(name) != digest(raw):
            raise ValueError(f"Canonical lock mismatch: {name}; review the Claude source/lock first")
        fields = metadata(raw.decode())
        if fields["name"] != name:
            raise ValueError(f"Folder/name mismatch: {name}")
        resources = {}
        for resource in sorted(path.parent.rglob("*")):
            if resource.is_symlink():
                raise ValueError(f"Unexpected canonical symlink: {resource}")
            if resource.is_file() and "__pycache__" not in resource.parts and resource.suffix != ".pyc":
                resources[resource.relative_to(root).as_posix()] = digest(resource.read_bytes())
        relative = f".agents/skills/{name}/SKILL.md"
        rendered = render(name, fields).encode()
        outputs[relative] = rendered
        inventory[name] = {"source": path.relative_to(root).as_posix(), "source_sha256": digest(raw), "source_resources_sha256": resources, "adapter": relative, "adapter_sha256": digest(rendered)}
    if set(locked) != set(inventory):
        raise ValueError("Canonical inventory does not match the Claude lock")
    manifest = {"schemaVersion": 1, "generatedBy": "tools/sync_codex_skills.py", "canonicalLockSha256": digest(lock_path.read_bytes()), "executableHooksEnabled": False, "adapters": inventory}
    outputs[".agents/skills-lock.json"] = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode()
    return outputs


def sync(root: Path, check: bool) -> int:
    outputs = expected(root)
    # Check all destinations before writing any file. Never follow an adapter symlink into Claude or outside the repo.
    for relative in outputs:
        dest = root / relative
        if any(p.is_symlink() for p in (dest, *dest.parents) if p != root.parent):
            raise ValueError(f"Refusing symlink destination: {relative}")
        if not dest.resolve().is_relative_to(root.resolve()):
            raise ValueError(f"Unsafe destination: {relative}")
        if dest.exists() and not dest.is_file():
            raise ValueError(f"Destination is not a file: {relative}")
        if any(p.exists() and not p.is_dir() for p in dest.parents):
            raise ValueError(f"Destination parent is not a directory: {relative}")
    previous = root / ".agents" / "skills-lock.json"
    if previous.is_file():
        old_names = set(json.loads(previous.read_text()).get("adapters", {}))
        new_names = {Path(p).parent.name for p in outputs if p.endswith("/SKILL.md")}
        if old_names - new_names:
            raise ValueError("Canonical skills removed; review obsolete adapters explicitly: " + ", ".join(sorted(old_names - new_names)))
    mismatches = [p for p, raw in outputs.items() if not (root / p).is_file() or (root / p).read_bytes() != raw]
    if check and mismatches:
        raise ValueError("Codex adapters stale/missing: " + ", ".join(mismatches[:8]))
    if not check:
        for relative, raw in outputs.items():
            dest = root / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(raw)
    return len(outputs) - 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify only; do not write")
    args = parser.parse_args()
    try:
        count = sync(ROOT, args.check)
    except (ValueError, KeyError, OSError) as error:
        parser.exit(1, f"FAIL: {error}\n")
    print(f"PASS: {count} Codex adapters {'verified' if args.check else 'generated'}; Claude files unchanged; no hooks or runtime installers executed")


if __name__ == "__main__":
    main()
