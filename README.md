# Unaware of My Demise — Unified Development Master Prompt

**Gothic anime gacha RPG · Android / Google Play first · Phaser 4 · consolidated 2026-10-12**

> Claude, Codex and any assigned engineer must read this entire README before substantial work. It combines the original master prompt, the 2026-10-12 repository review and the Sonnet implementation handoff into one authoritative engineering document. Fiction, dialogue, characters, chronology and spoilers remain authoritative in [narrative/](narrative/). Supporting documents record evidence and proposals; they do not create another master prompt.

The project has a working domain, client, service and admin foundation. The next engineering goal is to make its financial transitions, combat semantics, narrative flow, content releases and Android lifecycle work together, then complete the promised first-binary systems and prove store readiness. Preserve completed systems and close the specific gaps below.

## 1. Authority, scope and working agreement

1. Current owner/session instructions take precedence. This README governs engineering; narrative/ governs canon. [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md) are host entry points. Read the relevant canon, scripts and character profiles for the assigned feature.
2. Match the current assignment. A review or documentation task stays within that scope. An implementation assignment proceeds through complete, dependency-ordered changes and verification. If the owner explicitly requests review and task selection first, complete the review and wait for that selection; otherwise do not add routine approval stops.
3. Ordinary reversible coding, debugging, migrations authored for review, isolated previews, authorized staging work and vetted documentation-only skill research may proceed autonomously. Continue unblocked work while a genuine external dependency waits.
4. Separate approval is required for production creation/public release, permission boundaries/new roles, destructive canon or production-data operations, real-money prices, new executable third-party hooks/permissions and spending beyond the approved media budget. Never alter player transactions outside an explicitly authorized operation.
5. Canon may evolve through measured original changes to dialogue, pacing, quests, relationships and encounters. Preserve history, original source IDs and provenance; maintain chronology and character consistency. Flag substantial identity, plot-reversal or ending changes for owner review. Do not silently regenerate Part I or rewrite canon to accommodate an implementation.
6. Chat/progress reports are **Turkish**; player-facing text and technical deliverables are **English**; spoken dialogue targets **reviewed Japanese**. Turkish localization is deferred. Keep stable locale and line IDs for future additions.
7. Work in task branches/worktrees when another checkout is in use. Preserve others' edits, recheck current main before work and before publication, integrate deliberately and rerun affected checks. Push each finished verified step to main according to the owner's policy; keep commits reviewable and main green. Never force-push/rewrite shared history or blindly commit all uncommitted files. Archive legacy trees before removal; the previous README remains in Git history.
8. Report actual PASS / FAIL / BLOCKED / UNVERIFIED results. Code presence, a declaration, mock, unit test, browser preview, deployed Worker and physical-device acceptance are different evidence levels. Revalidate dated findings on the current commit before opening or closing a task.

## 2. Approved game and experience

- **First public release: Android through Google Play**, signed AAB. Browser builds are internal development/QA/owner previews. iOS and Steam are separately approved future tracks. Keep portable account, entitlement and gameplay adapters without delaying Android.
- **Landscape**, authored at **1920×1080 reference coordinates**, with adaptive resolution, safe areas, readable text and physical-size touch targets.
- Main combat is **5v5 turn-based tactical team combat**: manual skills/targets, Focus/ultimate, formation, status effects, bosses and deterministic replay. Auto Battle, Sweep and server-calculated AFK rewards are required foundations.
- Painterly Gothic-anime portraits/cinematics, distinctive **chibi battle units**, restrained ornamental UI and atmospheric staging. References are principles only: Heaven Burns Red for relationships/story rhythm, Reverse: 1999 for visual treatment, AFK Arena for convenience, BrownDust2 for tactical readability, Morimens for later replayability. Do not copy assets or specific designs.
- Express existing motifs—bells, names, time, memory, vows, registers, loss and companionship—through original mechanics and character attachment. Each character needs a recognizable face, silhouette, costume, weapon handling, emblem, accent, poses, impact timing and VFX rhythm.
- **Main-story access never requires a gacha win.** Use authored recruits/guest units and viable loan loadouts. A no-pull, no-ad player must have a demonstrable story/progression route.
- **One main currency: eclipse_token, displayed as Bell's Remains.** Wishes, character/weapon upgrades and shop spending use it. XP/ascension materials and character-bound Memory Shards are items; Ration is energy. Retired Fate's Thread/Silver Crowns do not return as new money.
- Adult female and male characters may have tasteful, eye-catching Gothic designs fitting their roles and dignity. Do not sexualize chibi/child-coded or age-unconfirmed characters; no explicit sexual content. Aim around 16+ in presentation, but the actual regional IARC rating must come from the real content questionnaire and owner review.
- Avoid ads during emotional dialogue/cinematics or tactical choices. Show the next story action, skill purpose, exact spending/result and save/recovery state clearly. Keep gacha rates/pity/history accessible before spending; hide irrelevant developer diagnostics in shipping flows.

### Initial content and extensibility contract

The first store build contains a coherent menu, an authored approximately **120-second opening**, **T-1/T-2/T-3 with intervening scenes**, and a **Finish/save/restart** flow. Canonical initial tutorials use **Mahmut and Fadyme**, manual skills/targets, no speed/Auto battle buttons, no Ration/drops/economic clear claims; they record presentation checkpoints. Entry cutscenes use the approved normal-speed Auto on/off reading toggle and no Skip. The general later story reader still needs appropriate choices, replay and skip behavior.

Start background patch download after sign-in; keep progress/retry visible without changing the tutorial's active content. Stage downloaded content and activate at restart. A returning completed account opens the full menu with the next campaign action; tutorial replay is separate. First startup needs connectivity for Google identity/content, with truthful retry and no lost progress.

Small initial **content** does not reduce first-binary **capabilities**. All runtime, gameplay, identity, monetization, admin and interpreter foundations promised for the first binary must already function before submission, even if later modes are initially locked. Full-menu screens and effect interpreters ship as code; patches may unlock/configure them, not introduce missing executable screens or primitives.

Deliver new chapters, characters, encounters, events, seasons and media as validated **signed declarative data/media**. No downloaded JavaScript, WASM, native libraries, SDK replacements or disguised private executable language. New executable effects, native features, security/SDK updates or OS/store mandates can require another AAB. Minimize further binaries through tested extensibility; never promise that no further AAB will be necessary.

## 3. Architecture, rendering and deployment

| Area | Approved implementation |
| --- | --- |
| Game | Phaser **4.2.1**, TypeScript strict, Vite, modular scene/input/asset/audio/content managers. Use pinned installed types and current official APIs. |
| Renderer | Phaser **WebGL** on Android WebView/browser. Phaser has no native Vulkan renderer. Use modern Phaser 4 render nodes, batching/atlases, animations, tweens, cameras, particles, geometry, masks, render textures and optimized filters; profile quality tiers/context recovery. Canvas fallback only where compatible and necessary. |
| Mobile | Capacitor **8** family; current shell is 8.5.3. Android Credential Manager, Play Billing, AdMob/UMP, secure storage, lifecycle/networking/crash reporting and reproducible native builds. Spine/Live2D only after runtime binding, SDK/license/editor/export/mobile/performance review; a flat generated image is not a rig. |
| Backend | Cloudflare Workers + Hono. **D1/SQLite is the sole SQL database**, with DB bindings, parameterized SQL, migrations and typed models. Any Drizzle usage must use the D1/SQLite driver. No Neon/PostgreSQL/Hyperdrive/Firebase/Supabase game database. |
| Assets/services | R2 for versioned assets/media/patches, Queues/Cron where justified, Access for admin, appropriate WAF/rate limiting/Turnstile and monitoring. R2 is not a financial database. |
| Management | Separate React + TypeScript **UOMD Control Center**, protected by Access, verified JWT, MFA policy, RBAC, audit and least privilege. The approved Access policy restricts access to the owner's account members; verify live policy enforcement. |
| Isolation | Separate development, staging and production D1/R2/bindings; no production user data in previews. Add isolated PR previews. Production creation remains an owner decision. |

