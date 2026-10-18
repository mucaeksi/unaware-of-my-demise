---
name: phaser4-engine
description: "Codex/UOMD adaptation. Implement and review PixiJS v8 scenes, WebGL2/WebGPU 2D stage rendering, sprites, asset loaders, tweens, DOM/CSS UI overlay and TypeScript architecture for Unaware of My Demise (Decision D-23, compatibility alias phaser4-engine). Use for game client coding, debugging or framework upgrades."
---
# phaser4-engine — Codex adaptation

Read the [canonical skill](../../../.claude/skills/phaser4-engine/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/phaser4-engine/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Verify installed PixiJS v8 and DOM/CSS UI architecture (Decision D-23) and existing package versions. Keep Android landscape as the first-release target; browser evidence is development/QA evidence.
- Preserve narrative canon, approved Google asset provenance, data-only signed patches and server-authoritative gameplay. Use the existing local browser tests rather than assuming Claude's old runtime state is current.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
