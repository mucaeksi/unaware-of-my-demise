---
name: uomd-monitoring
description: Investigate UOMD staging incidents and extend the Control Center Monitoring page with safe logs, player/economy aggregates, deployment provenance and explicit freshness.
---
# UOMD monitoring

Read README, [monitoring coverage](../../../docs/MONITORING.md), `apps/api/src/monitoring.ts`, `apps/api/src/admin/monitoring.ts` and the corresponding Control Center page. Inspect current source before assuming a past deployment or incident is still current.

For an incident, first verify access to the specific read capability. Record environment, actual request time/timezone, HTTP status, Ray/invocation id, runtime version/tag and recorded result/reason. Distinguish observed facts, historical imports and hypotheses. Local reproduction on main does not prove that main is live. Missing historical reasons stay `not_recorded`; never infer them from HTTP status. Match independent Cloudflare invocation and D1 evidence when available. Honor read-only investigation scope until the owner authorizes changes.

For new coverage:

- Add safe response outcomes or parameterized, bounded read-only aggregates. Preserve Cloudflare Access and viewer/operator RBAC. Monitoring writes are best effort with `waitUntil`; failure must not change payment/reward behavior.
- Never store raw callback URLs, query strings, signatures, custom_data, player ids, purchase/OIDC tokens, authorization headers or stacks in `monitor_events`. Store known outcome/code, route template, timestamp, status, Ray, version and duration only. Do not broaden the allowlist by logging arbitrary exception messages.
- For each source show provenance, timestamp and unavailable/stale state. Poll visible pages every 30 seconds and abort on navigation. Retain the previous snapshot and its timestamp on refresh failure. Show loading/unknown distinctly from zero.
- Player activity is server-observed API activity; wallet stock and ledger inflow/outflow are not retention or real money revenue. The only main currency is `eclipse_token`; upgrade materials are items. Use existing economy simulation rules before balance changes.
- Current ops health runs every 15 minutes and is stale after 30 minutes; successful backups are stale after 36 hours. Runtime version metadata identifies observed deployments, not CI build status. Development artifacts update after the relevant deployment.
- Operational events are retained 30 days/up to 10,000 after cron cleanup. Do not prune immutable financial or audit journals. Game deployment applies new D1 migrations once; admin/ops jobs do not race that migration.

Update docs/MONITORING.md with each real source. Test access denial, bounded aggregates, safe redaction, failure isolation and UI stale/error behavior appropriate to the change. Platform quota data, Android crashes, Google revenue, media jobs and other future sources require authenticated server-side integration before showing real metrics.
