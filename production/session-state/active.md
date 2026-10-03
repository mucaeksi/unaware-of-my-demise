# Active Session State

Durable resume point for long-running takeover work. Read this after
`CLAUDE.md` on every resume. Conversation memory is not authoritative.

- Last updated: 2026-10-03
- Branch: `claude/framework-bootstrap-setup-ahj0tz` (PR → `main`)
- Master task: `docs/coder/GACHA_ONLINE_GAME_MASTER_CLOUD_GITHUB_DRIVE_EXECUTION_PROMPT_FINAL.md`

## Completed (verified)

| Phase | Output |
|---|---|
| Bootstrap | `claude-framework/` duplicate removed, `.claude/` intact (DEC-0000) |
| 1 Infrastructure | `docs/INFRASTRUCTURE_AUDIT.md` |
| 1.5 Drive access | `docs/DRIVE_LEGACY_ACCESS.md` |
| 2 MCP/CLI | `docs/coder/MCP.md` |
| 3 Instructions read | all canonical docs read in full |
| 4 Repository audit | `docs/REPOSITORY_INVENTORY.md` |
| 5/6 Toolchain + current game | `docs/CURRENT_STATE.md` (client broken, server not Worker-compatible, prod DB empty) |
| Decisions / questions | `docs/DECISIONS.md` (DEC-0000…0008), `docs/OPEN_QUESTIONS.md` |

## Current phase

Phase 7 — deep LEGACY audit (Google Drive). Top-level listing done; LEGACY
`README.md` read (Godot 4.7.2 port, G0–G5 gates, content pipeline, Python
parity reference, FastAPI economy server).

## Exact next task

1. Read LEGACY `CLAUDE.md` (`1pBY0OZcC2o40n1m1v1ocNhe6bXgJSG9v`) and list
   LEGACY `docs/` (`1ul6O03C01Bjhc7NOVf1ereb9_L3Oyt0D`): GODOT_HANDOFF,
   PROJECT_WORKFLOW, decisions/, ASSET_CATALOG, ART_BIBLE, STORY_BIBLE_PART1,
   ONLINE_API_SPEC, PART1_ECONOMY_ANDROID.
2. List LEGACY `game/`, `content/`, `tools/`, `narrative/tools/`,
   `narrative/art/`, `narrative/audio/` → find the asset naming/ID/metadata
   pipeline and the Gemini voice/music generation records.
3. Write `docs/LEGACY_AUDIT.md`, inventories, `docs/MIGRATION_LEDGER.md`.
4. Then migrate the LEGACY Godot project + content pipeline (DEC-0008).

## Blockers / owner actions

See `docs/OPEN_QUESTIONS.md` (OQ-001…OQ-009). None block the legacy audit.

## Failing / missing tests

- Active `game/` fails headless load (patch_manager.gd parse error).
- No tests exist in the active repository.

## Session tooling notes

- Godot 4.7.2: download `Godot_v4.7.2-stable_linux.x86_64.zip` +
  `SHA512-SUMS.txt` from GitHub releases into the scratchpad, verify, run
  headless. Not committed.
- Gemini reachable via proxy; no key in env/repo.
