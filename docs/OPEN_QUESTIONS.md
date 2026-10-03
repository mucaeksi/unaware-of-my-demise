# Open Questions

Items that need owner input or external action. Each links to its decision
record where applicable. Engineering continues around every item.

| ID | Question / action | Type | Blocks | Ref |
|---|---|---|---|---|
| OQ-000 | **URGENT:** the LEGACY Drive folder `1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy` is shared as `anyone with the link` = **writer**. Anyone holding the link (it is written in this repo's docs) can edit or delete the archive and read `narrative/.secrets/`. Change link sharing to *Restricted* (or at most *Viewer*); Claude's connector access uses the owner account and is unaffected | security (CRITICAL) | none | DRIVE_LEGACY_ACCESS |
| OQ-001 | Confirm production Worker name `unaware-of-my-demise` (recommended) vs `unaware-of-my-demise-api` | owner decision | first Worker deploy | DEC-0001 |
| OQ-002 | Disable Neon Auth on project `sweet-cake-52313810` (console) | external action | nothing immediately (inert) | DEC-0002 |
| OQ-003 | Disconnect orphaned Cloudflare Workers Builds trigger; add GitHub secret `CLOUDFLARE_API_TOKEN` + variable `CLOUDFLARE_ACCOUNT_ID` | external action | automated Worker deploy | DEC-0003 |
| OQ-004 | Repository license for the game (root `LICENSE` is CCGS MIT) | legal | public distribution | DEC-0005 |
| OQ-005 | LEGACY `narrative/.secrets/` exists in Drive and the LEGACY pipeline code names `narrative/.secrets/google_api.env` as the Google API key file → **rotate that Google API key and delete the file from Drive** | security (HIGH) | none (not read) | LEGACY_AUDIT §7 |
| OQ-006 | Protect Neon branch `production` | external action | — | INFRASTRUCTURE_AUDIT §4 |
| OQ-007 | Confirm that the LEGACY owner-approved set (R01 logo, R02 key art, R03 Fadyme sheet r2, R04–R17 Fadyme assets, voice Sulafat, R18 theme — all approved 2026-09-30) is the canonical reference set to lock in this repo | creative approval | locking references, roster generation | DEC-0010, LEGACY_AUDIT §4 |
| OQ-008 | Android application id: LEGACY fixed decision `io.github.mucaeksi.unawareofmydemise` vs active placeholder `com.example.gachaonline` — adopting the LEGACY id unless the owner objects | owner confirm | Play listing | CURRENT_STATE C8 |
| OQ-009 | Merge PR from `claude/framework-bootstrap-setup-ahj0tz` into `main` | owner action | — | DEC-0007 |
