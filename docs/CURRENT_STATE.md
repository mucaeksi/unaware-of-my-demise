# Current State

## Snapshot 2026-10-04 (verified; the sections below are the 2026-10-03 audit, kept as history)

The backlog is `docs/INFRASTRUCTURE_ROADMAP.md` (INF ids, status table). Evidence for each line is in that table, the
PRs and `docs/DECISIONS.md`.

| Area | State |
|---|---|
| Production API | Cloudflare Worker `https://unaware-of-my-demise.muratcaneksiii.workers.dev`, deployed from `main` by `.github/workflows/deploy.yml` (migrations first, then the Worker, then health/bootstrap/sign-in checks). `GET /v1/bootstrap` reports the deployed commit. Google sign-in configured (variable `GOOGLE_CLIENT_IDS`). |
| Database | Neon PostgreSQL through Hyperdrive; migrations 0001–0003 (`database/migrations/`), append-only, applied by the deploy. |
| Server | TypeScript Worker (DEC-0013): auth, state, story, stages/victories (server re-simulation), progression, equipment, quests, gacha, Ration, release contract. vitest 423. |
| Client | Godot 4.7.2 LEGACY client (BATCH-0002), server snapshot only (DEC-0012), release gate (DEC-0015), Google sign-in through the UomdNative Android plugin (BATCH-0003, DEC-0016). GUT 284. |
| Android | CI builds, exports and verifies a debug APK signed with the repository debug key and keeps it as an artifact; the owner installed it and signed in with Google (2026-10-04). Not yet: release AAB, upload key, Play test track (G7). |
| CI | `ci.yml`: `database`, `server`, `godot`, `android`. `deploy.yml`: production, with no automatic rollback to an older commit. |
| Not built | admin panel, content patches/R2, staging environment, billing/ads/social, localization/audio runtime (roadmap G1–G6). |

---

## 2026-10-03 audit (historical)

Phase 6 (current game audit) plus the server/admin/database state, verified
**2026-10-03** against commit `8a5c776` (branch
`claude/framework-bootstrap-setup-ahj0tz`, base `main@8797289`).

Bottom line: the active repository is a **generic "Gacha Online" starter**,
not yet the Unaware of My Demise game. The Godot client does not run, the
backend cannot run on Cloudflare Workers, and production Neon has no game
schema. The UOMD framework/docs layer is in place.

---

## 1. Godot client (`game/`)

> **Update 2026-10-04 (BATCH-0002).** The starter described below has been
> replaced by the LEGACY Godot 4.7.2 client, migrated selectively and without
> SQLite (DEC-0012, `docs/MIGRATION_LEDGER.md`). Verified state:
>
> - `project.godot`: name "Unaware of My Demise", portrait lock, autoloads
>   `Game`/`Online`/`Native`, GUT 9.7.1, `untyped_declaration` = error.
>   Android app id `io.github.mucaeksi.unawareofmydemise` (resolves C8).
> - Headless `--import`: clean. GUT: **33 scripts, 219/219 tests pass**,
>   including the Python parity suites, content invariants, battle engine, UI
>   screens and the new `PlayerState`/`GameBackend` tests.
> - Player state is a server snapshot (`PlayerState`). Every change is a
>   `GameBackend` coroutine. `Online.backend()` is still the "no server" base,
>   so a real boot shows "Server unreachable" until the Worker API client
>   (`OnlineBackend`) exists. The story, battle and menus are verified only
>   through tests that use a stub backend.
> - The table below is the historical audit of the replaced starter.

