# Native Invitations and Errands

2026-10-27, D-35. Invitations and Errands use the editable native Hub frame and actual account-action service.
Invitations contain only selectors and eligible companions returned by the authenticated provider for the active release.
Choosing a companion opens a separate review; only **USE 1 INVITATION** spends it. Changing the choice consumes nothing.
Ownership and the transaction-time receipt distinguish a new companion from character-bound duplicate Memory Shards.
Back returns to the originating Company or Chapters route. Candidate names and choices never come from an unlocked local fallback.

Errands has Daily Supplies, AFK Patrol, This Window and This Week tabs. Progress, reward plans, periods and claimability
come from the provider. Daily windows expire against the last server clock plus monotonic elapsed time. Absolute UTC
end times avoid a periodic redraw that would reset native long-list scrolling. Listed weekly rewards remain claimable
during the provider's grace period; the client does not invent a grace deadline. An optional Patrol read failure is explicit
and does not disable otherwise fresh tasks. Patrol unlocks after a battle-stage clear; its preview is not a promised grant.

## Exact intent and recovery

The existing atomic account-scoped action journal now covers invitation selection, task claims, daily supplies and Patrol.
Before sending it saves the original release, request, exact body and review summary. One unresolved action blocks replacement
spending. Recovery first checks the original operation's path, request and canonical input hash, then validates its receipt.
Only an unknown status permits sending the same original body. Double taps are serialized. Account/auth/release callbacks
are fenced; returning to the original account can recover its saved operation. The journal remains durable; Editor fixtures
use a separate memory-only store. Local disk reload tests are not Android process-death acceptance.

Task claims retain the exact period and task identity, including completion rewards. Supplies retain the explicitly approved
`supply:YYYY-MM-DD` UTC day. The provider replays an existing old-day receipt before checking expiry, but rejects an unknown
old day with `period_closed` before any grant. A new day needs a fresh explicit action. The operation-status route recognizes
only the exact supplies ledger kind and input hash; generic task claims cannot settle a supplies identity.

The supplies listing advertises `periodBound: true`. The new client disables supplies when this capability is absent, so an
older deployed service cannot silently claim the next day on retry. The optional request field preserves legacy clients'
current-day semantics. This change is local and requires the matching API deployment through the owner's normal push flow;
there is no migration, binding change or deployment in this slice.

Receipts record provider reward plans; inventory caps still apply. Saved Actions labels these as recorded plans rather than
inventing an added amount. Invitation receipts preserve the original duplicate classification. Existing D1 atomic grant,
ledger uniqueness, single Bell's Remains currency, combat parity and signed data-only patches remain authoritative.

## Review and boundaries

Production Review adds `hub/invitations` and `hub/errands`. These run the actual controllers with explicitly labelled synthetic
account, clock, progress and response/status fixtures; HTTP and device preference/journal writes remain blocked. Selector
identities come from the canonical chapter index and names from the canonical roster snapshot. This is not proof of a
published patch, live provider balance, task schedule or reward rate. Metadata records the fixture, original request/hash,
receipt and active controller state. Native Game-view captures and NavigationSubmit input are Editor evidence.

No new bitmap is generated. The existing rebuilt OpenAI shelter is reused; unproduced invitation portraits are not replaced
with historical Gemini visuals. The review inventory and prior source-bound feedback remain intact.

The [scoped evidence](../evidence/sol-invitations-errands-2026-10-27.json) binds source blobs, checks, captures and restored Editor
state. Live identity/provider and matching API integration, physical Android storage/lifecycle/touch, human art/native-2K and
release acceptance remain open. Account/privacy, broader gear/mode actions and campaign narrative/visual migration follow.
Delivery is a verified local main commit; pushes and deployments remain with the owner.
