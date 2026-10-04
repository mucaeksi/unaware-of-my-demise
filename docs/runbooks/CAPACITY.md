# Runbook: capacity and cost budget (INF-038)

What the production Worker actually costs per request, measured, and where the plan limits bite.

## Measured (2026-10-04, production `unaware-of-my-demise`, last 3 days)

Source: Workers Observability invocation events (`$workers.cpuTimeMs`, 200 most recent invocations) and the
GraphQL `workersInvocationsAdaptive` aggregate (154 requests, 0 errors, CPU p50 2.6 ms, p99 46 ms, wall p99 1.8 s).

| Route | Invocations | CPU p50 (ms) | CPU max (ms) | What costs CPU |
|---|---|---|---|---|
| `POST /v1/attempts/{id}/victory` | 2 | 51 | 51 | battle re-simulation (DEC-0013) + reward transaction |
| `POST /v1/auth/google` | 11 | 11 | 39 | Google ID-token signature check (JWKS), account creation |
| `POST /v1/stages/{id}/attempts` | 2 | 23 | 23 | battle setup, frozen inputs |
| `GET /v1/state` | 2 | 20 | 20 | snapshot (REPEATABLE READ, many tables) |
| `GET /healthz` | 9 | 12 | 19 | opening a database connection |
| `POST /v1/story/advance` | 1 | 18 | 18 | |
| `GET /v1/bootstrap` | 103 | 2 | 5 | no database |

Sample sizes are tiny (one tester); repeat after the first closed test with real players.

## Limits that matter

- **Workers Free: 10 ms CPU per request.** Every database route measured above 10 ms, the victory route ~5×.
  No request failed so far, but the limit is documented and requests over it can be cut off (error 1102) as
  traffic grows. **Workers Paid** (30 s CPU per request by default, more requests) removes this; owner decision D-12.
- **Neon Free (`free_v3`)**: 0.25–2 CU autoscaling, 6 h history (D-05), 1 GiB per branch (34 MB used),
  10 branches. Compute suspends when idle: the first request after idle pays a cold start (wall p99 1.8 s).
- **Hyperdrive / R2 / rate limits**: well inside free allowances at current traffic. The API rate limit is 240
  requests/min per IP and 20 sign-ins/min (LEGACY budgets).

## Budget per player session (estimate from the table)

A typical session (bootstrap, sign-in or state, ~10 stage attempts with victories, a few menu mutations) costs on the
order of 1 s of Worker CPU. Re-measure with the query below before sizing a launch.

## How to measure again

Workers Observability → Query: dataset `cloudflare-workers`, filter `$workers.scriptName = unaware-of-my-demise`,
events view; group the invocations by request path and take p50/max of `$workers.cpuTimeMs`. Or the GraphQL
`workersInvocationsAdaptive` quantiles (`cpuTimeP50`, `cpuTimeP99`) for the whole Worker.

## When numbers move

- Victory CPU grows with battle length and content: the engine is deterministic and pure, so it can be profiled with
  the parity fixtures offline (`server/test`), without touching production.
- A route above ~50 % of the plan's CPU limit at p99 is a release blocker for that plan.
