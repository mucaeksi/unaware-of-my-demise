# Open Questions

Items that need owner input or external action. Each links to its decision
record where applicable. Engineering continues around every item.

| ID | Question / action | Type | Blocks | Ref |
|---|---|---|---|---|
| OQ-000 | LEGACY Drive folder link-sharing (`anyone`, writer) — **CLOSED 2026-10-03: owner accepted the risk** ("kimse erişemez zaten bu dosyalara"); no further reminders | owner decision | — | DRIVE_LEGACY_ACCESS |
| OQ-001 | Confirm production Worker name `unaware-of-my-demise` (recommended) vs `unaware-of-my-demise-api` | owner decision | first Worker deploy | DEC-0001 |
| OQ-002 | Disable Neon Auth on project `sweet-cake-52313810` (console) | external action | nothing immediately (inert) | DEC-0002 |
| OQ-003 | Disconnect orphaned Cloudflare Workers Builds trigger; add GitHub secret `CLOUDFLARE_API_TOKEN` + variable `CLOUDFLARE_ACCOUNT_ID` | external action | automated Worker deploy | DEC-0003 |
| OQ-004 | Repository license for the game (root `LICENSE` is CCGS MIT) | legal | public distribution | DEC-0005 |
| OQ-005 | LEGACY `narrative/.secrets/` API key — **CLOSED 2026-10-03: owner accepted the risk; no further reminders.** Engineering rule unchanged: secret files are never copied into Git (`.secrets/` excluded from every migration batch) | owner decision | — | LEGACY_AUDIT §7 |
| OQ-006 | Protect Neon branch `production` | external action | — | INFRASTRUCTURE_AUDIT §4 |
| OQ-007 | ~~Reference set confirmation~~ — **RESOLVED 2026-10-03**: owner confirmed; set locked (DEC-0010) | — | — | UOMD_REFERENCE_LOCK |
| OQ-008 | Android application id: LEGACY fixed decision `io.github.mucaeksi.unawareofmydemise` vs active placeholder `com.example.gachaonline` — adopting the LEGACY id unless the owner objects | owner confirm | Play listing | CURRENT_STATE C8 |
| OQ-009 | Merge PR from `claude/framework-bootstrap-setup-ahj0tz` into `main` | owner action | — | DEC-0007 |
| OQ-010 | **CLOSED 2026-10-04 (moot).** Owner abandoned the ZIP/Release route; LEGACY files are taken file-by-file through the Drive connector with blob-sha1 verification against the LEGACY git index (BATCH-0002, 456 files). | — | — | DRIVE_LEGACY_ACCESS LIMITATIONS |
