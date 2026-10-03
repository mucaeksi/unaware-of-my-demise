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
| 7 (partial) LEGACY audit | `docs/LEGACY_AUDIT.md` (creative pipeline, canon, reference-set evidence) |
| Decisions / questions | `docs/DECISIONS.md` (DEC-0000…0010), `docs/OPEN_QUESTIONS.md` |

## Current phase

Phase 7 — deep LEGACY audit (Google Drive). Creative pipeline, canon ledger (C1–C45) and
reference-set evidence audited (`docs/LEGACY_AUDIT.md`). Earlier: top-level listing; LEGACY
`README.md` read (Godot 4.7.2 port, G0–G5 gates, content pipeline, Python
parity reference, FastAPI economy server).

## Exact next task

1. Continue `docs/LEGACY_AUDIT.md` §8: list LEGACY `game/`
   (`1sUuCQc1RMcQn1xBhMPEwxvK2OwCAJZuN`), `content/`
   (`1simd_nzO6ukqoCXHQNwiSesFbmOIlEiD`), `tools/`
   (`1bVaM5WVAR2wdv2s5QMjzCgt_sw65fM0P`), `server/`
   (`1ow88cjDeVrf6val0p5gTSwHuz1CX0MKk`).
2. Read GODOT_HANDOFF, ONLINE_API_SPEC, PART1_ECONOMY_ANDROID, GDD.
3. Write inventories + `docs/MIGRATION_LEDGER.md`; migrate LEGACY Godot
   project + content pipeline (DEC-0008) and creative tools (DEC-0009).
4. Await owner on OQ-007 (reference set) before migrating reference files.
5. Bulk transfer: if a GitHub Release asset `legacy-import-*` exists (OQ-010),
   download it with `gh release download` into the scratchpad, verify, and
   migrate from it; otherwise continue per-file via the Drive MCP
   (download_file_content → base64 -d → compare size with Drive `fileSize`).
   LEGACY game ids: scripts `1V8Es81u0BLQPkNiwYNWRGq9rHowsGt3g` (app, ui,
   services, persistence, online, core), tests `12Rd1PKUftk2cvi9F87SslmRV7nSPfwew`,
   addons `1lOXaDhfJ2Ix82f5C5vs6WPYRgf8cM9HL`, data `1WROl9vgoDGemZKNoiw-8di2odEIRdnOV`,
   scenes `16IcSkDcVCYr7wiQY8m0PfHAeWwtehWtH`, theme `1xWlA8r1QB2mublyRb_k3USd7VPyf9VBD`,
   project.godot `1uUn9hHE4_Gg_OjbIbWhAi2WJQ3m0z_sq` (portrait lock, autoloads
   Game/Save/Online/Native, GUT + uomd_native plugins, ETC2/ASTC).

## Blockers / owner actions

See `docs/OPEN_QUESTIONS.md` (OQ-000…OQ-010). OQ-000 (Drive shared to anyone as writer) and OQ-005 (API key in Drive) are urgent security items. None block the audit.

## Failing / missing tests

- Active `game/` fails headless load (patch_manager.gd parse error).
- No tests exist in the active repository.

## Session tooling notes

- Godot 4.7.2: download `Godot_v4.7.2-stable_linux.x86_64.zip` +
  `SHA512-SUMS.txt` from GitHub releases into the scratchpad, verify, run
  headless. Not committed.
- Gemini reachable via proxy; no key in env/repo.
