# Build state (living document — facts only)

Last updated: 2026-10-10 · branch `claude/unaware-demise-dev-24ly57`.
Legend: **VERIFIED** = executed in this environment and observed; **LOCAL** = verified only against the local
Miniflare/Workers runtime, not a deployed Cloudflare environment; **NOT DONE** = does not exist yet; **BLOCKED** = needs an owner action.

## 1. What exists and how it was verified
| Area | Result | Evidence |
|---|---|---|
| Monorepo (npm workspaces, TS 5.9 strict) | VERIFIED | `npm run typecheck` → 0 errors in 8 workspaces; `npm run lint` (ESLint 10 flat config) clean |
| Shared primitives (sha256, canonical JSON, semver, ES256 sign/verify, seeded RNG) + media-spend guard | VERIFIED | `packages/shared` 14 tests (8 primitives, 6 budget guard) |
| Content schema (closed effect grammar, safe paths, story/encounter/manifest schemas, cross-reference validator) | VERIFIED | `packages/content-schema` 31 tests |
| Deterministic combat engine (narrative `battle_rules`: action gauge, damage formula, element chart, focus, statuses, replay) | VERIFIED | `packages/combat` 20 tests (determinism, replay hash, illegal-action rejection, MAX_TURNS) |
| Story VM (labels, choices, checkpoints, save/resume) | VERIFIED | `packages/story` 5 tests |
| Patch manager (signature, generation monotonicity, compat, depends_on, rollout, resume, per-file SHA-256, atomic state, rollback, corrupt-object auto-rollback) | VERIFIED | `packages/patch` 13 tests |
| Cloudflare Workers API (Hono) on D1 + R2: game API, admin API, Access JWT auth + RBAC, signed releases, battle replay verification, ledger | LOCAL | `apps/api` 38 tests in the Workers runtime (Miniflare D1/R2) incl. 50-way concurrent ledger debit, idempotency, append-only triggers, CSRF guard |
| Phaser 4.2.1 game (title → story VM → 5v5-capable tactical battle → victory/verification → chapters) | LOCAL | Playwright e2e in real Chromium/WebGL, 2 viewports (see §2); screenshots in `docs/evidence/` |
| Data-only content patching (new chapter node + new enemy unit + story delivered from R2 to the *unchanged* client; rollback to embedded base) | LOCAL | e2e `live data patch` (desktop) + `apps/api/test/content.test.ts` "real patch manager applies the published patch end to end" |
| Control Center v0 (React SPA): dashboard (D1/R2 health, channels, table counts), characters (20 seeded, optimistic concurrency, audit), asset catalog with provenance, patch list/publish/rollback/kill, audit log, user roles | LOCAL | e2e `admin.spec.ts` on both viewports against real D1/R2 (Miniflare) with a test-only Access identity |
| CI workflows | VERIFIED on PR #36 (first run) | `lint, typecheck, unit + Workers tests, builds` ✓; `content builds reproducibly from narrative + approved legacy art` ✓ (committed content == rebuilt content); Playwright e2e job ran 8 ✓ / 1 ✘ / 1 skipped — the ✘ was a fixed-sleep race on the slower CI GPU (result panel not yet drawn after 2.5 s), replaced by polling in the next commit; `deploy.yml` ✓ (staging). `publish-content.yml` and `bootstrap-signing-key.yml` have not been run |
| Skills bootstrap CI | VERIFIED (earlier runs 5 and 7 green; `tools/skills_doctor.py` PASS, 57 skill files) | `docs/SKILLS_MCP_STATUS.md` |
| Security review | VERIFIED | `docs/SECURITY_REVIEW_2026-10-10.md` (5 findings fixed, residual risks listed). `npm audit`: 1 low (esbuild dev-server file read on Windows; dev tooling only) |
| Secret scan of the working tree (private JWK members, PEM blocks, `AIza…`, `cfut_…`, `ghp_…`, `sk-…`) | VERIFIED | no matches; `.env*`, `.cache/`, `.wrangler/` are git-ignored |

Test totals at the last full run: **124 unit/Workers tests** (api 38, game 3, combat 20, content-schema 31, patch 13, shared 14, story 5)
and **9 e2e tests passed, 1 skipped by design** (the one-way "publish a release" scenario runs on the first project only).

