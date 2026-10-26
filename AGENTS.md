# Codex entry point

## Current owner mandate — D-35, 2026-10-26

GPT Sol/Codex owns the complete project and rebuilds the Unity player experience from the beginning, carrying the existing
systems over incrementally. Read `docs/handoff/GPT_SOL_UNITY_REBUILD.md` and `docs/handoff/SOL_REBUILD_PLAN.md` after the root
README. The current workspace is `E:\Unity\unaware-of-my-demise`; work on `main`, commit verified local changes, and leave
GitHub pushes to the owner. This section supersedes the D-31/D-33 agent assignments, F: path and Antigravity startup
requirements retained below as historical host records.

Generate all rebuilt visual assets with Codex's built-in OpenAI image tool. Existing Gemini visuals are references only,
not finished assets for the rebuilt client. Keep identity locks, exact reference/source hashes, prompts, native sizes and
provider provenance; use the existing ingest/QC pipeline. Keep music and reviewed Japanese voice production on the
budget-guarded Gemini tools. D-34's UI v2 direction is stopped; its mockups are reference material. Preserve canon, server
combat parity, the single-currency economy, signed data-only patches and existing release/permission/budget gates.

For Unity, verify the actual live `unityMCP` editor state before operations, then compilation/console, EditMode tests and
Game-view captures after changes. Use the current tool schemas and API reflection. Keep `.claude/`, `CLAUDE.md`, `.mcp.json`
and the pinned skill sources intact. Load relevant `.agents/skills/` adapters and their canonical sources; validate with
`python tools/sync_codex_skills.py --check`. No skill grants new credentials, hooks, paid spending or external permissions.

## CLI production context and owner review

For a production/rebuild continuation, read [CODEX_CLI_MASTER_PROMPT](docs/handoff/CODEX_CLI_MASTER_PROMPT.md) in full after
README and this entry point. It records the implemented C# architecture, latest scoped evidence, image pipeline and the
owner's requirement to inspect/revise real assets and Unity scenes. The first Editor-only Production Review slice is now
implemented; see `docs/review/README.md` and `docs/evidence/sol-production-review-2026-10-26.json` for scope and evidence.
Preserve the actual current task scope: documentation/review-only requests do not authorize new implementation automatically.

## Historical host instructions (superseded ownership and paths)

Read the root [README.md](README.md) completely before substantial work. It remains the sole engineering master prompt; `narrative/` remains the fiction/canon source. This file adapts the host, not the game specification.

**Decision D-33 (2026-10-25, staged):** after Claude Opus 5.5's first local Unity pass, Gemini Argon (Antigravity) takes over day-to-day operations — read [docs/handoff/ARGON_UNITY_HANDOFF.md](docs/handoff/ARGON_UNITY_HANDOFF.md); it states when the handoff is active. Until then:

## Antigravity / Gemini Argon: set up before any task (mandatory)

Do this at the start of every new Antigravity session, before reading code or changing anything, and report the result:

1. `python tools/setup_antigravity.py` must end with `RESULT PASS`. It verifies the skill lock, the `.agents/skills/`
   adapters and budgets, the prerequisites, and starts every project MCP server and lists its tools. Fix a FAIL first
   (`npm ci`, `bash tools/build_graph.sh`, `python tools/sync_codex_skills.py`); never skip it.
2. Additional Options (...) → MCP Servers must show `unityMCP`, `uomd-unity-live`, `graphify` and `chrome-devtools` from
   the workspace plugin `.agents/plugins/uomd-mcp/`. If they are missing, run `python tools/setup_antigravity.py
   --install-global`, disable the plugin, restart Antigravity.
3. Unity work needs the live Editor: the owner opens `apps/unity` in Unity Hub (6000.3.27f1) with Window → MCP for Unity →
   Transport **stdio**. Read `mcpforunity://editor/state` through `unityMCP`; if it does not answer, stop and tell the owner.
   After every change, see its effect through MCP: `read_console` (0 errors), `run_tests`, a Game-view screenshot.
4. Skills load on demand: read the matching `.agents/skills/<name>/SKILL.md` (it points at the canonical
   `.claude/skills/<name>/`) before the work it covers. Start with `uomd-unity-engine`, `unity-mcp-workflow`,
   `unity-mcp-orchestrator`; game-studio roles and workflows: `game-studios`; ML-Agents (offline only): `unity-ml-agents`.

Owner instruction 2026-10-24 (Decision D-31, supersedes 2026-10-14 D-21 and 2026-10-23 D-30): 100% of project operations, architecture, engineering, Unity 6 LTS (`apps/unity/`) client migration, and Gemini API creative asset production are transferred exclusively to **Claude Opus 5.5** (`claude-opus-5-5` / Claude Code). Argon 4 / Antigravity and Codex are retired from active ownership; only Claude Opus 5.5 operates on the repository from now on. Read the complete [README.md](README.md), [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md), and the Unity master blueprint [docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md](docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md). These Codex host instructions remain retained solely for `sync_codex_skills.py --check` adapter compatibility. Work only in `F:\unaware-of-my-demise`, commit locally on `main` (D-28), and never overwrite another agent's working tree or force-push shared history.

For Codex, discover project skills under `.agents/skills/`. Read the relevant `SKILL.md`, then its linked canonical source and only the needed references. The shared, pinned skill content stays in `.claude/skills/`; do not modify `.claude/`, `CLAUDE.md`, `.mcp.json` or the Claude bootstrap while maintaining the Codex adapters. Validate them with `python3 tools/sync_codex_skills.py --check`.

Use [uomd-codex-workflow](.agents/skills/uomd-codex-workflow/SKILL.md) for repository coordination and validation. Use [docs/CODEX_SKILLS.md](docs/CODEX_SKILLS.md) for the complete catalog, invocation examples, runtime status and optional MCP setup. Native Codex calls use `$<skill-name>`; Claude slash commands and plugin-qualified names are not assumed to exist here.

The owner enabled the project Graphify, Chrome DevTools and MCP for Unity (`unityMCP`, live Editor; `.codex/config.toml`) MCPs. Build or refresh the local code index with `bash tools/build_graph.sh`; use graph results as navigation and verify findings against current source. For browser tasks use actual DevTools tool schemas and an isolated local page/profile. A current chat may require MCP reload/restart; direct stdio checks do not prove tools were injected into that chat. Apply the pinned [ponytail](.agents/skills/ponytail/SKILL.md) skill in the owner-requested `ultra` mode for the current infrastructure assignment; it is an instruction skill, not an MCP daemon or executable hook. Native discovery verifies the full 26-skill catalog (D-23); read relevant canonical skills and references as each task needs them rather than indiscriminately executing catalog workflows.

Cloudflare architecture, Worker review and CLI work have dedicated `uomd-cloudflare-platform`, `uomd-workers-review` and `uomd-wrangler` entry points to the installed official plugin/current docs. Use `uomd-android-release-qa` for native acceptance and `uomd-visual-regression` for browser evidence. The owner's review-first, choose-one-task workflow is captured in [docs/NEW_SESSION_PROJECT_REVIEW.md](docs/NEW_SESSION_PROJECT_REVIEW.md); when requested, finish the review and wait for the selected task before implementing it.

Session/user authorization and available tools govern execution. A skill file or MCP declaration alone does not prove a live connection. Keep the current host's permissions, credentials and tool schemas; do not install upstream hooks, start paid generation, change global configuration or grant permissions through a skill adaptation.
