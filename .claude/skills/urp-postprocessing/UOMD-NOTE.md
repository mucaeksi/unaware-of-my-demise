# UOMD vendoring note

Vendored unchanged from the official https://github.com/Unity-Technologies/skills (Unity Companion License, pinned commit in
`.claude/skills-lock.json`). UOMD renders with URP 2D (`Assets/_UOMD/Settings/UomdURP2D.asset`, URP 17.3 on Unity 6.3).

- The skill reaches the Editor through `unity-cli` + `com.unity.pipeline` (`unity command eval`). UOMD does not ship that
  package; use MCP for Unity (`unityMCP`, see `unity-mcp-orchestrator` + its `UOMD-NOTE.md`) instead: its `execute_code`
  tool runs the same C# snippets in the open Editor, then check `read_console`. Persistent changes to assets or settings
  are reviewed repository changes. Do not add packages without a reviewed `Packages/manifest.json` change.
- Post-processing must respect the reduced-motion/flash preferences and the battle frame budget (60 FPS on Android).
  Project skills `uomd-battle`, `unity-urp-2d` and `uomd-unity-engine` win on conflict.
