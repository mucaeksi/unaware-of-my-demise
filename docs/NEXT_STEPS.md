# Autonomous infrastructure handoff

Owner instruction updated **2026-10-12**: complete README infrastructure in dependency order without waiting for task selections, update README/evidence after each verified slice, and fast-forward main only after required checks/integration. Defer creative/paid asset generation, then return to it after infrastructure. [README](../README.md) is the master; [DEV_TRACKER.json](DEV_TRACKER.json) holds status/evidence. R00/R01 are complete locally; current implementation is **R02 — finance recovery**, split into bounded slices. This supersedes the earlier choose-one-and-wait workflow for the current assignment.

## Resume safely

1. Read README, AGENTS and the current autonomous assignment. Inspect status/branch/worktrees, fetch main and compare intervening changes. Preserve others' work; use an isolated checkout when necessary.
2. Read the selected task's tracker entry, evidence dates and README acceptance. Reproduce the finding on current source; do not reopen native/T-3/team/boss foundations because old documents call them missing.
3. Complete the selected task and necessary dependencies, run scoped checks, update evidence/status and deliver a reviewable commit. Inspect the exact diff; never blindly commit an entire working tree.
4. Refetch/integrate main before publishing and repeat affected checks. Main pushes may trigger Workers Builds. A successful push is not a verified deployment; inspect actual deployed tags for that claim.
5. At session boundaries record task ID, start/latest revisions, edited files, checks/results, decisions/access, integration, budget reservations and next action. Automatic wake-up requires an actual configured host scheduler; this document does not establish one.

## R00 handoff

- Deliverables: capability/evidence registry in DEV_TRACKER, reconciled BUILD_STATE/INFRA_ROADMAP/GAME_FLOW/QA_ANDROID/MONITORING/NEXT_STEPS and README status pointer.
- Verification: document/link/registry checks and actual admin-data generation/build compatibility. Dated application audit remains historical. The delivery commit contains this record (`git log -1 -- docs/NEXT_STEPS.md`).
- R01–R18 engineering acceptance stays open. Live migrations/seeding, paid media, new permissions and public release are outside R00.

## Proposed next selections

| Order | Task | Concrete first slice |
| --- | --- | --- |
| 1 | R01 — complete locally | Shared material guard and 11 regressions delivered; 417 application/tool tests, lint/typecheck and builds passed. |
| 2 | R02 | Choose an acknowledgement/refund/RTDN recovery slice with crash/replay tests and exact entitlement policy. |
| 3 | R03 | Persist highest patch generation through kill/restart/rollback; then atomic publication and economic admission. |
| 4 | R04 | Resolve zero-cost repeat payout policy and cross-source duplicate grants, after R01/R03. |
| 5 | R06 | Correct Break/Auto, then gear/loans/capability semantics before chapter acceptance. |

Layout comparison (R10) precedes dependent paid art (R15); reservation/ingest guards are R14. Final balance and sound/VO are R16. Required executable mode/menu foundations ship in the first AAB; patches deliver supported data/media.

## External evidence and decisions

Use blocker IDs in DEV_TRACKER. Revalidate existing Google/Play/AdMob configuration before asking to create anything; public IDs and old Console notes do not prove access. Do not replace the owner-held upload or age keys. Actual layout/reward/privacy choices, encrypted recovery and public release remain bounded owner inputs.

The media budget is already approved; retain the active backup bucket. Deploy through Workers Builds, one Worker per build and one migration owner. Never run two E2E stacks against the same ports/state or rebuild mutable content while E2E reads it. Historical Claude workflow IDs, old branch instructions and removed Actions jobs are not executable work orders for this host.

## Five-hour continuation runner

`python3 tools/resume_infrastructure.py --loop` waits five hours before each attempt and takes scheduler/session locks. A new `codex exec` starts only on a clean tree. After an interrupted owned session, the runner can resume its exact recorded thread only if branch/HEAD/tracked and untracked file fingerprints still match; a foreign edit causes a safe skip. Each attempt has a bounded runtime and terminates its process group before the next interval. Usage/network failure is `RETRY_NEXT_INTERVAL`, not evidence that usage reset. Private status/logs/last message are under ignored `.cache/infrastructure-resume/`. `--dry-run` checks guards without a model call. Inspect status and the live scheduler PID before another copy.

This host has no crontab or running systemd. The local loop survives while its process and environment stay alive; environment suspension/destruction stops it. Codex CLI authentication is configured, but the host's independent Codex model endpoint is currently network-blocked. MCP stdio and local source work remain available. The loop's scheduled state is not proof that a new model session started; actual execution requires provider access and available usage. No network-policy bypass is attempted.

An independent read-only model readiness probe timed out after proxy HTTP 403 for `chatgpt.com` (2026-10-12). The saved environment draft adds only that custom hostname and replaces obsolete Godot/PostgreSQL/Next.js install/start instructions with the current Phaser/D1/pinned-tool setup. Saving is confirmed; applying/publishing is pending in environment settings. Existing package-manager presets and credential requirements are preserved. Recheck actual model access after publication; no automatic continuation PASS is asserted beforehand.

## Latest verified slice — R02-A

Existing-order subscription ack retry/provider-marker reconciliation passed two new regressions, all 419 application/tool tests and lint/typecheck. See README R02 and tracker evidence. Continue atomic refund/snapshot and RTDN/entitlement recovery; scheduled encrypted-token retry/deadlines are still open.

## Latest verified slice — R02-B

Atomic original-credit currency refunds passed catalog-edit, database-outage/retry, duplicate-refund and racing-spend tests; all 423 application/tool tests and lint/typecheck passed. No live or legacy financial repair. Continue immutable subscription terms/effective entitlement, RTDN processing leases and encrypted-token scheduled retries. R02 remains in progress.
