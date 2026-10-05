# Active Session State — UOMD takeover

<!-- STATUS -->
Epic: Infrastructure roadmap (docs/INFRASTRUCTURE_ROADMAP.md) — finish it step by step
Feature: batch 11 (PR #35): rising ad rewards 10→50 (DEC-0043), legal identity/13+/KVKK transfer map, backup shred fix, deploy operator-registration fix
Task: merge #35 when CI is green; the deploy then registers the operators and redeploys the admin Worker with Access (verify the panel login works for the owner); confirm the backup run on main writes to R2. Then wait for the owner: everything else waits for the first AAB (owner, 2026-10-05: "daha yolumuz uzun")
<!-- /STATUS -->

<!-- CHECKPOINT -->
**Updated:** 2026-10-05
**Owner directives (2026-10-04):** finish the roadmap in order, step by step; the owner presses "auto-continue" when a usage limit hits, so always leave a resumable checkpoint here. Merge to `main` every 3–4 verified steps (batch PRs), push the branch after each commit. Collect every owner decision in `docs/OWNER_DECISIONS.md` and present them together at the end. `narrative/` belongs to another team: do not touch it.
**Branch:** `claude/adoring-galileo-f7rd3o` fast-forwarded to main after #31. Merged + live: #18–#31 (live `b65a387`, migrations 0001–0012).
**Next step:** after #35: deploy run green (operators registered, admin Worker with ACCESS vars), `backup.yml` on main green with an R2 object, owner logs into the admin panel. Waiting for the first AAB (D-13 step 5): first signed content release (`publish-content.yml` needs the AAB's base commit and versionCodes), Play Monetization setup/RTDN (D-17), subscription tiers 5/10/20 USD (rewards TBD) and the subscriber ad rules (D-18), AdMob account. Legal: lawyer review + provider standard contracts per `docs/legal/KVKK_TRANSFERS.md`; open: refund rule, support-mail retention, closing notice. Other teams push to `main` directly: merge `origin/main` before each PR merge.
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

## Owner answers received 2026-10-05 (APPLIED 2026-10-05: DEC-0042, OWNER_DECISIONS)

Owner: "do not do these now, just note them". Verbatim intent (Turkish originals summarised):
- **D-12** Workers Paid: not now. Wait until the game is fully released and uploaded to Play Store as an AAB; continue on Free until then.
- **D-03** Neon branch protection needs a paid upgrade: do it when the game is fully released.
- **D-09** Content-signing key: give the owner the exact commands and explain in detail where each output goes.
- **D-13 + D-04**: no answer given yet (left blank) — ask again.
- **D-17** Billing: owner plans THREE subscriptions — US$5, US$10, US$20 — each with different rewards (reward design later; current single `eclipse_blessing_30d` must become a 3-tier model). Service account etc. will be created now: give step-by-step instructions.
- **D-18** AdMob is important: max 5 highest-paying rewarded ads per 12 hours; subscribers watch only 1 ad and skip; the highest subscription tier gets all ad rewards without watching any ad. (Changes current caps 4/window 8/day and adds tier-aware ad logic, server-side.)
- **D-11** Admin panel: do it; panel is important and must be well organised — owner must be able to make the changes they want from there. Give Access setup steps.
- **D-06** Alerts: use unawareofmydemise@gmail.com (and everywhere such an address fits).
- **D-05** Backups: owner asks for a recommendation; Neon stays free for now — is R2 better? Answer with a recommendation.
- **D-14** Tell the owner exactly where to add the origin; they will add it.
- **D-15** Research Terms of Service + Privacy Policy in detail and write them for the owner (after the reset).
- **D-16** All design/creative work is handed to another team; this session is responsible only for game infrastructure and gameplay for now.
- **D-19** No other languages for now: release fully in English; add languages later via patch.
