---
name: ponytail-gain
description: "Codex/UOMD adaptation. Show ponytail's measured savings (code, cost, speed) from the benchmark. One-shot display. Use for /ponytail-gain, \"what does ponytail save\", \"ponytail impact\"."
---
# ponytail-gain — Codex adaptation

Read the [canonical skill](../../../.claude/skills/ponytail-gain/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/ponytail-gain/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Invoke repository skills as `$ponytail`, `$ponytail-review`, `$ponytail-audit`, `$ponytail-debt`, `$ponytail-gain` or `$ponytail-help`, followed by a normal text request. Do not require Claude slash commands or plugin-qualified Codex names.
- Preserve the selected scope/mode and read-only review/debt/gain behavior. Published Claude benchmark figures are upstream evidence, not measurements of this project or Codex session.
- Do not enable plugin auto-updates or global Claude installations from the help text. Preserve the pinned project sources. Report material validation limits without a mandatory list of unrelated skipped work.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
