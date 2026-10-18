# Architecture (implemented state, 2026-10-17 — Decision D-23)

```
narrative/  ──(tools/build_content.ts)──►  content/base      (release rel_0001, embedded in the app)
(canon, JSON, art)   + legacy art in Git   content/patches   (data-only releases, published through R2)
                                                │
packages/shared ── hashing, canonical JSON, ES256 signing, seeded RNG
packages/content-schema ── zod grammar: effects, units, story commands, encounters, art, manifest, validateContentSet()
packages/combat ── deterministic 5v5 engine + replayBattle()      packages/story ── declarative story VM
packages/patch ── PatchManager (device) + manifest builder/signer (publisher)
                                                │
apps/game  (PixiJS v8 + DOM/CSS UI, Vite)  ◄── /content/base (static) + /api/v1/content/* (signed patches)
apps/api   (Hono on Workers): game Worker  = static client + /api/v1/*   │  D1 `DB`  (authoritative SQL)
                              admin Worker = static SPA + /admin/api/*   │  R2 `CONTENT` (objects/<sha256>)
apps/admin (React 19)  UOMD Control Center — behind Cloudflare Access
```

## Game client (`apps/game`)
- **Hybrid PixiJS v8 (`pixi.js` ^8.8.0) WebGL2/WebGPU 2D Stage + Modular TypeScript DOM/CSS UI Architecture (`#uomd-ui-layer`)** (Decision D-23), 1920×1080 reference, `Scale.FIT` with themed letterbox,
  portrait-rotation overlay, safe-area helper, reduced-motion preference, 2 active pointers. Scenes: Boot → Splash → Studio → Title →
  Prologue → Story → Battle → Finish → Home/Chapters/Roster/Growth/Gear/Teams/Summon/Recruit/Shop/Tasks/Mail/Library/Account/Operations/Purchases. Everything the scenes show comes from `ContentService` (patch overlay over the embedded base).
- Battle presentation consumes the engine's typed event log (no gameplay logic in scenes); actions are recorded and sent to
  `/api/v1/battles/verify`; the result screen shows whether the server's replay hash matched.
- Audio: Web Audio music with intro + sample-accurate loop region (Lyria loop metadata), procedural & voiced SFX.

## Backend (`apps/api`)
- **Game Worker** — `GET /api/v1/health` (D1 + R2 probes), `/content/channels/:channel/manifest` (signed, ETag),
  `/content/objects/:sha256` (immutable; only objects of a *published* release on that channel), `/characters`,
  `POST /battles/verify` (rate-limited, server re-simulation, audit row).
- **Control Center Worker** — Access JWT verified in code (RS256, issuer = team domain, audience = app), identity → role in
  `admin_users` (viewer/operator/owner), optimistic concurrency on edits, append-only `audit_log` (D1 triggers), asset
  catalog with provenance, release pipeline (upload → validate → draft → sign → publish / rollback / kill switch).
  First owner: `INSERT INTO admin_users (email, role, created_by) VALUES ('<you>', 'owner', 'manual');` (no secret involved).
- **D1** (`migrations/0001_core.sql`, `0002_economy_ledger.sql`): content releases/objects/pointers, audit, characters,
  assets, battle audit, rate counters, players/wallets/ledger. Ledger = unique idempotency key + `CHECK (balance >= 0)` in a
  single `batch()` transaction; verified with 50 concurrent debits and 20 concurrent identical requests.
- **R2**: content-addressed objects only. Nothing financial lives in object storage.

## Environments
`dev` and `staging` have separate D1 databases, R2 buckets, Worker names and rate-limit namespaces. There is **no
production environment definition yet** (needs owner approval); legacy production resources are untouched.

## Not implemented yet (see BUILD_STATE.md)
Accounts/Google sign-in, Play Billing, AdMob/UMP, gacha, shop, mail, Capacitor Android project, Spine/Live2D runtime,
Media Factory queue, Queues/Cron jobs, analytics ingestion, usage dashboards.
