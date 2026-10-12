# Control Center monitoring

Source reconciled 2026-10-12 at `0499a6cb109cee3f7de4c9ad951e4e22e25d3983`. The table describes implemented data sources, not a fresh live observation. [DEV_TRACKER](DEV_TRACKER.json) records evidence levels and R17 blockers; [BUILD_STATE](BUILD_STATE.md) defines the evidence contract. Live Cloudflare build settings, tags, MFA and backup/restore were not verified during R00.

The Access-protected **Monitoring** page is the central read-only view. Its `/admin/api/monitoring` endpoint requires at least the viewer role. Browser polling runs every 30 seconds, pauses in hidden tabs, and aborts on navigation. A failed refresh retains the last snapshot with a visible warning and its original timestamp.

| Area | Source | Freshness / meaning |
| --- | --- | --- |
| SSV | Game middleware after the actual response | Every callback; known verifier rejection reason, result, HTTP status, Ray, running version |
| Billing | Purchase verification and RTDN response | Every callback; safe outcome/code only |
| API failures | Game/admin middleware | 4xx/5xx; matched route templates; expected admin 401/403 probes excluded |
| Players | D1 players | Total accounts, new accounts / rolling 24h, active accounts seen by API / rolling 24h, banned accounts |
| Economy | D1 wallets and immutable ledger | Current balances, rolling 24h earned/spent/net and top source families |
| Gacha / ads | Immutable gacha_pulls / ad_rewards | Actual grants/pulls and unique participating players / rolling 24h |
| Purchases | D1 purchases | Total/new purchases, unacknowledged granted purchases and refunds with unrecovered rewards; no revenue estimate |
| Health / backups | Live game service binding + ops_runs | Health cron every 15 minutes; stale after 30 minutes; good backups stale after 36 hours |
| Worker versions | CF_VERSION_METADATA | Admin/current game directly; ops from last scheduled run. Version tag identifies source commit on new deployments. This is observed runtime metadata, not a build-status feed. |
| Development | Built progress.json + live dev_notes | Repository status/evidence update after admin deployment; feedback counts update on polling. generatedAt is build time, not test/deployment/device verification time. Use recorded commit, verifiedAt, result and evidence level. |
| Admin activity | Immutable audit_log | Latest ten actions; full audit page linked |

`monitor_events` stores no raw URL/query, headers, signature, custom_data, player id, purchase token, OIDC token, transaction payload or error stack. It stores only safe route templates and known error/outcome values. Monitoring writes use `waitUntil` and fail independently of reward/payment logic. Operational rows are pruned by the ops cron to 30 days and at most 10,000 events; the table may temporarily exceed that cap between ticks. The financial journals are never pruned by this feature.

The game deployment owns D1 migrations. Admin/ops can deploy first and begin serving the new view once the game migration completes; do not run the same migrations concurrently from three build jobs. All three Workers use the existing staging build pipelines. No Cloudflare API token is stored in the browser or application.

To extend coverage, add a safe response outcome to `src/monitoring.ts` or a read-only aggregate to `src/admin/monitoring.ts`, then update the Monitoring page and this source table. New operational sources should report their timestamp, unavailable/stale state and provenance. Platform quota analytics, Android crash reporting, Google revenue, events scheduler and media generation are not connected yet. Add their authenticated server-side data sources before displaying real metrics.

Imported Cloudflare history uses `cloudflare:<invocation id>` ids, real request timestamps, HTTP status, version and Ray. If the historical invocation had no rejection reason, show `not_recorded`; never infer a reason from its status. Imports are idempotent and pass through the same retention cleanup.

## Verification boundaries and pending operations work

- The current Development UI displays the tracker summaries and roadmap. `tools/build_progress.ts` also carries the registry/evidence fields into `progress.json`; dedicated evidence-detail UI is not claimed by R00.
- Recorded error/callback events do not establish total successful-request traffic, p95/SLO, crash rate or revenue. Token grants are not real-money revenue. Measure/index/bound aggregate queries and preserve unavailable states until authenticated data sources exist (R13/R17).
- Ops health reaches game/admin via service bindings. Admin 401/403 demonstrates the Worker's own JWT check; it bypasses Access edge/MFA. Independent authorized edge/alert-delivery evidence is still required.
- `uomd-db-backups` is an active ops binding. Latest successful backup rows and encrypted objects must be observed before claiming freshness. The retired plaintext probe/drill is not owner-key decryption/restore evidence. Bounded export, restore integrity/RPO/RTO, retention/deletion-on-restore and D1 Time Travel remain R17.
- No new alert destination is inferred. Prepare a concrete test and use an owner-chosen authorized destination before sending messages or claiming delivery.
