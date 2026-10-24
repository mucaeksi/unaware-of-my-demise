---
name: unity-ui-toolkit
description: "Codex/UOMD adaptation. Design, build, and audit Gothic Dark Anime interfaces in Unity 6 LTS using Runtime UI Toolkit (UIDocument, PanelSettings, UXML, USS) and TextMeshPro SDF fonts (Cinzel, Cormorant Garamond) with sa …"
license: "MIT"
---
# unity-ui-toolkit — Codex adaptation

Read the [canonical skill](../../../.claude/skills/unity-ui-toolkit/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/unity-ui-toolkit/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Unity 6 LTS (6000.0.x) skill for Unaware of My Demise (`apps/unity/`, Decision D-31). Resolve relative `references/` files against `.claude/skills/unity-ui-toolkit/`.
- Keep simulation (`Uomd.Combat`) pure deterministic C# (`Mulberry32Rng`, IEEE-754 `double`, `RoundHalfUp`) matching `/api/v1/battles/verify`, and keep rendering/UI in `Uomd.Battle`, `Uomd.Narrative`, and `Uomd.UI` using `Awaitable` and zero-GC frame loops.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
