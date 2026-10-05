# Decisions

Format: `DEC-NNNN` — status `ACCEPTED` (made from evidence within delegated
authority), `PROPOSED` (recommended, awaiting owner), `DECISION_REQUIRED`
(owner authority needed). Newest last.

---

## DEC-0000 — Bootstrap: `claude-framework/` → `.claude/`
- Status: ACCEPTED (2026-10-03)
- Evidence: `.claude/` was already committed in `8797289` with 274 files;
  `claude-framework/` was byte-identical (`diff -rq`) and index-identical
  (mode + blob hash for all 274 entries). No file referenced
  `claude-framework/`.
- Action: removed the duplicate `claude-framework/` (commit `8a5c776`).
  `.claude/` untouched.

## DEC-0001 — Production Worker name
- Status: ACCEPTED (owner, 2026-10-04: "Do the Recommend") — the Worker is `unaware-of-my-demise`
- Facts: master prompt names `unaware-of-my-demise-api`; the only Worker in
  the Cloudflare account is `unaware-of-my-demise` (dash template, no
  bindings, no routes). Workers Builds trigger also targets
  `unaware-of-my-demise`.
- Recommendation: **keep `unaware-of-my-demise`** (already exists, avoids a
  duplicate Worker, nothing depends on the `-api` name yet). Update the master
  prompt reference. `wrangler.toml` will use `name = "unaware-of-my-demise"`
  unless the owner chooses otherwise.

## DEC-0002 — Neon Auth present on production
- Status: DONE (owner permission 2026-10-04) — Neon Auth disabled on `sweet-cake-52313810`;
  the `neon_auth` schema and its 0 users are gone (`UOMD` listed no tables afterwards)
- Facts: `neon_auth` schema with 9 tables exists in `UOMD` on branch
  `production`; 0 users. Master prompt forbids Neon Auth.
- Recommendation: owner disables Neon Auth in the Neon console (Claude does
  not run destructive Neon operations autonomously). The game schema will live
  in `public` (or a dedicated `game` schema) and will not reference
  `neon_auth`. Until disabled, it is inert.