| File | What it does | Verified status |
|---|---|---|
| `project.godot` | name "Gacha Online"; main scene `scenes/main.tscn`; autoloads `ApiClient`, `PatchManager`; viewport 1080×1920, window override 540×960, stretch `canvas_items`; renderer `gl_compatibility`; Android package `com.example.gachaonline` | loads; identity is placeholder; **no portrait orientation lock** (`display/window/handheld/orientation` unset) |
| `export_presets.cfg` | one Android preset, Gradle build, min SDK 26, target 36, arm64-v8a, `package/signed=true` with empty keystore fields | untested; package id placeholder |
| `scenes/main.tscn` | single debug screen: login/register/draw buttons, labels | **corrupted**: lines 33 and 39 contain a literal TAB where `\ntext=` was intended (`offset_bottom=340.0<TAB>ext="demo@example.com"`), so the LineEdit default text is lost; hardcoded English strings (not localization-ready) |
| `scripts/api_client.gd` | HTTPRequest wrapper; base URL `http://127.0.0.1:8080`; login/register/banners/draw/manifest; client UUID via `randi()` | parses; untyped; non-crypto RNG for request ids; plain HTTP default |
| `scripts/patch_manager.gd` | fetch manifest, download PCKs, SHA-256 check, `load_resource_pack` | **parse error** — `FileAccess.store_string(path, value)` is not a static API in Godot 4.7 → autoload fails; version comparison is lexicographic string compare; no signature, no atomic install, no rollback |
| `scripts/main.gd` | wires the debug UI | crashes at `_ready` because `PatchManager` autoload is Nil |
| `icon.svg` | default icon | — |

Headless evidence (Godot 4.7.2 official, scratch copy of `game/`):

```
SCRIPT ERROR: Parse Error: Too many arguments for "store_string()" call. Expected at most 1 but received 2.
SCRIPT ERROR: Parse Error: Cannot call non-static function "store_string()" on the class "FileAccess" directly.
ERROR: Failed to instantiate an autoload, script 'res://scripts/patch_manager.gd' does not inherit from 'Node'.
SCRIPT ERROR: Invalid assignment of property or key 'server_base_url' with value of type 'String' on a base object of type 'Nil'.
```

Missing entirely: tests (gdUnit4 configured in `project.yaml` but no
`addons/gdUnit4`, no `tests/`), character presentation layer, VN/dialogue
system, audio/music cue system, localization, content data, portrait lock.

Status: **NEEDS_REWRITE** for the client foundation; the legacy archive
contains a far more advanced Godot 4.7 port (see `docs/LEGACY_AUDIT.md`)
which is the primary migration candidate.

## 2. Backend (`server/`)

TypeScript, **Fastify 5 + `pg` Pool + native `argon2` + `@fastify/jwt`**,
long-running `app.listen(:8080)`, reads files from `../patch/` with
`node:fs`. Dockerfile for a Node container.

| Concern | Finding | Worker-compatible? |
|---|---|---|
| Runtime model | `app.listen`, process lifetime | no — must become `export default { fetch }` |
| Password hashing | `argon2` native addon | no — needs WASM/WebCrypto implementation (must not be weakened) |
| DB | `pg.Pool` from `DATABASE_URL` | portable — use `env.HYPERDRIVE.connectionString`, per-request client, `nodejs_compat` |
| Filesystem | manifest/PCKs from local disk | no — R2 |
| Config | `dotenv` | no — Worker env/secrets |
| Gemini | `src/ai.ts` uses `@google/genai` at runtime | forbidden by architecture — remove |
| `wrangler.toml` | absent | — |

Correctness/security findings (see also `docs/INFRASTRUCTURE_AUDIT.md` §8):

- JWT secret falls back to `"dev"`.
- Gacha idempotency key is global (`request_id UNIQUE`), not per player; an
  old result is returned to whichever player supplies the UUID.
- Gacha draw itself is transactional with row locks on banner, wallet and
  pity (good), but the rarity roll ignores rates-by-rarity design (weights per
  item only), pity is hard pity only, no featured/50-50 logic, no history
  pagination, wallet deduction occurs after grants (inside same tx — fine).
- Admin endpoints: single shared token, actor recorded as `"admin"`, item and
  banner mutations audited, grants audited.
- No rate limiting, no input schema validation, errors leak `e.message`.
- `/content/:file` serves arbitrary basenames from `patch/files` (path is
  basename-filtered — OK) unsigned.

Status: **NEEDS_REWRITE** for the Worker runtime while preserving the
server-authoritative semantics (transactional draw, row locks, audit).

