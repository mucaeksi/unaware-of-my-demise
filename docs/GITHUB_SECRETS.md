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

## Android debug APK (CI job `android`, DEC-0016)

| Name | Kind | Purpose |
|---|---|---|
| `ANDROID_DEBUG_KEYSTORE_BASE64` | secret | base64 of a debug keystore (alias `androiddebugkey`, store/key password `android`). A fixed key keeps the APK's SHA-1 registered with the Android OAuth client; without it CI signs with a throwaway key and device sign-in fails. Not the release/upload key. |
| `GOOGLE_CLIENT_IDS` | variable | the Worker's accepted ID-token audiences (the Web OAuth client id); the same Web client id is `uomd/online/google_server_client_id` in `game/project.godot` |

## Android / Google Play (later release task)

| Name | Kind |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | secret |
| `ANDROID_KEY_ALIAS` | secret |
| `ANDROID_KEY_PASSWORD` | secret |
| `ANDROID_KEYSTORE_PASSWORD` | secret |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64` | secret |
| `GOOGLE_PLAY_PACKAGE_NAME` | variable |

## Gemini

**Not a GitHub or runtime secret.** Gemini is a development-time creative
service used only by Claude Code; its credential lives in the Claude Code
Cloud environment. It must never appear in the Godot project, the Worker,
the admin panel, CI, or Git.

---

History: this file previously instructed storing `GEMINI_API_KEY` for a
VPS backend (starter-template guidance). That contradicted the architecture
and was replaced on 2026-10-03 (see `docs/CURRENT_STATE.md` C4).
