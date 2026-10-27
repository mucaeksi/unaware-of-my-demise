# Campaign battle sessions and durable recovery

**Continuation — 2026-10-27:** native companion/Team/Armory and Saved Actions presentation, plus durable companion/Sweep actions, are now implemented at local scope. [Current guide](media/SOL_COMPANY_AND_SWEEP.md). Earlier presentation limits in this document describe its original delivery. Live account, Android, human art and release acceptance remain open.

Local implementation, 2026-10-27. Unity access is CLI only. No deployment, live-account acceptance, device acceptance or
art approval follows from these checks. Entry tutorials retain their fixed-party/narrative checkpoint path.

## Runtime boundary

`UomdEntryFlow` starts campaign battles through `UomdCampaignBattle`. A stable authenticated player identity is required;
legacy sessions resolve `/me` before opening the account journal. The start request contains only release and node IDs.
The returned session, optional catalog hash and exact frozen party are bound to the release and hashes of the loaded
unit pack/encounter. The scene constructs the real combat engine with that party. A missing required party, stale content
or expired unsent session leaves an accessible Chapters exit.

Victory saves a canonical submit body before sending it. The body contains the original release, node, request ID,
returned session and at most 600 legal actions. Optional targets/sessions are omitted when absent. Client rewards, stars,
costs and combat-log hashes are never submitted. The result screen holds Continue until the server confirms the claim
and authoritative progress/wallet reads finish. Campaign completion no longer calls `UomdLocalProgress.Complete`.
Saved Actions can resume the confirmed battle's post-story while its original scene flow is still present. After an app
restart, the journal recovers the claim; the campaign narrative can be reopened from Chapters. Story-only nodes call
their existing server endpoint; their mutations are not covered by the battle journal.

`apps/api/src/progress/battle-contract.ts` owns the wire schemas. Provider tests validate real local Worker replies.
`npx tsx tools/export_unity_battle_contract.ts` derives JSON schemas and cross-runtime fixtures; its reproducibility test
and C# consumer tests check exact JSON/hash/omission behavior and frozen-party replay against authoritative combat vectors.
The extraction leaves the start/submit request acceptance rules unchanged.

## Saved operation states

The account-scoped SHA-256 filename lives under `persistentDataPath/uomd_battles/v1/`. Each account has one current battle,
bounded to 256 KiB including its checksum envelope. No token, raw account identity, wallet authority or narrative cursor
is stored. Files use flushed temporary writes and atomic promotion with a prior-copy backup. An unpromoted temporary file
is ignored after restart. Corrupt/newer journals fail closed: an older backup could predate a sent claim, so the app never
silently replaces that claim with an earlier state. Such files require deliberate recovery/support before another battle.

| State | Meaning and permitted action |
| --- | --- |
| `fighting` | Session saved; no victory claim sent. An interrupted fight starts again with a new server session. |
| `pending` | Exact submit proof persisted. Check status, then retry the same account/path/request/body. A new battle is blocked. |
| `confirmed` | Exact receipt persisted. Refresh progress/wallet; Continue becomes available only after refresh. |
| `rejected` | Explicit `session_expired` or `battle_not_won` refusal followed by unknown status. Retain proof; check status again before a new attempt. A late bound receipt can still reconcile it. |

Unknown status alone never proves failure. A confirmed status must match the original request, endpoint and canonical
input hash with `binding=exact`; legacy/unbound results cannot settle a new journal. A lost submit response is reconciled
again before exposing retry. Release authority failures retain pending proof for restoration/rollback. Unknown-session,
consumed-session, identity-collision and malformed/binding errors remain retained for reconciliation rather than being
silently discarded. There is no automatic retry loop for battle start, whose provider contract has no idempotency key.

Only one request is active at a time. Repeated taps cannot create another claim. Captured account/revision guards discard
late start/status/submit/refresh callbacks even if another screen has already rebound the coordinator. Scene callbacks
also carry the account/revision/request identity. Switching accounts preserves each journal separately.

## Inspect in Unity

Open **Window → UOMD → Production Review**, choose **campaign**, then open its isolated preview. This explicit Editor-only
fixture runs the actual manual battle, result and Saved Actions controllers. It changes T1's party mode only in memory,
supplies a frozen party, blocks all HTTP through the normal preview isolation and never writes the device journal. Its
pre-story is skipped to focus this fixture on battle settlement. Opening/entry scenarios retain canonical story review.
The fixture defaults to an offline submit; `CampaignReview.Mode` provides controlled loss, expiry, release and success
responses for CLI validation. Captures visibly say REVIEW FIXTURE and record journal/request/input-hash/refresh state.
Saved Actions still uses the existing hub presentation; a new hub/art rebuild is a separate slice.

Evidence and counts: [scoped delivery record](evidence/sol-campaign-operations-2026-10-27.json). Local Worker fixtures and
Editor events do not establish physical touch, Android process lifecycle, Google identity/Billing/ads or live release
acceptance. No human art approval was recorded and no push/deploy was performed.
