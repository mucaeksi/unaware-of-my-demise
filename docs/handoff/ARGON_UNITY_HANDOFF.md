# Handoff to Gemini Argon — Unity client operations (Decision D-33)

> **Status: staged.** D-33 becomes active when Claude Opus 5.5 finishes the first local Unity pass
> ([CLAUDE_LOCAL_FIRST_PASS.md](CLAUDE_LOCAL_FIRST_PASS.md)), fills "State at handoff" below and marks D-33 active in
> [DECISIONS.md](../DECISIONS.md). Until then Claude Opus 5.5 owns the repository (D-31).

## 1. What you take over

From the D-33 activation commit, **Gemini Argon** (Antigravity) owns day-to-day operations of the whole project: the Unity
client (`apps/unity/`), the Cloudflare Workers + D1 backend (`apps/api/`), the React Control Center (`apps/admin/`), content
and Gemini API asset production, QA and documentation. Root [README.md](../../README.md) stays the single authoritative
engineering master prompt; `narrative/` stays the canon. Do not create a competing master prompt — edit README.

## 2. Where things are (verified 2026-10-25)

| Area | Facts |
| --- | --- |
| Client | Unity 6 LTS, editor pinned in `apps/unity/ProjectSettings/ProjectVersion.txt` (6000.0.58f2 at writing; the owner moves to 6.3 LTS in L-1). C#, URP 2D, Runtime UI Toolkit screens built in C#; 10 asmdefs; all 28 screens ported from the deleted TS client (oracle: `git show e918b723^:apps/game/src/...`). Type inventory and rules: `.claude/skills/uomd-unity-engine/SKILL.md`. |
| Combat | `Uomd.Combat` is a bit-exact port of `@uomd/combat`; 171 golden replays (`CombatParityTests`); the Worker re-simulates every battle. |
| Content | Base release `rel_0001` embedded via `npm run export:unity`; signed remote patches through `PatchManager`/`UomdPatchClient` (ES256, generation high-water marks, staging, rollback). Nothing is published on the staging channel yet (Phase C). |
| Backend | Cloudflare Workers + Hono + D1 SQLite only (never PostgreSQL); staging Workers `uomd-game-staging`, `uomd-admin-staging`, `uomd-ops-staging`, deployed by **Workers Builds** from GitHub `main` (`tools/deploy_staging.sh`, migrations first). |
| Control Center | `apps/admin` behind Cloudflare Access; its Development page shows the Unity status computed from the repo (`tools/lib/unity-status.ts`), the latest AAB (`docs/evidence/unity-android-build.json`) and the cloud captures (`docs/evidence/unity-*.webp`). |
| Builds | Debug-signed IL2CPP ARM64 AAB (~88 MB). Release signing waits on the owner's upload key (B-SIGNING). |
| Tests | `npm run verify` (lint, typecheck, tests, content check); `npm run test:unity-logic` (headless C#, 97); Unity EditMode (98); `npm run check:unity-compile`. |

## 3. Working rules (binding)

1. **Read before coding**: README, [NEXT_STEPS](../NEXT_STEPS.md), [DECISIONS](../DECISIONS.md), the relevant skill, and the
   TS oracle for any client behaviour. Never invent UI text, story, characters or infrastructure facts; ask the owner.
2. **Delivery (D-33, same terms Claude had under D-32)**: commit reviewable Conventional Commits only after
   `npm run verify` passes and the diff is reviewed; push to `main` yourself — fetch first, fast-forward only, never
   force-push or rewrite history. The push deploys staging through Workers Builds; watch the check runs.
3. **Never** run `wrangler deploy` or remote D1 migrations by hand; never edit an applied migration (add a new one).
4. **Secrets** only from the environment / Cloudflare; never print or commit keystore values, tokens or credentials.
5. **Approval gates stay with the owner**: production or public Play release, new paid spending beyond
   `content/budget/media_budget.json`, canon or identity changes, the upload key, legal facts, live player transactions.
6. **Unity rules**: engine-free code stays engine-free; server parity for combat; UI Toolkit built in C# on `UomdHubScreen`
   (no UGUI/TextMeshPro); data-only patches; every new `.cs` gets a committed `.meta`.
7. **Shell safety**: never pass text with backticks or `$(...)` through an unquoted heredoc or `bash -c` string.

## 4. Your tools in Antigravity

- Entry point: [AGENTS.md](../../AGENTS.md). Host surfaces: `.agents/skills/` (adapters that point at the canonical
  skills in `.claude/skills/`), `.agents/agents/` (13 specialists incl. `unity-architect`, `unity-build-resolver`,
  `unity-csharp-reviewer`), `.agents/workflows/`, `.agents/rules/`. Keep adapters in sync with
  `python3 tools/sync_codex_skills.py` and `python3 tools/install_ecc.py --sync-antigravity`; verify with `--check`.
- **First step of every session**: the "set up before any task" section of [AGENTS.md](../../AGENTS.md) —
  `python tools/setup_antigravity.py` must end with `RESULT PASS` (skills, adapters, budgets, prerequisites, and every MCP
  server started with its tools listed), then the MCP Servers list in Antigravity and `mcpforunity://editor/state`.
- MCP servers come from the workspace plugin `.agents/plugins/uomd-mcp/` (same servers and pins as `.mcp.json`; Antigravity
  discovers the plugin itself, nothing to add by hand; `--install-global` is the fallback):
  - `unityMCP` — MCP for Unity v10.3.0, the live Editor (48 tools incl. `read_console`, `run_tests`, `execute_code`,
    `manage_camera` screenshots). Unity package `com.coplaydev.unity-mcp` pinned to the same commit; Window → MCP for
    Unity → Transport stdio; do not use the package's Antigravity "Configure" button (it adds a second, global entry).
    Read `.claude/skills/unity-mcp-orchestrator/UOMD-NOTE.md` before using it,
  - `uomd-unity-live` — static project/skill inspection without the Editor,
  - `graphify` (`bash tools/build_graph.sh` first), `chrome-devtools`.
  - `unityMCP` and `graphify` use the repo-local uv cache `.cache/uv`: on the owner's Windows machine pywin32 could not be
    installed into the AppData uv cache (os error 32).
- Added skills (2026-10-25): `game-studios` (Claude Code Game Studios v1.2.0: 38 studio roles and 74 workflows mapped
  onto UOMD paths), `unity-ml-agents` (ML-Agents 4.1.0 for offline training only, never in the shipping client), and the
  official Unity skills `urp-postprocessing`, `validate-urp-render-graph-renderer-feature`, `shader-graph-create-custom-node`.
- Unity batch: `powershell -File apps/unity/cloud/unity_ci.ps1 test|build` (Windows) or `bash apps/unity/cloud/unity_ci.sh
  import|test|capture|build` (Linux cloud); then `node tools/record_unity_build.mjs` / `node tools/publish_unity_screens.mjs`.
- Assets (Gemini API, budget-guarded): `tools/gen_image.ts`, `tools/record_game_vo.py`,
  `tools/generate_phase1_music_lyria35.py`, then `tools/ingest_art.ts`; spend only within `content/budget/media_budget.json`.

## 5. Backlog at writing (re-order with the L-1 results)

1. Google Play checkout + rewarded ads in Unity (port `net/store.ts`: purchase → server verify with retry → restore; ads
   with server-side verification). BUY/WATCH are disabled until then.
2. Operation journal (`net/operations.ts`): keep idempotent actions across restarts; Saved actions screen shows them.
3. Server-sessioned campaign battles (`POST /api/v1/progress/battle/start` + submit with recorded actions).
4. Phase C: first staging content publication (owner's Control Center publish or an Access service token).
5. First chapter patch (D-29): world-map hub variant of Home, chapter content.
6. U-2b device-side `validateContentSet` + media header limits; locales; Companion chibi pose preview;
   VFX additive light + ultimate cut-in; turn-order bar.
7. B-SIGNING (owner's upload key), physical-device QA, Play internal track.

## 6. State at handoff

_To be filled by Claude Opus 5.5 at the end of L-1: activation commit, editor version, test counts, device results, open
items in priority order._
