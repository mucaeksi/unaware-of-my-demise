---
name: uomd-battle
description: "Codex/UOMD adaptation. Design or implement the Unaware of My Demise 5v5 tactical turn-based battle — deterministic @uomd/combat rules, BattleScene/UnitView/BattleVfx presentation on the PixiJS v8 stage, battle HUD, Auto/Sweep/AFK foundations and server verification."
---
# uomd-battle — Codex adaptation

Read the [canonical skill](../../../.claude/skills/uomd-battle/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/uomd-battle/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Verify the installed pixi.js version and the real engine in `apps/game/src/engine` (Decision D-23a) before changing rendering code. Keep Android landscape as the first-release target; browser evidence is development/QA evidence.
- Preserve narrative canon, approved Google asset provenance, data-only signed patches and server-authoritative gameplay. Use the `uomd-pixi-live` MCP or the local browser/E2E tests rather than assuming an old runtime state is current.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
