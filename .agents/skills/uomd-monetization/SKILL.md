---
name: uomd-monetization
description: Implement and diagnose UOMD AdMob SSV, Google Play Billing/RTDN and server-authoritative economy without duplicate grants, unsafe logs or premature native-release claims.
---
# UOMD monetization and economy

Read README's Google/Android and single-currency decisions, [economy rules](../../../docs/ECONOMY_SINGLE_CURRENCY.md), [monitoring](../../../docs/MONITORING.md) and the current implementation/tests under `apps/api/src/ads`, `apps/api/src/billing`, and `apps/api/test`. Retrieve current official Google contracts and installed native SDK types when changing integrations; this skill does not freeze provider APIs.

For AdMob SSV:

- Verify the signed message against Google's keys before trusting any callback field. Inspect the exact signed query handling; do not decode/re-serialize parameters and assume the resulting bytes are equivalent. Test apostrophes, percent escapes, plus/space, unicode and tampered signatures against the verifier's supported forms. Keep signature/key_id tail validation.
- A correctly signed foreign ad unit, including Google's URL-check placeholder, may be acknowledged with HTTP 200 and `granted:false, reason:ad_unit_not_ours` without any grant or nonce consumption. This does not justify accepting an invalid signature or bypassing checks for an owned ad unit.
- Owned-unit grants still require server-issued player-bound nonces, expiry, configured reward rules/caps and unique transaction/idempotency protections. Verify duplicate/concurrent requests do not mint twice or debit twice. Do not mint from an untrusted client SDK completion alone.
- Diagnose live callbacks using safe recorded reason, status and runtime version. Redact query/custom_data/signature and identifiers; use uomd-monitoring for capture and panel evidence.

For Play Billing / RTDN:

- Server-check package/product/purchase identity and current purchase state with the Google Play Developer API. Authenticate Pub/Sub OIDC issuer/audience/signature and configured publisher identity; notifications trigger verification rather than becoming trusted grant claims.
- Keep pending/cancelled/expired/hold/grace/refund states distinct. Replays and out-of-order notifications must not double-grant or restore revoked benefits. Track verified fulfillment and acknowledgement independently, with bounded retry/reconciliation evidence.
- Use immutable D1 ledger entries, unique idempotency keys, conditional writes and transactional batches where supported. Test insufficient funds, same-key retries and simultaneous requests. Preserve a single `eclipse_token` main currency; never balance by introducing another currency.
- Do not change actual Google Play prices/products, player balances, transaction history or production permissions merely to make a test pass. Use isolated test data and documented staging/sandbox paths.

Choose targeted regression tests for changed behavior, including negative authorization/signature cases, plus the repository's required checks. Android sign-in, UMP, rewarded ads, products/subscriptions, refund/pending and offline/resume acceptance need actual Android sandbox/device evidence; passing Worker/browser tests is only that layer's evidence. Respect current task authorization and Google/Cloudflare configuration boundaries.
