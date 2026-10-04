# Active Session State — UOMD takeover

<!-- STATUS -->
Epic: Infrastructure roadmap (docs/INFRASTRUCTURE_ROADMAP.md, INF backlog)
Feature: G3 second slice — Android Google sign-in
Task: INF-017/018/019 + INF-007 android job (DEC-0016, BATCH-0003)
<!-- /STATUS -->

<!-- CHECKPOINT -->
**Updated:** 2026-10-04
**Branch:** `claude/adoring-galileo-f7rd3o` (PR → `main`; #18 merged and deployed: `/v1/bootstrap` reports 5c7d6a0, migration 0003 on Neon, sign-in answers 401 to a forged credential)
**Current task:** second slice implemented: UomdNative plugin restored with Credential Manager sign-in, `SignInFlow` + `Online.sign_in/renew_session`, boot order gate → sign-in → snapshot, 401 renewal with the same Idempotency-Key, permission allowlist, CI `android` job (AAR + debug APK + verify + artifact). Local: GUT 270, AAR build, debug APK export verified.
**Next step:** device test once the owner adds the Android OAuth client + `ANDROID_DEBUG_KEYSTORE_BASE64`; then INF-013 (operation reconciliation beyond 401), INF-014 battle recovery, INF-006 staging.
**Blocked on (owner):** Android OAuth client (package `io.github.mucaeksi.unawareofmydemise` + debug keystore SHA-1) in the Web client's Google Cloud project; secret `ANDROID_DEBUG_KEYSTORE_BASE64`; `docs/INFRASTRUCTURE_REVIEW.md` (OQ-014).
**Files in progress:** none
**Open questions:** see `docs/OPEN_QUESTIONS.md` (OQ-006, OQ-014 open; OQ-000/005 closed — do not remind)
**Local test infra:** Postgres 16 at `/var/tmp/uomd-pg` port 54329 (`TEST_ADMIN_DATABASE_URL="postgresql://uomd@localhost/postgres?host=/var/tmp/uomd-pg&port=54329"`); Android SDK at `/var/tmp/android-sdk` (platform 36, build-tools 36.1.0), Godot Android templates in `~/.local/share/godot/export_templates/4.7.2.stable`, Gradle `/opt/gradle`; all session-local. Production deploys only through `.github/workflows/deploy.yml`.
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
