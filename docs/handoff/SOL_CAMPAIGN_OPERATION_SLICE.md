# Next slice: campaign battle sessions and operation recovery

**Delivery checkpoint — 2026-10-27:** this slice is now implemented and locally verified. See [runtime contract and limits](../UNITY_CAMPAIGN_OPERATIONS.md), [scoped evidence](../evidence/sol-campaign-operations-2026-10-27.json) and [next execution order](SOL_CONTINUATION_PLAN.md). The source-review text below records the pre-implementation boundary.

Source review: 2026-10-27, local `5b7fec3e`. This document records the next implementation boundary; it changes no runtime,
backend state, permissions, releases or account data. CLI-only Unity access, local main commits and owner-held pushes remain.

## Continuous continuation plan (owner request, 2026-10-27)

Proceed in order: provider-derived wire contracts and fixtures; account-scoped atomic battle journal; server-frozen-party
campaign routing and pending-result UI; restart, response-loss, expiry, release and identity-race checks; live CLI Editor
compilation, tests and Game-view evidence; scoped documentation and verified local commits. This authorizes local
implementation and validation. Live account acceptance, device acceptance, art approval, spending and publishing retain
their existing gates. Continue through the slice without routine approval interruptions; preserve the owner's working files.

## Current gap

The rebuilt tutorial course is locally verified. Campaign routing in
`apps/unity/Assets/_UOMD/Scripts/Scenes/UomdEntryFlow.cs` still calls `UomdLocalProgress.Complete` after local victory/story.
`BattleScreenController` constructs its engine from the embedded encounter without the server-frozen party. The API client
has a submit wrapper but no typed battle-start wrapper, and that submit wrapper generates a new request ID on each call.
Those paths are not a completed server-authoritative campaign port. The new entry cursor must not become its claim journal.

## Verified server contract

Sources: `apps/api/src/player/routes.ts`, `apps/api/src/progress/service.ts`,
`apps/api/src/player/operations.ts`, `apps/api/src/content/authority.ts`.

| Operation | Current contract |
| --- | --- |
| Start | `POST /api/v1/progress/battle/start` accepts exactly `releaseId`, `nodeId`. The strict body rejects an extra request ID. Do not use a generic helper that automatically adds one. |
| Start result | `sessionId`, server-frozen `party`, `expiresAt`, optional `catalogSha256`. The interface allows nullable values; the current implementation creates a session even for a fixed-party encounter, whose `party` is null. Honor the returned session. |
| Lifetime | Sessions last two hours; at most ten open sessions are retained. A lost start response can leave an unused session, so bounded recovery must respect this cap. |
| Submit | `POST /api/v1/progress/battle` accepts exactly `releaseId`, `nodeId`, stable `requestId`, optional `sessionId`, and at most 600 actions. Each action has `skillId` and optional `targetId`. |
| Accepted proof | The server replays the actions against published content and the frozen party. Client stars/rewards/costs and a client `logHash` are not submission fields. Omit an absent target; do not send JSON null for the optional string. |
| Recovery | `GET /api/v1/operations/<requestId>?path=/api/v1/progress/battle` returns `confirmed` or `unknown`, with binding/input-hash/result fields. **Unknown does not prove failure.** Preserve the same payload/path/account/request ID. |

Owned-party submission requires a session and rejects a wrong-stage, consumed or expired session. Successful claims and
rewards are committed atomically on the server. Before treating a session error as a new attempt, reconcile the original
request: its claim may already have committed after a lost response. Preserve the existing release-authority rules.

## One complete implementation slice

1. Add typed start/result and operation-status contracts from the current source schemas. Preserve optional/omitted fields
   accurately; extend the partial submit result only for UI fields actually consumed.
2. Add an account-scoped, bounded, atomic operation journal. Persist the exact canonical submit payload and stable identity
   before sending. Never store credentials or grant rewards from it. The narrative checkpoint remains a separate concern.
3. Start an owned-party battle through the API and construct the pure C# engine with the returned party. Bind its session,
   content release/catalog and action list to that journal. Existing `Battle.Create`/`BattleReplay` party arguments are reusable.
4. On victory, persist/submit the actions and reconcile ambiguous responses through operation status. Do not mark campaign
   progress locally until the server confirms. Keep a truthful pending/retry state and refresh authoritative progress/wallet.
5. Recover on restart/account switch, handle expired sessions and release changes without crossing accounts, and cancel stale
   scene callbacks. Keep tutorial fixed-party entry behavior and deterministic golden parity unchanged.

Accept with owned-party parity vectors, exact request/response fixtures, repeated taps, response loss after commit, restart,
unknown-status retry, expiry, release cutover/rollback, and account-switch races. Check the real Editor console/tests/captures
through CLI. Keep live staging/account acceptance separate from local fixtures. No deployment or release approval follows
from this source review. Native hub/system visuals and the broader roster still need their own OpenAI rebuild and owner QC.