## DEC-0003 — Canonical Worker deployment path
- Status: ACCEPTED (owner, 2026-10-04: use the owner's Cloudflare account, delete what is not needed, create what is)
- Done 2026-10-04:
  - the "Hello world" template Worker `unaware-of-my-demise` was deleted through the Cloudflare API, which also drops
    the orphaned Workers Builds binding;
  - `wrangler deploy` from `server/` uploaded the game API under the same name: version
    `097ca9db-15e6-4ed4-aba6-fa52adf91792`, with Hyperdrive `edbe90af…`, both rate limiters, and `GOOGLE_CLIENT_IDS` / `BANNER_EPOCH`
    empty. No route and no workers.dev (`workers_dev: false`), so it is not reachable yet.
  - The owner's Cloudflare credentials live only outside the repository and are never committed.
- Canonical path (2026-10-04): `.github/workflows/deploy.yml`.
  - It runs after CI succeeds on a push to `main`, or on demand.
  - It applies pending migrations to Neon (`database/migrate.sh`, secret `DATABASE_URL`), then runs `wrangler deploy`
    (secret `CLOUDFLARE_API_TOKEN`, variable `CLOUDFLARE_ACCOUNT_ID`), then checks `/healthz` on workers.dev.
  - The owner added the secrets and the variable (OQ-003, OQ-012). The public endpoint is workers.dev (OQ-013,
    `workers_dev: true`, `preview_urls: false`).
  - Verified 2026-10-04, Deploy run 2 (`06bbab7`):
    - migrations 0001 and 0002 were applied on Neon `UOMD`;
    - Worker version `668aef7e` is live at `https://unaware-of-my-demise.muratcaneksiii.workers.dev`;
    - `/healthz` answered `{"status":"ok"}`, a database round trip through Hyperdrive.
  - Run 1 failed before connecting: Neon's pooled endpoint rejects `PGOPTIONS` startup options, fixed in #13.
  - The client's project setting `uomd/online/server_url` points at this URL.
- Original proposal:
- Facts: no GitHub Actions; Cloudflare Workers Builds trigger is bound to the
  deleted repo id `1395495121` and all 6 builds failed.
- Recommendation: **GitHub Actions is canonical** for Worker deploys
  (validation → tests → `wrangler deploy`, migrations as a separate gated job),
  because the same pipeline must also run Godot headless, PCK build/sign/R2
  upload and AAB builds, and must gate deploys on tests. Owner actions:
  1. delete/disconnect the orphaned Workers Builds trigger in the Cloudflare
     dashboard (Workers → unaware-of-my-demise → Settings → Builds);
  2. create a scoped Cloudflare API token (Workers Scripts:Edit, Hyperdrive:Read,
     R2:Edit for the one bucket) and store it as GitHub secret
     `CLOUDFLARE_API_TOKEN` (+ variable `CLOUDFLARE_ACCOUNT_ID`).
- Until then deploy jobs are written but skipped when the secret is absent.

## DEC-0004 — Gemini model pinning per medium
- Status: ACCEPTED (2026-10-03); generation work DEFERRED by the owner (2026-10-04) until the game foundation is complete — adopts LEGACY owner decision **C44**
  (2026-09-30), found in `LEGACY:narrative/…/canon.md`.
- Images: `gemini-3.1-flash-image` (Nano Banana 2) at 2K — not Pro, not Lite.
- Music (all tracks and stingers, except the owner's main theme):
  `lyria-3.5`.
- Voice (all characters): `gemini-3.8-flash-tts`; one prebuilt voice per
  character, never reused (`casting.json` rule); Fadyme = `Sulafat`.
- All three models verified present in this environment's Gemini model list.

## DEC-0005 — Repository license
- Status: ACCEPTED (owner, 2026-10-04: "Do the Recommend")
- Action: the CCGS MIT text moved to `THIRD_PARTY_LICENSES/claude-code-game-studios-MIT.txt`. `THIRD_PARTY_NOTICE.md`
  now scopes it to the `.claude/` tooling. The root `LICENSE` is now "All rights reserved" (proprietary).
- Facts: root `LICENSE` is MIT, "Copyright (c) 2026 Donchitos", inherited from
  Claude Code Game Studios. At repo root it reads as licensing the whole game.
  `THIRD_PARTY_NOTICE.md` already attributes CCGS.
- Recommendation: move the CCGS MIT text to `.claude/LICENSE` (or
  `THIRD_PARTY_LICENSES/ccgs-MIT.txt`) and add an owner-chosen license for the
  game (typically "All rights reserved" for a commercial private game). Not
  changed without owner approval.

## DEC-0006 — `.gitkeep` removal
- Status: ACCEPTED (2026-10-03)
- Facts: 11 empty `.gitkeep` files existed beside `README.md` placeholders;
  owner policy (`.DOTFILES.md`, bootstrap instruction) forbids `.gitkeep`.
- Action: removed; directories remain tracked through their README.

## DEC-0007 — Branch workflow for this takeover
- Status: ACCEPTED
- The Claude Code Cloud session requires pushing to
  `claude/framework-bootstrap-setup-ahj0tz` and opening a PR into `main`.
  Merging is an owner action. This supersedes "work on main" for this session
  only; no force pushes, no history rewrite.

## DEC-0008 — Primary migration source for the client
- Status: ACCEPTED (owner, 2026-10-04) — done in BATCH-0002. The Android application id is the LEGACY
  `io.github.mucaeksi.unawareofmydemise` (`game/export_presets.cfg`; OQ-008 closed).
- Facts: active `game/` is a broken generic starter (parse errors, corrupted
  scene, placeholder identity). LEGACY `game/` is a Godot 4.7.2 port with core
  domain, persistence, offline flow/screens, 319 GUT tests and a content
  mirror, measured against a Python parity reference (LEGACY `README.md`,
  2026-09-30).
- Recommendation: migrate the LEGACY Godot project and its content pipeline
  selectively (with provenance) as the client foundation, then adapt it to the
  online server-authoritative architecture; retire the starter client.

## DEC-0009 — Adopt the LEGACY creative asset pipeline
- Status: ACCEPTED (2026-10-03)
- Evidence: `docs/LEGACY_AUDIT.md` §3 — `narrative/tools/gen_image.py`,
  `gen_audio.py`, `record_fadyme_vo.py`, `art_manifest.py` et al.; naming
  `{kind}_{id}_{variant}_v{NNN}[_t{N}]`, `uomd_*` PNG metadata, JSON audio
  sidecars, status vocabulary REVIEW/APPROVED/APPROVED_WITH_ISSUE/REJECTED/
  SUPERSEDED/REFERENCE/PENDING, `_review/_rejected/production` folders.
- Rule applied: CLAUDE.md "If an established legacy system exists, preserve
  compatible conventions". No new naming/ID/metadata scheme is invented.
- Adaptations (minimal): re-root under `narrative/`; read the Gemini
  credential from the environment/proxy instead of `narrative/.secrets/`;
  add a JSON manifest export for build/PCK tooling.

## DEC-0010 — Reference set status
- Status: ACCEPTED — owner confirmed 2026-10-03 ("Referans setini onaylıyorum,
  kilitle ve taşımaya devam et"). Migrated byte-exact (BATCH-0001,
  `docs/MIGRATION_LEDGER.md`); lock: `docs/UOMD_REFERENCE_LOCK.md`,
  `narrative/references/REFERENCE_SET.lock.json`.
- LEGACY records owner approval (2026-09-30) of R01 logo, R02 key art,
  R03 Fadyme sheet r2, R04–R17 Fadyme assets, Fadyme voice Sulafat and
  R18 Fadyme theme (`docs/LEGACY_AUDIT.md` §4).
- Claude does not mark the lock APPROVED on its own. On owner confirmation:
  migrate those exact files (byte-exact, sha256 recorded) into
  `narrative/references/`, update `docs/UOMD_REFERENCE_LOCK.md` to
  APPROVED/LOCKED with the version list, and continue roster generation
  autonomously under C41.

## DEC-0011 — Storage of binary creative assets
- Status: ACCEPTED (2026-10-03), revisit at ~500 MB repository size
- Reference set (73 MB) is committed as plain git objects (`.gitattributes`
  marks png/ogg/mp3 binary). Git LFS is not used: GitHub LFS bandwidth quotas
  would be consumed by every CI checkout, and no file approaches the 100 MB
  limit. Runtime-optimized derivatives (WebP/ETC2, OGG) are what ships;
  large source masters beyond the reference set may move to R2 with a manifest
  if repository growth requires it.

## DEC-0012 — Client player state: server snapshot, no local game database
- Status: ACCEPTED (2026-10-03) — owner directive "Sqlite kullanmıyoruz".
- Evidence: LEGACY `docs/GODOT_MIGRATION_PROMPT.md` §2.8/§5 (G4/G5) built an
  offline client on godot-sqlite (`Save` autoload, `scripts/persistence/`,
  `scripts/services/` over `Tx`) under "authority A" (only gacha, wallet,
  Memory Shards and reward windows on the server). The active target
  (CLAUDE.md "SERVER AUTHORITY") makes the server own every sensitive state
  transition (currencies, inventory, ownership, progression, rewards).
- Decision:
  - Not migrated: `game/addons/godot-sqlite/`, `game/scripts/persistence/`
    (SQLite repository, schema, save_store, Fernet, key providers),
    `game/scripts/app/save.gd`, the mutating services
    (`battle_reward_service`, `equipment_service`, `progression_service`,
    `quest_service`, `reward_claims`, `story_service`, `victory_service`,
    `tx`) and `game/tests/persistence/`. They stay in Drive as the behaviour
    reference for the server port (same rules, same idempotency/claim model).
  - Migrated unchanged: the pure domain (`scripts/core/**`), content packs,
    UI, `Outcome` and `ServiceRules` (pure, content-derived rules).
  - `GameFlow` reads a server-issued `PlayerState` snapshot and sends every
    mutation through a `GameBackend` (implemented by the `Online` autoload
    against the Worker API). The client never writes progression locally;
    it only renders what the server returns.
  - Battles still run on the client for presentation (deterministic engine,
    63-bit seed). Reward-bearing results are decided by the server; how the
    server validates a battle (re-simulation vs. bounded trust) is decided in
    the backend phase and recorded as its own decision.
  - Device-local data is limited to non-authoritative conveniences
    (settings, auth credential via the platform keystore, content cache).
- Not migrated for the same reason: `game/addons/uomd_native/`,
  `game/android/plugins/uomd_native/` (Keystore save-key wrapping existed for
  the SQLite save; Sign-In/Billing/Ads move with G6 when implemented).

## DEC-0013 — Backend: TypeScript Worker port of the LEGACY server, battles re-simulated
- Status: ACCEPTED (2026-10-04, lead engineer). Derived from CLAUDE.md
  "SERVER AUTHORITY" and DEC-0012. The owner may override the battle-validation
  choice.
- Evidence: `docs/LEGACY_AUDIT.md` §9.
- Decision:
  - **Runtime.** The production API is a TypeScript Cloudflare Worker using
    Hyperdrive → Neon (`UOMD`, branch `production`). It replaces both the
    starter Fastify `server/` and the LEGACY FastAPI code.
    - The LEGACY routes, payload names, error shape, idempotency model and
      ledger tables are kept (§9.3).
    - The SQLite DDL is translated to PostgreSQL as versioned migrations
      under `database/migrations/`. The starter `001_init.sql` and the demo
      seed are replaced.
  - **Rules.** The pure rules (progression, equipment, loot, quests, story
    state, gacha) are ported to TypeScript. They are verified against the same
    `parity/fixtures` that the Python reference and the GDScript port already
    pass. One source of truth for numbers (`content/` packs), three
    implementations checked against one fixture set.
  - **Battles are re-simulated on the server.**
    - The client asks to start a stage (`POST /v1/stages/{id}/attempts`,
      sending the roster). The server checks the stage is unlocked and the
      roster is owned and legal, then stores an attempt with a
      server-chosen seed and returns `{attempt_id, run_seed}`.
      Implementation note (2026-10-04): the seed is drawn from the CSPRNG
      below 2^53, not 63 bits, because Godot parses JSON numbers as
      doubles. The seed space stays far beyond any shopping, since the
      server, not the client, picks it.
    - The client plays that seed and reports the result.
    - The server re-runs the deterministic engine (TypeScript port,
      parity-tested) from the attempt's stored inputs. It grants rewards only
      if its own result is a victory, and applies them in one transaction
      keyed by the attempt (single use).
    - Why: a client-chosen seed allows seed shopping, and a client-reported
      victory would make rewards client-authoritative.
  - **Client contract change.** `GameBackend` gains
    `begin_stage(stage_id, roster) -> {attempt_id, run_seed}`.
    `submit_victory` takes the attempt id instead of a seed. This is done
    together with `OnlineBackend`.
  - **No Gemini or AI code in the runtime** (CLAUDE.md). The starter
    `server/src/ai.ts` is not carried over.
- Consequences:
  - The battle engine gets a third implementation, so parity fixtures become
    the gate for every engine change.
  - CI must run the GDScript and TypeScript parity suites.

## DEC-0014 — Ration (stamina): cap 100, server-side regeneration
- Status: ACCEPTED (2026-10-04, owner): "Stamina ayarla, 100e sabitle, harcama ve yenileme mekaniğini bu sayıya göre
  ayarlayacağız, ne çok hızlı bitecek ne de çok geç yenilenecek". Closes OQ-011.
- Facts: LEGACY never deducted Ration (LEGACY_AUDIT §9.4). `economy_part1.json` authored cap 120, 1 unit / 360 s,
  stage costs campaign 6 / material hunt 8 / gear dungeon 10 / special boss 10, `loss_on_failure: false`,
  `daily_inn_meal: 30`, no token refill.
- Decision:
  - **Cap 100** (owner) and **1 unit every 300 s**: an empty meter refills in 8 h 20 min. Two to three sessions a day
    each find a full or nearly full meter. Natural income is 288 Ration a day, about 48 campaign clears.
  - Stage costs stay as authored. Each stage's own `stamina_cost` (6 for every campaign stage after the free 1-1)
    is what is charged, so a full meter buys 16 campaign clears, about three story chapters.
  - **Spent only by a verified victory** (`loss_on_failure: false`). Opening an attempt checks the balance (402
    `INSUFFICIENT_FUNDS`) without spending it, and defeats or abandoned attempts cost nothing.
  - Regeneration is computed on read: `wallet.ration` as of `wallet.ration_updated_at` (migration 0002), with no
    timers. It stops at the cap; a surplus from future grants stays but does not grow. It restarts when a spend takes
    the balance below the cap, and partial progress survives spends made below the cap.
  - New accounts start full. The snapshot carries `ration {current, cap, regen_seconds_per_unit,
    next_unit_at_utc, full_at_utc}` for the client meter.
  - `daily_inn_meal`: +30 Ration once per UTC day of the server clock (`POST /v1/ration/inn-meal`, ledger key
    `inn_meal:YYYY-MM-DD` in `quest_claims`); like any grant it may exceed the cap. Token refill stays disabled as authored.
- Content change: `economy_part1.json` `ration.cap` 120 → 100 and `regen_seconds_per_unit` 360 → 300 (in both
  places), with the MANIFEST sha256 updated.


## DEC-0015 — Release contract: bootstrap, state revision, no automatic rollback
- Status: ACCEPTED (2026-10-04, engineering; implements the owner's infrastructure roadmap
  `docs/INFRASTRUCTURE_ROADMAP.md`, first slice INF-003/004/008/012/018).
- Context: the client had no way to learn that the server no longer serves it (old app, other rules content,
  maintenance); `GET /v1/state` read its tables at READ COMMITTED, so a concurrent mutation could appear half-applied;
  a late reply or an idempotent replay could move the client's state backwards; the Android preset lacked the INTERNET
  permission; the deployed Worker did not report which commit it runs.
- Decision:
  - `GET /v1/bootstrap` (unauthenticated) reports `api_version`, `snapshot_schema_version`, `min_client_version_code`
    (Worker var `MIN_CLIENT_VERSION_CODE`), `rules_hash` (shared algorithm, test vector in both suites), `source_sha`
    (Worker var `RELEASE_SOURCE_SHA`, set by the deploy) and `maintenance` (Worker var `MAINTENANCE_MESSAGE`). The client
    checks it at boot (`ClientRelease`) before reading any player state. While content ships inside the app, a rules
    hash mismatch means "update the app"; signed content patches (G5) will turn it into "download the content".
  - Every other route answers 426 `UPDATE_REQUIRED` to an `X-Client-Version-Code` below the floor and 503
    `MAINTENANCE` while the switch is on. Changing either is a redeploy for now (remote config is INF-035).
  - `account.state_revision` (migration 0003, additive) grows by one in every committed mutation's transaction and is
    in the snapshot; `schema_version` stays 1 (the field is additive). The client never adopts a lower revision.
    `GET /v1/state` and `GET /v1/wallet` read in one `REPEATABLE READ READ ONLY` transaction.
  - The Android versionCode lives in project setting `uomd/release/version_code`, equal to the preset's `version/code`
    (GUT-checked); the preset has `permissions/internet=true`.
  - The deploy passes `RELEASE_SOURCE_SHA`, verifies it through `/v1/bootstrap`, and skips an automatic deploy of a
    commit that is an ancestor of the live one. A manual run may roll back and says so.
- Not decided here: release IDs, presentation/content release manifests, channels, capability versions (G0/G4/G5).

## DEC-0016 — Google sign-in on Android: UomdNative plugin, nonce flow, session renewal
- Status: ACCEPTED (2026-10-04, engineering; owner set `GOOGLE_CLIENT_IDS` and asked for the second slice). Roadmap
  INF-017, INF-018, INF-019 (partly), INF-007 (Android job).
- Decision:
  - The LEGACY `UomdNative` Godot Android plugin returns (BATCH-0003) with Credential Manager sign-in ported from the
    LEGACY `GoogleSignInBridge`, reporting through the `sign_in_finished` signal, never by polling. A returning
    player is signed in without a prompt (authorized accounts, auto-select); otherwise the account chooser opens.
  - Flow (`SignInFlow`): `POST /v1/auth/nonce` → Credential Manager with the server's **Web** client id
    (`uomd/online/google_server_client_id`, public) and that nonce → `POST /v1/auth/google` → opaque session held in
    memory only. No client secret, no token storage, no SQLite.
  - Boot order (INF-026): release gate → sign-in when there is no session → snapshot.
  - Session expiry: a 401 renews the session once and resends the request with the **same** Idempotency-Key. A
    renewal that signs in a different account ends the session and does not resend.
  - Packaging: the AARs are built from source (`game/tools/build_uomd_native.sh`) and not committed; the export
    plugin adds the Maven dependencies. The permission allowlist is INTERNET plus androidx.core's app-private signature
    permission; the biometric permissions merged by androidx.credentials are removed. CI builds, exports and verifies a
    debug APK and keeps it as an artifact.
- Owner actions for a device test: an Android OAuth client (package `io.github.mucaeksi.unawareofmydemise`, the debug
  keystore's SHA-1) in the same Google Cloud project as the Web client, and the keystore as secret
  `ANDROID_DEBUG_KEYSTORE_BASE64`. Upload-key and Play App Signing SHA-1s follow with the release AAB (INF-040/043).

## DEC-0017 — Uncertain operations and battle recovery
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-013, INF-014).
- Context: after a lost reply the client retried once with the same key and then dropped it; the player's "Try again"
  sent a new key, so a request that had committed was applied a second time (a story advance, a pull). A victory whose
  report got no reply was discarded with "nothing was saved". After a restart an open battle was invisible, and defeats
  left attempts open.
- Decision:
  - A mutation without an API reply (no response, or a gateway page instead of the API's JSON) stays pending with its
    key. The same request sent again reuses the key (the server replays a committed result). Before any other
    mutation, `GET /v1/operations/{key}` settles it (committed or not); while that cannot be asked, nothing else is
    sent. Reads never settle it. A renewal into another account drops it. Pending state is in memory only (after a
    restart the snapshot is the truth).
  - Session renewal needs a bound account; signing in as another account clears the session but keeps the binding,
    so a request is never sent for another account; only a new boot changes the account.
  - A victory whose report got no reply stays `unreported` with its attempt; "Try again" resends the same report.
  - The snapshot carries `open_attempt` with the inputs the server froze; the client offers Resume (the deterministic
    battle runs again on those inputs, so it matches the server's re-simulation) or Give up.
  - Supersedes DEC-0013's "a defeat reports nothing": a defeat now abandons its attempt (`POST
    /v1/attempts/{id}/abandon`, status `lost`, pays nothing). The victory path is unchanged.

## DEC-0018 — Request intake and data lifecycle
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-016).
- Context: bodies were read whole before their size was checked; expired nonces and sessions, stored replies and open
  attempts were kept forever, with no rule for how long a retry stays safe.
- Decision:
  - Bodies are read with the 16 KiB cap applied while reading; invalid UTF-8 is a 400.
  - A daily Worker cron (`17 3 * * *` UTC, `server/src/retention.ts`) runs bounded, idempotent batches: nonces deleted
    1 day after expiry, sessions 7 days after, open attempts older than 24 h marked `expired`, stored replies older
    than 30 days purged (migration 0004: the key row stays as a tombstone).
  - Retry contract: a key is replayable for 30 days; after that it answers 409 `OPERATION_EXPIRED` and never runs
    again. Clients hold an uncertain key only for one app session (DEC-0017), far inside that window.
  - An open attempt older than 24 h cannot be won and is not offered for resume (it paid nothing). This also bounds
    how long an attempt can outlive a rules change (INF-022 still to do).
  - Nothing that proves an economic outcome is deleted: claims, pull history, resolved attempts and key tombstones stay.

## DEC-0019 — Economic journal by database triggers
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-015).
- Context: grants and debits were only visible through their side tables (pull history, claims, attempt results,
  stored replies); there was no single record that explains a balance or ties a change to the request and the content
  release that made it.
- Decision:
  - Migration 0005 adds `economy_journal` and triggers on `wallet` (Eclipse Tokens, Fate's Threads, Silver Crowns,
    Account XP), `inventory_items`, the three equipment tables (minted/destroyed), `roster` (copies, Memory Shards)
    and `gacha_pity` (state before and after). A trigger cannot be forgotten by a new grant path.
  - Each row carries the request's Idempotency-Key, route and rules hash, set once per transaction by the Worker
    (`setJournalContext`, transaction-local `set_config`); account creation records `account_create`; changes outside
    a request are `unattributed`. With the reward seed (stage_attempts) and RNG seed (pull_history) a past outcome is
    reproducible after tuning.
  - Ration is not journaled (time regeneration makes a row diff misleading); its spends are on the verified victory.
  - Invariant (tested): the journaled deltas of each currency and item add up to the balance.
  - Journal rows go with a deleted account (cascade); retention/anonymization is INF-020.

## DEC-0020 — Migration runner safety
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-009).
- Context: `migrate.sh --check` created the ledger table; a migration waiting for a lock held by live traffic queued
  indefinitely (and every request behind it); nothing serialized runners besides the deploy concurrency group; ledger
  and files were only compared by checksum.
- Decision: `--check` is read-only; each migration transaction takes an advisory lock, re-checks the ledger, and runs
  with `SET LOCAL lock_timeout` (10 s, `MIGRATION_LOCK_TIMEOUT`) and `statement_timeout` (5 min); files must be
  numbered contiguously; a renamed applied file is an error; a ledger row without a file is a warning (rollback
  deploy). Compatibility rule: every migration is additive and must keep the Worker version that is still serving
  working, because the deploy migrates before it switches the Worker. Each property is exercised by `database/test.sh`.

## DEC-0021 — Test-database safety and request observability
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-010, INF-011).
- Context: production Neon runs PostgreSQL 18 (project `pg_version`), CI and local tests ran 16; the test tools would
  create and drop databases on whatever server they were given; failed setups left databases behind; the Worker logged
  only unhandled errors, with no id to tie a player's report to a log line.
- Decision:
  - `database/POSTGRES_MAJOR` (18) is the tested major: the CI services use it and a step checks it; the deploy warns if
    production differs. All suites were re-run on PostgreSQL 18 before the switch.
  - `database/test.sh` and the API tests' `createTestDatabase` refuse Neon hosts always and any non-loopback host unless
    `TEST_DATABASE_ALLOW_REMOTE=1`; database names are unique; cleanup also runs on failure.
  - Every request writes one JSON line `{event, request_id, method, route (pattern), status, duration_ms, source_sha}`;
    unexpected errors write `unhandled_error` with the same id. The id is Cloudflare's `cf-ray` (or a UUID) and is
    returned as `x-request-id`. Headers, bodies, tokens and path ids are never logged.
- Not done here: alerting, dashboards, quota/cost budgets and runbooks (rest of INF-011).

## DEC-0022 — Sign-out and account deletion
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-019, INF-020). Google Play requires in-app account deletion for
  apps that create accounts.
- Decision:
  - Sign-out ends the session on the server (`POST /v1/auth/logout`), forgets it on the device and clears Credential
    Manager's remembered choice; other devices stay signed in.
  - Deletion is in Settings, confirmed twice: a warning screen, then a fresh Google credential for a fresh server nonce
    that must match the identity linked to the account. A session alone cannot delete an account.
  - The account row is deleted and every table cascades (economic journal included). `account_deletions` keeps only the
    random account id, the confirming provider and the created/deleted times: no provider subject, no game data.
  - Backups: Neon keeps history for point-in-time restore for 6 hours (project `history_retention_seconds` = 21600), so a
    deleted account stays restorable from history for at most 6 hours; restoring it would need an explicit operator
    action. Paid purchases do not exist yet; when billing arrives (INF-036) any legally required purchase records need
    their own retention decision.
- Open: the web page Play asks for (deletion without the app) needs a support contact (OQ-016).

## DEC-0023 — Stable content ids
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-005, INF-023 first part).
- Context: saved state stores content ids (roster, inventories, skill ranks, completed stages, claims) and the story
  cursor as an index into the story order. A content release that renamed or dropped an id, or inserted a story entry,
  would orphan or shift players' saved state, and nothing would notice.
- Decision:
  - `game/data/stable_ids.lock.json` records every id ever shipped per kind (characters, skills, items, weapons, armors,
    accessories, stages, currencies, daily tasks, weekly segments) and the shipped story order. It only grows.
  - `server/test/stable-ids.test.ts` (CI) fails when a shipped id is gone and not listed under `retired`, when the story
    order is not an append of the shipped one, and when new ids are not recorded yet
    (`UPDATE_STABLE_IDS=1 npx vitest run test/stable-ids.test.ts` adds them, never removes).
  - Retiring an id is a deliberate act: list it under `retired` in the same release that migrates the saved state holding
    it (the migration map itself is INF-023's remaining work, built when the first retirement is needed).
  - New data in a content release uses new ids and existing closed operations (the battle `EffectOp` set and the existing
    reward/quest kinds); a new operation is code and ships with an app (and Worker) release.

## DEC-0024 — Attempts are pinned to their rules release
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-022 first part).
- Decision: an attempt records the rules hash it was opened under (migration 0007). A victory is re-simulated with the
  rules the Worker bundles; if they differ from the attempt's (a content release happened in between), the victory gets
  409 `RULES_CHANGED` and the snapshot no longer offers the attempt for resume. The player loses only the replay (nothing
  is paid before a verified victory), never a reward for a battle judged under other rules. Attempts from before the
  column (NULL) keep working. Together with the boot gate (DEC-0015: the client's rules must equal the server's) and the
  24 h attempt TTL (DEC-0018) this is the drain policy for open battles across a rules rollout.
- Not decided here: running several rules releases side by side on the server (multi-release engine), needed only if a
  rollout must keep old-release battles payable.

## DEC-0025 — Staging is a separate environment, and databases know which environment they belong to
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-006). Activation waits on owner decision D-07.
- Decision: staging is its own Worker (`unaware-of-my-demise-staging`, `server/wrangler.jsonc` `env.staging`) with its
  own Hyperdrive config, its own empty Neon database (no copy of player data; `deploy-staging.yml` builds the schema with the migrations), its own rate-limit counters and its
  own secret (`STAGING_DATABASE_URL`), deployed by `.github/workflows/deploy-staging.yml` from the same commits as
  production. Each database records its environment in the one-row table `uomd_environment` (outside the
  numbered migrations; a database-level setting was tried first, but Neon does not let the owner set custom parameters);
  `database/migrate.sh` with `UOMD_ENVIRONMENT` refuses a database recorded as another environment's, production
  records itself on its next deploy, and staging claims only an empty database (so it can never adopt the production
  database through a wrong URL). The staging workflow also refuses `STAGING_DATABASE_URL` equal to `DATABASE_URL`.
  No test, seed or reset tool is bound to production; none exists in the Worker.
- Not decided here: production deploys waiting for a green staging deploy (after staging has run for a while), and a
  staging build of the Android app (its `uomd/online/server_url` would point at the staging Worker).

## DEC-0026 — One content source, and how content reaches each side
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-021 and the G4 "single path" choice).
- Decision: `game/data/content/*.json` is the single authoring source of game content. Packs are edited there (by hand
  or by a tool), `tools/content_manifest.py --write` records their hashes, and CI requires the manifest to match and
  `tools/validate_part1_content.py` (LEGACY validator, MIG-0041) to pass. The LEGACY generator
  (`build_part1_content.py`, from the GDD markdown) is reference only.
  The server's rules come from the deployed Worker: it bundles the packs of its commit, so a rules change is a Worker
  release (recorded `source_sha`, rules hash in `/v1/bootstrap`, attempts pinned by DEC-0024). The client gets the same
  packs inside the app or, later, in a signed content patch (G5) — never a separately edited copy — and the boot gate
  (DEC-0015) refuses to play when its rules hash differs from the server's.
- Rejected for now: loading server rules from a runtime registry (R2/DB) independent of the Worker release; it adds a
  second release identity without a current need. Revisit if content must change faster than Worker deploys.

## DEC-0027 — Audio by stable id, text by locale field
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-025).
- Decision: the client plays audio only by id through the `Audio` autoload (`game/scripts/app/audio_director.gd`).
  Runtime paths keep the LEGACY layout (`audio/voice/<speaker_id>/<line_id>`, `audio/music/<id>/`, LEGACY_AUDIT §4)
  under the content's `assets/` root, without the generation version: `res://assets/audio/voice/<speaker_id>/<line_id>.ogg`,
  `res://assets/audio/music/<cue_id>.ogg`, `res://assets/audio/sfx/<cue_id>.ogg`. Versions, takes and sidecars stay in
  narrative staging; promotion writes the stable runtime name (and sets loop points in the import settings). Buses
  Music/Voice/SFX → Master (`game/default_bus_layout.tres`), linear volumes saved in `user://settings.cfg`. A missing
  file is silence, never an error.
  Player-facing content text is read as `<field>_<locale>` with English (`_en`, the authored language) as the fallback
  (`LocalizedText.pick`); adding a language is a content addition.
- Open: story scenes carry `music_cue` as prose, not an id; cue ids per scene are a content/narrative decision
  (`docs/OWNER_DECISIONS.md` D-08). UI chrome strings (button labels) are not yet in a translation table.

## DEC-0028 — A content patch carries data and imported art/audio, never code
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-027).
- Decision: content patches are Godot delta packs (`--export-patch` against the base pack of the app release they apply
  to, plus earlier patches), built by `game/tools/build_content_patch.sh`. `tools/pck_inventory.py` reads the pack
  (format v4, Godot 4.7.2), checks every file against its directory MD5 and refuses anything outside the allowlist:
  `data/content/*.json`, `assets/**/*.import`, imported textures/audio under `.godot/imported/`, `.godot/uid_cache.bin`,
  and the script-class cache only when it lists the same classes as the base. Scripts (`.gd`/`.gdc`/`.remap`), scenes,
  `.tres`/`.res` (they can embed script), native libraries and `project.binary` always need an app release (Google Play
  forbids downloading executable code; a reviewed AAB stays the only code path). CI proves both directions with the
  pinned engine on every change.
- Facts: `--export-pack` of a commit is byte-reproducible (same SHA-256 on three exports), so a release's base pack can
  be rebuilt from its commit; it is still kept with the release.
- Next: signed manifest and trust root (INF-028).

## DEC-0029 — Signed content manifests, trust root in the app
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-028). Activation waits on owner decision D-09 (signing key).
- Decision: a content release is described by a manifest (`tools/content_release.py`: schema, channel, release id,
  monotonic generation, app versionCode range, base pack SHA-256, rules hash, key id, packs in mount order with
  SHA-256 and size) and signed with RSA (3072-bit) PKCS#1 v1.5 over SHA-256 of the exact bytes
  (`tools/sign_content_manifest.sh`, `openssl dgst -sha256 -sign`). The private key exists only as the GitHub repository secret
  `CONTENT_SIGNING_KEY`; the public key ships in the app as `res://data/keys/<key_id>.pem`,
  which a patch cannot change (DEC-0028). The client (`ContentManifest.verify`) trusts a manifest only with a valid
  signature from a shipped key, for its own versionCode, and with a generation newer than the installed one (replay of an
  old manifest is refused; a rollback is published as a new generation pointing at older packs).
- Why RSA, not Ed25519: Godot's `Crypto` (mbedTLS, the same on Android) verifies RSA PKCS#1 v1.5 with SHA-256 and has no
  Ed25519; verified headless by GUT against an openssl-signed fixture (its private key was discarded).
- Key rotation: a new key id is an app release that ships both keys; manifests switch after enough players updated.

## DEC-0030 — Content patches are delivered by the Worker from a private bucket
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-029).
- Decision: the R2 bucket `unaware-of-my-demise-content` stays private (verified 2026-10-04: r2.dev access disabled, no
  custom domain, no CORS). The Worker binds it as `CONTENT` and serves signed-in players only:
  `GET /v1/content/current` (the channel's signed manifest and signature, byte-exact, `no-store`) and
  `GET /v1/content/packs/{sha256}` (immutable, content-addressed packs; `private, max-age=31536000, immutable`; one
  byte range per request for resumed downloads, 206/416). Layout: `packs/<sha256>.pck`,
  `manifests/<channel>/<generation>.json(.sig)` (both never overwritten), `channels/<channel>/current.json(.sig)` (the
  pointer, a copy of the current manifest). The pointer needs no trust of its own (DEC-0029: signature + generation).
  Each deployment serves one channel (`CONTENT_CHANNEL`: production, staging); the client cannot ask for another.
  No credential or URL that bypasses the Worker is ever embedded in the app or a pack.
- Rejected: presigned R2 URLs handed to clients (would need R2 S3 credentials in the Worker for little gain at this
  scale); a public bucket.

## DEC-0031 — Publishing content: cumulative packs, immutable objects, pointer last
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-030). First run waits on owner decision D-09.
- Decision: `.github/workflows/publish-content.yml` (manual: channel, base commit of the installed app, versionCode
  range, reason) rebuilds the app's base pack from its commit (byte-reproducible, DEC-0028), builds one cumulative patch
  of everything since that base (never a chain of deltas: a device mounts exactly one pack over the app, and a rollback
  is a new generation built from an older commit), validates content, signs the manifest (generation = current + 1),
  uploads `packs/<sha256>.pck` (content-addressed; an existing one must read back identical), then
  `manifests/<channel>/<generation>.json(.sig)` (refused if it exists), reads every object back byte for byte, writes an
  append-only `history/<channel>/<generation>.json` (actor, reason, commit, base, run link) and only then moves
  `channels/<channel>/current.json(.sig)`. Default channel: staging.
- Not decided here: automatic promotion from staging to production after device tests (manual for now).

## DEC-0032 — Installing content on the device, and the boot order
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-026, INF-031, INF-032).
- Decision: `ContentInstaller` (user://content) keeps exactly two releases, `installed.json` and `last_good.json`, each
  the signed manifest plus its pack file, and `generation.json` (the replay floor). Install: verify the manifest
  (DEC-0029, generation above the floor), check free space, download into `packs/<sha256>.pck.part` (a dropped
  connection resumes from the bytes already there with a Range request), check length and SHA-256 (a damaged file is
  deleted, never kept), rename into place, then move installed → last_good and write the new record with a
  temporary-file rename (a crash leaves the old or the new release, never half of one), then delete every other pack.
  Boot (INF-026): mount the installed release (re-verified: signature, app versionCode, pack SHA-256; falling back to
  last_good, then to the shipped data) → load content → release gate → sign-in → snapshot. When the gate reports other
  game data (`content_update_required`), the client signs in, fetches the current release, installs it and reloads the
  content; if a release was already mounted in this process it asks for a restart instead (cumulative packs are never
  layered). Nothing is mounted while a battle runs.

## DEC-0033 — The admin panel: a separate Worker behind Cloudflare Access, audited in the same transaction
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-033/034). Activation waits on owner decision D-11.
- Decision: replace the starter admin (shared `x-admin-token`, endpoints that never existed in the Worker) with a
  separate admin Worker (`server/wrangler.admin.jsonc`) serving the static Next.js panel and the admin API on one origin
  (a same-origin BFF: no CORS, no token in the browser). Cloudflare Access signs operators in; the API verifies the
  Access JWT on every request and maps the e-mail to a role in `admin_users` (viewer, support, operator). Reads of
  player data are audited; changes require a reason, an Idempotency-Key and a same-origin JSON request, and their audit
  row commits in the same transaction (append-only `admin_audit`, migration 0008). The game Worker exposes nothing
  administrative; there is no production grant endpoint.
- Why not the admin panel's own login: Access gives SSO/one-time PIN and MFA without the project storing operator
  credentials, and is free at this team size.

## DEC-0034 — Live operations: versioned config and mail paid through a claim ledger
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-035). No real event or reward amounts are designed here.
- Decision: operators publish append-only config revisions (`liveops_config`: feature flags, notices with server-UTC
  windows; validated, unknown fields refused) and send mail (`mail`: to everyone or one account, a UTC window, bounded
  rewards of Silver Crowns, Eclipse Tokens and known items) through the admin API, each change audited with its reason
  (DEC-0033). Players read `GET /v1/liveops` (no sign-in: the current revision's flags and the notices running now) and
  `GET /v1/mail`, and claim with `POST /v1/mail/{id}/claim`: idempotent, and the `mail_claims` primary key makes a second
  claim (another key, another device) a 409 that pays nothing; the grant is journaled as `mail_claim`. A missing config
  means revision 0, no flags, no notices; clients ignore flags they do not know. Revoking a mail stops further claims and
  never takes back what was claimed.

## DEC-0035 — Release AABs and the end-to-end test
- Status: ACCEPTED (2026-10-04, engineering; roadmap INF-039…042). Store upload waits on owner decision D-13.
- Release: `.github/workflows/release-android.yml` (manual, main only) builds the AAB with the pinned Godot 4.7.2, JDK 17,
  platform 36 and build-tools 36.1.0 from the committed versionCode/versionName (raising them is a reviewed commit; a
  versionCode already built is refused), signs it with the upload key from secrets, and `game/tools/build_android_release.sh`
  proves it: the signature verifies and is the upload key's; bundletool 1.18.2 (hash-pinned) validates the bundle and
  builds the universal APK, which `verify_apk.sh` checks (package, min/target SDK, arm64-v8a only, permission allowlist,
  UomdNative plugin, 16 KB zip and ELF alignment) and whose versionCode/Name must match. The AAB, its base pack (the
  base of that release's content patches) and a provenance file (hashes, commit, upload certificate) are kept for 90 days.
  No NDK is needed: Godot ships the native libraries prebuilt (verified with a full local build, 2026-10-04).
- End-to-end: `server/e2e/run.sh` runs the production Worker code under `wrangler dev` (entry `src/e2e-index.ts`: only
  sign-in is swapped for test credentials; never deployed — deploy.yml checks the production entry) against a disposable
  PostgreSQL with every migration, and the headless Godot client (`game/e2e`) plays a new account through the opening,
  1-1 and 1-2 (server-verified victories), the First Oath and 1-3, calls the menus, then relaunches with the same session
  and signs in again — same account, same state. CI job `e2e`.
- Not covered here (device and store): a real Google sign-in on a phone, Play install/upgrade, background/kill, patch
  under bad connectivity (INF-043/044, owner-run with the release build).

## DEC-0036 — Owner answers of 2026-10-05: v1 scope, staging timing, support address, music cues
- Status: ACCEPTED (2026-10-05, owner answers to docs/OWNER_DECISIONS.md D-01, D-02, D-07, D-08, D-10).
- D-10 (v1 scope): Google Play billing (the LEGACY Eclipse Blessing subscription and purchases), rewarded ads with
  server-side verification, and the LEGACY social features (friends, requests, block, report) are **in** the first public
  release. INF-036 and INF-037 move from BLOCKED_OWNER to TODO. Real payments and production ad serving stay off until
  the store and ad accounts exist (sandbox and test ads only), as the roadmap says.
- D-01 (support address): `unawareofmydemise@gmail.com` is the address wherever the game or a store needs one. The game
  Worker serves the public deletion page `GET /account/delete` (Google Play Data safety link): what is deleted and what
  stays, the in-app path, the address, and a self-service deletion without the app — choose the same Google account in
  the browser (Google Identity Services, fresh server nonce), confirm, and `POST /account/delete` deletes the linked
  account exactly like the in-app deletion (`account_deletions.confirmed_by = web:google_oidc`). No session is needed;
  the fresh Google token for a single-use nonce is the proof. Sign-in rate limit, strict CSP (per-response nonce),
  readable during maintenance and database outages. The browser button needs the Worker origin on the Web OAuth client
  (owner action D-14); until then the page still offers the app and the address.
- D-07 (staging): deferred until after the closed test; production deploys stay as they are, `deploy-staging.yml`
  keeps skipping. INF-006 is DEFERRED, not done.
- D-08 (music/voice cues): the narrative team assigns cue ids per scene. First the whole stretch from the first app
  launch to entering the game is designed (docs/design/FIRST_LAUNCH_FLOW.md), so its cue points exist for them to fill.
- D-02: there is no `docs/INFRASTRUCTURE_REVIEW.md`; the roadmap's R01–R16 labels stay as written and are marked as
  untraceable (they are unrelated to the R01–R23 creative reference set in UOMD_REFERENCE_LOCK.md).

## DEC-0037 — Social features: the LEGACY friend graph on the Worker
- Status: ACCEPTED (2026-10-05, engineering; owner decision D-10 put social in v1; roadmap INF-037).
- Source: the LEGACY server and client (Drive: `server/social.py`, `server/repository.py`, `server/app.py`,
  `tests/test_social.py`, `client/screens/friends_screen.py`, `docs/ONLINE_ACCOUNT_SOCIAL_PART1.md`). Kept as they were:
  friend codes (8 characters without 0/O/1/I/L), `friend_edges` with mirrored pending/accepted pairs and one-sided
  blocks, crossed requests becoming a friendship, repeat requests answering the relationship as it is, a block ending
  every relationship and stopping the blocked player's requests (403, never saying who blocked whom), reports with the
  LEGACY reason keys, public records without friend codes or anything private. No chat, guild, PvP, co-op or transfer.
- Filled where LEGACY stopped (its own docs asked for these): cancelling one's own request; unblocking (LEGACY's
  message said "unblock them first" but had no route); choosing a nickname (unique regardless of case, 3–16 characters,
  reserved words, once per 24 h); coarse presence that respects the player's setting; player level from account XP
  (LEGACY returned 0 because no curve existed then); keyset paging; anti-abuse limits in a versioned config
  (`SOCIAL_LIMITS` v1: 50 friends, 30 waiting requests, 100 waiting on one player, 30 requests and 10 reports per day,
  a repeat report within 24 h is the same report) — engineering defaults the owner may tune; moderation in the admin
  panel (open reports, resolve with a reason, reset a nickname; audited).
- Paths follow this API's conventions (POST for every change, each with an Idempotency-Key): removal is
  `POST /v1/friends/{id}/remove` instead of LEGACY's `DELETE /v1/friends/{id}`.
- Concurrency: every change to a pair runs under a transaction-scoped advisory lock on the pair. The idempotency
  helper now locks the account row `FOR NO KEY UPDATE` instead of `FOR UPDATE`: still one mutation per account at a
  time, but a foreign-key check from another account's transaction (KEY SHARE) is no longer blocked by it. With
  `FOR UPDATE`, two players sending each other a request at the same moment deadlocked (found by the concurrency test;
  500 before, a friendship after).
- Deleting an account removes its edges on both sides and every report it made or received (cascades).


## DEC-0038 — Billing and rewarded ads: server-verified Eclipse Blessing and AdMob SSV
- Status: ACCEPTED (2026-10-05, engineering; owner decision D-10 put billing and rewarded ads in v1; roadmap INF-036).
  Activation needs the owner's accounts: D-17 (Play) and D-18 (AdMob).
- Source: LEGACY (Drive) `server/billing.py`, `client/game_controller.py` (`watch_rewarded_ad`, the blessing methods),
  `client/screens/blessing_screen.py`, the `android_bridge` adapters, and `economy_part1.json` (`subscription`,
  `rewarded_ads`), which already held every number. No number was invented: 1,600 instant, 187 per twelve-hour
  window, 60 windows, 14-day claim grace, 30 days; ads 30 Eclipse Tokens, 4 per half-day window, 8 per UTC day.
- Eclipse Blessing (Google Play subscription `eclipse_blessing_30d`):
  - The app sends only the purchase token. The Worker asks Google Play (subscriptionsv2, service account), refuses a
    purchase tagged for another account (the app sets Play's obfuscated account id to the game account id) or bound
    to another account, binds it, pays the period's instant grant, then acknowledges the purchase.
  - The instant grant is paid once per (purchase token, period) ever: the ledger `billing_instant_grants` keeps only the
    token's SHA-256 and the period, with no account reference, so deleting and recreating an account cannot repeat it.
  - Twelve-hour windows are claimed by the player (an idempotent mutation), within the period, a missed one for 14 days.
  - Play's real-time developer notifications (Pub/Sub push, Google OIDC token checked against `RTDN_AUDIENCE` and
    `RTDN_PUSH_SERVICE_ACCOUNT`) re-read the purchase from Play: a renewal opens and pays the next period even if the
    app is not opened; a refund, revocation or voided purchase stops further claims. Every message is recorded once.
  - Refunds take nothing back that was already paid (no negative balances). Engineering default; the owner may change it.
- Rewarded ads (AdMob): the app shows the ad with the account id as the SSV user id; AdMob calls `/v1/ads/ssv`, signed
  with ECDSA P-256 by Google's published keys. Only our own ad units pay, because AdMob signs every publisher's
  callbacks. One payment per transaction id; caps are checked under the account lock. A capped or repeated callback
  answers 200 so AdMob stops retrying. The app only polls `/v1/ads/status` until the count rises, and offers an ad
  only when the server names a unit (`ADMOB_AD_UNIT_IDS`), so no ad is shown that the server would not pay for.
- Consent: Google's UMP form runs before the first ad of a run; without "can request ads" no ad is shown.
- Android: Play Billing Library 9.1.0, Google Mobile Ads 25.5.0, UMP 4.0.0 in the UomdNative plugin. The AdMob app id
  is built in from `ADMOB_APP_ID` (Google's sample id until D-18, test ads only).
- Permission allowlist (`game/tools/verify_apk.sh`, single source): now adds `com.android.vending.BILLING`, `AD_ID`,
  `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `FOREGROUND_SERVICE` and AdMob's Privacy Sandbox `ACCESS_ADSERVICES_*` defaults.
  The advertising ID must be declared in Play's Data safety form (D-18).
- Not done without the owner's accounts: a license-tester purchase and a real AdMob callback on a device; until then the
  routes answer 503 (purchases) or the app offers no ad.

## DEC-0039 — Third-party notices generated from what the app ships
- Status: ACCEPTED (2026-10-05, engineering; roadmap INF-040).
- Settings → Licenses shows, in a read-only text view:
  - the Godot Engine's license and every component compiled into it, read from the engine itself
    (`Engine.get_license_text`, `get_copyright_info`, `get_license_info`), so it always matches the shipped engine;
  - every Android library in the app, with the licenses its Maven POM (or a parent POM) declares;
  - the Apache License 2.0 text, which most of those libraries use (the official file, sha256 `cfc7749b…d30`).
- The library list `game/data/legal/android_libraries.json` is generated by the UomdNative Gradle task
  `thirdPartyNotices`. That build mirrors the exported app's runtime classpath: the template's and the engine's
  libraries are declared `runtimeOnly`, so Gradle resolves the same versions as the app (an AAR carries no
  dependencies, so nothing is shipped twice).
- The file is committed, and three checks keep it honest:
  - `tools/build_uomd_native.sh` fails when the regenerated file differs from the committed one;
  - GUT checks that every declared library is listed with a license;
  - `tools/verify_apk.sh` compares it with the version records inside the APK (AndroidX `META-INF/*.version`, Google
    `*.properties`).
- Google's Play libraries are listed under the "Android Software Development Kit License" their POMs name, with its URL.

## DEC-0040 — Maintenance and the minimum app version from the admin panel
- Status: ACCEPTED (2026-10-05, engineering; roadmap INF-033).
- Before: maintenance and the minimum app versionCode were deploy variables, so stopping the game or retiring an app
  version needed a deploy.
- Now: operators set them in the admin panel (Service tab; permission `release.write`, operator role).
  - Each change is an append-only revision in `release_control` (migration 0012), with who set it and why, and an
    audit row (`release.set_control`) in the same transaction.
  - The game Worker reads the newest revision at most every 30 s per isolate. Requests in between share that read, so
    there is one small query per isolate per 30 s.
- Combining it with the deploy variables:
  - minimum versionCode = the larger of the deploy's and the panel's, so an operator can retire app versions but never
    reopen ones this server no longer supports;
  - a non-empty panel message wins over the deploy's.
- Failure behaviour: when the database cannot be read, the last value read stays in force (none yet = the deploy
  variables alone). A database outage never turns into a maintenance screen or a forced update by itself; the routes
  that need the database fail as before.
- `/v1/bootstrap` reports the combined values, so the client's start screen shows the panel's maintenance message.

## DEC-0041 — The session stays in memory; a long absence refreshes the hub
- Status: ACCEPTED (2026-10-05, engineering; roadmap INF-019).
- The session token is never written to the device.
  - A new launch signs in again through Credential Manager. For a returning player this is silent, with no prompt and
    one `/v1/auth/google` call.
  - So there is no bearer token at rest to protect, to leak through backups, or to outlive a sign-out.
  - The AndroidKeyStore wrapping the plugin offers stays unused for sessions.
- Coming back from the background after more than 5 minutes:
  - on the hub, the client fetches the server's state again and redraws, so a change made on another device shows;
  - a required update or a maintenance that started meanwhile is shown at once;
  - battles, story scenes and every other screen are never interrupted, and their next server call meets the same
    answers.
- An expired session during the absence is handled as before: the first 401 renews once and repeats the same
  Idempotency-Key.

## DEC-0042 — Owner answers of 2026-10-05: backups, alerts, content key, admin access, scope
- Status: ACCEPTED (2026-10-05, owner answers; `docs/OWNER_DECISIONS.md`).
- D-05 backups: Neon stays on its free plan, which keeps 6 hours of history. The off-site backup is
  `.github/workflows/backup.yml`:
  - nightly `pg_dump` of production, read-only;
  - encrypted with `age` to the owner's public key;
  - uploaded to the private R2 bucket `uomd-db-backups`, deleted after 30 days by its lifecycle rule.
  - Only the owner's offline key can open a backup.
- D-06 alerts: `.github/workflows/monitor.yml` fails on an outage; GitHub e-mails the owner at
  `unawareofmydemise@gmail.com`.
  - Every 15 minutes: the Worker (no database) and the admin panel.
  - Every 3 hours: the database and the retention cron. Kept rare so Neon's free compute is not kept awake.
- D-09: `uomd-content-1` (RSA 3072) is the content-signing key. The app ships its public half; the private half is
  only in the `CONTENT_SIGNING_KEY` secret and the owner's offline backup.
- D-11: Cloudflare Access guards the admin Worker. The owner wants the panel to stay well organised and to cover the
  changes they need to make.
- D-14: the Worker origin is on the Web OAuth client, so the deletion page's Google button can sign in.
- D-16, scope: design and creative work, the main theme included, belongs to the other team. This engineering
  track owns game infrastructure and gameplay.
- D-19: the game launches in English. Other languages arrive later through content patches.
- Deferred until the release: D-03 (Neon branch protection needs a paid plan) and D-12 (Workers Paid).
- Partly done: D-13 and D-17, with progress in OWNER_DECISIONS. D-18: AdMob account pending, plus the reward question.

## DEC-0043 — Rewarded ads: five per half-day window, rewards rising from 10 to 50
- Status: ACCEPTED (2026-10-05, owner decision D-18; numbers may be tuned later).
- At most 5 rewarded ads per half-day window and 10 per UTC day; before this it was 4 and 8.
- Rewards: the n-th view of a window pays 10, 20, 30, 40 and 50 Eclipse Tokens, 150 per window. That equals 5 × 30
  but rewards watching the whole series.
  - Data: `rewarded_ads.reward_token_by_view` replaces `reward_token`.
  - `GET /v1/ads/status` reports what the next view pays (0 at a cap); the app shows it on the button.
- Economy, recomputed in `economy_part1.json`:
  - window maximum 270 tokens (was 240);
  - daily maximum from ads 300, from all sources 540;
  - 15-day free-to-play reference 9,700 tokens / 60 pulls (was 8,800 / 55); the owner accepted 60;
  - hard pity reached in about 20 days of full play (was 22).
- `tools/validate_part1_content.py` checks that these numbers stay consistent with one another.
- Still waiting on the subscription tier design (D-17): subscribers watch one ad and skip; the highest tier gets the
  ad rewards without watching.
