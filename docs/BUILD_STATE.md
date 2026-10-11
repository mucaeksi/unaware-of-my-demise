# Build state (living document — facts only)

Last updated: 2026-10-11 · `main` = `claude/unaware-demise-dev-24ly57` (kept identical; every verified step is pushed to `main`). Read-only archive branches: `archive/godot-era` (25dc0b2, last Godot tree) and `archive/pre-cleanup-2026-10-10` (b3172b1, everything removed afterwards).
Legend: **VERIFIED** = executed in this environment and observed; **LOCAL** = verified only against the local
Miniflare/Workers runtime, not a deployed Cloudflare environment; **NOT DONE** = does not exist yet; **BLOCKED** = needs an owner action.

## 1. What exists and how it was verified
| Area | Result | Evidence |
|---|---|---|
| Monorepo (npm workspaces, TS 5.9 strict) | VERIFIED | `npm run typecheck` → 0 errors in 8 workspaces; `npm run lint` (ESLint 10 flat config) clean |
| Shared primitives (sha256, canonical JSON, semver, ES256 sign/verify, seeded RNG) + media-spend guard + Google media helpers | VERIFIED | `packages/shared` 19 tests (8 primitives, 6 budget guard, 5 media price/request/response) |
| Content schema (closed effect grammar, safe paths, story/encounter/manifest schemas, cross-reference validator) | VERIFIED | `packages/content-schema` 31 tests |
| Deterministic combat engine (narrative `battle_rules`: action gauge, damage formula, element chart, focus, statuses, replay) | VERIFIED | `packages/combat` 20 tests (determinism, replay hash, illegal-action rejection, MAX_TURNS) |
| Story VM (labels, choices, checkpoints, save/resume) | VERIFIED | `packages/story` 5 tests |
| Patch manager (signature, generation monotonicity, compat, depends_on, rollout, resume, per-file SHA-256, atomic state, rollback, corrupt-object auto-rollback) | VERIFIED | `packages/patch` 13 tests |
| Cloudflare Workers API (Hono) on D1 + R2: game API, admin API, Access JWT auth + RBAC, signed releases, battle replay verification, ledger, Google sign-in + sessions, server-side gacha | LOCAL | `apps/api` 52 tests in the Workers runtime (Miniflare D1/R2) incl. 50-way concurrent ledger debit, idempotency, append-only triggers, CSRF guard, Google token verification, atomic gacha pulls (12 identical + 28 simultaneous requests) |
| Gacha / economy engine (canonical rates, pity, 55 % target, Fate Knots, min 4★, exact analysis, simulator) | VERIFIED | `packages/economy` 14 tests; migration `0003_player_core.sql` (not yet applied to remote staging: the next Deploy run does it) |
| Phaser 4.2.1 game (title → story VM → 5v5-capable tactical battle → victory/verification → chapters) | LOCAL | Playwright e2e in real Chromium/WebGL, 2 viewports (see §2); screenshots in `docs/evidence/` |
| Data-only content patching (new chapter node + new enemy unit + story delivered from R2 to the *unchanged* client; rollback to embedded base) | LOCAL | e2e `live data patch` (desktop) + `apps/api/test/content.test.ts` "real patch manager applies the published patch end to end" |
| Control Center v0 (React SPA): dashboard (D1/R2 health, channels, table counts), characters (20 seeded, optimistic concurrency, audit), asset catalog with provenance, patch list/publish/rollback/kill, audit log, user roles | LOCAL | e2e `admin.spec.ts` on both viewports against real D1/R2 (Miniflare) with a test-only Access identity |
| CI workflows | VERIFIED green on PR #36, head `51ef302` | `lint, typecheck, unit + Workers tests, builds` ✓; `content builds reproducibly from narrative + approved legacy art` ✓ (committed content == rebuilt content); Playwright e2e ✓ (9 passed, 1 skipped by design). It took three runs to get there, and each red run was a real timing defect in the *test helpers* on the slower CI GPU, not in the game: (1) fixed 2.5 s sleep before reading the server verdict → polling; (2) the skill-panel wait of 15 s was too tight — measured **15.1 s on the runner vs 2.9 s locally** (software rendering stretches animation time) → 120 s with the duration logged. `deploy.yml` ✓ twice (staging) incl. the browser smoke job (desktop + phone). `publish-content.yml` has not been run (GitHub only allows dispatching a *new* workflow file once it exists on `main`; `deploy.yml` already exists there, so it carries the signing-key job) |
| Skills bootstrap CI | VERIFIED (earlier runs 5 and 7 green; `tools/skills_doctor.py` PASS, now 46 skill files after removing Context7 and the 10 Godot-derived discipline skills) | `docs/SKILLS_MCP_STATUS.md` |
| Security review | VERIFIED | `docs/SECURITY_REVIEW_2026-10-10.md` (5 findings fixed, residual risks listed). `npm audit`: 1 low (esbuild dev-server file read on Windows; dev tooling only) |
| Secret scan of the working tree (private JWK members, PEM blocks, `AIza…`, `cfut_…`, `ghp_…`, `sk-…`) | VERIFIED | no matches; `.env*`, `.cache/`, `.wrangler/` are git-ignored |

Test totals at the last full run (2026-10-11): **263 unit/Workers tests** (api 129, game 3, combat 20, content-schema 31, economy 40, patch 13, shared 22, story 5)
and **11 e2e tests passed, 1 skipped by design** (desktop + phone; account flow now also visits Companion, Errands, Armory) (the one-way "publish a release" scenario runs on the first project only).

