# Active Session State — UOMD takeover

<!-- STATUS -->
Epic: Infrastructure roadmap (docs/INFRASTRUCTURE_ROADMAP.md) — finish it step by step
Feature: batch 8 (PR #30, open): INF-036 billing + rewarded ads — server (28f78b2, 09081dd) + native/client (this commit)
Task: push batch 8, get CI green, merge #30, verify production; then the remaining roadmap gaps (INF-038 → INF-042) and the final owner-decision summary
<!-- /STATUS -->

<!-- CHECKPOINT -->
**Updated:** 2026-10-05
**Owner directives (2026-10-04):** finish the roadmap in order, step by step; the owner presses "auto-continue" when a usage limit hits, so always leave a resumable checkpoint here. Merge to `main` every 3–4 verified steps (batch PRs), push the branch after each commit. Collect every owner decision in `docs/OWNER_DECISIONS.md` and present them together at the end. `narrative/` belongs to another team: do not touch it.
**Branch:** `claude/adoring-galileo-f7rd3o`. Merged + live: #18–#29 (live `10b42fb`: web deletion page, first-launch flow, social; migrations 0001–0010). PR #30 (INF-036, migration 0011) open.
**Next step:** CI on PR #30 → merge → check production (`/v1/ads/ssv` 503 and `/v1/subscription/status` 401 until D-17/D-18 are configured is correct). Then continue the roadmap gaps from INF-038 onward. Owner answers applied 2026-10-05: D-01/02/07/08/10 (DEC-0036); open: D-03…D-06, D-09, D-11…D-18 (D-17 Play billing, D-18 AdMob added with DEC-0038). Plugin builds with JDK 21 locally (CI uses 17). Local e2e needs PostgreSQL on TCP 127.0.0.1:54318 with a password (Hyperdrive local mode refuses socket URLs).
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
