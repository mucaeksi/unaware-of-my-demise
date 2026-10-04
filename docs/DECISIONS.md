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
