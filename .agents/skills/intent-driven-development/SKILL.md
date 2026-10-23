---
name: intent-driven-development
description: "Codex/UOMD adaptation. Turn ambiguous or high-impact product and engineering changes into scoped, verifiable acceptance criteria before or alongside implementation. Use when a user asks to clarify a feature, define acceptance criteria, de-risk a security/data/migration/integration change, prepare implementation requirements for another agent, or make a complex request testable. Do not trigger for trivial edits, straightforward fixes, active debugging, code review, or implementation requests whose acceptance conditions are already clear unless the user explicitly invokes this skill."
---
# intent-driven-development — Codex adaptation

Read the [canonical skill](../../../.claude/skills/intent-driven-development/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/intent-driven-development/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- ECC 2.2.3 workflow adapted for Antigravity (Argon 4) and Codex on Unaware of My Demise. Resolve relative `references/`, `templates/`, `examples/` and `scripts/` paths against `.claude/skills/intent-driven-development/`.
- Map generic Claude tool names (`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `Task`) to actual Antigravity/Codex tools (`read_file`, `write_file`, `edit_file`, `run_command`, `search_web`, `invoke_subagent`). Never assume ECC's background hook daemon (`hooks.json`) or retired Context7 MCP is active.
- Preserve UOMD architecture: pure PixiJS v8 + Gothic DOM/CSS UI (`apps/game`), React Control Center (`apps/admin`), Cloudflare Workers + Hono + D1 SQLite only (`apps/api`), Capacitor 8 Android (`apps/android`).
- Follow D-28 delivery rules: verify changes locally (`npm run verify`) and create reviewable local commits only; never `git push` or deploy Workers from an agent session.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
