# Active Session State — UOMD takeover

<!-- STATUS -->
Epic: Infrastructure roadmap (docs/INFRASTRUCTURE_ROADMAP.md, INF backlog)
Feature: G2 — slices 3–5 (INF-013/014 merged, INF-016 merged, INF-015 in PR)
Task: INF-015 economic journal (DEC-0019)
<!-- /STATUS -->

<!-- CHECKPOINT -->
**Updated:** 2026-10-04
**Branch:** `claude/adoring-galileo-f7rd3o` (PR → `main`; #18, #19 merged and deployed, live 126be16)
**Current task:** slice 3 implemented: `GET /v1/operations/{key}`, `POST /v1/attempts/{id}/abandon`, snapshot `open_attempt`; client keeps an uncertain mutation's key until settled, keeps an unreported victory, offers Resume/Give up for an open attempt, defeats abandon. Local: vitest 396, GUT 281.
**Next step:** PR, CI, merge (owner asked to merge per slice). Then per the roadmap: INF-015 economic journal / INF-016 intake & retention (rest of G2), INF-006 staging (G1), INF-002 v1 capability list (G0, owner decisions).
**Device evidence:** owner installed the CI debug APK and signed in with Google (INF-017 VERIFIED, OQ-015 closed).
**Blocked on (owner):** OQ-014 missing `docs/INFRASTRUCTURE_REVIEW.md`; OQ-006 Neon branch protection.
**Files in progress:** none
**Open questions:** see `docs/OPEN_QUESTIONS.md` (OQ-006, OQ-014 open; OQ-000/005 closed — do not remind)
**Local test infra (session-local, recreate as needed):** Postgres 16 at `/var/tmp/uomd-pg` port 54329 (`initdb -U uomd --auth=trust`, `pg_ctl -o '-k /var/tmp/uomd-pg -p 54329'` as user postgres; `TEST_ADMIN_DATABASE_URL="postgresql://uomd@localhost/postgres?host=/var/tmp/uomd-pg&port=54329"`); Android SDK `/var/tmp/android-sdk`; Godot Android templates in `~/.local/share/godot/export_templates/4.7.2.stable`; Gradle `/opt/gradle`. Production deploys only through `.github/workflows/deploy.yml`; no credentials in the session.
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
