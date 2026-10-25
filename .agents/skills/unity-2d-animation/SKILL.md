---
name: unity-2d-animation
description: "Codex/UOMD adaptation. Implement and tune Unity 6 LTS 2D character and visual novel animations — 16-cell 4x4 SD Chibi 8-state frame loops, bottom-left foot pivot grounding, 2-phase anticipation + impact snap (1.35x hol …"
license: "MIT"
---
# unity-2d-animation — Codex adaptation

Read the [canonical skill](../../../.claude/skills/unity-2d-animation/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/unity-2d-animation/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Unity 6 LTS skill (editor pinned in `apps/unity/ProjectSettings/ProjectVersion.txt`) for Unaware of My Demise (`apps/unity/`, Decision D-31). Resolve relative `references/` files against `.claude/skills/unity-2d-animation/`.
- Keep simulation (`Uomd.Combat`) pure deterministic C# (`Mulberry32Rng`, IEEE-754 `double`, `RoundHalfUp`) matching `/api/v1/battles/verify`, and keep rendering/UI in `Uomd.Battle`, `Uomd.Narrative`, and `Uomd.UI` using `Awaitable` and zero-GC frame loops.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
