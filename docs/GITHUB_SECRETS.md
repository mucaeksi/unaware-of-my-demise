# GitHub Secrets and Variables

Repository: **Settings → Secrets and variables → Actions**.
Never commit secret values. Workflows must skip (not fail open) when an
optional secret is absent.

## Cloudflare (Worker deploy, R2 publish) — see DEC-0003

| Name | Kind | Purpose |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | secret | scoped token: Workers Scripts Edit, Hyperdrive Read, R2 Edit (bucket `unaware-of-my-demise-content` only) |
| `CLOUDFLARE_ACCOUNT_ID` | variable | account id (not secret) |

Worker runtime secrets (e.g. JWT signing key, admin session secret) are set
with `wrangler secret put` / the Cloudflare dashboard — **not** as GitHub
secrets, and never in `wrangler.toml`.

## Neon (migrations, restore drill)

| Name | Kind | Purpose |
|---|---|---|
| `DATABASE_URL` | secret | production Neon connection string. `deploy.yml` applies migrations with it; `restore-drill.yml` dumps production read-only over the direct (non-pooled) host derived from it. Both skip with a warning when it is absent. Never seed or reset production. |
| `STAGING_DATABASE_URL` | secret (environment `staging`) | the staging Neon branch (DEC-0025); `deploy-staging.yml` migrates it with `UOMD_ENVIRONMENT=staging`. Must never be the production URL (the workflow and `migrate.sh` refuse it). |
| `STAGING_GOOGLE_CLIENT_IDS` | variable (optional) | staging sign-in audiences; defaults to `GOOGLE_CLIENT_IDS` |

## Android debug APK (CI job `android`, DEC-0016)

| Name | Kind | Purpose |
|---|---|---|
| `ANDROID_DEBUG_KEYSTORE_BASE64` | secret | base64 of a debug keystore (alias `androiddebugkey`, store/key password `android`). A fixed key keeps the APK's SHA-1 registered with the Android OAuth client; without it CI signs with a throwaway key and device sign-in fails. Not the release/upload key. |
| `GOOGLE_CLIENT_IDS` | variable | the Worker's accepted ID-token audiences (the Web OAuth client id); the same Web client id is `uomd/online/google_server_client_id` in `game/project.godot` |

## Android release (release-android.yml, DEC-0035, owner decision D-13)

| Name | Kind | Purpose |
|---|---|---|
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | secret | `base64 -w0` of the upload keystore (Play App Signing upload key; never the app signing key) |
| `ANDROID_UPLOAD_KEY_ALIAS` | secret | its alias |
| `ANDROID_UPLOAD_KEYSTORE_PASSWORD` | secret | the store password, which must also be the key password (Godot signs with one password) |

Uploading to Play from CI (a service account) is not set up; the AAB is uploaded by hand to a test track.

## Content signing and admin (DEC-0029, DEC-0033)

| Name | Kind | Purpose |
|---|---|---|
| `CONTENT_SIGNING_KEY` | secret | PEM private key that signs content manifests (D-09) |
| `ADMIN_ACCESS_TEAM_DOMAIN`, `ADMIN_ACCESS_AUD` | variables | Cloudflare Access team domain and application audience of the admin Worker (D-11) |
| `ADMIN_OPERATOR_EMAILS` | variable | operators the deploy registers (adds only) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | secret | JSON key of the Google Cloud service account that reads purchases (Play Console: "View financial data", "Manage orders and subscriptions"); `deploy.yml` uploads it as a Worker secret. Without it purchases answer 503 (D-17, DEC-0038) |
| `RTDN_AUDIENCE`, `RTDN_PUSH_SERVICE_ACCOUNT` | variables | audience and service-account e-mail of the Pub/Sub push subscription that delivers Play's developer notifications to `/v1/billing/rtdn` (D-17) |
| `ADMOB_AD_UNIT_IDS` | variable | comma-separated AdMob rewarded ad unit ids whose server-side verification callbacks pay (D-18); the app shows the first one (`/v1/ads/status`). Without it `/v1/ads/ssv` answers 503 and the app offers no ad |
| `ADMOB_APP_ID` | variable | the AdMob app id (`ca-app-pub-…~…`) that `release-android.yml` builds into the app (D-18); unset, builds carry Google's sample id and serve only test ads |

## Gemini

**Not a GitHub or runtime secret.** Gemini is a development-time creative
service used only by Claude Code; its credential lives in the Claude Code
Cloud environment. It must never appear in the Godot project, the Worker,
the admin panel, CI, or Git.

---

History: this file previously instructed storing `GEMINI_API_KEY` for a
VPS backend (starter-template guidance). That contradicted the architecture
and was replaced on 2026-10-03 (see `docs/CURRENT_STATE.md` C4).
