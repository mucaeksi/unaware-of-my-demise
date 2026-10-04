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

