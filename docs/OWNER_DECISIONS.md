# Owner decisions to collect

Items the infrastructure roadmap cannot finish without the owner (an account action, a secret, a product or legal
choice). Engineering continues around each one; the full list is presented to the owner in one pass at the end of the
roadmap. Each item says what is needed, why, where it goes, and what already works without it. Answered items move to
the "Answered" table at the end (with the decision record that applied them).

Suggested order for the open items (2026-10-05): D-12 → D-03 → D-09 → D-13 + D-04 → D-11 → D-06 → D-05; D-14 any time.

| ID | Decision / action | Why it is needed | Where it goes | Works without it |
|---|---|---|---|---|
| D-03 | Protect the Neon `production` branch — OQ-006 | prevents accidental reset/delete from the console | Neon console | — |
| D-04 | Before a public release: delete the debug Android OAuth client (its keystore was shared in chat) and register the upload/App Signing SHA-1s | the debug key is not secret | Google Cloud console | internal testing |
| D-05 | Off-site backups beyond Neon's 6-hour history: either a paid Neon plan with longer history (e.g. 7 days) or nightly encrypted `pg_dump`s to a private R2 bucket with a retention period (needs an R2 API token as a secret and a retention choice) | today a mistake noticed after 6 hours cannot be undone (docs/runbooks/BACKUP_RESTORE.md) | Neon billing, or R2 + GitHub secret | 6-hour PITR, monthly restore drill |
| D-06 | Alert channel for production errors (email or phone) | nobody is notified of a 5xx spike or a failed cron today | Cloudflare notifications / Workers observability alerts | logs and dashboards (docs/runbooks/INCIDENT.md) |
| D-09 | Content-signing key (DEC-0029): in Cloud Shell `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out uomd-content-1.key` and `openssl pkey -in uomd-content-1.key -pubout -out uomd-content-1.pem`; put the whole `.key` file content in the GitHub repository secret `CONTENT_SIGNING_KEY` (used by `publish-content.yml` for both channels), keep an offline backup, and send the `.pem` (public, safe to share) to be committed as `game/data/keys/uomd-content-1.pem` | without it no content patch can be trusted or installed | GitHub secret + repository | the app runs with the content it ships |
| D-11 | Admin panel access (docs/ADMIN_PANEL.md): enable Cloudflare Access on the `unaware-of-my-demise-admin` workers.dev host with a policy for the operators' e-mails (MFA if possible), then set the repository variables `ADMIN_ACCESS_TEAM_DOMAIN`, `ADMIN_ACCESS_AUD` and `ADMIN_OPERATOR_EMAILS` | the panel refuses everyone until then | Cloudflare Zero Trust + GitHub variables | admin API answers 503 |
| D-12 | Cloudflare Workers plan: measured CPU per request is above the Free plan's 10 ms on every database route (victory ~51 ms, sign-in up to 39 ms; docs/runbooks/CAPACITY.md). Move to Workers Paid (US$5/month base) before players arrive? | requests over the limit can be cut off (error 1102) as traffic grows | Cloudflare billing | today's single-tester traffic |
| D-13 | Play release path: (1) create the upload keystore in Cloud Shell (`keytool -genkeypair -keystore upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000`, one password for store and key) and keep an offline backup; (2) GitHub secrets `ANDROID_UPLOAD_KEYSTORE_BASE64` (`base64 -w0 upload.jks`), `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEYSTORE_PASSWORD`; (3) Play Console: create the app `io.github.mucaeksi.unawareofmydemise`, enroll in Play App Signing, upload the first AAB from `release-android.yml` to an internal test track, add testers; (4) add the upload and App Signing certificate SHA-1s to the Android OAuth client (D-04) | without it there is no store build and Google sign-in fails on Play-installed copies | Cloud Shell, GitHub secrets, Play Console, Google Cloud | the CI debug APK for internal device tests |
| D-14 | Web deletion page, "without the app" button: in Google Cloud → APIs & Services → Credentials → the **Web** OAuth client (the id in `GOOGLE_CLIENT_IDS`) → Authorized JavaScript origins, add `https://unaware-of-my-demise.muratcaneksiii.workers.dev` | Google's sign-in button refuses origins not listed on the client | Google Cloud console | the page's in-app path and support address (DEC-0036) |
| D-15 | Legal texts for the first-install notices (docs/design/FIRST_LAUNCH_FLOW.md step 5): the Terms of Service, and approval of a Privacy Policy (engineering drafts it from what the system really stores; Play requires one for an app with accounts, purchases and ads) | Play policy; players accept them before the first sign-in | web pages served by the Worker + the notices screen | the game without the notices step |
| D-16 | Deliver the owner's main-theme OGG when ready. Usage is decided: Godot → studio → title/entry. Owner says the file is not ready and asks for later-delivery preparation (2026-10-05) | the main theme is the owner's own and is never substituted or generated | reserved `game/assets/audio/music/bgm_main_theme.ogg`; an assigned `flow.title` can override it | the implemented opening remains silent until delivery; see `narrative/design/STARTUP_AUDIO_V01.md` |

## Answered

| ID | Answer (owner, 2026-10-05) | Applied in |
|---|---|---|
| D-01 | Support address `unawareofmydemise@gmail.com`, for every place that needs an address | DEC-0036; `server/src/web.ts` (`/account/delete`); OQ-016 closed |
| D-02 | There is no `INFRASTRUCTURE_REVIEW.md`; fix the references | DEC-0036; roadmap header; OQ-014 closed |
| D-07 | Staging after the closed test | DEC-0036; roadmap INF-006 DEFERRED |
| D-08 | The narrative team assigns music/voice cues; first the full first-launch → game-entry stretch is designed | DEC-0036; `docs/design/FIRST_LAUNCH_FLOW.md` |
| D-10 | Billing, rewarded ads and social features are all in v1 | DEC-0036; roadmap INF-036/037 TODO |
