# Owner decisions to collect

Items the infrastructure roadmap cannot finish without the owner (an account action, a secret, a product or legal
choice). Engineering continues around each one; the full list is presented to the owner in one pass at the end of the
roadmap. Each item says what is needed, why, where it goes, and what already works without it.

| ID | Decision / action | Why it is needed | Where it goes | Works without it |
|---|---|---|---|---|
| D-01 | Support contact for account-deletion requests made outside the app (email address or form URL) — OQ-016 | Google Play Data safety requires a web link for deletion requests | a public deletion page served by the Worker | in-app deletion (DEC-0022) |
| D-02 | Provide `docs/INFRASTRUCTURE_REVIEW.md` (findings R01–R16) — OQ-014 | the roadmap cites it; traceability | `docs/` | the roadmap itself |
| D-03 | Protect the Neon `production` branch — OQ-006 | prevents accidental reset/delete from the console | Neon console | — |
| D-04 | Before a public release: delete the debug Android OAuth client (its keystore was shared in chat) and register the upload/App Signing SHA-1s | the debug key is not secret | Google Cloud console | internal testing |
| D-05 | Off-site backups beyond Neon's 6-hour history: either a paid Neon plan with longer history (e.g. 7 days) or nightly encrypted `pg_dump`s to a private R2 bucket with a retention period (needs an R2 API token as a secret and a retention choice) | today a mistake noticed after 6 hours cannot be undone (docs/runbooks/BACKUP_RESTORE.md) | Neon billing, or R2 + GitHub secret | 6-hour PITR, monthly restore drill |
| D-06 | Alert channel for production errors (email or phone) | nobody is notified of a 5xx spike or a failed cron today | Cloudflare notifications / Workers observability alerts | logs and dashboards (docs/runbooks/INCIDENT.md) |
