# UOMD note (read before using this skill)

Vendored unchanged from CoplayDev/unity-mcp `unity-mcp-skill/` at tag v10.3.0 (commit
`aa5fc638d623f56178d50329d9ad8c541a57fe66`, MIT). The Unity package (`com.coplaydev.unity-mcp`, pinned to the same commit in
`apps/unity/Packages/manifest.json`) and the server (`mcpforunityserver==10.3.0`, `unityMCP` in `.mcp.json`) are the same
release. Project rules in `uomd-unity-engine` and `unity-mcp-workflow` win on conflict.

How this project differs from the generic templates in `references/`:

- **The UI is built in C#**, not in scenes: `UomdBootstrap` creates the `UIDocument`/`PanelSettings`, every screen is a
  Runtime UI Toolkit controller (`UomdHubScreen` for the hub screens). Do not add UGUI Canvases, TextMeshPro or scene
  GameObjects for UI; change the C# screen instead. `manage_ui`, `manage_gameobject` and `manage_scene` are for inspecting.
- **Edit code as repository files** (the normal edit tools + `git`), then let Unity recompile and check `read_console`.
  Generated files (`Core/Generated/UomdCorePrimitives.g.cs`, `StreamingAssets/uomd_base/`) come from `npm run export:unity`.
- **Project entry points** are Editor menu items, callable with `execute_menu_item`: `UOMD/MCP/Verify StreamingAssets Bundle &
  Deterministic Math`, `UOMD/MCP/Inspect Active Scene & URP 2D Status`, `UOMD/MCP/Capture GameView Screenshot`,
  `UOMD/Apply Project Setup`.
- **Tests**: `run_tests` (EditMode) inside the Editor; outside it `npm run test:unity-logic` and `unity_ci` scripts.
- Ignore `references/probuilder-guide.md`, the 3D/physics templates and asset generation (`generate_image`,
  `generate_audio`, `generate_model`): art and audio come only through the Gemini pipeline and `tools/ingest_art.ts`.
- Never install packages through `manage_packages` without a reviewed manifest change; `Packages/manifest.json` and
  `packages-lock.json` are committed.
- **Hosts**: Claude Code reads `unityMCP` from `.mcp.json`, Codex from `.codex/config.toml`, Antigravity from the workspace
  plugin `.agents/plugins/uomd-mcp/` (check with `python tools/setup_antigravity.py`). Do not use the package window's
  "Configure" buttons for these hosts; they write a second, global entry. The server uses the repo-local uv cache
  `.cache/uv` (on this Windows machine pywin32 could not be installed into the AppData cache, os error 32).
- `execute_code` runs a C# snippet in the open Editor: use it where a vendored Unity skill says `unity command eval`.
