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

Alerts (owner decision D-06): `.github/workflows/monitor.yml` fails, and GitHub e-mails the owner
(unawareofmydemise@gmail.com), when:

- the game Worker's `/v1/bootstrap` does not answer 200 twice a minute apart (checked every 15 minutes);
- the admin Worker answers a server error or nothing (every 15 minutes);
- `/healthz` (database through Hyperdrive) does not answer 200 (every 3 hours: each check wakes Neon's free compute);
- the daily retention cron left work undone for two days (every 3 hours, read-only query).

Maintenance is reported in the run summary, not as a failure. Delivery depends on the owner's GitHub notification
settings: Settings → Notifications → Actions, e-mail on, failed workflows only. The nightly backup
(`backup.yml`) and the monthly restore drill alert the same way when they fail.

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

First choice, no deploy (DEC-0040): admin panel → Service → "Maintenance and minimum app version". Write the message
players should see, a reason, Apply: within 30 seconds every game route answers `503 MAINTENANCE` with that message
and `/v1/bootstrap` reports it (the client shows it at start). End it the same way with an empty message. The same
form raises the minimum app versionCode (an outdated app is told to update); it cannot lower it below the deploy's.
Every change is audited (`release.set_control`). Needs the operator role (and Cloudflare Access, D-11).

Fallback (the panel unreachable, or Access not set up yet): `MAINTENANCE_MESSAGE` in `server/wrangler.jsonc`. It is a
deploy: change it on `main` through a PR (CI → Deploy), or, in an emergency, edit the variable in the Cloudflare
dashboard and commit the same value right after, because the next deploy from `main` overwrites dashboard values. A
panel message, when set, wins over the variable; clear it in the panel too.

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
