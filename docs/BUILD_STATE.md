# Build state — evidence and current gaps

Reconciled **2026-10-12** against source commit `0499a6cb109cee3f7de4c9ad951e4e22e25d3983`. This R00 change updates documentation and development data. [README](../README.md) remains the engineering authority; [DEV_TRACKER.json](DEV_TRACKER.json) records capabilities, evidence and R00–R18 status. Previous versions remain in Git history.

## Evidence contract

Implementation state and acceptance evidence are separate. A capability may have working foundations and unresolved correctness or release gates.

| Level | Meaning |
| --- | --- |
| BUILT | Source/configuration exists and its stated scope was inspected. This is not a passing runtime test. |
| LOCAL_TESTED | The specified checks ran locally on the recorded revision; no staging or Android implication. |
| STAGING_VERIFIED | Deployed version and behavior were observed; requires deployment/version evidence. |
| DEVICE_VERIFIED | The case ran on the recorded device and signed binary; requires device/build identifiers. |
| OWNER_BLOCKED | A specific owner decision, private key or release action is needed; independent engineering may continue. |
| UNVERIFIED | Required evidence is absent or has not been refreshed. |

The registry separates `implementationStatus`, `taskStatus`, `evidenceIds`, `sourcePaths` and `blockerIds`. Evidence records carry `commit`, `verifiedAt`, scope/result and test/build/deployment/device identifiers; unavailable identifiers remain null. `verifiedAt` dates that evidence, not blanket feature approval. Historical dates retain their known precision. Admin `generatedAt` is only snapshot generation time.

Update only affected capabilities, attach scoped evidence, and link the existing README acceptance section. When checks precede delivery, record the base revision and working-tree scope; the enclosing Git commit identifies the documentation change. Do not stamp old tests with a new date or turn an unavailable external check into a source failure.

## Current source inventory

| Area | Present in source | Remaining work |
| --- | --- | --- |
| Android and identity | Capacitor shell; Java Google Credential Manager, Billing, AdMob/UMP and restart plugins; server verification/sessions. | R11 lifecycle/privacy/storage; R18 physical-device/Play acceptance. Native bridges are not missing. |
| Opening | Nine-shot prologue; embedded T-1/T-2/T-3 and six dialogue scenes; staged patch/PatchBar; entry API, Finish/restart. | R09 visibility/timing, checkpoint/Continue and durable Finish; approved media/device proof. |
| Combat and progression | Deterministic 5v5-capable engine, 20 heroes/20 regular enemies/7 bosses, owned-party snapshots, team/gear screens, boss presentation; R01 material guard locally corrected. | R06 control/boss Auto, supported caps, owned/virtual loans and healing/Focus snapshots are locally tested; undefined signatures are explicitly rejected. Resistance/broader conformance and R12 modes remain. Roster coverage is not semantic correctness. |
| Economy | Wallet/ledger, gacha/pity/history, mail/tasks, character/gear progression, server battle rewards; shared atomic material spending. | R04-A/B/C copies, future provenance and paid-only repeat eligibility locally accepted; R02 policy/live/native and R05 retries remain; R16 numeric tuning. |
| Purchases and refunds | R02-A–E3 locally verified: ack/refund/immutable fulfillment and entitlement, durable RTDN/transport, encrypted pending/retry work and shared fences/Cron, earned-mail grace/deletion guards. | Live keyring/Cron/RTDN settings, backlog capacity, legacy/claimed/noncurrency/partial/calendar policy and native offer binding; real Play/device proof. |
| Narrative and patches | Story VM, signed manifests, hash checks, staging/rollback and campaign compiler. | R03-A/B/C client generation/storage/publication and economic authority locally accepted; R07-A content identity/prerequisite validation is locally tested; full story compilation/reference coverage and R08 catalog/grammar/storage remain. |
| Control Center | 13 pages, Access JWT/RBAC/CSRF/audit, monitoring and generated development data. | R13 operational workflows; current edge/MFA/version evidence is unverified. |
| Operations | Game/admin/ops configs, scheduled age-encrypted export, reconciliation and service-binding health. | R17 bounded export, owner-key encrypted restore, independent alerts/capacity. |
| Media | Approved budget, reference/spec packages and generation/budget helpers. | R14 reservation/ingest/strict-art; R15 pilot; R16 final sound/VO. Tooling presence is not approved production art. |