Keep apps/game, apps/android, apps/api, apps/admin, packages/*, content/, narrative/, tools/ and tests/ intact unless the assigned change requires a reviewed restructure. Godot survives only in archive/godot-era; older media are references in archive/pre-cleanup-2026-10-10, [narrative/ARCHIVE.md](narrative/ARCHIVE.md) and reference/. Do not restore retired code or engine guidance.

**Current staging deploy path is Cloudflare Workers Builds.** The former GitHub Actions workflows were removed after the account's billing/spending-limit block. Do not recreate them from stale work orders. [tools/deploy_staging.sh](tools/deploy_staging.sh) deploys game, admin or ops: **one build deploys exactly one Worker**, and game owns D1 migrations/seeding. Verify live build commands, path filters, bindings and source version tags; a deploy script alone does not prove the live test gate.

D1 Free is authorized for development. The previously recorded baseline was 5 million rows read/day, 100,000 written/day, 5 GB aggregate storage, 500 MB/database and 10 databases; **reverify current provider limits before capacity decisions**. Measure rows read/written, CPU/query latency/concurrency, storage and costs; add quota handling/alarms and an approved paid-tier path. Optimize/shard from metrics while staying within Cloudflare.

### Trust and Google integrations

- Financial/gameplay state is server authoritative: balances, inventory, progression, pity, purchases, subscriptions, ad rewards, AFK/Sweep and event claims. Use immutable journals, unique idempotency keys, nonnegative balances, conditional writes/CAS, supported transactional D1 batches and durable retry/reconciliation. Two API calls are not a transaction; Miniflare concurrency tests are not live-D1 proof.
- Android player login is **Google only** via Credential Manager and backend signature/issuer/audience/expiry verification. Map verified Google sub to a stable internal player ID, not mutable email. Handle refresh/re-auth/revocation/recovery/deletion. Play Games is optional achievements/services identity, not a substitute login. Browser staging uses genuine Google web sign-in when configured; automation uses explicitly isolated dev/test identities only.
- **Play Billing is required in the first AAB** for shop products, consumables/bundles and recurring subscriptions. Google Play owns real prices/products/base plans; admin maps in-game benefits. Verify through Play Developer API; support pending, ack/consume, restore, renew/cancel/refund, grace/hold/pause/expiry and OIDC RTDN via Pub/Sub. Grant only after server confirmation; sale availability cannot cancel already-paid obligations.
- **AdMob rewarded ads** are the default; interstitial placements require approval. Verify SSV and idempotent nonce/transaction grants server-side, enforce abuse/frequency controls, and separate test/live units. The currently approved cap is five rewarded ads per rolling 12 hours; reward amounts remain subject to final tuning.
- **UMP/privacy** must support applicable EEA/UK/Swiss consent, withdrawal, age/child-directed safeguards, account/data deletion, Data Safety and truthful disclosures. Access MFA and consent configuration require actual evidence.
- Reconcile actual Google Play/AdMob reporting with entitlement/ledger records; token grants are not revenue. Keep accounts/entitlements platform-independent: future iOS can require another equivalent login and Apple billing, and Steam has separate storefront rules.

Secrets stay in the supported runtime/Worker/CI secret store. Never print keys/tokens, dump the environment, copy secret values into source/artifacts/chat or presume GitHub Actions secrets exist in the current host. A configured variable/MCP declaration does not prove permission or connectivity. For missing access, report the exact setting/secret name, console, minimum scope and target environment; let the owner enter it securely. Verify credentials with bounded authorized checks revealing only success/failure. Existing grants remain valid across turns.

## 4. Implemented foundation and dated audit baseline

**Audit source:** 2026-10-12, commit **184b8d2963eac292162873e07db49bdd04b82f06**; remote main matched and the original working tree was clean. This is a dated engineering snapshot, not a claim that later changes have already been reviewed. Refresh it for the current task/commit.

| Area | Implemented at the audit baseline | Outstanding acceptance |
| --- | --- | --- |
| Domain/schema | Shared canonical/hash/ES256/RNG primitives; closed effects, content validation; pure story VM/save format; deterministic combat/replay. | Semantic graph/catalog coverage, complete first-binary grammar and lifecycle integration. |
| Combat | 5v5-capable formation/targets, Focus/cooldowns/statuses, boss phases/objectives/telegraphs/summons, Auto policy; all 20 heroes, 20 regular enemies and 7 bosses in fixtures. | Break/Auto correctness, secondary gear effects/procs, loans, wave/capability contracts and sequential balance proof. |
| Player economy | Ledger/pity/history/rates, character XP/ascension/ranks, gear/equip/reroll/dismantle, teams, tasks/mail/drops/Ration, frozen owned-party battle sessions and server replay/reward batch. | Material/reward/duplicate races, client retry, financial recovery and missing modes. |
| Google/native | Server Google token/session checks; Java Credential Manager, Billing, AdMob/UMP and native restart bridges; account cloud-save/export/delete. | Complete lifecycle/privacy/offer UI and physical-device/Play sandbox proof; do not label native bridges absent or claim no AAB was ever built. |
| Entry | 9-shot prologue source, T-1/T-2/T-3, all six before/after dialogue scenes, background staged download/PatchBar, Finish and account entry reconciliation. | Subtitle/timeline/resume/Continue/restart recovery, approved visuals/VO and real Android acceptance. |
| Campaign/canon | 20 playable identities, 27 enemies including 7 bosses; 7 chapters/35 stages; **51 ordered main-story entries and 419 unique main line IDs**; **76 companion parts**; 4 canonical runtime events. | Audit baseline: 38 battle nodes, no Part I dialogue. R07-C2 now compiles 38 battle + 16 story nodes and 88 Part I dialogue files covering all 419 lines. C3 verifies one complete no-gacha chapter and First Oath choice; companion/codex/event routes/gates remain. |
| Art/audio | Art Bible/reference packages, P0 specs, prompt queue, budget tooling/keyer; base 4 unit atlases/units, 2 portrait identities, 1 background, 2 BGM tracks, 2 UI images, zero stills. | Campaign's 43 generic unit placeholders, 13 shared objective art IDs and 6 gradient backgrounds are provisional. Approved ingest/assembler/strict-art and production pilot are missing. |
| Patch | Signed ES256 manifests, safe paths/media, SHA-256/size validation, staged activation, rollout cohorts, previous fallback, unpublished R2-object protection, admin publish/rollback/kill. | Durable generation, publication/reward authority, catalogs/compatibility, disk/large-media failure handling and unchanged-AAB season proof. |
| Control Center | **13 real pages:** Dashboard, Monitoring, Development, Players, Banners, Economy, Shop, Flags, Catalog, Characters, Assets, Patches, Audit; Access JWT/RBAC/CSRF/version/audit code. | Essential narrative/design/LiveOps/media/payment/release-composer workflows, approved publication, scalable investigation and actual telemetry. |
| Operations | Separate game/admin/ops Worker configs, age-encrypted backup, wallet/ledger reconciliation, catch-up scheduling and health code. | Current live settings/MFA, owner-key encrypted restore, measured RPO/RTO/retention/scale, independent alerts and automated native/PR evidence. |

Preserve these foundations. A plan/specification/queue is not an implemented feature; a locked menu does not establish working mode mechanics.

### Verification from that audit

Checks ran in an isolated temporary copy, without changing application code, canon, live data or cloud resources. Pinned dependencies were installed with lifecycle scripts disabled. The source review was not a live penetration test and does not claim every possible defect was found.

| Check | Observed result |
| --- | --- |
| Lint/typecheck | PASS. |
| Existing tests | **406 PASS:** API 166, game 33, combat 82, schema 34, economy 40, patch 18, shared 22, story 5, tools 6. |
| Skill tooling | 46 generated Codex adapters passed integrity; 10 Python regression tests passed. These counts are separate from application tests. |
| Builds/content | Game/admin builds passed. Rebuilt base content matched all **31 files byte-for-byte**. This does not establish Android release acceptance. |
| Material regression | **Expected protection FAIL:** never-owned XP item yielded HTTP 200, level 3/XP 8 and wallet 96; expected rejection, level 1/XP 0 and wallet 100. |
| Combat regressions | **2 FAIL:** one-turn Break failed to skip the next action; Auto selected basic instead of an available ultimate against a live boss with save-until-boss enabled. |
| Patch regressions | **3 FAIL / 1 PASS:** old kill, replay after kill and intermediate generation after local rollback were accepted. Higher-generation signed rollback was correctly accepted. |
| Browser isolation | Desktop 1280×720 and touch-phone 1200×540 renderer boot passed, no uncaught errors. Second prologue shot had text length 33 but **body alpha 0**. API requests were isolated 404 responses, not backend tests. |
| Unverified | Full local entry/API harness timed out waiting for admin Worker health. No fresh current Cloudflare/Access/Google credential, physical Android, signed-AAB/Play sandbox or owner-key restore acceptance. Historical reports do not supply those missing results. |

Additional failing regressions expose gaps outside the green existing suite. They were audit fixtures, not fixes applied to production. The prologue's **112.8-second** ending estimate is code-derived from repeated overlap subtraction; total elapsed time was not measured.

## 5. Prioritized dependency route

**P0**: financial/data/release blocker. **P1**: required first-binary or core experience gap. **P2**: operational/scale/ergonomic debt, promoted when required by measured load or release acceptance. **S/M/L** are relative effort, not promised dates.

Every package below was open or incomplete at the audit baseline. Current task and evidence status is recorded in [DEV_TRACKER](docs/DEV_TRACKER.json), with evidence semantics in [BUILD_STATE](docs/BUILD_STATE.md). R00's documentation/evidence reconciliation is completed in the 2026-10-12 R00 delivery; this does not close R01–R18 engineering or live/device gates. Recheck current code and scoped evidence before starting. Each package's completion criteria are defined once in section 6.

| ID | Work package | Priority / size | Dependencies |
| --- | --- | --- | --- |
| R00 | Truthful capability/evidence matrix | P1 / S | None |
| R01 | Atomic material spending and grant invariants | P0 / S–M | R00 |
| R02 | Purchase/refund/RTDN/entitlement recovery | P0 / L | R00 |
| R03 | Patch publication/generation/reward authority | P0 / M | R00 |
| R04 | Free-repeat rewards and duplicate grant concurrency | P0 / M | R01, R03 |
| R05 | Persistent client operation recovery | P1 / M | R01, R02, R04 |
| R06 | Combat semantics, gear/loans/capability limits | P1 / L | R01 |
| R07 | Canon compiler and semantic publication validation | P1 / L | R03, R06 |
| R08 | Effective server/client catalog and complete patch grammar | P1 / L | R02, R03, R06, R07 |
| R09 | Complete entry/Continue/checkpoint/restart flow | P1 / M–L | R05, R07 |
| R10 | Reviewable layouts and mobile/accessibility UX | P1 / M | R06, R09 |
| R11 | Native identity/monetization/privacy lifecycle | P1 / L | R02, R05 |
| R12 | Missing first-AAB mode foundations | P1 / L, separate slices | R01, R04, R06, R08 |
| R13 | Essential Control Center workflows | P1 / L | R02, R03, R07, R08 |
| R14 | Media budget correctness and free ingest/QC | P1 / M–L | Guard work early; layout-specific contracts after R10 |
| R15 | Approved visual pilot and character/UI polish | P1 / L | R10, R14 |
| R16 | Final economy/campaign balance and sound/VO | P1 / L | R06, R08, R09, R12, R15 |
| R17 | Ops/build/scale/restore hardening | P1/P2 / M–L | Starts early; completion after R02, R03, R08 |
| R18 | Unchanged signed-AAB and Play acceptance | P0 release gate / L | R11–R17 and all required systems |

First engineering deliveries: material guard, crash-safe finance, release authority, tutorial/duplicate grants, then Break/Auto/gear semantics. Complete a real chapter path through R07/R09 before adding disconnected combat screens. R02 and R03 can run independently; Google access/sandbox preparation and R17 start early. Free layout/ingest prototypes proceed alongside backend work. Numerical tuning and real sound/music production follow the owner's final-stage order; cue/voice interfaces are implemented early.

## 6. Open work and concrete completion criteria

### R00 — State, evidence and document reconciliation

**Delivery record (2026-10-12):** the capability/evidence registry is in [DEV_TRACKER](docs/DEV_TRACKER.json); the supporting records below now distinguish implemented source, dated local tests and unverified external acceptance. Maintain these records as subsequent selected tasks complete. R00 adds no gameplay fix or fresh deployment/device approval.

Build a capability/evidence registry recording required-versus-implemented functionality, task status, commit, test/build/deployment/device ID, **verifiedAt** and exact blockers. Keep BUILT, LOCAL_TESTED, STAGING_VERIFIED, DEVICE_VERIFIED and OWNER_BLOCKED distinct. Admin generatedAt is not evidence freshness.

Reconcile [BUILD_STATE](docs/BUILD_STATE.md), [DEV_TRACKER](docs/DEV_TRACKER.json), [INFRA_ROADMAP](docs/INFRA_ROADMAP.md), [GAME_FLOW](docs/GAME_FLOW.md), [QA_ANDROID](docs/QA_ANDROID.md), [MONITORING](docs/MONITORING.md) and [NEXT_STEPS](docs/NEXT_STEPS.md) against code. Remove superseded initial scaffolding/failed-bootstrap/Actions work orders from active queues. T-3, owned parties, boss HUD/native bridges and approved $20 media budget already exist. The unclaimed refunded-mail guard and removal of the old plaintext backup probe are also already implemented.

Do not follow stale instructions to delete the **active uomd-db-backups bucket** or commit everything to an old Claude branch. Correct obsolete API documentation: current account deletion is **POST /api/v1/account/delete**, not DELETE /api/v1/account. Keep this README authoritative; supporting documents remain factual detail/proposals.

### R01 — Material spending and shared transaction invariants

**Completed locally (2026-10-12):** [stackSpend](apps/api/src/db/grants.ts#L46) now atomically proposes the remaining quantity even for a missing stack, so CHECK (qty >= 0) rolls back the entire consuming transaction. All character level/ascend/skill and gear level/ascend/reroll callers share the guard. The earlier UPDATE-only missing-row flaw was reproduced by seven failing negative cases before the fix.

The committed [material-spending regressions](apps/api/test/material-spending.test.ts) cover missing/zero/insufficient/exact stacks, multiple materials, all consumers, complete state/fee/task/journal rollback, concurrent last-stack spends, same-key replay and a rejected request retried after replenishment. Eleven new cases and the existing progression/gear cases passed; repository lint/typecheck and **417 application/tool tests** passed. Game/admin builds passed. This is local D1/Workers evidence; a deployed-source/physical-device result is not inferred from the main push. Scope and dated identifiers are recorded in DEV_TRACKER.

**Accept when:** missing/zero/insufficient/exact stacks, multiple materials, concurrent spends, stale versions, repeated requests and lost responses are covered. Rejected work changes no character/gear state, balance, task counters, grant/request journal or other material. Exact valid spends and semantic retries apply once.

### R02 — Purchases, subscriptions, refunds and RTDN

Server verification/order dedup and paid fulfillment are retained. Local recovery slices below are delivered; [DEV_TRACKER](docs/DEV_TRACKER.json) keeps dated detailed evidence. Latest local suite: **486 application/tool tests**, lint/typecheck and admin build PASS. No live Google, deployed migration or physical-device acceptance is implied.

| Verified slice | Result | Recorded full-suite proof |
| --- | --- | --- |
| R02-A | Retry/reconcile existing-order subscription acknowledgement independently from grants; fixed safe failure codes. | 419 tests; two new cases failed before correction. |
| R02-B | Original immutable currency credits; refund marker, wallet CAS/clawback, shortfall and journal in one D1 batch. | 423 tests; four new cases, three failed before correction. |
| R02-C | Frozen fulfillment/mail terms, effective provider state/expiry, atomic claims/deletion guards and sales-independent paid verification; official selected-line order start. | 434 tests; ten billing and one preserved auth-throttle cases. |
| R02-D | Durable RTDN processing/done/60-second lease, retryable concurrent delivery, legacy-marker recovery, bounded dead-letter and audited CAS operator reset. | 443 tests; nine new cases, three failed before correction. |
| R02-E1 | Eight-second provider/OAuth deadlines, safe failures, credential-scoped cache, consumed-marker recovery and affirmative verified publisher email. | 455 tests; nine HTTP and three billing/auth cases. |
| R02-E2 | Exact-order full-refund proof; preserve earlier periods/recovered state, suspend uncertain mail and retain partial refunds for review. | 461 tests; six new cases. |
| R02-E3 | Provider-bound encrypted pending/retry work before grants, shared client/RTDN/Cron ownership with transactional fences, ack/consume/renewal/refund recovery, safe operator review and deletion cleanup. | 480 tests; 19 new cases, stronger expired-worker coverage; earned-window regression failed before correction. |
| R02-F | Viewer-only, consistent D1 reconciliation snapshot; original/refund/shortfall/claimed-periodic facts, stable semantic hash and explicit legacy/noncurrency review reasons. | 486 tests; six new cases; no repair or policy application. |

**R02-E3 runtime contract:** `verifyReceipt` is the application entry point; domain helpers remain separately testable. AES-256-GCM binds ciphertext to key ID/environment/package/player/product/token hash, with fresh nonces and retained-key rotation. `BILLING_TOKEN_KEYS` is an environment-specific **game Worker secret**, never a client variable. Every-minute dev/staging Cron processes at most five eligible jobs, uses bounded retries/ack deadlines and emits only aggregate results. Successful consumables/deleted accounts discard stored ciphertext; active subscriptions keep renewal observation after a refund without revocation. Earned mail can materialize within its original claim grace after expiry, stops at the actual paid period end and commits in batches with current-rights guards. Amounts/cadence were not retuned.

Migration **0022**, two isolated local Workers and real local scheduled-handler dispatch passed; absent Access/keyring configuration failed closed. Wrangler is unauthenticated in this host, and staging/reference HTTP checks received proxy 403. Existing Workers Builds remain the deployment path; actual Cron/keyring/Google/RTDN configuration and deployed tags are **unverified**. [SECRETS_AND_PERMISSIONS](docs/SECRETS_AND_PERMISSIONS.md) specifies secure setup; no live secret or player transaction was changed.

The [billing policy review](docs/billing/POLICY_REVIEW.md) contains concrete future refund/calendar alternatives and evidence gates. The viewer reconciliation endpoint reports facts only; a marker or snapshot hash does not authorize historical repair.

Remaining acceptance:

- Legacy unknown fulfillment and previously half-completed refund markers need auditable investigation/reconciliation; do not invent old terms from today's catalog or silently rewrite historical balances.
- Define retained/claimed periodic currency, items/characters/gear, partial refunds and unrecoverable policy explicitly. Current automatic clawback covers verified full-order original currency; other decisions remain review work.
- Resolve the nominal 60 × 12-hour/30-day offer against actual calendar/accelerated periods and hold/pause accrual. Current code caps configured cadence at the verified period end; boundary tests do not prove every plan promises the same count. Final numbers remain R16.
- Complete the native pre-purchase offer/benefit-version binding and lifecycle in R11, prove actual provider permissions/ack timing/linked-token transitions and scheduled backlog capacity, then run physical sandbox cases in R18.

**Accept when:** fault injection, response loss, duplicate/out-of-order notifications, pending/active/cancel/grace/hold/pause/recovery/expiry, catalog-edit→refund, claim/refund and delete→renewal converge to the approved journal/ledger/entitlement result. Local code slices stay distinct from remaining policy, configuration and store evidence.

### R03 — Generation, publication and reward release authority

**R03-A locally verified:** [PatchManager](packages/patch/src/manager.ts) now persists an independent per-channel highest accepted generation/tombstone, checks freshness before kill and atomically fences activation against concurrent updates. Kill clears staging; restart revalidates stored signatures and legacy retained overlays; rollback or lost/corrupt overlay state preserves the generation record. IndexedDB metadata/object writes resolve on transaction completion and reject aborts after request success. Eleven new regressions (the original three failed before correction), 29 patch cases, two actual Chromium/IndexedDB cases, lint/typecheck, **497 application/tool tests** and game/admin builds pass. Native storage/deployed acceptance remains separate.

Legacy migration can recover the greatest signed generation still retained in the old overlay; it cannot reconstruct already-erased historical generations. A corrupt independent generation record fails closed. Deleting the entire browser database/reinstalling loses local history; server economic admission is the separate R03-C gate.

Reject authentic old kill g2 over active g4, replay g2 after accepted kill g3, and unseen g3 after g4→g2 fallback. Preserve repeated current polling and a deliberately signed **newer g5** containing older content for an authorized rollback.

**R03-B locally verified:** [ContentStore.activate](apps/api/src/content/store.ts) atomically requires a successful draft transition and a strictly increasing channel pointer before its success audit can commit. A lost transition rolls the complete batch back with 409. The deterministic delayed-snapshot race and stale-audit regression failed before correction; audit failure also preserves the unsigned draft and old pointer. Eighteen publishing/verification cases, lint/typecheck and **499 application/tool tests** pass. The existing rate-limit burst test now freezes only Date to avoid crossing its minute window. No deployment evidence is implied.

**R03-C locally verified:** [economic authority](apps/api/src/content/authority.ts) is checked again inside every session-start/reward transaction. Current releases accept new claims; normal replacement grants only already-started sessions a maximum two-hour completion window, bounded by their original expiry. Signed-in fixed and owned battles both freeze the release; the client submits that captured ID. Canary publication (<100%) automatically allowlists the previous cohort for at most 24 hours. Explicit Access/RBAC/CAS exceptions also expire within 24 hours; grace cannot extend the original cutover. A revoked policy or durable channel kill floor blocks new claims and all unfinished sessions, including allowlisted content; a newer signed rollback can resume service without lowering the floor. Recorded-result retries still return without a second payment. Account deletion erases battle sessions, and the write-time active-account guard prevents state recreation.

Migration **0023** backfills accepted kill history, including retired kills, per channel. Fifteen additional economic regressions (three failed before correction), lint/typecheck, **514 application/tool tests**, 19 Python checks, actual local game/admin Workers with all 23 migrations, both builds and the real Chromium desktop campaign scenario pass. R03 local source acceptance is complete; deployed/native evidence remains separate. Legacy fixed clients without a session remain compatible on a current/allowlisted release and have no old-release grace. The public nonfinancial replay diagnostic does not grant rewards. Admin release-policy UI integration remains R13.

**Accept when:** generation regression cases pass durably, concurrent publish cannot move the pointer backward, killed/expired old content cannot mint new rewards, and retrying an already-recorded result remains idempotent.

### R04 — Free-repeat rewards and cross-source duplicates

**R04-C locally verified:** the real compiled **stage_1_1** previously minted repeat currency/items with zero Ration and fresh request IDs. The existing `NodeRewards` paid-win contract is now enforced inside the verified result transaction: only a Ration-spending win receives fixed repeat rewards or repeat drop-table entries. Free practice preserves configured first-clear/first-three-star milestones and first-clear drops; its first win also receives no repeat portion. This closes the unlimited mint path without altering reward amounts/rates/prices or rewriting narrative/history. See [the applied eligibility rule and recorded source/canon mismatch](docs/economy/FREE_REPEAT_POLICY.md). The presentation-only T-1/T-2/T-3 entry runner remains reward-free.

Three new cases (the real sequential/concurrent farm cases failed before correction), lint/typecheck and **527 application/tool tests** pass. Original-result retry retains recorded eligibility; paid repeat behavior is preserved. Actual desktop campaign and desktop/phone disclosure tests pass, with screenshots taken after camera fade completes and inspected. Chapters/victory feedback disclose free practice. R04 local correctness is accepted; R16 still owns final income/recovery/tuning and deployed/native evidence remains separate.

**R04-A locally verified:** gacha now fences the exact original copy counts of every drawn character inside its D1 batch, in addition to pity CAS. A competing pity group or any attachment-grant source forces a bounded retry before debit, response and immutable pull journal commit. Pulls and mail/purchase/stage/task attachments share the same atomic character-copy/shard upsert. Two deterministic cross-group/cross-source regressions failed before correction; 74 focused cases, lint/typecheck and **516 application/tool tests** pass. Existing within-ten-pull duplicate classification and request replay remain intact. **R04-B locally verified:** migration 0024 adds immutable, uniquely keyed future reward-grant facts in the same D1 transaction as the grant. Shared currency/character/material/gear/account-XP attachments, summons and new-account starters record their original attachment and exact committed effect (including stack clamping and gear instance IDs). A journal fault or reused identity rolls the grant back. Player export includes a bounded newest-first history and truncation flag; deletion retains only pseudonymous immutable facts. Existing inventory/history is not backfilled or repaired. Eight new cases, lint/typecheck, **524 application/tool tests** and isolated game/admin Workers with all 24 migrations pass. R04-C now enforces paid-only repeat eligibility; final balance figures remain R16.

**Accept when:** zero-cost repetitions cannot farm unlimited economic grants and concurrent cross-group/cross-source duplicates preserve copies/shards/history. All financial policies remain in the single-currency model.

### R05 — Durable client retry and operation status

**R05-A locally verified:** requests capture their session/revision before transport. A late unauthorized/logout/deletion response cannot erase a newer account, and an older sign-in cannot replace the later selection. Logout ends local authority immediately while revoking only its captured bearer. Four regression cases failed before correction; lint/typecheck and **531 application/tool tests** pass. This supplies the account boundary for the recovery slices below.

**R05-B locally verified:** [client operations](apps/game/src/net/operations.ts) durably record the original ID, frozen payload and verified account/backend scope before sending summons, battle results or character upgrades. Identical pending taps/reload retries reuse that ID; a later confirmed intent gets a new one. An unresolved action blocks changing its input. Transactions wait for IndexedDB completion, retain pending IDs after abort/quota/confirmation-write failures, bound history, check payload integrity and never store session/purchase credentials. Previous-account results cannot update the current account; ambiguous errors remain pending.

Ten additional client cases, four actual Chromium storage cases, lint/typecheck and **541 application/tool tests** pass. On both desktop and touch-phone, a real local Worker commits a summon before the browser loses its response; reload recovers the original result with one debit and one pull record. Both builds and all 24 local migrations pass. Native force-stop/reinstall and deployed acceptance remain separate.

**R05-C locally verified:** migration **0025** stores canonical original inputs alongside committed summon, character/gear and battle results; immutable-update guards preserve the proof while account deletion may erase these request caches. Four failing-before regressions now reject changed targets/materials/gear XP/actions/session IDs under an existing identity, including a concurrent target race. Authenticated, rate-limited `GET /api/v1/operations/:id?path=…` returns the player's original result and input hash without a new debit/grant; missing results remain unknown and legacy inputs remain explicitly unproved. Manual recovery verifies that hash and result shape before confirmation, refreshes confirmed results from the server and adds durable gear wrappers.

**555 application/tool tests**, lint/typecheck, 28 Python checks (including real SQLite legacy migration), both builds and all 25 local migrations pass. On real local Workers, desktop/phone response-loss recovery now confirms through status without another mutation POST; killed-release recorded battle status remains recoverable. Remaining R05 scope is claims, checkpoint/cloud-save/purchase lifecycle and player-facing recovery; native/deployed acceptance remains separate.

**R05-D locally verified:** mail and task claims with a request ID store their frozen original result in the same D1 batch as the claim marker/grants. Concurrent identical requests recover that result, and a recorded task claim survives window expiry or catalog edits without recalculating rewards. A journal fault rolls back the mail marker/reward; reused identities cannot claim a different mail. Existing callers without an ID retain one-time claim behavior. Task batches also fence active-account status. Durable client wrappers and status proof now cover both claim types; a definite first rejection permits a later new intent while earlier ambiguous failures stay pending.

Two failing-before cases, four additional API/two client cases, lint/typecheck and **561 application/tool tests** pass. Real desktop/phone account UI flows and four response-loss/reload scenarios (summon and mail, both viewports) pass with all 25 local migrations and both builds. Claims recover through status with no second mutation POST. Checkpoint/cloud-save, purchase lifecycle and player recovery UI remain the next R05 work; no native/deployed acceptance or creative asset generation is claimed.

**R05-E locally verified:** ID-bearing entry checkpoints and cloud saves atomically record their result with the monotonic update/CAS. A save replay returns its original version after another writer advances, without overwriting the newer data; changed input under the same ID is rejected. Checkpoints preserve both the original response and later progress, including no-ops. Journal faults roll updates back, and active-account transaction guards prevent post-deletion recreation. Legacy no-ID callers retain their contract. The client persists PUT identities, serializes checkpoint updates, confirms an uncertain predecessor before sending higher progress and fences account changes; late successful authenticated reads are also rejected across account selection.

Four additional API/five client cases, lint/typecheck and **570 application/tool tests** pass. Real desktop/phone tests cover eight response-loss/reload recoveries (summon, mail, save, checkpoint), with zero repeat writes for confirmed status; save recovery preserves a simulated later writer's v2 while acknowledging original v1. Four fresh/returning menu tests, both builds and all 25 local migrations pass. Purchase lifecycle, visible player recovery and remaining session/lifecycle boundaries are next; R09 still owns the complete Finish/Continue/narrative experience. No physical native or deployed acceptance is implied.

**R05-F1 locally verified:** shared browser session changes are observed before transport and after responses without writing another tab's state. Economic requests pin the verified session revision and reject a changed selection before sending; pending/history reads also fence account changes. Expired sessions cannot start an economic operation, and expiry of the previous account does not cancel a new sign-in. A 30-second HTTP deadline preserves the original pending operation. Late logout/deletion callbacks now stop before forgetting a newer identity. Five additional client cases (two failed before correction), lint/typecheck and **575 application/tool tests** pass. Ten actual desktop/phone recovery cases, including two pages sharing storage and a delayed old 401, pass; both builds and 25 local migrations pass. Visible recovery and native purchase/session work remain; localStorage is still replaced with native secure storage in R11.

**R05-F2 locally verified:** Home/Account now open Saved Actions: account-scoped pending/history pages, offline display for a verified account, original-identity retry and authoritative result verification. History labels are explicitly last known results. Hub views refresh on authentication changes and discard stale renders; the creating-scene guard preserves signed-out navigation. Logout/deletion pin the rendered account revision; two-tap deletion also resets on account reselection (including switching back) and scene restart. Sign-in releases its selection guard before notifying views.

**576 application/tool tests**, lint/typecheck, 28 Python checks and 22 real local-Worker desktop/phone account, recovery and Control Center scenarios pass. Four final UI cases also verify offline recovery with zero extra mutation POSTs, account isolation and deletion-confirmation lifecycle; desktop pending/phone confirmed screenshots were inspected. The test stack now service-binds both real Workers in one runtime after private logs traced intermittent HTTP 500 to two runtimes opening the same SQLite file (`SQLITE_BUSY`); the admin browser origin and real authentication remain covered. Both builds and 25 local migrations pass. Graphify refreshed (2994 nodes/7387 edges/158 communities). Purchase recovery and native session storage/lifecycle remain open; no physical-device, deployed or creative-asset acceptance is implied.

**R05-G1 locally verified:** native purchase and owned-receipt restore pin the account revision across profile loading/SDK waits and reject changed selections before verification. The client checks the requested product and authoritative response shape. Pending receipts now reach the existing provider-bound encrypted server recovery instead of being skipped. Restore reports delivered, pending, unavailable and unentitled outcomes; Shop exposes uncertain verification instead of silently treating it as zero restored purchases. No raw receipt is added to the generic operation journal.

Five new regression cases failed before correction; **581 application/tool tests**, lint/typecheck and both builds pass. Two desktop/phone **browser SDK-fixture** Shop cases pass and the phone screenshot was inspected; they mock the native receipt list/verification responses and do not prove Play/device behavior. Existing Worker regressions still prove encrypted pending recovery, frozen benefits and unbound-token rejection. Remaining R05 work includes consumed-receipt response-loss/status recovery and native lifecycle/secure storage; actual Google/device/keyring gates remain open.

**R05-G2 locally verified:** Account now opens Purchase History. Authenticated, rate-limited/no-store history reads existing delivery and recovery facts in one D1 batch; up to 31 rows from each source determine the latest 30 records and truncation. Consumed deliveries remain visible after Google no longer lists the token, with zero provider calls or repeat grants. Delivered, refunded and unconfirmed/review records remain distinct; a past delivery does not establish current subscription entitlement. Legacy default `active` is hidden without an actual provider-check timestamp. Raw receipts, ciphertext and fulfillment internals are not returned.

Four API/two client cases and **587 application/tool tests**, lint/typecheck and both builds pass. Four desktop/phone browser response/SDK-fixture cases cover purchase-history reload with zero payment POSTs, account isolation and Shop outcomes; the phone history screenshot was inspected. Local D1 tests independently cover owned consumed delivery, absent provider token, unchanged balance, cross-account denial, pending/review/refund and legacy observation. Both local builds/25 migrations pass; Graphify refreshed (3011 nodes/7457 edges/154 communities). This is bounded recent history, not full archival export or fresh Google verification. Native secure storage/lifecycle and pre-purchase offer/version binding retain R02/R11/R18 work. Proceed to independent R06 combat semantics while those cross-package gates remain recorded; R05 is not marked fully accepted.

Persist pending operation identity, original request ID, payload and account scope until authoritative reconciliation. Cover gacha, battles, upgrades/gear, claims, entry checkpoints and purchases; distinguish actual new player intent from retry. Provide safe status/history recovery and clear pending/confirmed/rejected states.

**Accept when:** post-commit response loss, force-stop/reload, duplicate taps, manual retry and account switching yield one debit/grant, no stale-account replay and no false success. Retain strong existing server idempotency.

### R06 — Combat semantics, equipment, loans and compatible limits

**R06-A locally verified:** duration-one control retains its owed next-action skip when turn-start expiry removes it, including the boss duration floor. Turn-start death is checked before a saved control skip; existing DoT/regen/cooldown ordering is preserved. Auto reserves an available ultimate against regular foes and uses it when a living opposing boss is present, retaining emergency-heal priority. Explicit control + boss Auto actions reproduce the exact authoritative event hash.

Five additional boundary/replay cases, lint/typecheck and **592 application/tool tests** pass. Three scenarios fail against the previous engine with the corrected current fixtures; the new 18-case boss suite passes. Real local-Worker owned campaign passes on desktop (its phone project is explicitly skipped), and free-practice disclosure passes on desktop/phone. Both builds and 25 local migrations pass. No balance/canon/asset changes or native/deployed acceptance. Remaining R06 work is supported progression/config limits, equipment effects/loans and explicit semantic conformance; C01–C39 proposals are not silently applied.

**R06-B locally verified:** progression validation now matches the shipped level-20/rank-3 battle contract without changing current values. Every XP threshold and accumulated XP/level-fee arithmetic must remain positive/within safe integers; caps, account/rank gates and equipment milestones are reachable and ordered, and supported ranks have complete integer costs. Admin updates reject unknown material IDs against the D1 catalog before the existing CAS/audit batch. Unsupported stored config fails closed with `invalid_progression_config`/503 and keeps its original data for operator review.

Four economic regressions failed before correction; three real D1 admin/runtime cases, **599 application/tool tests**, lint/typecheck and desktop/phone account flows pass. Valid config remains admissible to BattleParty, a successful save advances one version and stale saves remain 409. Both builds/25 local migrations pass. No seed values, balances or historical rows were repaired or retuned. Stage-gate identity validation awaits R07/R08 effective story/catalog authority; equipped secondary/proc effects and canonical loan loadouts remain R06 work.

**R06-C1 locally verified:** an owned story guest now uses the player’s own level, computed basic gear stats and skill ranks in its reserved guest place, once; unowned guests remain explicit loans. This follows the canonical chapter-1 instruction (“your copy and equipment take the guest place”). Owned guest/team construction shares the same helper, duplicate guest IDs are defensively deduplicated, and later unequipping cannot change the already-frozen session party.

The revised owned-guest regression failed before correction; all nine owned-battle cases, **599 application/tool tests**, lint/typecheck and the real desktop owned campaign pass (phone intentionally skipped by that campaign test). Both builds/25 local migrations pass. Unowned loan equipment still needs the authored rarity-3 template, deterministic accessory seed and explicit defaults; equipped secondary/proc effects remain open. No inventory grants, numerical tuning, creative assets or native/deployed acceptance are claimed.

**R06-C2 locally verified:** the authored story-loan equipment template now compiles into the closed battle-rules grammar and both shipped unit packs. Declared unowned guests use rarity-3 padded armor, the lowest matching generic weapon (excluding signature ownership), Ash-Maw Hide accessories/set and IEEE CRC32 UTF-8 seeds from character/stage/accessory IDs. Fresh virtual equipment defaults to level 1/ascension 0; existing guest character level and rank-1 behavior remain. The builder computes basic stats without minting gear or consuming inventory, freezes them in the battle session and fails closed on missing/malformed declared equipment. Older releases without this declaration retain their existing gearless contract; owned guests continue using their own copy. Secondary/proc effects remain R06 work.

Three API/one external-vector CRC cases, strengthened real-session loan assertions, **603 application/tool tests**, **33 Python checks**, lint/typecheck and the real desktop campaign pass (phone intentionally skipped there). Both builds/25 local migrations pass. Generated unit-pack/hash/provenance metadata is updated; unrelated empty art metadata was restored. The campaign smoke report explicitly retains a conservative gearless baseline, with no final R16 balance/viability claim. Free Graphify refreshed (3041 nodes/7466 edges/164 communities). No creative assets, permanent inventory grants, numerical seed retuning or native/deployed acceptance. GitHub delivery was blocked at the original verification; the four-commit transfer was delivered on 2026-10-13 as recorded below.

**R06-D1 locally verified:** supported `heal_bonus_pct` and normal-action `focus_gain_pct` now travel from owned/virtual loan gear into a closed version-1 server-frozen equipment snapshot. Outgoing healing (including regeneration) applies the source bonus before the missing-HP cap; basic/active Focus applies its bonus with existing status scaling before integer rounding/maximum. Fixed Focus grants and incoming-hit limits retain their contract. Absent fields preserve older sessions; malformed supported bonuses fail admission with 503 before a session write. No roll ranges, fees, RNG order or signature magnitudes changed.

Six engine cases (four original cases failed before correction), two real D1 session cases and a canonical Brin loan/CRC bonus fixture, **612 application/tool tests**, lint/typecheck and both builds pass. Honest client/server hashes match the recorded D1 battle audit after unequipping; submitted replacement parties are rejected. Real local-Worker campaign passes on desktop (phone explicitly skipped there), all 25 local migrations apply. Free Graphify refreshed (3047 nodes/7493 edges/159 communities at source verification). Effect/element resistance, undefined signature procs and broader semantic decisions remain open; R06 is partial. Main delivery was blocked at that observation; the transfer delivery below supersedes that blocker. The five-hour scheduler process is alive and retains 17:16:48 UTC as its next attempt; this is not independent model-access proof.

**R06-D2 locally verified:** authored weapon/signature passives currently contain names/text/IDs without executable ops or a specified magnitude. New equips and owned/virtual-loan admission now reject those undefined effects rather than silently ignoring them. Metadata is bounded/validated; inventory reports `supported: false`, Armory explains that the passive is unavailable and disables EQUIP while retaining REMOVE. Legacy equipped instances remain owned and removable; already-frozen battle sessions retain their original replay contract. Delivery, rewards, gacha results, balances and historical data are not rewritten.

Two regressions failed before correction; malformed/future-ID metadata and virtual-loan guards also pass. **615 application/tool tests**, **33 Python checks**, lint/typecheck, both builds/all 25 local migrations and two real-Worker desktop/touch-phone Armory cases pass. Unsupported taps send zero equip requests; normal gear still equips, and original frozen sessions still complete. Screen evidence is inspected; this is local browser/Worker proof, not native/staging acceptance.

Remaining R06 work:

- Define/version the remaining status/DoT/regeneration/cooldown/event/RNG order and rounding. Resolve redirect precedence, Soaked, Soul Link, absolute versus relative lowest HP, shield copy, fresh-bar phases/objective hits and source text overrides using [OPS_SPEC](docs/combat/OPS_SPEC.md) and vectors. C01–C39 remain review proposals.
- Close effect/element resistance semantics and either retain explicit rejection or supply reviewed finite declarative ops/magnitudes for the authored signature echoes. Heal/normal-action Focus and canonical loan loadouts are implemented; sold supported effects must work. Effective stage-gate identity authority follows R07/R08; full no-gacha viability and final values remain R16.

**Accept when:** hand-checkable control/Auto/expiry/proc tests and server/client replay agree; every sold supported stat/proc works; valid configuration cannot create progression that fails battle admission; guest/recruit strategies remain viable. Tune final numbers only after these semantics stabilize.

### R07 — Canon compiler and semantic content validation

**R07-A locally verified:** the shared effective-content validator now rejects duplicate unit, skill, status, boss phase/objective, chapter and globally scoped node IDs. A linear, nonrecursive walk rejects self, same-chapter and cross-chapter prerequisite cycles while accepting acyclic routes independent of chapter order. Draft creation and publication return `content_invalid`/422 before writing/signing or advancing the channel; the existing device activation and campaign compiler use the same validator. Current base and campaign content remain admissible.

Eleven schema and three real D1/API regressions pass; thirteen rejected-input cases failed before correction. All **629 application/tool tests**, lint/typecheck, both builds and campaign compilation pass. Five actual local-Worker desktop/phone graph-rejection and Control Center/campaign scenarios pass with all 25 migrations (phone campaign intentionally skipped); both rejection screenshots were inspected. Graphify refreshed (3047 nodes/7973 edges/143 communities). Full story/source coverage, formation/reference validation, effective economic catalog references and native/deployed acceptance remain open; R07 is partial. No canon, rewards, numeric combat policy or paid media changed.

**R07-B locally verified:** encounter and frozen-party schemas reject per-side slot collisions, repeated player copies and duplicate guest declarations. Effective content checks character/enemy kinds for parties, guests, enemies and summons; intent/phase signature IDs must name the unit's own skill. Immunity/preservation references and status/tag predicates are resolved across nested all/any conditions, effect guards, damage modifiers, hooks and continuous modifiers. Draft/publication reject invalid inputs before changing the active release, signing or recording success.

Thirty additional schema cases and three real D1/API cases pass; **31 rejected-input regressions failed before correction**. All **662 application/tool tests**, lint/typecheck, game/admin builds, campaign compilation and 46 adapter checks pass. Five real local-Worker desktop/phone formation/reference rejection and Control Center/campaign cases pass with all 25 migrations (phone campaign intentionally skipped); settled rejection screenshots inspected. Graphify refreshed (3045 nodes/7977 edges/153 communities). Existing T-3 three-front-enemy staging, repeated enemy types, per-side slot reuse, sparse slots and the declared six-guest 7-4 list remain admissible; existing five-member composition is retained. No canon, battle RNG/math, catalog values or paid media changed. Full canonical story compilation, broader cross-resource/economic catalog validation and native/deployed acceptance remain open.

**R07-C1 locally verified:** authenticated story completion now records a reward-free, zero-star/one-clear node and its exact original result atomically in the existing operation journal. Story prerequisites use clear completion while battle prerequisites retain stars; subsequent battles can open after a story. Account/release/prerequisite guards run again inside the transaction. Concurrent retries, repeated reads and response loss preserve one completion; a killed release still permits original-result recovery. No migration or historical progress repair is required.

Signed-in Chapters uses authoritative account progress and discards stale views. Story callbacks pin their opening account/release, persist the original request and only advance after confirmation; failed saves expose retry/back. Saved Actions labels and status verification support story progress. Eight D1/API and five client cases, **675 application/tool tests**, lint/typecheck and 46 adapters pass. Actual local game/admin builds and all 25 migrations pass; desktop/phone real-reader response-loss/reload recovery confirms through status with zero extra POSTs and preserves cross-account isolation. Two existing Control Center cases also pass; reader screenshots inspected. Graph3055/8001/144. The initial browser assertion expected a fresh application even though startup had already applied the fixture; the corrected check verifies the actual active release. Full canonical compilation, phase interludes, post-battle resume and native/deployed acceptance remain open.

**R07-C2 locally verified:** [campaign story compilation](docs/CAMPAIGN_STORY_COMPILATION.md) now uses the canonical manifest and seven chapter files for **all 51 ordered entries / 419 unique line IDs**, producing 88 scenes (70 pre/post, 16 standalone, two phase interludes). The index has 54 nodes including the three existing tutorials. Exact spoken text/speaker/emotion/voice tags, source SHA-256, scene links and line/order coverage are tested; publication/device validation rejects inconsistent coverage, prerequisites, provenance and boss-phase bindings. Stage IDs, recruits, guests, drops and numeric mechanics retain their existing snapshot values. Canonical chapter IDs replace the shortened snapshot names for chapters 2 and 5 after exact stage mapping checks.

Canonical chapter-1 music prefixes and chapter-7 after-battle directions now take precedence over the drifted snapshot. Direction/cue prose and Japanese voice labels are bounded production metadata; unavailable media is silent rather than substituted. Eleven new location placeholders use the existing gradient method. Current manual skill/target tutorials supersede legacy automatic-combat/portrait-tap instructional copy; that prose is not executed. The 107 embedded entry dialogue lines remain unchanged. Both Construct phase interludes bind to its real Aether Ward and pause/resume battle presentation without changing actions or RNG. Locked menu titles hide future chapter/reveal names; world grading no longer dims the reader HUD.

Eleven compiler, ten semantic coverage and four additional D1 publication/512-file cases pass; **700 application/tool tests**, lint/typecheck, both builds/campaign and 46 adapters pass. The local-Worker matrix passes 15 browser cases with all 25 migrations (phone campaign intentionally skipped). Screenshot inspection caught phase readers rendering behind the paused battle; explicit scene ordering and a new render-order assertion fix that defect, with two final desktop/phone canonical cases and game types/lint rerun successfully. Settled opening/phase screenshots inspected. Initial fixture failures involved premature scene polling, preserved audit records and comparing query timing metadata; corrected checks now verify actual progress, isolated IDs and financial rows. Full chapter/First Oath, reusable companion/codex/event gates, post-battle resume, production media and old-AAB/native/deployed acceptance remain open; R07 is partial.

**R07-C3 locally verified:** the compiler now carries the manifest’s seven canonical First Oath choices, source hash and battle/story gates into the index. An invitation earned after 1-2 can be used after the First Oath scene is durably completed. The server discloses eligible choices only at that gate and atomically spends one item with the existing character/copy grant and exact-input original-result journal. Account, release, completion, item and character eligibility are fenced inside the transaction. Recovery retains the actual original duplicate payout even after later grants or a killed release; no currency, Ration or new migration is involved.

The Invitations screen opens after First Oath and from Roster, reviews the chosen companion before spending, blocks another choice while confirmation is pending and recovers through Saved Actions/status after response loss or reload. Account changes clear selections and discard stale callbacks. Twelve D1/API, six client, seven schema and one compiler cases pass; **726 application/tool tests**, lint/typecheck, campaign/game/admin builds and 46 adapters pass. Twelve existing Control Center/canonical-story browser cases and two final desktop/touch-phone First Oath cases pass against real local Workers with all 25 migrations. The final cases prove commit-before-response-loss, reload/original-status recovery with zero extra POSTs, the full chapter and account-change isolation. Choice/confirmation/settled result screenshots inspected. Initial harness failures involved queued scene overlap, an intentionally aborted request logged without its URL and an early click before input registration; corrected scene waits, URL-bound error recording and settled input pass the final rerun. Graphify refreshed (3116 nodes/8152 edges/157 communities).

A new account completes all five chapter-1 battles, the opening, First Oath and camp with Brin, the selected Iona and the three starter companions, with no wishes or ads. This checks one canonical choice and legal manual active/ultimate actions for the last three battles: default level-1 Auto lost 1-3, and account-level growth caps cannot be bypassed. The test catalog initially used generic ten-HP fixtures; the chapter check now loads actual canonical stats. No values were tuned. Full seven-choice/Auto feasibility and account-XP progression remain R08/R12/R16; reusable companion/codex/event gates, post-battle/checkpoint resume, effective catalogs and native/deployed/old-AAB acceptance remain open. R07 is partial.

Extend [semantic validation](packages/content-schema/src/validate.ts) beyond Zod shape: globally unique node/unit/skill/status/phase/objective IDs, legal slots/parties, no dependency cycles, known waves/guests and authoritative reward/drop/gear/banner references. Unknown drop tables must fail validation rather than silently grant nothing.

Provide reusable companion/codex/event/spoiler evaluation from stable IDs and server/account stage completion. Keep mechanical boss intents free of ungated lore.

**Accept when:** source coverage and rejected-publish tests catch omissions/malformed graphs; one full chapter follows authored order and recruits correctly on a no-gacha account. Later companion/event content may be patched, but its interpreter/gating must already work.

### R08 — Versioned effective catalog and full content grammar

A unit/art JSON patch currently does not introduce the D1 characters, skills, gear, items, drops, banners or config needed to recruit/grow/equip/summon it. Define one **versioned effective server/client release**, stage and promote its catalog with validated references, and retain the relevant historical party/rule/effect snapshots. Live editable balance must not become an untracked second truth.

Implement finite precompiled story/UI/effect grammar for JA voice assets and EN subtitle cues, emotions, stills, preauthored video/cinematics/animation, camera/layers/masks, branches/flags/checkpoints, locale packs, audio maps and declarative event/banner/shop/mission schedules. Validate every admitted JSON kind; arbitrary JSON passing a file allowlist is insufficient.

Complete patch delivery contracts:

- Align server dependency chains with the client's base-only overlay: enforce a compatible base-only/flattened contract or explicitly implement supported chains with same-channel/generation validation.
- Carry min/max client, content schema/capabilities, dependencies and rollback compatibility through draft authoring, signing, activation and rollback; do not widen limits on republishing.
- Define trusted signing-key rotation/revocation/root-intermediate strategy or state when a new AAB is necessary; currently trusted public keys are compiled into the client.
- R07-C2's larger patch exposed the installed D1 runtime's 100-parameter query limit. Draft hash reads now deduplicate and chunk at 100; real D1/API tests exercise all 512 allowed files and a missing object in the final chunk before any draft/file/audit writes. Current documentation retrieval returned 403, so the limit evidence is the actual runtime failure and passing regression. Broader season subrequest/memory budgets and complete effective JSON loading remain R08 work.
- IndexedDB writes must resolve on transaction completion and fail on abort/quota error, not request success alone. Preserve healthy state before cache collection.
- Budget actual retained active/previous/staged/partial objects and device quota, reserve safely, collect orphans, report persistence loss and handle low disk/QuotaExceeded without corrupting progress.
- Current resume reuses completed files, not partial byte ranges. Add appropriate deadlines/abort/retry, cancellation/network-data policy and range/chunk handling where justified for large media; measure on WebView.
- Clean obsolete Blob URLs/textures safely across releases and rollbacks; bound cache memory.

**Accept when:** a new hero can recruit→grow→equip→summon→fight, with new boss/chapter/banner/event/media/balance in consistent data. Interrupted/corrupt/offline/incompatible/low-storage patches retain a usable previous state and never introduce executable code. Complete the signed-original-AAB proof in R18.

### R09 — Entry, narrative continuity and returning-player flow

The prologue's outgoing text fade starts immediately before reusing the same caption/body for the next scene; real Chromium showed second-shot narration alpha 0. Use correct layer/tween lifecycle and test visibility across all nine shots. Authored holds sum to 120 seconds; repeated 800 ms overlap subtraction implies 112.8 seconds to ending, which needs a whole-timeline measurement/defined overlap contract.

StoryRunner has a save format, but StoryScene creates it fresh and ignores checkpoint events. Persist account/content-scoped scene/line/choice/read-skip state and restore across pause/force-stop/offline. Resume a completed battle into its post-scene without refighting or duplicate rewards.

Completed-entry BEGIN currently selects the first tutorial node. Use authoritative next-playable campaign/Continue state; first restart leaves campaign 1-1 unstarted and tutorial replay is explicit. Finish must distinguish local save, durable cloud-pending and confirmed state; native relaunch failure needs truthful retry/fallback. A missing mandatory prologue must not silently count as seen.

Also preload commanded background locations, implement fade-in events, map errors to useful player messages and activate a team only after its edited preset was saved successfully.

**Accept when:** sign-in→opening→all three manual tutorials/interscenes→Finish→verified patch/restart→campaign Continue and mid-scene/post-battle resume work without lost/duplicated progress on desktop/touch and Android. Keep entry timing, no-Skip/no-speed/no-battle-Auto rules intact.

### R10 — Layout review, safe areas and accessibility

Build free **A/current, B/arena-lite, C/AFK-faithful** data-driven layout candidates with identical content. Show phone/desktop 2v2/5v5/boss/objective/summon cases side by side. Owner chooses before locking chibi dimensions/pivots/background safe zones or paying for dependent art.

Apply actual safe-area insets/reflow to HUD, modals and touch zones; the helper currently has no callers. Add checkpoint-safe WebGL context recovery and responsive quality tiers rather than a fatal-only overlay.

Wire stable EN string keys; implement text size/contrast/flash/reduced-motion preferences, physical-size touch targets, status shape cues and critical TalkBack/keyboard/focus semantics. Settings/privacy remain reachable before sign-in. Show exact material/currency costs, result/cap/rank/stats, remaining wallet, XP waste and affordability/gate reasons before growth actions.

**Accept when:** comparison artifacts are reviewable, the chosen contract is recorded, small/notched landscape devices remain readable/targetable, and core flows work under accessibility/lifecycle stress. Portrait-led final polish follows R15.

### R11 — Native identity, purchase recovery, privacy and release build

- Native Billing ignores asynchronous results without an active purchase call; one-time RTDN only notes completion and restoration runs only when Shop opens. Add startup/resume/background/pending/reinstall reconciliation, transient-versus-permanent error handling and safe backend retry.
- Use the existing ProductDetails/getProducts bridge in shop UI. Display localized price, selected base plan/offer, pricing phases, recurrence/trial terms and cancellation/restore paths before purchase; do not blindly choose the first offer or invent prices.
- Implement native secure session storage plus refresh/re-auth/revocation/account-switch recovery; the opaque bearer currently lives in localStorage. Complete genuine web staging Google identity with configured credentials.
- Make UMP privacy options login-independent/reactive, including grant/refusal/withdrawal/offline retained state. Define approved age/TFUA/child-directed configuration; a teen ad-content rating alone is not an age/consent policy.
- Ad UI must track nonce/transaction-specific server pending/verified/rejected/test status. Unrelated wallet growth or a polling timeout cannot establish reward success; test-key callbacks intentionally do not mint real rewards.
- Inventory every collected/retained field and mutable table, including battle sessions, for full export/deletion/support and deletion-on-restore. Retain only justified financial/legal records under defined retention, with public privacy and deletion request routes.
- Fix the native instrumentation fixture's wrong package assertion (com.getcapacitor.app versus io.github.mucaeksi.unawareofmydemise). Test actual native interactions; 2+2 or screenshot byte size does not prove playable acceptance. Close Google executor/BillingClient connection lifecycle leaks.
- Make signing/environment/versionCode/test-ad/native SDK gates explicit and fail closed. A default staging endpoint, unsigned bundle or unintended live ad unit is not a store-ready release. Preserve the owner-held upload key; do not replace/recreate it.

**Accept when:** identity/store/consent recovery contracts are testable and release configuration is reproducible; the physical signed Play sandbox matrix in R18 verifies pending/completion/refund/renewal/reinstall/resume/deletion. Legal identity/contact/domain/retention/territories/Data Safety/IARC facts must be supplied, not invented.

### R12 — Required mode and progression foundations

Implement separate, complete slices sharing existing combat/ledger/grants:

- Sweep: server clear eligibility, reward/Ration/task accounting and repeated/concurrent claim limits.
- AFK: server-clock elapsed time, cap/checkpoint, offline return and idempotent claims.
- Achievements, unlock gates, event/season schedules and rewards; social/profile/leaderboard foundations.
- Async arena defense/match/season settlement and endless run/wave/modifier/snapshot mechanics.
- Multiwave admission/interpreter: current compiler takes only the first wave; all existing 35 stages are single-wave, but future extra waves must not disappear silently. Validate summons' tuning snapshot, scaling, reuse and formation slots.
- Character-bound Memory Shards' nonmandatory sink/excess/benefit policy. Do not turn them into another main currency or require duplicate pulls for story access.

**Accept when:** each mode executes a schema-valid example with authoritative results, abuse/concurrency/lifecycle tests and explicit compatibility. Launch locks may hide later content, not missing promised mechanisms. Do not add broad guild/chat scope without an approved need.

### R13 — Control Center workflow and authorization completion

Preserve the existing 13 pages, Access/JWT/RBAC/CSRF and audit foundation. Complete:

- Narrative Studio scene/VO/locale/spoiler preview and versioned Git canon reconciliation; design editing for skills/enemies/AI/bosses and staged simulations.
- LiveOps events/seasons/schedules/cohorts/mail/claims; Media Factory jobs/references/budget/quality approval; monetization entitlement/refund/ack/recovery/revenue reconciliation, ad placements/caps and consent reporting.
- Release composer: upload/build draft→semantic validation→file/config diff→compatible preview→approval→canary→adoption/error monitoring→rollback/kill. The owner should not need CLI choreography for normal publication.
- Sum premium attachments for owner thresholds: two 4,000-token attachments bypass the current per-attachment 5,000 check. Make mail/compensation grant and immutable admin audit atomic; preserve request replay.
- Product kind/version and banner state updates need truthful CAS/outcomes/audit; rejected/no-change writes must not claim a completed action.
- Bind owner-approved art to actual R2 hash/size/model/prompt/reference/cost/licence provenance. Operator-entered “approved” metadata or nonexistent object hashes cannot pass a store publication gate; pending preview media is explicit.
- Persist reviewable sensitive approval records and verify the actual Access MFA policy. Do not invent a second reviewer if there is only one owner.
- Add bounded cursor/filter/detail/export for characters/assets/releases/players/audit/purchases; measure/index/preaggregate expensive full-table polling so support can inspect complete history without runaway row scans.

**Accept when:** the owner can run a real scene/banner/event/media release and finance/support recovery through secure UI, with correct environment, authorization, version, audit and rollback evidence. Required dashboard/crash/revenue/privacy/security modules use real sources rather than decorative placeholders.

### R14 — Google media budget, provenance and deterministic ingest

Approved authority is [content/budget/media_budget.json](content/budget/media_budget.json): **1000 TL/month, recorded as $20/month, $3 per batch, at most three paid attempts per asset**. Recheck exchange/provider prices before spending so the owner's TL limit is respected; this is not zero budget or approval for a broad batch.

| Source media | Approved workflow |
| --- | --- |
| Portraits/chibi/backgrounds/UI | Google Gemini image models with locked identity/reference/provenance. |
| BGM/themes/loops | Lyria 3.5; not dialogue TTS or unverified arbitrary SFX. |
| Dialogue | Chirp 3 HD, reviewed Japanese transcript/casting bound to stable line IDs. |
| Cinematics | Veo 3.1 Lite; silent/video-only capability/pricing only when the actual endpoint supports it. |
| SFX | Verify an appropriate Google-based source workflow; independent local processing/export is allowed. |

Model names are owner direction, not proof of live endpoint availability. Before the first paid call, verify actual model/version, request shape, quota, price and licence. Keys remain server-side. Workflow: dry-run→conservative durable **per-call** reservation→bounded call→sanitized usage/outcome/provenance→visual review→settlement/upload/manifest.

Fix unlocked JSON read-modify-write reservations, count>1 calls sharing one “attempt,” canceled/timeout attempts disappearing from the cap, unknown provider charges, last-call-only usage and missing partial-output sidecars. Persist/reconcile accepted-but-uncertain calls; changing a failed prompt is required after the retry cap. Test concurrency/crash/timeout/partial success offline without spending.

Implement **tools/ingest_art.ts**, approved-art assembly and **strict-art** validation; those named plans are not code yet. Current build_content.ts still reconstructs provisional archived Git media. Offline ingest/QC must deterministically key/slice/atlas/export with alpha/pivot/crop/reference similarity, codec/size/memory/licence/hash/provenance checks, approved-first builds and store rejection of placeholder/legacy/unapproved output.

**Accept when:** every actual paid call consumes the correct budget/attempt, uncertain charges remain reserved until reconciled, all partial output has provenance, and reproducible offline ingest/strict-art can build approved media without calls or hidden overrides.

### R15 — Small visual pilot and character attachment

After layout approval and safe ingest, lock one original Fadyme/Mahmut identity pilot, expression sets and correctly aligned chibi key poses (initial eight-pose contract), then tutorial enemies, all nine prologue plates and the roadside-rest/shelter illustrations. Grow the 47-entity backlog through approved patches rather than one broad spend batch.

Use locked character sheets/turnarounds/front-side-back, costume/weapon identity, expressions, texture/animation/audio cue maps and adult-age provenance. Compare similarity/hashes and inspect every result; do not borrow a mismatched body/hair/outfit/pose. Resolve current reference costume/hood-versus-cape and studio mark decisions through reviewable alternatives.

Polish portrait-led roster/character/team/summon reveal and restrained navigation/VFX around relationships and tactical roles, retaining rates/pity/history transparency and exact spending information. Preserve approved third-party engine credit/licences separately from commissioned Google art.

**Accept when:** pilot identity/poses/alpha/pivots/readability/cohesion are owner approved and perform on Android; required initial content no longer uses placeholder art. Broad campaign production stays patchable; initial polish must not wait for all future characters.

### R16 — Final balance, recovery floor and sound/VO production

Reward/fee quantities remain placeholders/proposals until the final math pass. [TUNING_PROPOSAL](docs/economy/TUNING_PROPOSAL.md) is **not applied approval**. Decide the unconditional supply/recovery source, real fee/reward changes, targeted material route availability and the final-boss repeat-5★ versus first-clear-only contradiction explicitly.

Replace averaged cash proxies with actual versioned fees, XP/material availability, account/ascension/story caps, skills/gear/loans, Ration/AFK/Sweep, daily/weekly claim windows, drops and pity timelines. Simulate chronological fresh accounts: all-in-wishes/balanced/no-pulls, no-ads, missed windows, caps and zero balance. Demonstrate recovery to an affordable next legal step within a daily cycle through predictable free sources; optional ads/subscriptions, winning blocked content or amortized weeklies cannot be its guaranteed floor.

Current campaign probes are smoke tests, not sequential feasibility: they may recruit after losing a preceding probe and omit actual gear/manual progression. Validate the full required story with no gacha gate and sensible manual/Auto challenge before signing off numeric balance.

Then produce final sound/music/VO/cinematic assets within R14's guard, as the owner requested. Establish voice mixer/cue/decoder/subtitle interfaces early, but record reviewed Japanese transcripts/name readings/casting rather than feeding English dialogue into a Japanese voice. Bind subtitles and cues to stable IDs, measure video/audio encoding, looping, pause/resume/ducking and device decoder behavior.

**Accept when:** actual-config sequential playthrough/simulator conservation/material gates are viable, desired no-ad recovery holds, cost/result UX matches authoritative values and reviewed audio/media work with the complete runtime on target devices.

### R17 — Telemetry, capacity, build and encrypted recovery

Use actual Cloudflare rows read/written/query/CPU/p95/error/storage/cost data and native crash/performance, player retention, actual revenue and patch download/adoption metrics. Existing error/callback logging and “usage not connected” states are retained; do not derive nonexistent successful-request SLO/revenue charts from incomplete logs.

Measure expensive dashboard/monitoring scans, large content validation and exports. Backup currently loads SELECT * before enforcing its row cap; use bounded/streamed consistent export and scale proof. Keep healthy-state reconciliation and appropriate forensic handling of an unhealthy dataset.

Complete encrypted full restore with the **owner-held age private key**, compare hashes/table/FK/ledger consistency, restore duration and RPO/RTO; a prior deleted plaintext-probe drill is not encrypted production recovery proof. Include D1 Time Travel recovery and periodic exports within the applicable provider limits. Define R2 retention/lifecycle, privacy deletion-on-restore and periodic recovery rehearsal; no substitute new key.

Service-binding admin 401 proves in-app auth, not Access-edge/MFA protection. Add independent authorized external health/alert coverage with tested delivery/escalation and an owner-chosen destination. Do not auto-send Slack/email or create new permissions to claim an alert works.

Record/reproduce live Workers Builds settings, test/content/build gates, tags, path filters and single migration owner. Add isolated PR preview datasets plus native/emulator/E2E gates through the current approved pipeline; snapshot/live configuration requires actual read permission.

**Accept when:** bounded operations meet measured capacity/SLO/cost targets, encrypted recovery and alert delivery are demonstrated, deployment evidence maps to the exact code version and outages do not silently depend solely on the failing application database.

### R18 — First-store-AAB acceptance and public release

Before store submission, every required capability has functioning code and evidence. Use a reproducible, explicitly configured, signed native build with a strictly increasing version code. Run emulator **and physical Android** checks; a desktop/touch viewport is not hardware acceptance.

| Gate | Required proof |
| --- | --- |
| Identity/save/privacy | Real Google subject mapping, expiry/revocation/re-auth, reinstall/account switch/deletion and lifecycle/cloud checkpoints; UMP grant/refuse/withdraw and accurate public privacy/deletion/Data Safety/IARC. |
| Financial correctness | Physical signed Play sandbox one-time/subscription/pending/ack/refund/cancel/hold/grace/recovery/RTDN replay; verified rewarded test-ad/SSV flows, consent/caps and one authoritative fulfillment. |
| Narrative/experience | Authored ~120-second opening, visible text, manual T-1/T-2/T-3/interscenes, Finish/download/restart, correct Continue and canonical no-gacha chapter flow. |
| Runtime/mechanics/admin | Required managers, locale/accessibility/audio/chibi/cinematic grammar, 5v5 and complete promised mode foundations, secure operational Control Center and audited server economy. |
| Unchanged-AAB season | Record original signed AAB checksum. Apply **one data-only season** with new chapter, playable hero/chibi animation, boss, limited banner, event, cinematic/music and balance, to that same unchanged AAB. Prove recruit/growth/equip/authoritative battle and compatible backend catalog. |
| Fault/performance | Low storage, corrupt hash/signature, partial download, offline, force-stop/restart, context loss, rollback/kill, long sessions, cold start/memory/frame pacing and device codecs; 60 FPS is a measured target where feasible, not a fabricated claim. |
| Ops/security | Current authorized Cloudflare source/deploy evidence, least privilege/MFA/source and relevant security audit, cost/health/crash/patch alerts, encrypted restore/retention and CI/build gates. |
| Store rollout | Internal test → any required closed test → owner-approved staged production. Publishing a public Play build and creating production remain separate approval gates. |

Review [QA_ANDROID](docs/QA_ANDROID.md) against these gates and current decisions. Mocked external services, green unit tests, a produced AAB file or a past preview do not close device/store gates.

## 7. Execution, verification and handoff

**Current owner assignment (2026-10-12):** continue all infrastructure packages in dependency order without waiting for another task selection. Apply the pinned skills at task-appropriate depth (Ponytail `ultra` requested), update this README and scoped evidence after each verified slice, then fast-forward main. Defer creative/paid asset generation (R15 and production-media portions of R16); implement independent schema, budget, offline ingest, runtime and QA foundations. External/device/store/restore gates retain real evidence requirements. [NEXT_STEPS](docs/NEXT_STEPS.md) describes the five-hour runner and its actual host/network limits.

**Continuation verification (previous host):** `python3 tools/resume_infrastructure.py --loop --isolated` uses its own recorded Git worktree, preserving the primary checkout even when it contains unfinished work. Parent/session locks, full-worktree fingerprints, ownership/common-repository checks, exact-thread retry (including clean interrupted attempts), bounded process-group termination and a persisted five-hour schedule passed **27 Python checks at that delivery**; the current tools suite has 33 including the migration and five terminal-startup cases. An actual isolated dry-run preserved the primary branch/HEAD/tracked/untracked changes and made no model call. The **2026-10-13 10:16:48 Europe/Bucharest** attempt started the independent CLI but received model-startup HTTP 403, with no agent/tool work. Its verified owned process group was stopped, leaving the live scheduler and recorded interrupted thread intact. The next **2026-10-13 15:16:48 Europe/Bucharest (12:16:48 UTC)** attempt also received HTTP 403 and a terminal error item, with zero successful model/tool items. Its verified owned process group was stopped; the updated live scheduler preserves the interrupted thread/fingerprint and next deadline **2026-10-13 20:16:48 Europe/Bucharest (17:16:48 UTC)**. The runner now stops a terminal startup failure before any model work instead of waiting the entire execution timeout; normal work, uncertain logs and retryable errors retain their execution behavior. These five new guards pass in actual subprocess tests. Processes survive only while this host stays alive. Isolated runs use the owner's authorized full-access host scope so shared Git metadata can be committed/pushed; outer network policy still applies. Fresh workspace dependencies must be installed there, with no symlink to primary workspace packages.

**Previous-host model-access evidence:** environment revision 57 is running/connected/current; policy observation is `unknown` and the desired host list has no `chatgpt.com` rule; previous independent CLI startup received proxy HTTP 403 and timed out. The confirmed saved environment draft (revision 2) contains current Phaser/D1 setup and the model-host rule, but its publication is not active and no publish/apply tool is exposed. Scheduled/dry-run success is not usage-reset or model-execution proof. The active chat continues independent engineering.

**Transfer delivery (2026-10-13):** imported the verified delta bundle at `54e27c74` and fast-forwarded main through `d791b0f9`, `b93d0168`, `573705db` and `ee3e7bab`; a fresh fetch confirms `origin/main = ee3e7bab`. All **615 application/tool tests**, **33 Python checks**, lint/typecheck, 46 adapter checks and game/admin builds pass in the new isolated checkout. Actual local game/admin Workers apply all 25 migrations; desktop/touch-phone Armory and desktop campaign pass (phone campaign intentionally skipped). Both settled Armory screenshots were inspected. The first browser stack timed out; setting writable `npm_config_cache` and `XDG_CONFIG_HOME` resolved startup on retry. The previous GitHub delivery blocker is resolved. Prior scheduler PIDs/deadlines/environment observations are historical and were not transferred; no new independent model run or deployed/native acceptance is claimed. Continue independent R07 semantic validation while remaining R06 decisions stay open.

For an authorized full-game engineering assignment, refresh R00 and start R01 or the earliest still-open dependency. For a selected smaller task, complete that task and its necessary dependencies only. This document is also the Sonnet/Claude/Codex handoff; a separate duplicate prompt is unnecessary.

1. Read this README/entry instructions and relevant canon/skills; inspect branch/status/worktrees and current main. Revalidate the affected audit finding instead of reimplementing finished work.
2. Choose one bounded, complete vertical slice with observable player/ops behavior and acceptance. Add meaningful regression tests for correctness flaws; avoid decorative stubs or tests that merely mirror implementation.
3. Implement within the approved stack/authority/data grammar. Preserve foreign work and historical compatibility; report proposal-versus-decision boundaries.
4. Run scope-appropriate checks. Application changes normally need lint/typecheck/unit/Workers plus affected browser/content tests; native changes need native/device gates. Documentation-only work needs links/format/diff/decision-coverage checks, not a new gameplay PASS claim.
5. Meaningful application changes need a functioning Cloudflare game preview and separate secure admin preview where possible, with isolated data and screenshots/console/network/performance evidence. Inspect actual touch state and safe version/Ray/reason/status logs for authorized staging. Deploy only within the assigned authority, verify the source tag before a live claim and report missing access as a blocker instead of fabricating preview success.
6. Review diff/secrets/unrelated changes, refetch main, integrate intervening work and rerun affected checks. Deliver reviewable commits according to section 1; do not force-push.
7. Update factual evidence/state/backlog and give concise Turkish outcome, IDs, branch/commit, actual successful/failed/blocked checks, real preview/screenshots if produced, exact blockers/cost and next concrete action. Continue independent authorized work rather than stopping at the first missing credential.

Use repository scripts as applicable:

~~~sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build:content
npm run build:campaign
npm run build
npm run e2e
python3 tools/sync_codex_skills.py --check
python3 -m unittest discover -s tools/tests -p 'test_*.py'
~~~

Respect pinned package/tool sources and current host permissions; installation alone is not connection evidence. Run remote/browser/native commands only with explicit appropriate targets, credentials and scope. **Never rebuild mutable content while its E2E stack is reading it, or run two stacks on the same ports/state.**

At a context/session boundary, preserve latest/start HEAD, finished/in-progress IDs, edited files, exact checks/results, integration status, unresolved decisions, budget reservations/unknown charges and next concrete action. Resume from that state; do not restart completed work or claim an automatic scheduler/usage-limit wake-up capability the host does not provide.

### Owner-dependent inputs

Finish a concrete reviewable result before requesting the decision. State its exact source/impact and continue other work.

| Input | What must be prepared/verified |
| --- | --- |
| Art/layout | Same-content A/B/C comparison, approved portrait/chibi/reference/costume contract, studio mark and required credit decisions before dependent paid production. |
| Google identity | Actual Android/Web OAuth identifiers, consent configuration, package and upload/app-signing SHA-1s; public IDs are not proof a credential is usable. |
| Play/RTDN | App/product/base-plan IDs and prices, testers/internal track, minimum service-account permissions, PLAY_PACKAGE_NAME, RTDN_AUDIENCE and RTDN_PUSH_SERVICE_ACCOUNT; GOOGLE_PLAY_SERVICE_ACCOUNT belongs in the Worker/approved secret store. |
| AdMob/UMP | App/unit IDs, test/live handling, SSV callback and app-ads.txt/public website, approved audience/consent policy. Revalidate current callback rather than resending live financial tests without need. |
| Native signing | Owner-held upload key and secure UOMD_KEYSTORE_FILE/PASSWORD/KEY_ALIAS plus explicit versionCode/environment; no secret values in chat/source. |
| Economy/legal | Unapplied reward/fee/final-boss/shard/refund decisions; actual operator/contact/domain/retention/public deletion/IARC/Data Safety facts. |
| Media/alerts/recovery | Existing R14 budget or explicit increase; owner-approved alert destination; owner-held age decryption for full restore; production/public release approval after R18. |

[docs/AAB_ACCESS_PLAN.md](docs/AAB_ACCESS_PLAN.md) records setup history/public IDs but also obsolete Actions/permission assumptions. Revalidate live access; do not request the owner's password, recreate an existing upload key or assume every described console scope is granted.

## 8. Skills, pinned tooling and reference map

Claude skills are in .claude/skills/; Codex adapters/project skills are in .agents/skills/. Read relevant SKILL.md and linked canonical sources, not an entire catalog by keyword. Preserve Claude files/bootstrap/lock/.mcp.json when maintaining adapters; validate with the read-only sync check. [CODEX_SKILLS](docs/CODEX_SKILLS.md) contains discovery, canonical references and runtime notes.

The vetted source inventory has six ZIPs; ZIP presence is not installation or callable MCP. Use [tools/bootstrap_skills.py](tools/bootstrap_skills.py) and [tools/skills_doctor.py](tools/skills_doctor.py) for scoped verification/repair of checksums, licences and pinned revisions without restoring obsolete Actions jobs. Ponytail and Graphify remain high-priority; UI/UX Pro Max, official Phaser 4 guidance, Chrome DevTools and Cloudflare platform/security guidance are relevant when the task requires them. Apply the vetted pinned official security-audit workflow to assigned auth, payment, consent, D1, webhook, R2/patch, permissions, supply-chain and secret-handling changes; distinguish source findings from executed, authorized audit evidence. .mcp.json declares Graphify/Chrome DevTools, but verify real calls or report the rg/Playwright fallback. **Context7 is retired.**

**Tool setup verified 2026-10-12:** project MCPs enabled in `.codex/config.toml`; host trust configured for this repository. Native Codex discovery found 54 skills, all six Ponytail variants enabled, zero skill errors. Real stdio MCP calls passed: Graphify stats/query (2,705 nodes/6,771 edges/144 communities after SQL extraction), Chrome DevTools page creation and DOM evaluation on an isolated loopback page (30 tools). [build_graph.sh](tools/build_graph.sh) builds a free local code index with pinned SQL support and no LLM calls; canonical/media/vendor content is excluded, some Gradle/data constructs remain outside AST coverage. Index/report are Git-ignored, refreshed after source changes. These stdio checks do not prove tools were injected into an already-running chat; reload/restart the MCP client when required. [CODEX_SKILLS](docs/CODEX_SKILLS.md) records cache initialization and usage.

Research useful official/proven Phaser/TypeScript/D1/Workers/Capacitor/animation/audio/Play Billing/AdMob/Google/QA skills when they improve the assigned task. Inspect source, version, maintenance/licence, compatibility, duplicate instructions and executable risk; pin provenance. Documentation-only additions may proceed as reviewable work. New code-executing hooks/MCP permissions or paid services require their applicable approval; never blindly install a catalog or another engine's guidance.

Supporting records below are details/evidence/proposals. If they conflict with this README, current owner instructions, actual code or newer evidence, mark the conflict and correct the support record rather than silently changing approved decisions.

| Subject | Records |
| --- | --- |
| Canon/opening/spoilers | [narrative/00_Canon](narrative/00_Canon/), [Opening_Tutorial](narrative/02_Main_Story/Opening_Tutorial/), [spoiler policy](narrative/00_Canon/SPOILER_UNLOCK_POLICY.md), narrative/09_VN_Scripts/Runtime_Snapshot. |
| State/history | [BUILD_STATE](docs/BUILD_STATE.md), [DECISIONS](docs/DECISIONS.md), [GAME_FLOW](docs/GAME_FLOW.md), [DEV_TRACKER](docs/DEV_TRACKER.json), [INFRA_ROADMAP](docs/INFRA_ROADMAP.md), [handoff questions](docs/handoff/QUESTIONS.md). |
| Combat/economy | [COMBAT_RULES](docs/COMBAT_RULES.md), [OPS_SPEC/vectors](docs/combat/OPS_SPEC.md), [campaign probe](docs/combat/CAMPAIGN_BALANCE.md), [single-currency model](docs/ECONOMY_SINGLE_CURRENCY.md), [tuning proposal](docs/economy/TUNING_PROPOSAL.md). |
| Delivery/security | [ARCHITECTURE](docs/ARCHITECTURE.md), [PATCHING](docs/PATCHING.md), [MONITORING](docs/MONITORING.md), [RUNBOOK](docs/RUNBOOK.md), [QA_ANDROID](docs/QA_ANDROID.md), [secrets/permissions](docs/SECRETS_AND_PERMISSIONS.md), [source security review](docs/SECURITY_REVIEW_2026-10-10.md). |
| Media/locales/store | [ART_BIBLE](docs/media/ART_BIBLE.md), [EXPORT_PIPELINE](docs/media/EXPORT_PIPELINE.md), [media queue](docs/media/QUEUE.md), [string catalog](docs/i18n/STRINGS.md), [store drafts](docs/store/README.md), [THIRD_PARTY](docs/THIRD_PARTY.md). |
| Agent/tool coordination | [AGENTS](AGENTS.md), [CLAUDE](CLAUDE.md), [CODEX_SKILLS](docs/CODEX_SKILLS.md), [skill source inventory](skill-sources/README.md), [review-first template](docs/NEW_SESSION_PROJECT_REVIEW.md) only when that workflow is requested. |
