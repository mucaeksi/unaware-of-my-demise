# Infrastructure status — first-AAB foundations

Source reviewed 2026-10-12 at `0499a6cb109cee3f7de4c9ad951e4e22e25d3983`. [README](../README.md) defines scope and R00–R18 acceptance; [DEV_TRACKER.json](DEV_TRACKER.json) records evidence and blockers. This table feeds Control Center through `tools/build_progress.ts`; retain its numeric first column and four-column structure.

✅ means the complete stated area is accepted; 🟡 means foundations exist but acceptance is incomplete; ❌ means the area is absent. Symbols summarize implementation, not live/device evidence. `generatedAt` dates the admin build, not these observations.

| # | Area | Status | Present source / remaining acceptance |
| --- | --- | --- | --- |
| 1 | Repository, build and staging delivery | 🟡 | Game/admin/ops configs and one-Worker deploy script exist; Workers Builds is the staging path. R17: verify live commands, filters, gates and source tags; PR/native automation remains incomplete. |
| 2 | Signed content patching | 🟡 | R03-A–C generation, atomic publication and bounded economic revocation locally accepted. R08 catalog/grammar/storage compatibility and live/native evidence remain. |
| 3 | Combat and owned parties | 🟡 | 20 heroes, 20 regular enemies, 7 bosses; server party snapshots and boss presentation exist. R06: Break/Auto, procs, loans and caps; R12: Sweep/AFK and other modes. |
| 4 | Story VM and opening | 🟡 | VM/choices/checkpoint format, nine-shot prologue and three tutorials exist. R07/R09: chapter flow, scene resume, narration visibility/timing and Continue; JA voice/cinematic grammar needs R08/R16. |
| 5 | Game screens and mobile UX | 🟡 | Hub, roster, character, team, gear, summon, tasks, mail, shop and account screens exist. R10/R15: layouts, safe areas, accessibility/locales and approved visual polish. |
| 6 | Google identity and account lifecycle | 🟡 | Server token/session checks and native Credential Manager exist. R11: secure storage, refresh/revocation/recovery, full export/deletion and configured identity acceptance. |
| 7 | Progression, save and rewards | 🟡 | Save CAS, entry checkpoints, server replay, teams/growth/gear/drops exist; R01 material spending locally corrected/tested. R04/R05/R09: repeat/duplicate policies and durable operation/save recovery. |
| 8 | Economy, mail and tasks | 🟡 | Single eclipse_token ledger, Ration, mailbox, 12-hour/weekly tasks and shared grants exist. R02/R04/R12/R16: entitlement races, duplicates, achievements/AFK/Sweep and balance. |
| 9 | Gacha, banners and inventory | 🟡 | Rates/pity/history, idempotent pulls, weapon gear grants and admin editing exist. R04: cross-source duplicates; R08: coherent catalog; R16: numerical feasibility. |
| 10 | Play Billing, subscriptions and RTDN | 🟡 | Server verification/refund/RTDN and Java Billing bridge exist. R02-A–E3 locally verified: durable ack/refund/entitlement/RTDN and encrypted scheduled work. Remaining policy/live keyring/Cron and R11 native offers/restore; R18 physical sandbox proof. |
| 11 | AdMob, UMP and SSV | 🟡 | Native rewarded/UMP and server SSV/cap logic exist, including foreign-unit/test-callback handling. R11/R18: privacy reachability, reward status, audience policy and device evidence. |
| 12 | Android shell and signed release | 🟡 | Capacitor project and Google/Billing/Ads/restart plugins exist; historical AAB work is not absent. R11/R18: signing/environment/versionCode gates and emulator plus physical-device acceptance. |
| 13 | Control Center | 🟡 | 13 pages, Access JWT/RBAC/CSRF/audit, catalog and monitoring exist. R13: narrative/LiveOps/media/release/support workflows and atomic approvals; no invented second reviewer. |
| 14 | Google media pipeline | 🟡 | Budget approved (1000 TL/month, recorded $20, $3/batch, three attempts/asset); image/budget helpers and references exist. R14/R15: reservations, provider capability, ingest/strict-art and pilot. |
| 15 | Monitoring, backup and recovery | 🟡 | Safe events, age-encrypted R2 backup and service-binding health exist. Preserve uomd-db-backups. R17: live evidence, bounded export, owner-key restore, alerts and platform metrics. |
| 16 | Security, privacy and store policy | 🟡 | Auth/Access/RBAC/SSV/RTDN checks, export/delete and store drafts exist. R01–R05/R11/R13/R17/R18: correctness, retention, consent, MFA/source audits and store/device evidence. |
| 17 | Production and public release | ❌ | No production target is configured in the repository; external inventory was not read. Creation/public rollout is gated on owner authorization after R18. Staging or a built AAB is not production acceptance. |

Use the README dependency route rather than the superseded A/B/C scaffolding queue. R00/R01/R03 are locally accepted; R04 is the current source assignment. R02/R03 can be split into independently verifiable tasks; external checks retain explicit evidence limits.