Source paths and requirements are in the registry; [INFRA_ROADMAP](INFRA_ROADMAP.md) is the concise admin-facing view.

## Recorded verification

| Record | Revision/date | Result and limit |
| --- | --- | --- |
| Transfer and R07-A | `ee3e7bab` transfer / `539c1594` + R07-A working tree, 2026-10-13 | Original four commits delivered unchanged to main. Shared ID/prerequisite guards: 629 application/tool tests, lint/typecheck, builds/campaign and 5 real local-Worker browser cases pass; phone campaign intentionally skipped. 25 local migrations. Transfer also revalidated 33 Python tests and 46 adapters. No deployed/native evidence. |
| Repository audit | `184b8d2963eac292162873e07db49bdd04b82f06`, 2026-10-12 | Historical local lint/typecheck/build PASS; 406 existing tests passed, 46 skill adapters and 10 Python tests passed; 31 rebuilt base files matched. Details remain in README §4. Not rerun for R00. |
| Audit regressions | Same audit revision/date | Missing-material protection failed; two combat and three patch negative cases failed. Newer signed rollback positive case passed. Engineering findings remain open. |
| Audit browser/harness | Same audit revision/date | Isolated renderer boot passed; second-shot narration alpha 0 observed. Full entry/API harness timed out at admin health. Neither proves complete entry or device acceptance. |
| R00 source reconciliation | `0499a6cb109cee3f7de4c9ad951e4e22e25d3983`, 2026-10-12 | Source/configuration inspected and records refreshed. Application source matches the audit baseline; documentation changed. |
| R00 delivery checks | Documentation working tree based on the revision above | Registry records document/link/registry/admin-data build checks. No fresh application-suite, deployed-Worker, device or encrypted-restore PASS is asserted. |

Historical Actions runs, browser screenshots and staging/backup reports remain historical; they do not establish current migration count, publication state, gates, MFA or owner-key encrypted recovery. Old plaintext-probe code is removed; its earlier drill does not close encrypted recovery.

## Deployment and resource facts

- Staging uses **Cloudflare Workers Builds**, not the removed GitHub Actions workflows. [deploy_staging.sh](../tools/deploy_staging.sh) targets game/admin/ops: one build deploys one Worker; only game applies migrations/seeds.
- Verify live build commands/path filters/test gates and source tags before claiming current staging results. No live configuration was read in R00. Main pushes may trigger existing pipelines.
- Ops actively binds **uomd-db-backups**. Preserve it; obsolete decommission instructions are superseded. Configured cron schedules are 03:17 UTC daily and every 15 minutes, with catch-up logic; configuration is not latest-run success.
- Admin service-binding 401/403 checks verify the Worker's own JWT rejection, not the public Access edge or MFA.
- Approved Google media budget: **1000 TL/month**, recorded **$20/month**, **$3/batch**, **three paid attempts per asset**. See [media_budget.json](../content/budget/media_budget.json); recheck exchange/provider prices and finish R14 guards before dependent production.
- Deletion is **POST /api/v1/account/delete**; export is **GET /api/v1/account/export**. Complete field/table/retention coverage remains R11, including battle sessions.
- Production/public Play rollout is a separate owner gate. Credentials, live permissions and device availability are not inferred from configuration.

## Next selected work

R00 establishes the registry; R01 atomic material spending is locally complete: 11 new regressions (7 failed before correction), 26 focused progression/gear/material cases, lint/typecheck and 417 application/tool tests passed; game/admin builds passed. The owner now authorized autonomous infrastructure continuation. Current: **R07-A** independent content identity/prerequisite validation after delivered R06 loan/equipment slices; R06 resistance/signature decisions and R05 native lifecycle acceptance remain open; financial policy/live/native gaps remain open. Follow [NEXT_STEPS](NEXT_STEPS.md); external/device/asset evidence remains distinct.
