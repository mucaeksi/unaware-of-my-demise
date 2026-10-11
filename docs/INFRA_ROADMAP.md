# Infrastructure roadmap — what exists, what is missing (2026-10-11)

Rule agreed with the owner: **all infrastructure first, then design/media production.** Status is measured against the README
"first AAB" foundation list and "Detailed release acceptance". ✅ built and verified · 🟡 partly · ❌ not built · 🔑 needs an owner input.

| # | Area | Status | What exists / what is missing |
|---|---|---|---|
| 1 | Repo, CI, deploy, staging (Workers, D1, R2, Access) | ✅ | CI per commit, staging deploy + browser smoke, Access-protected admin |
| 2 | Content patching (signed manifests, rollback, kill switch) | ✅ | proven end to end locally and in unit tests; **no release published on staging yet** (needs an authenticated publisher) |
| 3 | Combat core (deterministic, replay-verified) | 🟡 | engine covers 3/20 characters, 9/27 enemies; no Sweep/AFK, boss phases, equipment, growth |
| 4 | Story VM + cinematic player | 🟡 | commands/choices/checkpoints work; no voice, subtitles track, skip/replay UI polish, opening cinematic player |
| 5 | Game client scenes | 🟡 | Title, Story, Battle, Chapters only; no roster, team builder, gacha, shop, mail, settings, account, inventory screens |
| 6 | Accounts: Google sign-in + player identity | ❌ 🔑 | tables `players`, `wallets`, `ledger` exist; no sign-in, sessions/tokens, linking, recovery, deletion. Needs Google OAuth client IDs |
| 7 | Cloud save / progression server | ❌ | progress is local only; no server save, conflict handling, anti-tamper |
| 8 | Economy: wallets, ledger, rewards, mail | 🟡 | ledger + idempotency + concurrency tests exist; no reward grants, mail, quests, stamina |
| 9 | Gacha: banners, rates, pity, history | ❌ | nothing yet (server-authoritative, simulation tool for the admin) |
| 10 | Shop + Google Play Billing + subscriptions + RTDN | ❌ 🔑 | needs Play Console app, service account, products; verification logic can be built/tested without them |
| 11 | AdMob rewarded ads + UMP consent + SSV | ❌ 🔑 | needs AdMob app/unit IDs; server verification can be built/tested |
| 12 | Android shell (Capacitor), signing, native plugins | ❌ 🔑 | no Android project; no Android SDK in the cloud sandbox (CI build + emulator needed); keystore from owner |
| 13 | Control Center modules | 🟡 | have: dashboard, characters, assets, patches, audit, users. Missing: players, banners, shop, ads, events/LiveOps, narrative studio, media factory, feature flags, compensation |
| 14 | Media Factory (Google generation) | 🟡 | guard (1000 TL/month, 3 attempts/asset), price table, image CLI, references ready; no jobs/approval UI, no Lyria/Chirp/Veo tools, request shape untested live |
| 15 | Observability, backups, alerts | ❌ | no D1 export/Time Travel rehearsal, no usage alerts, no error tracking |
| 16 | Security & policy | 🟡 | audit done once; missing: privacy/data-deletion flow, consent, rate-limit rules at the edge, store compliance docs |
| 17 | Production environment | ❌ | deliberately absent (needs owner approval) |

## Proposed order (each step = code + tests + CI green + push to main)
- **A. No outside input needed:** (9) gacha engine + server API, (8) rewards/mail/quests tables, (7) cloud save, (6) session/token layer with a pluggable Google verifier, (10)(11) purchase/ad-reward verification logic with fakes, (15) backup/export + alerts, (13) admin modules for these, (5) client screens.
- **B. Needs the owner:** Google OAuth client IDs; Play Console app + service account + product IDs; AdMob app/unit IDs; Android keystore; a CI Access service token (optional).
- **C. Environment-bound:** Android project + emulator/device tests (GitHub-hosted runner with Android SDK).
- **D. After A–C:** media production within the budget, then Part I content as data patches.