## 3. Admin (`admin/`)

Next.js 16 / React 19 single page (`app/page.tsx`, 169 lines) calling the
admin API with a token typed into the browser. No auth, no RBAC, no tests,
no deployment target. Status: **NEEDS_REWRITE** (foundation only).

## 4. Database (`database/`)

> **Update 2026-10-04.** Replaced by `database/migrations/0001_baseline.sql`, a PostgreSQL translation of the LEGACY
> schemas plus `stage_attempts` (DEC-0013). It has a checksum-guarded runner (`migrate.sh`) and constraint tests
> (`test.sh`), all verified on local PostgreSQL 16. Not applied to Neon yet. The starter migration and demo seed are
> deleted. The audit below describes the removed starter.

- `migrations/001_init.sql`: players (email+password_hash), wallets (non-negative
  CHECKs), items, player_inventory, gacha_banners, gacha_entries, gacha_pity,
  gacha_draws (`request_id UNIQUE`), audit_log. Uses `CREATE … IF NOT EXISTS`
  (idempotent but no migration ledger table).
- `seed/001_demo.sql`: demo characters Aster/Mira/Rook/Lyra/Nova — **not UOMD
  canon**; must never be applied to production.
- `server/src/db/migrate.ts` executes only `001_init.sql` (no ordering/ledger).
- Production Neon: `public` schema empty (nothing applied).

Status: **NEEDS_REWRITE** — schema must be derived from the legacy server
economy (FastAPI, wallet/pity/quests/purchases) and the UOMD content model, not
from the starter.

## 5. Patch / content

- `patch/manifests/manifest.json`: empty (`patches: []`).
- `scripts/build_patch.sh`: uses `godot --export-patch` with `--patches` base
  list (correct Godot 4.x mechanism), outputs to `patch/files/` (gitignored).
- `scripts/build_patch.ps1`, `scripts/encode-github-secrets.ps1`: Windows
  PowerShell — local-only helpers (`CLOUD_DEPENDENCY_GAP`, superseded by CI).
- No signing, no R2 upload, no CI.

## 6. CI/CD

None. No `.github/workflows/`. Cloudflare Workers Builds trigger is orphaned
(bound to a deleted repo) and its builds all failed.

## 7. Framework / docs

- `.claude/` UOMD-tailored CCGS framework: present (274 files) after bootstrap.
- `docs/` UOMD context, asset pipeline, reference lock, master prompt: present.
- `narrative/` staging tree: present with README placeholders, no content.
- Reference set: **NOT YET LOCKED** (`docs/UOMD_REFERENCE_LOCK.md`).

## 8. Consistency issues found

| # | Issue | Resolution |
|---|---|---|
| C1 | Master prompt Worker name `unaware-of-my-demise-api` ≠ actual `unaware-of-my-demise` | DEC-0001 |
| C2 | Neon Auth present though prohibited | DEC-0002 |
| C3 | Workers Builds orphaned + no GitHub Actions → no canonical deploy path | DEC-0003 |
| C4 | `docs/GITHUB_SECRETS.md` instructs storing `GEMINI_API_KEY` server-side / VPS deploy — contradicts Gemini-is-dev-only and Workers runtime | rewrite doc (done in this checkpoint) |
| C5 | `docs/ADMIN_PANEL.md`, `docs/ARCHITECTURE.md` describe Fastify/VPS starter | ARCHITECTURE rewrite pending Phase 12 |
| C6 | Root `LICENSE` is MIT "Copyright (c) 2026 Donchitos" (from the CCGS framework) and sits at repo root, implying the whole game is MIT-licensed | RESOLVED 2026-10-04 (DEC-0005) |
| C7 | `.gitkeep` files present although project policy forbids them (every directory already had a README placeholder) | removed in this checkpoint |
| C8 | Client Android package `com.example.gachaonline` vs legacy README `io.github.mucaeksi.unawareofmydemise` | RESOLVED 2026-10-04: LEGACY id adopted (DEC-0008) |
