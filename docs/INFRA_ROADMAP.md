# Infrastructure status — first-AAB foundations

Source reconciled 2026-10-15 for R06–R17 completion on `main`. [README](../README.md) defines scope/acceptance; [DEV_TRACKER.json](DEV_TRACKER.json) records exact evidence. R00–R17 are source complete and locally verified on `main`; only R18 external physical-device/live-store/live-Cloudflare gates remain. This table feeds Control Center; retain its numeric first column and four columns.

✅ means local source/architecture implementation and tests are complete; 🟡 means external live/device acceptance remains; ❌ means deliberately unconfigured until owner approval. `generatedAt` dates the admin build, not these observations.

| # | Area | Status | Present source / remaining acceptance |
| --- | --- | --- | --- |
| 1 | Repository, build and staging delivery | ✅ | Game/admin/ops configs, 29 D1 migrations, 4 seed files (`characters`, `catalog`, `banners`, `assets`) and one-Worker deploy script (`tools/deploy_staging.sh`) verified locally; Workers Builds deploys on push to `main`. |
| 2 | Signed content patching | ✅ | R03 authority, R08 signed snapshots/effective catalog/finite grammar/0.1.2 capabilities, background download during Tutorial, and `ContentService` stale-patch base guard (`preferBaseFile`) locally verified. |
| 3 | Combat and owned parties | ✅ | 20 heroes, 20 regular enemies, 7 bosses; 2-head SD Chibi 0.72x sprites, 3 wide panoramic tutorial battlefields, multi-layer canvas VFX, Ultimate cut-ins, R06 control/boss Auto, `effect_res`, `element_res`, and multi-wave encounters locally verified. |
| 4 | Story VM and opening | ✅ | R07/R08/R09 + D-22 v0.1.2 opening: Phaser splash + retro chime, ŞovTaym Studios + Main Theme, Tap-to-Start -> Google Play Sign-In -> background patch, 120s 9-shot Prologue, 6 Tutorial LN scenes with reactive character busts, and random-quote Patch Wait / auto client restart locally verified. |
| 5 | Game screens and mobile UX | ✅ | Online Gacha Title, Part I Beginning banner on first post-tutorial restart, Hub, roster, character, team, gear, summon, tasks, mail, shop, modes and account screens; R10 battle layout candidates, `safeArea` insets, 4-tab growth UI and accessibility settings locally verified. |
| 6 | Google identity and account lifecycle | ✅ | Server token/session checks, native Credential Manager, Title-screen Google Play Sign-In gate, R11 `AndroidKeyStore` AES-GCM session plugin (`UomdSecureSessionPlugin`), and 21-table account erasure + deletion-on-restore (`account_deletions`) locally verified. |
| 7 | Progression, save and rewards | ✅ | Save CAS, entry checkpoints, server replay, teams/growth/gear/drops, R01 material guard, R04 repeat/copy/provenance, R05 durable operation recovery, and R09 campaign Continue/stage preview locally verified. |
| 8 | Economy, mail and tasks | ✅ | Single `eclipse_token` ledger, Ration, mailbox, 12-hour/weekly tasks, R12 Sweep/Memory Shards/AFK Patrol/Achievements/Events/Arena/Endless, and R16 chronological variable-fee simulator + 80-token UTC Daily Supplies recovery floor locally verified. |
| 9 | Gacha, banners and inventory | ✅ | Selected catalogs drive gear/gacha and new identities with original recovery, immutable provenance, and R12 excess shard conversion (`memory_dust`). |
| 10 | Play Billing, subscriptions and RTDN | 🟡 | R02-A–F server verification/refund/RTDN/encrypted scheduled work and R11 native store offer disclosure + startup/resume purchase reconciliation locally verified; live Play sandbox/keyring proof remains R18. |
| 11 | AdMob, UMP and SSV | 🟡 | R11 reactive UMP consent state, child/teen non-personalized ad policy, and nonce-bound rewarded ad SSV locally verified; physical Android device ad proof remains R18. |
| 12 | Android shell and signed release | 🟡 | Capacitor project, native plugins, Base AAB v0.1.2 bundle (`content/base` 46 files), and R11 fail-closed release signing/environment/versionCode gates locally verified; physical-device and Play Console AAB acceptance remain R18. |
| 13 | Control Center | ✅ | 13 pages, Access JWT/RBAC/CSRF/audit, catalog, monitoring, D1 `assets.sql` seeding (47 assets), inline visual/audio asset preview, Live Preview scene jump presets (`?preview_scene=`), Base AAB v0.1.2 pipeline status, and R13 composer/diff/MFA gate locally verified. |
| 14 | Media generation and ingest | ✅ | 26 approved art assets (`content/approved_art`) ingested via `tools/ingest_art.ts` with SHA-256 provenance: studio mark, title key art, 9 prologue plates, 2 event CG stills, 3 wide panoramic battlefields, and 6 SD Chibi 4-pose sprite sheets. |
| 15 | Monitoring, backup and recovery | ✅ | R17 bounded snapshot-consistent D1 backup, index-backed monitoring prune/freshness, encrypted restore rehearsal, deletion-on-restore scrub, R2 retention pruning, Access edge probe, and out-of-band R2/webhook alerts locally verified. |
| 16 | Security, privacy and store policy | 🟡 | Auth/Access/RBAC/SSV/RTDN/MFA checks, 21-table deletion/export and store drafts locally verified; owner-supplied privacy domain/contact and live edge audit remain external gates. |
| 17 | Production and public release | ❌ | Deliberately unconfigured until R18 physical-device/Play sandbox acceptance and explicit owner rollout authorization. |

All local engineering packages R00–R17 are complete and verified on `main`; only R18 physical device, live credentials, and public release gates remain.

