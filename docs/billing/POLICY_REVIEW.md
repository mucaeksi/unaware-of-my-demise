# Billing policy review — proposals, not applied repair

[README R02](../../README.md#r02--purchases-subscriptions-refunds-and-rtdn) governs acceptance. These choices affect future terms and operator decisions; this document does not approve live transactions, change prices or repair historical balances.

## Read-only investigation

Viewer endpoint: GET `/admin/api/billing/purchases/<orderId>/reconciliation`. One D1 read batch captures recorded purchase state, immutable original credits/refund debits, current wallet/version, recorded shortfall, claimed periodic credits and refund-event count. The semantic snapshot hash stays stable when facts are unchanged; it is **not repair authorization**. Provider status is explicitly unverified. Raw purchase tokens, token hashes, ciphertext and keys are excluded.

| Observed case | Required treatment |
| --- | --- |
| Frozen currency-only order, original = clawback + shortfall, one refund event | Journal arithmetic is balanced; confirm provider/context separately. This does not turn game tokens into revenue. |
| Refunded marker with missing debit/shortfall/event | Flag currency_marker_incomplete / refund_journal_incomplete. Prepare a specific bounded repair with current provider proof and wallet CAS; never run from this report alone. |
| NULL historical fulfillment | Flag legacy_terms_unknown. Do not reconstruct goods or offers from today's catalog, or assume a recorded shortfall proves an old outage was actual spending. |
| Claimed subscription mail | Report original instant credits and claimed periodic credits separately; retain policy review until the approved rule/version is explicit. |
| Character/gear/item/account XP attachment | Report the original requested kind only. Current owned goods do not establish the original grant/conversion/consumption provenance. No invented instance attribution or destructive clawback. |
| Corrupt/unsafe terms or shortfall | Explicit review reason; no rounding, guessed correction or false completed status. |

## Recommended future refund contract

Proposal: recover fungible original **and claimed order-linked periodic currency** up to the current available balance in one CAS/ledger/refund batch; keep a truthful irreversible shortfall, without automatically collecting later free income. Retain acquired characters/gear/materials/XP/progression and record the retained benefit as reviewed loss. Unclaimed order mail stays revoked. Partial refunds, old unknown terms and half-completed markers remain explicit operator cases until supported rules/evidence exist.

Alternative: preserve the current original-currency-only clawback and explicitly retain claimed periodic benefits. It reduces player impact, but paid→claim→refund can retain periodic currency. It must be an intentional recorded policy, not an accidental gap.

Before adoption, bind a policy version to **new pre-purchase offers/periods** and show support/retention terms truthfully. Existing unknown periods require a specific review; do not rewrite immutable snapshots. R04 grant journals can supply missing noncurrency provenance; R11 must bind the displayed offer/version before launching Google billing. No automatic historical applier is implemented here.

## Calendar/hold accrual decision

The current promise combines 60 × 187 half-day offerings / 30 nominal days with real calendar plans. Current code issues the configured cadence before the verified end, capped by count: 28 days yield 56 windows, whereas a 31-day period is capped at 60. This is not a guarantee of 60 benefits for every plan.

Proposal: preserve the promised **60 benefits per paid period** and distribute windows over that period's authoritative duration, with truthful offer copy rather than an exact universal 12-hour claim. Thirty-day fixtures retain their present timing; 28/31-day and licensed accelerated periods need explicit coverage. Alternative: retain fixed 12-hour cadence and advertise the actual plan-specific count/value. Prices stay in Play; numerical balance and recovery remain R16.

Decide whether paid hold/pause intervals accrue benefits, and how verified recovery/extension/new tokens interact with already-issued windows, before claiming complete financial acceptance. Observation time alone does not prove the exact historic provider transition interval. Confirm real base-plan/offer/trial/linked-token behavior using signed isolated sandbox data; this source review is not that evidence.

## Configuration and rollout gates

Provision/verify the existing game Worker keyring and exact deployed Cron/Google permissions securely per [SECRETS_AND_PERMISSIONS](../SECRETS_AND_PERMISSIONS.md). Current host has no Wrangler authorization and its staging/reference reads are proxy blocked. Physical Google/RTDN timing, backlog capacity, legal retention and public release remain separate gates. Continue independent R03–R18 infrastructure while preparing these decisions.
