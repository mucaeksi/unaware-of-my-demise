# Secrets and permissions checklist (names only — never paste values into chat or Git)

## What exists (verified 2026-10-10)
| Where | Item | Status |
|---|---|---|
| Cloudflare account `0c942d198668a8b1a8e8ee699651b817` | Workers.dev subdomain `muratcaneksiii`; Zero Trust org `red-sky-901e.cloudflareaccess.com` | present |
| Cloudflare (created by this work) | D1 `uomd-dev` (`0512d420-…`), D1 `uomd-staging` (`687f9735-…`), R2 `uomd-content-dev`, R2 `uomd-content-staging` | created. **staging is deployed** (migrations 2/2, 20 characters seeded, Workers `uomd-game-staging`, `uomd-admin-staging`); dev remote is still empty |
| Cloudflare (legacy, untouched) | Workers `unaware-of-my-demise`, `unaware-of-my-demise-admin`; Hyperdrive → Neon; R2 `unaware-of-my-demise-content`, `uomd-db-backups`; Access app on the legacy admin Worker | present |
| GitHub Actions | `CLOUDFLARE_API_TOKEN` (secret) | **verified by use (2026-10-10, run 38081525826)**: D1 migrations + seed, Worker + static-asset deploys and the health check all succeeded for staging, so the token has at least Workers Scripts/D1/R2 edit on this account. Its exact scope list is not readable from here |
| GitHub Actions (presence not readable) | `CLOUDFLARE_ACCOUNT_ID` (variable, optional), `GOOGLE_PLAY_SERVICE_ACCOUNT`, Android keystore secrets, Neon URLs | presumed from legacy workflows |
| Claude Code cloud environment | Gemini credential injected by the proxy for `*.googleapis.com` | working (model list verified) |

## What this repository's workflows need
### 1. `CLOUDFLARE_API_TOKEN` (GitHub Actions secret, repository level) — **works for staging deploys (verified)**
Verified: it can deploy both Workers, apply D1 migrations and write R2-bound Workers (see above). The legacy token was documented as *Workers Scripts Edit, Hyperdrive Read, R2 Edit (bucket `unaware-of-my-demise-content` only)*.
`.github/workflows/deploy.yml` additionally needs (create in Cloudflare Dashboard → My Profile → API Tokens, scoped to
account `0c942d19…`):
- Account → **Workers Scripts: Edit** (deploy Workers + static assets)
- Account → **D1: Edit** (apply migrations, seed)
- Account → **Workers R2 Storage: Edit** — for buckets `uomd-content-dev` and `uomd-content-staging`
- Account → **Workers KV / Queues**: not needed yet
Add as: GitHub → Settings → Secrets and variables → Actions → *Repository secret* `CLOUDFLARE_API_TOKEN`
(optionally variable `CLOUDFLARE_ACCOUNT_ID`; the workflow defaults to the account above).

### 2. Cloudflare Access for the Control Center
The admin Worker verifies the Access JWT itself (audience + issuer) and **fails closed** until `ACCESS_AUD` is set in
`apps/api/wrangler.admin.jsonc`. Steps: Zero Trust → Access → Applications → add *Self-hosted* app for the Worker
`uomd-admin-staging`, policy "allow: your email / Cloudflare account members" (same pattern as the legacy admin app),
MFA required by your IdP policy; copy the **Application Audience (AUD) tag** into the wrangler var `ACCESS_AUD`.
First admin: add a row to `admin_users` (owner) — see `docs/ARCHITECTURE.md` §Control Center.

### 3. `CONTENT_SIGNING_KEY` (Worker secret on `uomd-admin-<env>`; ES256 private JWK)
**Status: not set yet** (`GET /admin/api/health` on staging reports `signing_configured:false`). An earlier note here claimed it was
already uploaded; that was wrong — the Worker did not exist until the first deploy. The key pair generated in the first session
lives only in that session's scratch space and is **abandoned** (nothing was ever signed with it).
Preferred way, with no human handling of the private key: run the GitHub workflow **Deploy** (`deploy.yml`) for `staging` with the
boolean input `bootstrap_signing_key` ticked (job `signing-key`, runs after the deploy). It generates the pair inside the job, stores the private half only as the Worker
secret (never printed, never uploaded, never in the repository) and prints the **public** key, which must then be committed to
`content/keys/trusted_public_keys.json` (replacing the `uomd-staging-2026-10` entry) before the next game deploy, because clients
trust a manifest signature only if that public key is embedded in the build.
Manual alternative: `npx tsx tools/gen_signing_key.ts --kid <id> --out <dir outside repo>` then
`npx wrangler secret put CONTENT_SIGNING_KEY --env staging -c apps/api/wrangler.admin.jsonc`. Rotate by adding a second `kid`.

### 4. Publishing from CI (optional): Access **service token**
Zero Trust → Access → Service auth → create token, add it to the Access policy, then store as GitHub secrets
`CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` and variables `ADMIN_URL_STAGING` / `ADMIN_URL_DEV`; insert its identity
(`svc:<client id>`) into `admin_users` with role `operator`.

### 5. Google (needed before Android work, not for this milestone)
| Need | Name | Where created |
|---|---|---|
| Google Sign-In (Android + web) | `GOOGLE_CLIENT_IDS` variable (Android + Web OAuth client IDs; the legacy Worker already has one Web client) | Google Cloud Console → APIs & Services → Credentials |
| Play Developer API | `GOOGLE_PLAY_SERVICE_ACCOUNT` (already presumed) + Play Console API access | Play Console → Users and permissions |
| RTDN | `RTDN_AUDIENCE`, `RTDN_PUSH_SERVICE_ACCOUNT`, Pub/Sub topic | Google Cloud Pub/Sub |
| AdMob | `ADMOB_APP_ID`, ad-unit IDs, server-side verification key | AdMob console |
| Paid media generation | **spending guard implemented, budget = $0 until you approve**: `content/budget/media_budget.json` (`approved_usd`, `per_batch_cap_usd`, `approved_by/at`); every generation script must run `npx tsx tools/media_budget.ts reserve …` first and is blocked (exit 1) without an approved, sufficient budget; actual costs are settled and recorded (`packages/shared/src/budget.ts`, 6 tests). Also set a hard quota/budget alert on the Google Cloud project (Billing → Budgets & alerts) — the repo guard cannot see charges made outside it. | owner decision: amount + per-batch cap |

### 6. Context7 (developer tooling)
API key from https://context7.com/dashboard, configured in your local/cloud MCP environment (not committed).

## Verified without exposing values
- Cloudflare OAuth (MCP) can list/create Workers scripts, D1, R2 and read Access apps — **not** a substitute for the CI token.
- `api.cloudflare.com` and `*.workers.dev` are reachable from the cloud sandbox; no `CLOUDFLARE_*` env vars exist there.