## 1b. Deployed staging environment (GitHub Actions run 38081525826 `deploy.yml`, 2026-10-10, all steps green)
| Item | Value | Verified by |
|---|---|---|
| Game (Phaser client + public API) | https://uomd-game-staging.muratcaneksiii.workers.dev | `GET /api/v1/health` → `ok:true`, D1 ok (2 migrations), R2 ok, `current_release:null`; index 200; roster endpoint returns 20 characters from remote D1; security headers present |
| Control Center | https://uomd-admin-staging.muratcaneksiii.workers.dev | Cloudflare Access now fronts it (unauthenticated → **302** to the team login; policy = account members = the owner only). Before Access: `/admin/api/health` → `auth_configured:false, signing_configured:true` (signing key set by the `signing-key` job; private half never printed); every data route answers **503 admin_auth_not_configured** (fails closed — verified with `curl`) |
| Remote D1 `uomd-staging` | 2 migrations, 20 characters, 0 releases, 0 admins | direct SQL read through the Cloudflare API |
| Browser smoke test on the deployed URL | desktop passed (boot, WebGL, T-1 played to victory); phone passed on rerun; the first phone run failed once on an input-timing race in the test helper (fixed: it now waits for the skill panel and polls for the verdict) | `npm run e2e:remote` (`tests/e2e/remote.spec.ts`); the deploy workflow now runs it as job `smoke` |
Remaining on staging: first published release (needs an authenticated publisher: Access service token or an ephemeral CI publisher). Done since: Access application, `ACCESS_AUD`, first owner row, signing key.

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
2. ~~Access policy for the Control Center~~ **Done 2026-10-10 (owner-authorised):** Access application + audience tag + owner row; see `SECRETS_AND_PERMISSIONS.md` §2.
3. ~~Legacy Neon/Hyperdrive/Workers decommission~~ **Done on 2026-10-11 for everything inside Cloudflare** (see `SECRETS_AND_PERMISSIONS.md`). Owner checklist for what lies outside: (a) delete or suspend the Neon project/branches (take a fresh `pg_dump` first only if real player/test data matters — the stored dump is from 2026-10-05); (b) delete the GitHub Actions secrets `DATABASE_URL`, `STAGING_DATABASE_URL`, `R2_BACKUP_ACCESS_KEY_ID`, `R2_BACKUP_SECRET_ACCESS_KEY` and variable `BACKUP_AGE_RECIPIENT`; (c) revoke the R2 backup S3 token in the Cloudflare dashboard; (d) remove any Play RTDN Pub/Sub push subscription that targets `unaware-of-my-demise.muratcaneksiii.workers.dev`; (e) delete R2 bucket `uomd-db-backups` (or let its lifecycle rule expire the single object on ~2026-11-04); (f) account Preferences still say Godot 4.7.2 — change them.
4. Visual canon: crimson cape on approved chibi sheets vs deep-plum hood on the locked sheet.
5. **Google media budget — no approved amount exists anywhere** (README gives the policy but no figure; `content/budget/media_budget.json` is `approved_usd: 0`; Drive and Git history hold none; Billing/Budgets cannot be read from this sandbox, only the Gemini model list was ever checked). Please tell me the amount and per-batch cap (or check AI Studio → Spend and Cloud Billing → Budgets for project `gen-lang-client-0955955681`) and I record it in the budget file; also set a hard cap on Google's side.
7. Preferences file mentions Godot 4.7.2; the README and the directive say Phaser 4.2.1 — the project follows the README.

## 5. Exact next implementation step
Once `CLOUDFLARE_API_TOKEN` (scopes above) is present: run workflow *Deploy Cloudflare environment* (`staging`) → it applies D1 migrations + seed, builds the client with `VITE_CONTENT_CHANNEL=staging`, deploys both Workers and health-checks `/api/v1/health`; then set `CONTENT_SIGNING_KEY`, create the Access app and publish `rel_0001` + `rel_0002` with *Publish content release*. After that: grow engine effect coverage (stun/shield/DoT families) and author the next tutorial scene (T-3) as a data patch to exercise the pipeline on the staging channel.

## 6. Repository state after the 2026-10-11 cleanup
- `main` CI: **green on 85c02f0** (lint/typecheck/129 tests/builds, content reproducibility, Playwright e2e at ×3 battle speed). Earlier `main` runs of the same hour were cancelled by the old concurrency rule; CI now runs per commit.
- Working tree: 0 Godot-extension files; skills 46; `.mcp.json` = Graphify + Chrome DevTools; `narrative/` 40 MB (was 210 MB); `reference/` 10 MB; 814 tracked files. The `.git` pack stays ~920 MB (history is never rewritten).
- Cloudflare: 2 staging Workers, 2 D1, 3 R2 buckets (`uomd-content-dev/staging`, `uomd-db-backups` kept), 1 Access app + 1 shared policy. Legacy stack deleted.
- Google generation: owner-approved **1000 TL/month** (recorded as $20/month, $3/batch, max 3 paid attempts per asset; enforced by `media_budget.json` + guard); tooling ready (`tools/gen_image.ts`, `tools/media_budget.ts`, `reference/`). The Gemini request shape has not been exercised against the live API.
- Known open items (owner): Google budget amount; Neon project + legacy GitHub secrets + R2 backup token; Claude account Preferences still say Godot; visual canon (locked plum hood vs crimson chibi atlas in `content/base`); CI service token if releases should be published from GitHub (otherwise publish through the Access-protected admin UI/API).