## 1b. Deployed staging environment (GitHub Actions run 38081525826 `deploy.yml`, 2026-10-10, all steps green)
| Item | Value | Verified by |
|---|---|---|
| Game (Phaser client + public API) | https://uomd-game-staging.muratcaneksiii.workers.dev | `GET /api/v1/health` → `ok:true`, D1 ok (2 migrations), R2 ok, `current_release:null`; index 200; roster endpoint returns 20 characters from remote D1; security headers present |
| Control Center | https://uomd-admin-staging.muratcaneksiii.workers.dev | `GET /admin/api/health` → `auth_configured:false, signing_configured:false`; every data route answers **503 admin_auth_not_configured** (fails closed — verified with `curl`) |
| Remote D1 `uomd-staging` | 2 migrations, 20 characters, 0 releases, 0 admins | direct SQL read through the Cloudflare API |
| Browser smoke test on the deployed URL | desktop passed (boot, WebGL, T-1 played to victory); phone passed on rerun; the first phone run failed once on an input-timing race in the test helper (fixed: it now waits for the skill panel and polls for the verdict) | `npm run e2e:remote` (`tests/e2e/remote.spec.ts`); the deploy workflow now runs it as job `smoke` |
Remaining on staging: Access application + `ACCESS_AUD`, signing key (workflow ready), first owner, first published release.

## 2. End-to-end evidence (Playwright 1.56.1, Chromium, WebGL via SwiftShader)
Projects: `landscape-desktop` 1280×720 and `phone-landscape` 1200×540 touch (dpr 2). Both play the **real** flow through
pointer/touch input at 1920×1080 reference coordinates:
BOOT → TITLE → BEGIN → dialogue (typewriter, tap to advance) → battle (select skill, confirm target, two manual turns, then Auto at ×2)
→ VICTORY (3 stars, 8 turns) → client posts its action log → **server replays the battle and the hash matches**
(`Server verification ✓ replay matches`) → CONTINUE → post-battle story → Chapters. Console errors, uncaught page exceptions, failed requests and HTTP ≥ 400 responses (except the content-manifest probe, which legitimately 404s when nothing is published) fail the tests.
Desktop additionally: publishes `rel_0002` through the admin API while the client runs, opens the content-updates panel,
the client downloads/verifies/applies it (chapter node "A Road Forgotten" + unit `hollow_pilgrim` that is not in the app build),
the patch survives a reload (IndexedDB), the new battle is played and server-verified, then the device is rolled back to the embedded base.

Screenshots taken by the e2e run (WebP, `docs/evidence/`): `desktop-01-title`, `desktop-02-story`, `desktop-03-battle`, `desktop-05-victory`,
`desktop-06-patch-lab`, `desktop-07-chapters-patched`, `desktop-08-pilgrim-battle` (patch-only enemy), `phone-03-battle` (1200×540 touch),
`admin-desktop-dashboard`, `admin-desktop-patches`. They are test artifacts, not marketing art; the full set plus traces is uploaded by CI (`e2e-evidence`).

## 3. Not done / not verifiable here (do not assume)
- **Staging preview is DEPLOYED and verified (details in §1b).** What is still missing on it: a published content release (needs the admin API, i.e. Access + signing key), so server replay verification answers "release not published" and the game plays its embedded base content.
- Cloudflare Access application + `ACCESS_AUD`, `CONTENT_SIGNING_KEY` Worker secret, first owner — **owner/approval actions**.
- Real-device/Android/WebView testing, Capacitor project, Google sign-in, Play Billing, AdMob/UMP, gacha, shop, mail, accounts, RTDN: **NOT DONE** (outside this milestone).
- Content: only tutorial T-1 (base) and T-2 (patch). Chibi/battle art for 18 of 20 characters and 25 of 27 enemies does not exist; engine effect coverage is 3/20 characters and 9/27 enemies (`COMBAT_RULES.md`).
- No Google paid generation was run (no approved budget). No animation rigs: chibi units use approved key-pose sheets with procedural tween animation.
- Performance: no device profiling; the e2e machine uses software WebGL, so no FPS claims are made.

## 4. Decisions needed from the owner
1. CI token scopes / permission to proceed with staging deploy (exact scopes in `SECRETS_AND_PERMISSIONS.md`).
2. Access policy for the Control Center (who is allowed; recommended: only the owner's identity) and creating the Access application.
3. Legacy Neon/Hyperdrive/Workers decommission (README: D1 only). Not touched.
4. Visual canon: crimson cape on approved chibi sheets vs deep-plum hood on the locked sheet.
5. Gemini/Google media budget before any Veo/Lyria/image batch.
6. Context7 API key.
7. Preferences file mentions Godot 4.7.2; the README and the directive say Phaser 4.2.1 — the project follows the README.

## 5. Exact next implementation step
Once `CLOUDFLARE_API_TOKEN` (scopes above) is present: run workflow *Deploy Cloudflare environment* (`staging`) → it applies D1 migrations + seed, builds the client with `VITE_CONTENT_CHANNEL=staging`, deploys both Workers and health-checks `/api/v1/health`; then set `CONTENT_SIGNING_KEY`, create the Access app and publish `rel_0001` + `rel_0002` with *Publish content release*. After that: grow engine effect coverage (stun/shield/DoT families) and author the next tutorial scene (T-3) as a data patch to exercise the pipeline on the staging channel.
