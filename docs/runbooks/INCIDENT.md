# Runbook: incidents (INF-011)

## Signals

| Signal | Where |
|---|---|
| Worker errors, latency, status per route | Cloudflare dashboard → Workers → `unaware-of-my-demise` → Observability. One JSON `request` line per request (`request_id` = `cf-ray`, route pattern, status, `duration_ms`, `source_sha`); `unhandled_error` lines with the same `request_id`. No tokens, bodies or headers are logged. |
| A player's report | the response header `x-request-id` (shown with an error) finds the exact log line. |
| Data lifecycle job | daily 03:17 UTC; one `{"event":"retention", ...}` log line with the counts it removed. |
| Deploys | Actions → Deploy: migrations, deployed SHA, health check. |
| Database | Neon Console → monitoring; `database/verify.sh` for integrity. |
| Release identity | `GET /v1/bootstrap`: `source_sha`, minimum client version, maintenance. |

No alert is wired yet: nobody is paged on errors. Choosing a channel (email, phone) is owner decision D-06.

## Severity

- **SEV1** — players lose or gain currency/items wrongly, accounts mixed up, data exposed, everything down.
- **SEV2** — a feature is broken for everyone (sign-in, gacha, battles), no state damage.
- **SEV3** — degraded or partial; workaround exists.

## First steps

1. **Contain.** SEV1 with state damage: maintenance first (below), then investigate. Never "fix" balances by hand
   in production: every correction goes through a reviewed migration or admin operation that is journaled.
2. **Identify the release.** `GET /v1/bootstrap` → `source_sha`; compare with the last Deploy run.
3. **Roll back** if the newest release is the cause: `ROLLBACK.md`.
4. **Check data**: `database/verify.sh`; if state is wrong, `BACKUP_RESTORE.md` (the 6-hour window matters:
   decide early).
5. **Communicate** to players through the maintenance message; keep it factual.

## Maintenance

`MAINTENANCE_MESSAGE` in `server/wrangler.jsonc`: non-empty → every game route answers `503 MAINTENANCE` with that
message and `/v1/bootstrap` reports it (the client shows it at start). It is a deploy: change it on `main` through a
PR (CI → Deploy), or, in an emergency, edit the variable in the Cloudflare dashboard and commit the same value right
after, because the next deploy from `main` overwrites dashboard values.

## Record (copy into the incident note)

```
Incident: <short title>            Severity: SEV1/2/3
Detected (UTC):                    Resolved (UTC):
Live source_sha at detection:
Impact: who, what, how long; state damage yes/no
Timeline:
Actions: maintenance / rollback (run link, from → to SHA, reason) / restore (point in time, backup branch name)
verify.sh result after recovery:
Root cause:
Follow-ups (issues):
```
