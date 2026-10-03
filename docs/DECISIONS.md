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
- Status: DECISION_REQUIRED
- Facts: master prompt names `unaware-of-my-demise-api`; the only Worker in
  the Cloudflare account is `unaware-of-my-demise` (dash template, no
  bindings, no routes). Workers Builds trigger also targets
  `unaware-of-my-demise`.
- Recommendation: **keep `unaware-of-my-demise`** (already exists, avoids a
  duplicate Worker, nothing depends on the `-api` name yet). Update the master
  prompt reference. `wrangler.toml` will use `name = "unaware-of-my-demise"`
  unless the owner chooses otherwise.

## DEC-0002 — Neon Auth present on production
- Status: DECISION_REQUIRED
- Facts: `neon_auth` schema with 9 tables exists in `UOMD` on branch
  `production`; 0 users. Master prompt forbids Neon Auth.
- Recommendation: owner disables Neon Auth in the Neon console (Claude does
  not run destructive Neon operations autonomously). The game schema will live
  in `public` (or a dedicated `game` schema) and will not reference
  `neon_auth`. Until disabled, it is inert.

## DEC-0003 — Canonical Worker deployment path
- Status: PROPOSED
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
- Status: ACCEPTED (2026-10-03) — adopts LEGACY owner decision **C44**
  (2026-09-30), found in `LEGACY:narrative/…/canon.md`.
- Images: `gemini-3.1-flash-image` (Nano Banana 2) at 2K — not Pro, not Lite.
- Music (all tracks and stingers, except the owner's main theme):
  `lyria-3.5`.
- Voice (all characters): `gemini-3.8-flash-tts`; one prebuilt voice per
  character, never reused (`casting.json` rule); Fadyme = `Sulafat`.
- All three models verified present in this environment's Gemini model list.

## DEC-0005 — Repository license
- Status: DECISION_REQUIRED (legal)
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
- Status: PROPOSED (pending deep legacy audit)
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
