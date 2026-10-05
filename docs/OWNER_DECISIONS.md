# Owner decisions to collect

Items the infrastructure roadmap cannot finish without the owner (an account action, a secret, a product or legal
choice). Engineering continues around each one; the full list is presented to the owner in one pass at the end of the
roadmap. Each item says what is needed, why, where it goes, and what already works without it. Answered items move to
the "Answered" table at the end (with the decision record that applied them).

Open items (2026-10-05, after the owner's answers): D-18 (AdMob account), D-17 (Monetization setup, tier rewards), D-15 (texts drafted by engineering, owner review), D-13 + D-04 (first AAB when the game is ready).

| ID | Decision / action | Why it is needed | Where it goes | Works without it |
|---|---|---|---|---|
| D-13 | Play release path: (1) create the upload keystore in Cloud Shell (`keytool -genkeypair -keystore upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000`, one password for store and key) and keep an offline backup; (2) GitHub secrets `ANDROID_UPLOAD_KEYSTORE_BASE64` (`base64 -w0 upload.jks`), `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEYSTORE_PASSWORD`; (3) Play Console: create the app `io.github.mucaeksi.unawareofmydemise`, enroll in Play App Signing, upload the first AAB from `release-android.yml` to an internal test track, add testers; (4) add the upload and App Signing certificate SHA-1s to the Android OAuth client (D-04) **Progress 2026-10-05:** steps (1)–(3) done (upload keystore + the three GitHub secrets, app created in Play Console); the first AAB waits until the game is ready (owner) — continue from step (3) then. | without it there is no store build and Google sign-in fails on Play-installed copies | Cloud Shell, GitHub secrets, Play Console, Google Cloud | the CI debug APK for internal device tests |
| D-04 | Before a public release: delete the debug Android OAuth client (its keystore was shared in chat) and register the upload/App Signing SHA-1s **Status:** keep the debug client until just before the public release (CI debug APK uses it). | the debug key is not secret | Google Cloud console | internal testing |
| D-17 | Google Play billing for the Eclipse Blessing (DEC-0038), after the app exists in Play Console (D-13): (1) create the subscription product `eclipse_blessing_30d` with a 30-day base plan and choose its price; (2) in Google Cloud create a service account, add it in Play Console → Users and permissions with "View financial data" and "Manage orders and subscriptions", put its JSON key in the GitHub secret `GOOGLE_PLAY_SERVICE_ACCOUNT`; (3) create a Pub/Sub topic, grant `google-play-developer-notifications@system.gserviceaccount.com` the Publisher role, add a push subscription to `https://unaware-of-my-demise.muratcaneksiii.workers.dev/v1/billing/rtdn` with authentication on (a service account and an audience), set GitHub variables `RTDN_AUDIENCE` and `RTDN_PUSH_SERVICE_ACCOUNT`; (4) Play Console → Monetization setup: the topic name; (5) add license testers. Also confirm the refund rule: nothing already paid is taken back **Progress 2026-10-05:** service account, its key secret, Pub/Sub topic and push subscription, RTDN variables done; left: Play Console → the app → Monetize with Play → Monetization setup → RTDN topic (available once the app exists there), license testers. **Owner plan:** three subscriptions (US$5, US$10, US$20) with different rewards — reward design pending; products created after the first AAB upload. | without them every purchase answers 503 and the Blessing cannot be bought | Play Console, Google Cloud, GitHub secret/variables | everything else; the screen shows "not available" |
| D-18 | AdMob for rewarded ads (DEC-0038): (1) create the AdMob account and the Android app, set its app id as GitHub variable `ADMOB_APP_ID`; (2) create a rewarded ad unit with server-side verification callback URL `https://unaware-of-my-demise.muratcaneksiii.workers.dev/v1/ads/ssv`, set its id as GitHub variable `ADMOB_AD_UNIT_IDS`; (3) AdMob → Privacy & messaging: publish the GDPR (and US states) consent message; (4) Play Console Data safety: declare the advertising ID and ads; mark "contains ads" **Owner rules (2026-10-05):** at most 5 rewarded ads per 12 hours; subscribers watch 1 ad and skip; the highest subscription tier gets all ad rewards without watching. AdMob account not opened yet (the site failed with a DNS error; owner retries). **Answered (2026-10-05, DEC-0043):** the ads of a window pay 10, 20, 30, 40 and 50 Eclipse Tokens (150, as 5 × 30); the 15-day free-to-play reference becomes 9,700 tokens / 60 pulls ("60 is good; we tune numbers later"). The subscriber rules wait for the tier design. | the server pays only its own ad units; without them the app offers no ad | AdMob, GitHub variables, Play Console | everything else; no ad button |
| D-15 | Legal texts for the first-install notices (docs/design/FIRST_LAUNCH_FLOW.md step 5): the Terms of Service, and approval of a Privacy Policy (engineering drafts it from what the system really stores; Play requires one for an app with accounts, purchases and ads) **Owner (2026-10-05):** engineering researches and drafts both texts in detail for the owner to review. | Play policy; players accept them before the first sign-in | web pages served by the Worker + the notices screen | the game without the notices step |

## Deferred by the owner

| ID | Decision | Until |
|---|---|---|
| D-03 | Neon `production` branch protection needs a paid Neon plan | the game is fully released (owner, 2026-10-05) |
| D-12 | Cloudflare Workers Paid | the game is released on Play as an AAB and the owner has seen it; Free plan until then (owner, 2026-10-05) |

## Answered

| ID | Answer (owner, 2026-10-05) | Applied in |
|---|---|---|
| D-01 | Support address `unawareofmydemise@gmail.com`, for every place that needs an address | DEC-0036; `server/src/web.ts` (`/account/delete`); OQ-016 closed |
| D-02 | There is no `INFRASTRUCTURE_REVIEW.md`; fix the references | DEC-0036; roadmap header; OQ-014 closed |
| D-07 | Staging after the closed test | DEC-0036; roadmap INF-006 DEFERRED |
| D-08 | The narrative team assigns music/voice cues; first the full first-launch → game-entry stretch is designed | DEC-0036; `docs/design/FIRST_LAUNCH_FLOW.md` |
| D-10 | Billing, rewarded ads and social features are all in v1 | DEC-0036; roadmap INF-036/037 TODO |
| D-05 | Neon stays on the free plan; engineering's recommendation accepted: nightly `pg_dump` encrypted with `age` to the owner's key, private R2 bucket `uomd-db-backups`, 30-day lifecycle rule (bucket, token secrets and `BACKUP_AGE_RECIPIENT` set by the owner) | DEC-0042; `.github/workflows/backup.yml`; BACKUP_RESTORE runbook |
| D-06 | Alerts by e-mail to `unawareofmydemise@gmail.com` (and that address wherever one fits) | DEC-0042; `.github/workflows/monitor.yml`; INCIDENT runbook |
| D-09 | Content-signing key `uomd-content-1` (RSA 3072) generated by the owner; private key in `CONTENT_SIGNING_KEY` + offline backup | DEC-0042; `game/data/keys/uomd-content-1.pem` |
| D-11 | Cloudflare Access on the admin Worker, operators registered; the panel must stay well organised and let the owner make the changes they need | DEC-0042; admin Worker (Access answers 302 to anonymous requests) |
| D-14 | Worker origin added to the Web OAuth client | DEC-0042; `/account/delete` |
| D-16 | All design/creative work (main theme included) belongs to the other team; this engineering track owns game infrastructure and gameplay only | DEC-0042 |
| D-19 | Launch in English only; other languages later through content patches | DEC-0042; roadmap INF-025 |
