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

## Play / Google identifiers (received 2026-10-11, public)
- Android package name (fixed in Play Console): `io.github.mucaeksi.unawareofmydemise` (deploy default for `PLAY_PACKAGE_NAME`).
- OAuth Web client (used as `GOOGLE_CLIENT_IDS`; its ID token audience is what the Android Credential Manager returns): `604013824221-n7htgfhfs55njs5ie11ulojsk1tnk6da.apps.googleusercontent.com`.
- OAuth Android client (needs the package name above + the upload/App-signing SHA-1 once the keystore exists): `604013824221-e70vq2aq1glagljh81igslm7rmpekm78.apps.googleusercontent.com`.
- Play billing service account (invited in Play Console): `uomd-play-billing@unaware-of-my-demise.iam.gserviceaccount.com`.
- Pub/Sub: push subscription `uomdsub`, pull subscription `play-rtdn-sub` (unused by the game). The push subscription must use the staging RTDN endpoint with OIDC auth (audience = the endpoint URL).

## Android shell (built 2026-10-11)
- `apps/android`: Capacitor 8.5.3 project, package `io.github.mucaeksi.unawareofmydemise`, minSdk 24 / targetSdk 36, landscape, immersive. Web layer = the Phaser client built with `VITE_API_BASE` (staging by default).
- Native bridges (Java, `apps/android/android/app/src/main/java/.../`): `UomdGoogleSignIn` (Credential Manager "Sign in with Google" -> Google ID token, audience = the OAuth **Web** client id), `UomdBilling` (Play Billing 8: products, purchase bound to the player's billing tag, restore), `UomdAds` (UMP consent -> AdMob rewarded with server-side-verification options). JS side: `apps/game/src/platform/native.ts`, `net/store.ts`, `net/identity.ts`. The device never grants anything: the Worker verifies ID tokens, purchase tokens (Play Developer API) and ad rewards (AdMob SSV).
- Debug builds use Google's sample rewarded unit (test ads only); release builds use `ca-app-pub-4258559369390965/3553164322`.
- **Upload keystore (generated 2026-10-11, alias `upload`, PKCS12, valid to 2054):** created once in the Claude sandbox, handed to the owner as a file together with its password (never printed into the chat, never committed, not stored in any bucket). **The owner holds the only copy**: keep it in a password manager. Public fingerprints: SHA-1 `0F:1F:F8:89:4F:D7:AE:A5:1D:C4:7C:FF:43:B5:4D:FC:8B:12:38:6E`, SHA-256 `C7:36:53:D1:18:BD:72:4A:D7:32:59:B8:53:BF:CE:71:BF:85:6D:EF:4B:CF:A1:AE:5E:5D:FB:99:B2:E7:7A:45`. If it is ever lost, Play App Signing allows an upload-key reset through Play Support.
- **Building the AAB:** `apps/android` -> `npm run aab` (needs `ANDROID_HOME`, Java 21, and the env vars `UOMD_KEYSTORE_FILE`, `UOMD_KEYSTORE_PASSWORD`, `UOMD_KEY_ALIAS=upload`, `UOMD_VERSION_CODE` = a number higher than the last upload). It works in the Claude sandbox (SDK installed under /tmp) and in CI. Release builds talk to the staging API by default; production gets its own `UOMD_API_BASE`.
- CI `android.yml` (needs GitHub Actions to be runnable): signs with the GitHub secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (it refuses to create a key), then boots the debug APK on an emulator. 2026-10-11: Actions are blocked by a GitHub billing/spending-limit state on the owner's account, so builds are made in the sandbox and delivered as files.
- Trust note: Play App Signing (default for new apps) keeps the real app-signing key at Google; a leaked upload key can be reset through Play Support.

### Owner steps after the first green build
1. Take the signed `.aab` the assistant sent you (or the `uomd-android` artifact of a green Android build run).
2. Play Console > your app > Testing > Internal testing > Create release > upload the AAB (accept Play App Signing).
3. Google Cloud > Credentials > the **Android** OAuth client: add the package name and the SHA-1 of the **upload key** (from the workflow summary) AND later the SHA-1 of the **app signing key** (Play Console > Setup > App signing).
4. Play Console > Monetize: create the products/subscription whose ids match the Control Center Shop products, then activate them there.
5. Add yourself and testers under Testing > Testers (license testing for purchases).
