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
| OQ-007 | ~~Reference set confirmation~~ — **RESOLVED 2026-10-03**: owner confirmed; set locked (DEC-0010) | — | — | UOMD_REFERENCE_LOCK |
| OQ-008 | Android application id: LEGACY fixed decision `io.github.mucaeksi.unawareofmydemise` vs active placeholder `com.example.gachaonline` — adopting the LEGACY id unless the owner objects | owner confirm | Play listing | CURRENT_STATE C8 |
| OQ-009 | Merge PR from `claude/framework-bootstrap-setup-ahj0tz` into `main` | owner action | — | DEC-0007 |
| OQ-010 | **Needed for code/content migration:** attach the LEGACY archive as a **GitHub Release asset** of this repo (not committed to git). Easiest: in Google Drive, download the `LEGACY` folder (Drive builds the ZIP; `.secrets/` should be removed from Drive first, see OQ-005), then GitHub → Releases → *Draft a new release* → tag `legacy-import-2026-10` → attach the ZIP(s) → publish (mark as pre-release). Minimum alternative: the single file `LEGACY/.git/objects/pack/pack-8cf633316e4aed8b31fb0e176f784f6bb54d753c.pack` (10.3 MB). Why: the Drive MCP transfers single files up to ~6–7 MB (verified 6.3 MB OK; the 10.3 MB pack broke the connection), and hundreds of small source files would each pass through the model context, where a copy error cannot be detected without a checksum. | external action | DEC-0008 (Godot project + content + tools + server migration) | DRIVE_LEGACY_ACCESS LIMITATIONS |
