# Open Questions

Items that need owner input or external action. Each links to its decision
record where applicable. Engineering continues around every item.

| ID | Question / action | Type | Blocks | Ref |
|---|---|---|---|---|
| OQ-001 | Confirm production Worker name `unaware-of-my-demise` (recommended) vs `unaware-of-my-demise-api` | owner decision | first Worker deploy | DEC-0001 |
| OQ-002 | Disable Neon Auth on project `sweet-cake-52313810` (console) | external action | nothing immediately (inert) | DEC-0002 |
| OQ-003 | Disconnect orphaned Cloudflare Workers Builds trigger; add GitHub secret `CLOUDFLARE_API_TOKEN` + variable `CLOUDFLARE_ACCOUNT_ID` | external action | automated Worker deploy | DEC-0003 |
| OQ-004 | Repository license for the game (root `LICENSE` is CCGS MIT) | legal | public distribution | DEC-0005 |
| OQ-005 | LEGACY `narrative/.secrets/` exists in Drive — verify/rotate any credentials stored there | security | none (not read) | DRIVE_LEGACY_ACCESS |
| OQ-006 | Protect Neon branch `production` | external action | — | INFRASTRUCTURE_AUDIT §4 |
| OQ-007 | Initial canonical reference set (logo, key art, Fadyme sheet/assets/voice/theme) approval — LEGACY already contains Fadyme sheet previews, voice auditions and a Fadyme theme; owner must say whether any LEGACY item is the approved reference or everything is regenerated | creative approval | locking references | UOMD_REFERENCE_LOCK |
| OQ-008 | Android application id: LEGACY fixed decision `io.github.mucaeksi.unawareofmydemise` vs active placeholder `com.example.gachaonline` — adopting the LEGACY id unless the owner objects | owner confirm | Play listing | CURRENT_STATE C8 |
| OQ-009 | Merge PR from `claude/framework-bootstrap-setup-ahj0tz` into `main` | owner action | — | DEC-0007 |
