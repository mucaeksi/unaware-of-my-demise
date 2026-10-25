---
name: unity-mcp-workflow
description: Orchestrate UOMD Unity work in Claude Code with the project MCPs — uomd-unity-live (static project/skill/bundle inspection, works without an Editor) and unityMCP (MCP for Unity, drives the open Unity Editor) — plus npm run export:unity, the headless C# harness, Unity batch scripts and graphify.
license: Proprietary
---
# UOMD Unity MCP workflow

Two project MCP servers are configured in `.mcp.json` (and `.codex/config.toml`). Use the static one for facts about the
repository, the live one for anything that needs a running Editor.

## 1. `uomd-unity-live` — static, no Editor needed (`tools/mcp_unity_live.ts`)

- `unity_project_status`: `ProjectVersion.txt`, asmdefs, C# counts, scenes, UPM packages, StreamingAssets sync.
- `unity_bundle_status`: `StreamingAssets/uomd_base/unity_export_manifest.json` and `UomdCorePrimitives.g.cs` vs
  `content/base/release.json`.
- `unity_inspect_unit_slices`: chibi atlas frames and Unity bottom-left pivots for a unit (`fadyme`, `mahmut`, …).
- `unity_editor_mcp_bridge`: how MCP for Unity is wired (package pin, server entry, `UOMD/MCP/*` menu items).
- `unity_skills_search`, `unity_skill_read`: the Unity/UOMD skills in `.claude/skills/`.

## 2. `unityMCP` — MCP for Unity, the live Editor (CoplayDev/unity-mcp v10.3.0)

- Pinned pair: Unity package `com.coplaydev.unity-mcp` at commit `aa5fc638d623f56178d50329d9ad8c541a57fe66`
  (`apps/unity/Packages/manifest.json`) and server `mcpforunityserver==10.3.0` (stdio, started by Claude Code through
  `uvx`; needs `uv` and Python ≥ 3.10 on the machine). Upgrade both together and re-vet the vendored skill.
- One-time Editor setup: open `apps/unity`, then **Window → MCP for Unity** → Transport **stdio** (the package defaults to
  HTTP; stdio starts its bridge on port 6400 automatically). Do not press "Configure" for Claude Code: `.mcp.json` already
  registers `unityMCP`, a second CLI registration would duplicate it.
- Before using its tools read `.claude/skills/unity-mcp-orchestrator/SKILL.md` and its `UOMD-NOTE.md`. Typical use here:
  `read_console` (compiler errors, runtime logs), `refresh_unity`, `run_tests` (EditMode), `execute_menu_item`
  (`UOMD/MCP/Verify StreamingAssets Bundle & Deterministic Math`, `UOMD/MCP/Inspect Active Scene & URP 2D Status`,
  `UOMD/MCP/Capture GameView Screenshot`, `UOMD/Apply Project Setup`), `manage_editor` (play/stop), `manage_camera`
  (screenshot), `manage_scene`/`find_gameobjects`/`manage_ui` to inspect, `manage_profiler`.
- Edit code as repository files (diffable, reviewed), not through ad-hoc Editor mutations; UI is C#-built UI Toolkit, never
  scene-authored UGUI/TextMeshPro. Unavailable in the cloud container (no interactive Editor); there use section 3.

## 3. Standard loop

1. `npm run export:unity` after changes to `content/base/`, `packages/core` or `packages/combat`.
2. Implement inside the asmdef boundaries (`uomd-unity-engine`, `unity-6-core`, `unity-ui-toolkit`,
   `unity-deterministic-combat`); port behaviour from the TS client, never invent UI text or canon.
3. Specialists: `unity-architect` (boundaries), `unity-csharp-reviewer` (GC/lifecycle/determinism), `unity-build-resolver`
   (compiler/Gradle/IL2CPP).
4. Verify (full table in `uomd-mobile-qa`):
   - `npm run test:unity-logic` — engine-free assemblies + EditMode parity tests under .NET, no licence.
   - `npm run check:unity-compile` — every asmdef against the pinned editor's real assemblies.
   - Live Editor: `unityMCP` `run_tests` + `read_console`; batch: `bash apps/unity/cloud/unity_ci.sh test|capture|build`
     (Linux) or `powershell -File apps/unity/cloud/unity_ci.ps1 test|build` (Windows).
   - `npm run verify` before every commit. Never `wrangler deploy`; staging deploys from `main` through Workers Builds.
