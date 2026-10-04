# Active Session State — UOMD takeover

<!-- STATUS -->
Epic: Takeover / rebuild (master prompt)
Feature: BATCH-0002 LEGACY client migration
Task: Worker API + Neon schema (DEC-0013)
<!-- /STATUS -->

<!-- CHECKPOINT -->
**Updated:** 2026-10-04
**Branch:** `claude/framework-bootstrap-setup-ahj0tz` (PR → `main`, merge regularly)
**Current task:** LEGACY server audited (`docs/LEGACY_AUDIT.md` §9), DEC-0013 accepted (TS Worker port, server battle re-simulation)
**Next step:** PostgreSQL migration `database/migrations/` translating LEGACY `backend/_schema.py` + `server/schema.py` (+ `stage_attempts`), then Worker skeleton (auth nonce/google, sessions, idempotency, `GET /v1/state` snapshot per `player_state.gd`)
**Blocked on:** nothing
**Files in progress:** none
**Open questions:** see `docs/OPEN_QUESTIONS.md` (OQ-001…004, 006, 008 open; OQ-000/005 closed — do not remind)
<!-- /CHECKPOINT -->

---

## Notes

Read after `CLAUDE.md` on every resume. Conversation memory is not authoritative.

### Completed (verified)

| Phase | Output |
|---|---|
| Bootstrap | `claude-framework/` duplicate removed, `.claude/` intact (DEC-0000) |
| 1 / 1.5 / 2 | `docs/INFRASTRUCTURE_AUDIT.md`, `docs/DRIVE_LEGACY_ACCESS.md`, `docs/coder/MCP.md` |
| 4 / 5 / 6 | `docs/REPOSITORY_INVENTORY.md`, `docs/CURRENT_STATE.md` |
| 7 (partial) | `docs/LEGACY_AUDIT.md` (creative pipeline, canon, reference set) |
| Reference set | LOCKED 2026-10-03, BATCH-0001 (26 files) |
| Client | BATCH-0002: 291 files (240 byte-exact, 13 adapted, 5 new, 33 regenerated .uid) + GUT 9.7.1 vendored; manifest `docs/migration/BATCH-0002.manifest.json` |
| Decisions | `docs/DECISIONS.md` DEC-0000…0012 |

### Owner directives in effect

- Take needed LEGACY files from Google Drive only (ZIP route abandoned, OQ-010 moot). Never modify Drive.
- No unnecessary files; no extra code — fix and build on what exists.
- No SQLite anywhere (DEC-0012). Server-authoritative.
- Merge to `main` regularly. Autonomous; resume every ~5 h via `send_later`.

### Remaining work (order)

1. ~~LEGACY `server/` audit~~ done (§9). Still to read: GODOT_HANDOFF, PART1_ECONOMY_ANDROID, GDD; per-endpoint LEGACY rule files (list in LEGACY_AUDIT §8.4).
2. Worker API (Cloudflare Workers + Hyperdrive + Neon) implementing the
   `GameBackend` contract; Neon schema; battle validation decision
   (client runs deterministic engine; server decides rewards).
3. `OnlineBackend` (GDScript) + test double; restore deferred e2e/app-flow
   tests (Drive ids in the ledger) on top of it.
4. CI (`.github/workflows/`): headless import + GUT, later Android export.
5. Creative pipeline tools (DEC-0009); content pipeline (DEC-0008).

### Session tooling notes

- Godot 4.7.2: download `Godot_v4.7.2-stable_linux.x86_64.zip` + `SHA512-SUMS.txt`
  from GitHub releases into the scratchpad, verify, run headless. Not committed.
- Tests: `godot --headless --path game --import` then
  `godot --headless --path game -s addons/gut/gut_cmdln.gd -gexit` (uses `.gutconfig.json`).
- Drive transfer: `download_file_content`; large results land under
  `/root/.claude/projects/.../tool-results/`, decode in the sandbox, verify
  against the LEGACY git index (blob sha1 + size). No base64 through the model.
- GUT source: `add_repo bitwes/Gut` (read) then `git archive v9.7.1`.
