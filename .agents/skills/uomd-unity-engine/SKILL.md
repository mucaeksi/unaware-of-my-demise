---
name: uomd-unity-engine
description: "Codex/UOMD adaptation. Implement, review, or debug the Unaware of My Demise game client on Unity 6 LTS (6000.0.58f2, C#, URP 2D, Runtime UI Toolkit) in apps/unity/ — verified assembly/type inventory, the headless .NET …"
license: "Proprietary"
---
# uomd-unity-engine — Codex adaptation

Read the [canonical skill](../../../.claude/skills/uomd-unity-engine/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/uomd-unity-engine/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Verify the Unity 6 LTS client in `apps/unity/` and exported bundle in `apps/unity/Assets/StreamingAssets/uomd_base` (Decision D-31) before changing client code. Keep Android IL2CPP ARM64 landscape as the first-release target.
- Preserve narrative canon, approved Google Gemini API asset provenance, data-only ES256 signed patches and server-authoritative gameplay. Use the `uomd-unity-live` MCP and `npm run export:unity` rather than assuming an old runtime state is current.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
