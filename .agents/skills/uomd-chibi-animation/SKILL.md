---
name: uomd-chibi-animation
description: "Codex/UOMD adaptation. Produce or integrate Unaware of My Demise character media — 2-head SD chibi battle atlases, knee-up (boydan) Light Novel portraits, cut-ins, and their Unity 6 LTS URP 2D animation (16-cell 8-stat …"
---
# uomd-chibi-animation — Codex adaptation

Read the [canonical skill](../../../.claude/skills/uomd-chibi-animation/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/uomd-chibi-animation/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Verify the Unity 6 LTS client in `apps/unity/` and exported bundle in `apps/unity/Assets/StreamingAssets/uomd_base` (Decision D-31) before changing client code. Keep Android IL2CPP ARM64 landscape as the first-release target.
- Preserve narrative canon, approved Google Gemini API asset provenance, data-only ES256 signed patches and server-authoritative gameplay. Use the `uomd-unity-live` MCP and `npm run export:unity` rather than assuming an old runtime state is current.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
