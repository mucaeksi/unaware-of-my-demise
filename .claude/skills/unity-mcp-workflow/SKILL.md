---
name: unity-mcp-workflow
description: Orchestrate Claude Opus 5.5 Unity 6 LTS development using the uomd-unity-live MCP server, npm run export:unity content bundle exporter, Unity CLI batchmode test runner, and graphify code navigation.
license: Proprietary
---
# Unity 6 LTS & Claude Opus 5.5 MCP Workflow (`uomd-unity-live`)

> **Reality check (2026-10-24):** project class names in this skill that are not listed in `uomd-unity-engine` → *Verified assembly and type inventory* are planned designs, not existing code. Verify with `rg` before referencing them.

Use this skill to coordinate Unity 6 LTS inspection, content bundle synchronization, C# assembly/slice verification, and automated CLI test execution in Claude Code.

## 1. `uomd-unity-live` MCP Server (`tools/mcp_unity_live.ts`)
Configured in `.mcp.json` and `.codex/config.toml` under `uomd-unity-live`, this stdio MCP server provides deterministic inspection tools without requiring an interactive GUI session:

- **`unity_project_status`**:
  Inspects `apps/unity/` structure (`ProjectVersion.txt`, `.asmdef` assemblies, C# script counts, scenes, and `StreamingAssets/uomd_base` sync status against `content/base`).
- **`unity_bundle_status`**:
  Verifies `apps/unity/Assets/StreamingAssets/uomd_base/unity_export_manifest.json` and `UomdCorePrimitives.g.cs` against `content/base/release.json` (`release_id`, SHA-256 file counts, unit slice counts).
- **`unity_inspect_unit_slices`**:
  Returns the exact 16-cell (`4×4`) chibi slice specs, top-left vs Unity bottom-left normalized pivots (`unity_pivot: { x, y }`), and asset paths for any character or enemy (`sable`, `kaelen`, `nyx`, `vesper`, `orion`, etc.).
- **`unity_skills_search` & `unity_skill_read`**:
  Searches and reads all canonical Unity 6 LTS and UOMD skills in `.claude/skills/` (`uomd-unity-engine`, `unity-6-core`, `unity-urp-2d`, `unity-ui-toolkit`, `unity-2d-animation`, `unity-deterministic-combat`, `unity-android-il2cpp`, `uomd-battle`, `uomd-anime-ui`, `uomd-chibi-animation`, `uomd-narrative-cinematics`, `uomd-mobile-qa`).

## 2. Standard Development Loop for Claude Opus 5.5
1. **Sync Canonical Content & C# Primitives**:
   Run `npm run export:unity` whenever `content/base/`, `packages/core`, or `packages/combat` changes. This updates `apps/unity/Assets/StreamingAssets/uomd_base/` and `UomdCorePrimitives.g.cs`.
2. **Implement C# Modules Inside `.asmdef` Boundaries**:
   Follow `unity-6-core`, `unity-urp-2d`, `unity-ui-toolkit`, and `unity-deterministic-combat`.
3. **Run Subagent Specialists**:
   - Delegate architecture/assembly layout reviews to `unity-architect`.
   - Delegate C# GC/lifecycle/determinism reviews to `unity-csharp-reviewer`.
   - Delegate compiler/Gradle/IL2CPP errors to `unity-build-resolver`.
4. **Verify via CLI & Workspace Gate**:
   - Exporter & schema tests: `npx vitest run tools/export_unity_bundle.test.ts`
   - Unity EditMode NUnit tests (when Unity Editor CLI is installed on host):
     `Unity -batchmode -nographics -projectPath apps/unity -runTests -testPlatform EditMode -testResults .cache/unity-editmode-results.xml -quit`
   - Full repository verification: `npm run verify`
   - Headless C# compile + parity tests (no Unity licence): `npm run test:unity-logic`
   - Never run `wrangler deploy`; staging deploys only from `main` via Workers Builds (D-28).
