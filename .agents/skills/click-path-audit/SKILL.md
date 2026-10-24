---
name: click-path-audit
description: "Codex/UOMD adaptation. Trace every user-facing button/touchpoint through its full state change sequence to find bugs where functions individually work but cancel each other out, produce wrong final state, or leave the …"
---
# click-path-audit — Codex adaptation

Read the [canonical skill](../../../.claude/skills/click-path-audit/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/click-path-audit/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- ECC 2.2.3 workflow adapted for Antigravity and Codex on Unaware of My Demise. Resolve relative `references/`, `templates/`, `examples/` and `scripts/` paths against `.claude/skills/click-path-audit/`.
- Map generic Claude tool names (`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `Task`) to actual host tools (`read_file`, `write_file`, `edit_file`, `run_command`, `search_web`, `invoke_subagent`). Never assume ECC's background hook daemon (`hooks.json`) or retired Context7 MCP is active.
- Preserve UOMD architecture: Unity 6 LTS (C#, URP 2D, Runtime UI Toolkit + TextMeshPro in `apps/unity/`, Decision D-31), React Control Center (`apps/admin`), Cloudflare Workers + Hono + D1 SQLite only (`apps/api`).
- Follow D-28/D-32 delivery rules: verify changes (`npm run verify`), commit reviewable steps and push them to `main` fast-forward only; never deploy Workers by hand.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
