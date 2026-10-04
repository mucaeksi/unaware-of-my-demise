# Active Session State — UOMD takeover

<!-- STATUS -->
Epic: Infrastructure roadmap (docs/INFRASTRUCTURE_ROADMAP.md) — finish it step by step
Feature: batch 4 (INF-025 audio/locale, env-guard fix, INF-027 patch gate, restore-drill fix, INF-028 signed manifests) — PR open
Task: merge batch 4 when CI is green; then INF-029 (private R2 delivery), INF-030 publish/promote, INF-031 installer, INF-032 recovery, INF-026 boot order with mount
<!-- /STATUS -->

<!-- CHECKPOINT -->
**Updated:** 2026-10-04
**Owner directives (2026-10-04):** finish the roadmap in order, step by step; the owner presses "auto-continue" when a usage limit hits, so always leave a resumable checkpoint here. Merge to `main` every 3–4 verified steps (batch PRs), push the branch after each commit. Collect every owner decision in `docs/OWNER_DECISIONS.md` and present them together at the end. `narrative/` belongs to another team: do not touch it.
**Branch:** `claude/adoring-galileo-f7rd3o`. Merged + live: #18–#24 (live `f375a6f`; Neon schema 0001–0007). Restore drill passed (run 37238392033, recorded in docs/runbooks/BACKUP_RESTORE.md). Batch 4 commits since #24: 191a615 (INF-025), 278bd9a (environment record table + plain-owner test; production had NOT recorded its environment: Neon refuses custom parameters), ca7d67f (INF-027), 0d38293 (drill skips pg_session_jwt), 24bb094 (INF-028).
**Next step:** merge batch 4 → verify live source_sha and that the deploy printed "recorded uomd_environment = production" (Neon: `SELECT * FROM uomd_environment`). Then G5 rest: INF-029 private R2 delivery via the Worker (authorized, range/resume), INF-030 publish/promote workflow (upload+verify immutable objects, signed channel pointer, actor/reason record; skips without D-09 key), INF-031 client installer (temp file, hash/signature/dependency checks, atomic marker, last-known-good, mount before GameFlow = INF-026), INF-032 recovery. Then G6, G7. Owner decisions so far D-01…D-09 in docs/OWNER_DECISIONS.md.
**Files in progress:** none
**Open questions:** `docs/OPEN_QUESTIONS.md` (OQ-006, OQ-014, OQ-016 open; OQ-000/005 closed — do not remind); owner decisions collected in `docs/OWNER_DECISIONS.md`.
**Local test infra (session-local, recreate as needed):** PostgreSQL 18 (production major) from PGDG at `/var/tmp/uomd-pg18` port 54318 (`TEST_ADMIN_DATABASE_URL="postgresql://uomd@localhost/postgres?host=/var/tmp/uomd-pg18&port=54318"`; `PATH=/usr/lib/postgresql/18/bin:$PATH` for database/test.sh); Godot 4.7.2 in the scratchpad (checksum-verified download); Android SDK `/var/tmp/android-sdk`; Godot Android templates `~/.local/share/godot/export_templates/4.7.2.stable`; Gradle `/opt/gradle`. Production deploys only through `.github/workflows/deploy.yml`; no credentials in the session.
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
