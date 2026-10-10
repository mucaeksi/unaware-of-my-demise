# Security review — foundation milestone (2026-10-10)

Method: the `security-audit` project skill (Cloudflare Workers / API / authN-authZ / data / secrets checklist) applied by
reading the code that exists on this branch, then fixing what was found and adding a test for each fix.
Scope: `apps/api` (game + admin Workers), `packages/patch`, `packages/shared/signing`, the `.github/workflows/*`, secrets handling.
Not covered: penetration testing against a deployed environment (none is deployed yet), the legacy Neon/Hyperdrive stack.

## Findings fixed in this milestone
| # | Severity | Finding | Fix | Test |
|---|---|---|---|---|
| S1 | Medium | The admin API accepted the Access cookie (`CF_Authorization`) on state-changing requests from any site: a logged-in operator visiting a hostile page could be made to publish/roll back a release or edit a character (CSRF). | `adminApp.ts`: every non-GET/HEAD/OPTIONS request under `/admin/api/*` must be same-origin (`Sec-Fetch-Site` ∈ {same-origin, none}, `Origin` = own origin). CI service tokens (no browser headers) are unaffected. | `admin.test.ts › cross-site request protection` |
| S2 | Low | Public `GET /api/v1/health` returned raw D1/R2 exception text and the database size when something broke, which discloses table names / internals to anyone. | Error text only when `ENVIRONMENT=dev`; size removed. | `admin.test.ts › public health never leaks internal error text outside dev` |
| S3 | Low | `publish-content.yml` interpolated free-text `workflow_dispatch` inputs (`notes`, `directory`, …) straight into a shell script (classic Actions script-injection pattern; reachable only by users with write access, but needlessly dangerous next to an Access service token). | All inputs now travel through `env:` and are quoted in the script. | workflow YAML parsed; inputs no longer appear inside `run:` |
| S4 | Low | Miniflare/wrangler local state (`.wrangler/`, can contain D1 dumps and R2 objects of a dev run) was not git-ignored. | `.wrangler/` and `*.tsbuildinfo` added to `.gitignore`. | `git status` clean of local state |
| S5 | Info | A pre-signed `content/releases/rel_0002.staging.json` (offline-signed) and its npm script contradicted the model "the Control Center signs, generations are server assigned". | Removed; the only publishing path is the audited admin API. | — |

## Verified controls (with the test or code that proves them)
**Authentication / authorization (Control Center)**
- Cloudflare Access JWT is verified *in the Worker* (RS256, issuer = team domain, audience = AUD tag, expiry, signature via the team JWKS). A direct hit on `*.workers.dev` without a valid token gets 401; the static SPA shell is public but contains no data and no secrets. Tests: wrong audience / issuer / key / expired → 401.
- **Fails closed**: without `ACCESS_TEAM_DOMAIN` + `ACCESS_AUD` every data route returns 503 (`admin_auth_not_configured`). Test present, and confirmed on the **deployed** staging Worker with `curl` (`/admin/api/system` → 503; `/admin/api/health` reports `auth_configured:false`).
- RBAC in D1 (`viewer` < `operator` < `owner`); unknown identities get 403; bootstrap owners (`ADMIN_BOOTSTRAP_OWNERS`) are created once and audited; an owner cannot demote themself (409).
- `ACCESS_JWKS_URL` (test JWKS) is ignored unless `ENVIRONMENT=dev`; JWT rejection reasons are only echoed in dev.
- Service tokens map to `svc:<common_name>` and need an explicit `admin_users` row.

**Public game API**
- Only 5 routes; `/api/*` unknown → JSON 404. No CORS headers are emitted (same-origin only). `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` default on every response.
- `POST /api/v1/battles/verify`: body ≤ 64 KB, strict zod schema, rate limited (Workers rate-limit binding, D1 fixed-window fallback), replay bounded by `MAX_TURNS=300` so CPU per request is bounded; the caller is stored only as a daily salted-by-date SHA-256 prefix (no raw IP).
- Content objects are served only when they belong to the published pointer or its dependency chain (draft/unpublished objects 404 identically to missing ones). Test present.

**Content pipeline / supply chain**
- Releases are **data only**: path allowlist (`SafeAssetPath`: no `..`, absolute paths, backslashes; extensions .json/.webp/.png/.ogg/.mp3/.m4a/.webm/.txt), media-type allowlist on upload, size caps, body SHA-256 must equal the stated hash, closed effect grammar (no scripting op exists).
- Manifests are signed ES256 over canonical JSON by the admin Worker; clients embed only the public keys (`content/keys/trusted_public_keys.json`). Generations are strictly monotonic; rollback and kill switch are *new higher generations*, so a replayed old manifest is rejected by clients. Compat range, `depends_on`, rollout bucket and per-file SHA-256 are checked client-side before any state change; corrupt cached objects trigger automatic rollback to the last good set (13 PatchManager tests).
- Private signing key exists only as the Worker secret `CONTENT_SIGNING_KEY` (never in Git; verified by `git grep` for `"d":` JWK members and by secret scanning — see `BUILD_STATE.md`).

**Data integrity**
- D1 STRICT tables; append-only triggers on `audit_log` and the economy ledger (UPDATE/DELETE raises); `CHECK (balance >= 0)`; idempotency keys on ledger writes; every character edit uses optimistic concurrency and writes an audit row in the same batch (transaction). Tests present (36 Workers tests).

**CI / repository**
- Workflows use `permissions: contents: read`, no `pull_request_target`, no third-party actions beyond `actions/*`; secrets are referenced by name only and the deploy job fails fast with a names-only message when `CLOUDFLARE_API_TOKEN` is absent. No executable third-party hooks were enabled (skills lock verified by `tools/skills_doctor.py`).
- Production deployment is intentionally impossible from these workflows (no `production` environment exists in the wrangler configs) — owner approval is required.

## Open items / residual risk (owner decisions or follow-ups)
1. **Cloudflare Access application for `uomd-admin-*` does not exist yet**, and `ACCESS_AUD` is unset, so the Control Center is in its safe default (503 for all data). Creating the Access app and choosing its allow-list is an access-control change; the owner should approve the policy (recommended: only the owner's email/IdP group, MFA enforced at the IdP).
2. **Rate limiting of the public API on Cloudflare**: the `API_LIMITER` binding must exist in the account's Workers rate-limit namespace; until then the D1 fallback is used (correct but adds a D1 write per verify call). Add edge WAF rate rules before public launch.
3. **Replay verification is advisory** today (it records `battle_audit`); no economy/progression is granted from it yet. When rewards become server-side, grant only from the server-computed result.
4. **Secrets in the legacy stack** (Neon URLs, Play service account, Android keystore) are presumed in GitHub secrets; they were not read, rotated or used. Decommissioning legacy Neon/Hyperdrive is an owner decision (README states D1 exclusivity).
5. **Context7 key** and the skill-lock refresh remain owner actions (see `SKILLS_MCP_STATUS.md`).
6. The admin SPA bundle is publicly fetchable on `*.workers.dev`; put the Worker behind a custom domain + Access (not just `workers.dev`) before sharing the URL.
7. The game build exposes `window.__UOMD__` (game + services) for browser tests. It reveals nothing a client does not already hold, but production builds should strip it behind a build flag before store release.
8. Paid media generation is guarded by `content/budget/media_budget.json` (default $0, owner-approved only; `docs/SECRETS_AND_PERMISSIONS.md`). It cannot see charges made outside the repo: set a budget alert on the Google Cloud project too.
9. Dependency advisories: `npm audit` against the registry reported one low-severity, dev-tooling-only issue (esbuild dev server, Windows). No other software-composition scanner was run.
