# Repository Inventory

Phase 4. Verified 2026-10-03 at `8a5c776` (+ checkpoint changes).
Statuses follow the master prompt vocabulary.

| Path | Purpose | Current state | Runtime status | Legacy relationship | Status |
|---|---|---|---|---|---|
| `.claude/` | UOMD-tailored CCGS framework (39 agents, 73 skills, 13 hooks, 13 rules, docs, scripts, settings) | complete, 274 files | dev tooling | none | ACTIVE |
| `.DOTFILES.md` | dotfile policy | current | — | — | ACTIVE |
| `.env.example` | env template (placeholders only) | starter-oriented (`PORT`, `DATABASE_URL`) | — | — | NEEDS_REFACTOR (Worker env) |
| `.gitignore`, `.gitattributes` | VCS rules | adequate; `.gitattributes` lacks `*.ttf/*.otf/*.apk/*.aab` binary rules | — | — | ACTIVE |
| `CLAUDE.md` | project rules | current | — | — | ACTIVE |
| `README.md` | project overview | current target description | — | — | ACTIVE |
| `GAME_TOOLCHAIN.md` | toolchain pin | Godot 4.7.2, API 36 | — | LEGACY uses minSdk 28 / target 36 | ACTIVE |
| `LICENSE` | Proprietary, all rights reserved (CCGS MIT moved to `THIRD_PARTY_LICENSES/`) | at root | — | — | DONE (DEC-0005) |
| `THIRD_PARTY_NOTICE.md` | CCGS attribution | current | — | — | ACTIVE |
| `UOMD_FRAMEWORK_MANIFEST.md` | framework manifest | current | — | — | ACTIVE |
| `project.yaml` | CCGS config | stage "Technical Setup", gdUnit4 test command | — | — | ACTIVE (test cmd references missing addon) |
| `docker-compose.yml` | local Postgres + Node server | local-only | none in cloud | — | CLOUD_DEPENDENCY_GAP (optional dev aid; not part of production path) |
| `admin/` | Next.js admin | single page, no auth; calls starter admin endpoints that no longer exist | not deployed | none | NEEDS_REWRITE |
| `database/` | PostgreSQL migrations + runner + constraint tests | `0001_baseline.sql` from LEGACY schemas | tests pass on local PostgreSQL 16; not applied to Neon | LEGACY `backend/_schema.py` + `server/schema.py` | ACTIVE |
| `docs/UOMD_*.md`, `docs/coder/*` | canonical rules, master prompt, templates | current | — | — | ACTIVE |
| `docs/ARCHITECTURE.md`, `docs/ADMIN_PANEL.md`, `docs/PRODUCTION_CHECKLIST.md` | starter-era docs (Fastify/VPS) | stale | — | — | NEEDS_REFACTOR |
| `docs/engine-reference/godot/` | Godot 4.7 reference notes | current | — | — | ACTIVE |
| `docs/INFRASTRUCTURE_AUDIT.md`, `DRIVE_LEGACY_ACCESS.md`, `CURRENT_STATE.md`, `DECISIONS.md`, `OPEN_QUESTIONS.md`, `coder/MCP.md`, this file | takeover audit outputs | new | — | — | ACTIVE |
| `game/` | Godot client | LEGACY Godot 4.7.2 port, SQLite-free (BATCH-0002, DEC-0012) | import clean; GUT 219/219 | needs `OnlineBackend` (Worker API) to play | MIGRATED |
| `parity/` | Python-reference parity fixtures read by `game/tests/parity` | byte-exact LEGACY (BATCH-0002), persistence fixtures excluded | parity suites pass | — | MIGRATED |
| `narrative/` | creative staging tree | README placeholders only | — | LEGACY `narrative/` has art/audio/tools | ACTIVE (empty) |
| `patch/manifests/manifest.json` | patch manifest | empty, unsigned | — | — | NEEDS_REFACTOR |
| `production/session-state/`, `session-logs/` | durable session state | placeholders | — | — | ACTIVE |
| `scripts/build_patch.sh` | PCK patch export | sound Godot CLI usage, no signing/upload | — | — | NEEDS_REFACTOR |
| `scripts/build_patch.ps1`, `scripts/encode-github-secrets.ps1` | Windows helpers | local-only | — | — | CLOUD_DEPENDENCY_GAP (superseded by CI) |
| `server/` | Cloudflare Worker API (DEC-0013) | TypeScript, Hyperdrive + Neon; auth/session/account/wallet/state routes | vitest 16/16 on local PostgreSQL; wrangler dry-run bundle OK; not deployed | LEGACY FastAPI server ported route by route | IN_PROGRESS |
| `.github/workflows/` | CI/CD | **absent** | — | LEGACY had `ci.yml` (validate, parity, godot, android) | missing |

Tests in repository: **none** (no Godot tests, no server tests, no admin tests).

Removed in this checkpoint: `claude-framework/` (duplicate of `.claude/`,
DEC-0000), 11 empty `.gitkeep` files (DEC-0006).
