# AAB process: how the assistant gets access without a password (names only, never values)

**Why not "log in as the owner":** Google accounts that own a Play developer account / AdMob / billing are protected by 2-step
verification and device checks; a login from a datacenter browser is blocked or flagged, and an automated login against Play
Console risks locking the account that holds the store listing. A password in any secret store is also a standing risk. The
official route is a **service account** (robot identity) with only the permissions the work needs, whose key lives in a secret
store and can be revoked in one click. Passwords are never requested, pasted or stored.

## What the assistant can drive once the identities exist
| System | Identity | What the assistant does with it |
|---|---|---|
| Cloudflare | already connected (MCP + `CLOUDFLARE_API_TOKEN`) | everything: Workers, D1, R2, Access, deploys |
| Google Cloud project | service account `uomd-ci@<project>` (JSON key) | enable APIs, Pub/Sub topic + push subscription for RTDN, OAuth consent screen status, budgets/alerts read |
| Google Play Console | the same service account, invited in Play Console (Users and permissions) | read/verify purchases (already coded), create/update in-app products and subscriptions (monetization API), upload AAB to internal track, read reviews/vitals |
| AdMob | OAuth user consent (AdMob API has no service accounts); read-only reports, ad-unit creation only if Google grants the beta | reports; ad units are created by the owner in the console (3 clicks) and their ids put into `ADMOB_AD_UNIT_IDS` |
| Gemini / AI Studio key | injected by the sandbox proxy for `*.googleapis.com` | media generation within the budget guard |

## Owner steps (one-time, about 30 minutes, nothing secret is typed into a chat)
1. **Google Cloud** (the project that will own sign-in and RTDN): create a project (or reuse one) and enable *Google Play Android
   Developer API*, *Cloud Pub/Sub*, *Identity Toolkit is not needed*. Create a **service account** `uomd-ci`; create a JSON key.
2. **Play Console**: *Users and permissions → Invite new users* → the service account e-mail. Grant for the app: *View app information*,
   *Manage orders and subscriptions*, *Manage store presence*, *Release to production/testing tracks*. Accept the invitation.
   (Create the app entry first: name, package id `app.uomd...` to be decided together, default language.)
3. **OAuth clients** (Google Cloud → APIs & Services → Credentials): one *Android* client (package id + the upload/App-signing
   SHA-1) and one *Web* client. Only their **client IDs** are needed (they are public identifiers, not secrets).
4. **AdMob**: create the app, one *Rewarded* ad unit, enable *server-side verification*. Send the **IDs** (public identifiers).
5. **Android upload keystore**: generated in CI by a workflow I write (key never printed); you only enable Play App Signing.

## Where the secrets go (never into chat)
- **Claude Code cloud environment** → *Edit environment* → network secrets / environment variables: `GCP_SERVICE_ACCOUNT_JSON`
  (the key file content). A new session picks it up. This is how the assistant authenticates to Google APIs.
- **GitHub → Settings → Secrets and variables → Actions** (the owner enters them; the assistant cannot read or set Actions secrets):
  `GOOGLE_PLAY_SERVICE_ACCOUNT` (same JSON, for CI uploads), `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`,
  variables `GOOGLE_CLIENT_IDS`, `ADMOB_AD_UNIT_IDS`, `PLAY_PACKAGE_NAME`, `RTDN_AUDIENCE`, `RTDN_PUSH_SERVICE_ACCOUNT`.
- **Cloudflare Worker secrets**: `GOOGLE_PLAY_SERVICE_ACCOUNT` is set on the game Worker by the deploy workflow from the GitHub secret.

## Control Center login with your Google e-mail
The Control Center sits behind Cloudflare Access. To sign in with a Google account, give me **only the e-mail address**; I add it
to the Access policy (One-time PIN to that mailbox works immediately; "Sign in with Google" needs the Web OAuth client from step 3
configured as an identity provider). No password is involved at any point.

## AdMob (received 2026-10-11, public identifiers)
- Publisher: `pub-4258559369390965`; app: `ca-app-pub-4258559369390965~2559970251`; rewarded unit: `ca-app-pub-4258559369390965/3553164322` (cap: 5 per 12 h, same rule on the server).
- **Server-side verification callback URL to enter in AdMob** (rewarded unit -> server-side verification): staging
  `https://uomd-game-staging.muratcaneksiii.workers.dev/api/v1/ads/ssv` (production gets its own URL later). AdMob's callback sends the numeric unit id; the Worker accepts either form.
- **app-ads.txt** (needed on the developer website listed in the Play listing): `google.com, pub-4258559369390965, DIRECT, f08c47fec0942fa0`.
- During development the Android build must use Google's **test ad unit ids**, never the live unit (live ads on test devices can get the account flagged for invalid traffic).
