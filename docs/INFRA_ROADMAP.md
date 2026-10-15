# Infrastructure status — first-AAB foundations

Source reconciled 2026-10-15 for R06–R17 completion on `main`. [README](../README.md) defines scope/acceptance; [DEV_TRACKER.json](DEV_TRACKER.json) records exact evidence. R00–R17 are source complete and locally verified on `main`; only R18 external physical-device/live-store/live-Cloudflare gates remain. This table feeds Control Center; retain its numeric first column and four columns.

✅ means local source/architecture implementation and tests are complete; 🟡 means external live/device acceptance remains; ❌ means deliberately unconfigured until owner approval. `generatedAt` dates the admin build, not these observations.

| # | Area | Status | Present source / remaining acceptance |
| --- | --- | --- | --- |
| 1 | Repository, build and staging delivery | ✅ | Game/admin/ops configs, 29 D1 migrations and one-Worker deploy script (`tools/deploy_staging.sh`) verified locally; Workers Builds deploys on push to `main`. |
| 2 | Signed content patching | ✅ | R03 authority and R08 complete signed snapshots/effective catalog/finite grammar/0.1.2 capabilities, runtime readiness, trust/static-root rules and storage/transport/cache bounds locally verified. |
| 3 | Combat and owned parties | ✅ | 20 heroes, 20 regular enemies, 7 bosses; R06 control/boss Auto, supported caps, loans, healing/Focus snapshots, `effect_res`, `element_res`, and multi-wave encounters (`Encounter.waves`) locally verified. |
| 4 | Story VM and opening | ✅ | R07 compiler/story/First Oath/Archive gates, R08 finite presentation grammar, R09 9-shot opening visibility, audio-gesture resume, durable account-scoped checkpoints, post-battle resume and Finish/restart locally verified. |
| 5 | Game screens and mobile UX | ✅ | Hub, roster, character, team, gear, summon, tasks, mail, shop, modes and account screens; R10 battle layout candidates (`afk_faithful`, `current`, `arena_lite`), `safeArea` insets, 4-tab growth UI and accessibility/quality settings locally verified. |
| 6 | Google identity and account lifecycle | ✅ | Server token/session checks, native Credential Manager, R11 `AndroidKeyStore` AES-GCM session plugin (`UomdSecureSessionPlugin`), and 21-table account erasure + deletion-on-restore (`account_deletions`) locally verified. |
| 7 | Progression, save and rewards | ✅ | Save CAS, entry checkpoints, server replay, teams/growth/gear/drops, R01 material guard, R04 repeat/copy/provenance, R05 durable operation recovery, and R09 campaign Continue/stage preview locally verified. |
| 8 | Economy, mail and tasks | ✅ | Single `eclipse_token` ledger, Ration, mailbox, 12-hour/weekly tasks, R12 Sweep/Memory Shards/AFK Patrol/Achievements/Events/Arena/Endless, and R16 chronological variable-fee simulator + 80-token UTC Daily Supplies recovery floor locally verified. |
| 9 | Gacha, banners and inventory | ✅ | Selected catalogs drive gear/gacha and new identities with original recovery, immutable provenance, and R12 excess shard conversion (`memory_dust`). |
| 10 | Play Billing, subscriptions and RTDN | 🟡 | R02-A–F server verification/refund/RTDN/encrypted scheduled work and R11 native store offer disclosure + startup/resume purchase reconciliation locally verified; live Play sandbox/keyring proof remains R18. |
| 11 | AdMob, UMP and SSV | 🟡 | R11 reactive UMP consent state, child/teen non-personalized ad policy, and nonce-bound rewarded ad SSV locally verified; physical Android device ad proof remains R18. |
| 12 | Android shell and signed release | 🟡 | Capacitor project, native plugins, and R11 fail-closed release signing/environment/versionCode gates locally verified; physical-device and Play Console AAB acceptance remain R18. |
| 13 | Control Center | ✅ | 13 pages, Access JWT/RBAC/CSRF/audit, catalog, monitoring, and R13 cumulative mail threshold, CAS, cursor pagination, release composer, R2 asset approval/provenance, release diff, sensitive approvals and MFA gate locally verified. |
| 14 | Media generation and ingest | ✅ | R14 cross-process atomic budget lock, per-call batch reservations, failed/reconcile workflow, deterministic offline ingest, component-first slicer, A31 hygiene, `--strict-art`, and R15 pilot identity/bond/expression contracts locally verified. |
| 15 | Monitoring, backup and recovery | ✅ | R17 bounded snapshot-consistent D1 backup, index-backed monitoring prune/freshness, encrypted restore rehearsal, deletion-on-restore scrub, R2 retention pruning, Access edge probe, and out-of-band R2/webhook alerts locally verified. |
| 16 | Security, privacy and store policy | 🟡 | Auth/Access/RBAC/SSV/RTDN/MFA checks, 21-table deletion/export and store drafts locally verified; owner-supplied privacy domain/contact and live edge audit remain external gates. |
| 17 | Production and public release | ❌ | Deliberately unconfigured until R18 physical-device/Play sandbox acceptance and explicit owner rollout authorization. |

All local engineering packages R00–R17 are complete and verified on `main`; only R18 physical device, live credentials, and public release gates remain.

