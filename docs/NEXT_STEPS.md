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
- At R00 delivery, R01–R18 engineering acceptance stayed open; current status is in DEV_TRACKER. Live migrations/seeding, paid media, new permissions and public release are outside R00.

## Current continuation route

| Order | Task | Next action |
| --- | --- | --- |
| 1 | R02 acceptance gaps | Prepare explicit legacy/refund/calendar/native-offer policy and secure/live configuration proof; local recovery slices are complete. |
| 2 | R03 | Close durable generation, concurrent publication and economic release/session authority independently of missing Google access. |
| 3 | R04–R06 | Fix reward/copy races, client durability and combat semantics before chapter/experience acceptance. |
| 4 | R07–R18 | Follow README dependencies; finish noncreative infrastructure, retain genuine external/device/store gates and defer paid/creative assets. |

## Five-hour continuation runner

`python3 tools/resume_infrastructure.py --loop` waits five hours before each attempt and takes scheduler/session locks. A new `codex exec` starts only on a clean tree. After an interrupted owned session, the runner can resume its exact recorded thread only if branch/HEAD/tracked and untracked file fingerprints still match; a foreign edit causes a safe skip. Each attempt has a bounded runtime and terminates its process group before the next interval. Usage/network failure is `RETRY_NEXT_INTERVAL`, not evidence that usage reset. Private status/logs/last message are under ignored `.cache/infrastructure-resume/`. `--dry-run` checks guards without a model call. Inspect status and the live scheduler PID before another copy.

This host has no crontab or running systemd. The local loop survives while its process and environment stay alive; environment suspension/destruction stops it. Codex CLI authentication is configured, but the host's independent Codex model endpoint is currently network-blocked. MCP stdio and local source work remain available. The loop's scheduled state is not proof that a new model session started; actual execution requires provider access and available usage. No network-policy bypass is attempted.

An independent read-only model readiness probe timed out after proxy HTTP 403 for `chatgpt.com` (2026-10-12). The saved environment draft adds only that custom hostname and replaces obsolete Godot/PostgreSQL/Next.js install/start instructions with the current Phaser/D1/pinned-tool setup. Saving is confirmed; applying/publishing is pending in environment settings. Existing package-manager presets and credential requirements are preserved. Recheck actual model access after publication; no automatic continuation PASS is asserted beforehand.

## Latest verified slice — R02-E3

R02-A/B/C/D/E1/E2/E3 are locally verified; README R02 summarizes each and DEV_TRACKER retains dated evidence. Latest: encrypted durable pending/retry work and shared client/RTDN/Cron transaction fences, bounded scheduled recovery, lost consume-marker repair, active-refund observation, earned-window expiry/grace and secure deletion/operator/export behavior. Lint/typecheck and all **480 application/tool tests** passed. Two isolated local Workers, 22 migrations and real scheduled dispatch passed; missing keyring/Access fails closed. No live keys, money changes, migration deployment, Google/device or formal security-audit proof.

Current host Wrangler is unauthenticated; staging/official-reference reads receive proxy 403. Set **BILLING_TOKEN_KEYS** in each existing game Worker secret store and prove exact deployed Cron/Google behavior using approved isolated sandbox data; source Cron config is not a live run. See SECRETS_AND_PERMISSIONS. Local tests use ephemeral test keys only.

Next source work: prepare legacy/claimed/noncurrency/partial/calendar-cadence and native offer-version decisions, then close independent **R03** generation/publication/economic release authority. R02 stays in progress for those acceptance gaps. Continue other authorized infrastructure while external setup waits; defer creative/paid assets.

## Latest verified addition — R02-F

Viewer-only reconciliation snapshots and concrete refund/calendar/native-offer policy alternatives are prepared in docs/billing/POLICY_REVIEW.md. Six new cases, lint/typecheck and all 486 application/tool tests pass; no actual provider proof or financial repair. Next implement independent R03 durable generation/publication/economic release authority, retaining open R02 external/policy acceptance.
