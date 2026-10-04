# Open Questions

Items that need owner input or external action. Each links to its decision
record where applicable. Engineering continues around every item.

| ID | Question / action | Type | Blocks | Ref |
|---|---|---|---|---|
| OQ-000 | LEGACY Drive folder link-sharing (`anyone`, writer) — **CLOSED 2026-10-03: owner accepted the risk** ("kimse erişemez zaten bu dosyalara"); no further reminders | owner decision | — | DRIVE_LEGACY_ACCESS |
| OQ-001 | ~~Worker name~~ — **CLOSED 2026-10-04**: `unaware-of-my-demise` (DEC-0001). Confirm production Worker name `unaware-of-my-demise` (recommended) vs `unaware-of-my-demise-api` | owner decision | first Worker deploy | DEC-0001 |
| OQ-002 | ~~Neon Auth~~ — **CLOSED 2026-10-04**: disabled with owner permission (DEC-0002). Disable Neon Auth on project `sweet-cake-52313810` (console) | external action | nothing immediately (inert) | DEC-0002 |
| OQ-003 | ~~Deploy credentials~~ — **CLOSED 2026-10-04**: owner added secret `CLOUDFLARE_API_TOKEN` (new scoped token) and variable `CLOUDFLARE_ACCOUNT_ID`; `.github/workflows/deploy.yml` deploys from `main` | — | — | DEC-0003 |
| OQ-004 | ~~License~~ — **CLOSED 2026-10-04**: proprietary root `LICENSE`, CCGS MIT under `THIRD_PARTY_LICENSES/` (DEC-0005). Repository license for the game (root `LICENSE` is CCGS MIT) | legal | public distribution | DEC-0005 |
| OQ-005 | LEGACY `narrative/.secrets/` API key — **CLOSED 2026-10-03: owner accepted the risk; no further reminders.** Engineering rule unchanged: secret files are never copied into Git (`.secrets/` excluded from every migration batch) | owner decision | — | LEGACY_AUDIT §7 |
| OQ-006 | Protect Neon branch `production` | external action | — | INFRASTRUCTURE_AUDIT §4 |
| OQ-007 | ~~Reference set confirmation~~ — **RESOLVED 2026-10-03**: owner confirmed; set locked (DEC-0010) | — | — | UOMD_REFERENCE_LOCK |
| OQ-008 | ~~App id~~ — **CLOSED 2026-10-04**: `io.github.mucaeksi.unawareofmydemise` (DEC-0008). Android application id: LEGACY fixed decision `io.github.mucaeksi.unawareofmydemise` vs active placeholder `com.example.gachaonline` — adopting the LEGACY id unless the owner objects | owner confirm | Play listing | CURRENT_STATE C8 |
| OQ-009 | Merge PR from `claude/framework-bootstrap-setup-ahj0tz` into `main` | owner action | — | DEC-0007 |
| OQ-010 | **CLOSED 2026-10-04 (moot).** Owner abandoned the ZIP/Release route; LEGACY files are taken file-by-file through the Drive connector with blob-sha1 verification against the LEGACY git index (BATCH-0002, 456 files). | — | — | DRIVE_LEGACY_ACCESS LIMITATIONS |
| OQ-011 | ~~Ration spending~~ — **CLOSED 2026-10-04**: owner set cap 100; spend on verified victory, 1 unit / 300 s server-side regeneration (DEC-0014) | — | — | DEC-0014 |
| OQ-012 | ~~Production migrations~~ — **CLOSED 2026-10-04**: owner added secret `DATABASE_URL`; the deploy workflow applies pending migrations before each Worker deploy | — | — | DEC-0003 |
| OQ-013 | ~~Public endpoint~~ — **CLOSED 2026-10-04**: workers.dev (owner); a custom-domain route can replace it later | — | — | DEC-0003 |
| OQ-014 | `docs/INFRASTRUCTURE_REVIEW.md` (findings R01–R16 cited by the infrastructure roadmap) is not in the repository; provide it so the R-findings can be traced | owner action | traceability of `docs/INFRASTRUCTURE_ROADMAP.md` only | INFRASTRUCTURE_ROADMAP |
| OQ-015 | ~~Device sign-in test~~ — **CLOSED 2026-10-04**: owner installed the CI debug APK, signed in with Google and played. Still open inside this row: remove the debug Android OAuth client before a public release. Device test of Google sign-in: install the CI debug APK (artifact `uomd-debug-apk`) and sign in with a Google account; report any error code (`[10]`/DEVELOPER_ERROR = package or SHA-1 mismatch on the Android OAuth client). Before a public release, remove the debug Android OAuth client (its keystore was shared in chat) | owner action | INF-017 VERIFIED | DEC-0016 |
