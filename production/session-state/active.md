# Active Session State — UOMD takeover

<!-- STATUS -->
Epic: Takeover / rebuild (master prompt)
Feature: BATCH-0002 LEGACY client migration
Task: gacha + Ration + deploy (DEC-0003/0013/0014)
<!-- /STATUS -->

<!-- CHECKPOINT -->
**Updated:** 2026-10-04
**Branch:** `claude/framework-bootstrap-setup-ahj0tz` (PR #10 → `main`, merge when CI is green)
**Current task:** foundation complete server-side; deployment (DEC-0003) partially done
**Next step:** DONE: engine port (parity-gated), every gameplay route (stages/victories, progression, equipment, quests, gacha pull/banners/history/pity, wallet convert), Ration (DEC-0014), client `GameBackend` calls for all of them, license (DEC-0005), Worker deployed to Cloudflare (version 097ca9db, template + orphaned trigger deleted). NEXT: (1) client quest + gacha screens on the new `GameBackend` calls; (2) Ration `daily_inn_meal`; (3) CI deploy job (needs OQ-003 secrets); (4) Android Credential Manager sign-in (sets `Online.session_token`); (5) Gemini asset work only after the foundation (DEC-0004).
**Blocked on (owner):** OQ-012 Neon production migrations (port 5432 times out from the session, credential route refused by the permission classifier); OQ-013 public endpoint (route vs workers.dev); Google OAuth client id → `GOOGLE_CLIENT_IDS`; OQ-003 GitHub deploy secrets.
**Files in progress:** none
**Open questions:** see `docs/OPEN_QUESTIONS.md` (OQ-003, 006, 012, 013 open; OQ-000/005 closed — do not remind)
**Local test infra:** Postgres 16 at `/var/tmp/uomd-pg` port 54329 (`TEST_ADMIN_DATABASE_URL="postgresql://uomd@localhost/postgres?host=/var/tmp/uomd-pg&port=54329"`); Cloudflare credentials only at `/root/.config/uomd/cloudflare.env` (outside Git, ephemeral container).
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
| Decisions | `docs/DECISIONS.md` DEC-0000…0014 |
| Server | Worker API: engine port + all gameplay routes + gacha + Ration; 368 vitest; deployed 2026-10-04 |

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
