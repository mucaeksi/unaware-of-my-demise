# Active Session State — UOMD takeover

<!-- STATUS -->
Epic: Infrastructure roadmap (docs/INFRASTRUCTURE_ROADMAP.md, INF backlog)
Feature: G0/G2 first slice — release contract + state revision
Task: INF-003/004/008/012/018 (DEC-0015)
<!-- /STATUS -->

<!-- CHECKPOINT -->
**Updated:** 2026-10-04
**Branch:** `claude/adoring-galileo-f7rd3o` (PR → `main`)
**Current task:** first roadmap slice implemented and locally verified: `GET /v1/bootstrap`, update/maintenance gate, `account.state_revision` (migration 0003), consistent `GET /v1/state`, client `ClientRelease` gate + monotonic snapshot adoption, Android INTERNET permission, deploy source-SHA check and no-automatic-rollback guard. vitest 389, GUT 259, database 0001–0003.
**Next step:** after merge, confirm the deploy run: migration 0003 applied on Neon and `/v1/bootstrap` reports the merged SHA. Then INF-013 (operation reconciliation: keep the action key until its result is known, no replay across accounts), INF-017 auth coordinator (Credential Manager), INF-006/007 staging + CI (Android export job).
**Blocked on (owner):** Google OAuth client id → `GOOGLE_CLIENT_IDS` (sign-in answers 503 until set); `docs/INFRASTRUCTURE_REVIEW.md` missing (OQ-014).
**Files in progress:** none
**Open questions:** see `docs/OPEN_QUESTIONS.md` (OQ-006, OQ-014 open; OQ-000/005 closed — do not remind)
**Local test infra:** Postgres 16 at `/var/tmp/uomd-pg` port 54329 (`TEST_ADMIN_DATABASE_URL="postgresql://uomd@localhost/postgres?host=/var/tmp/uomd-pg&port=54329"`; recreate with `initdb -U uomd --auth=trust` + `pg_ctl -o '-k /var/tmp/uomd-pg -p 54329'` as user postgres); production deploys only through `.github/workflows/deploy.yml`; no credentials in the session.
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
