# Ads, purchases and wishes disclosure — English draft

Player-facing copy proposal (wire only after corresponding UI/config exists):

- **Purchases:** Optional digital purchases are processed by Google Play. Review the price and product details before confirming. Pending or cancelled payments do not grant items. Verified rewards belong to the signed-in game account.
- **Subscriptions:** A subscription renews according to the billing terms shown by Google Play unless cancelled. Manage or cancel it in Google Play. Deleting your game account does not cancel your subscription. Benefits require an active verified entitlement and the product's claim rules.
- **Wishes:** Wishes have randomized results. Check the current banner's rates, pool, cost and guarantees before spending. Bell's Remains also pays for upgrades and shop items; wishing reduces the balance available for them. You can experience story content without winning a specific character.
- **Rewarded ads:** Watching is optional. Only a completed, verified ad can provide a reward. The current limit is five rewarded grants per rolling 12 hours across your account, not five each calendar half-day. Ads do not grant from a device callback alone. No ad is available when consent/SDK eligibility or network supply prevents it.
- **Privacy choices:** Use Privacy options (ads) when offered to review the applicable Google UMP choice. Advertisement data handling is described in the privacy policy.

Source verification: `ads/service.ts` currently pays 30 tokens per valid grant, explicitly marked a placeholder; `AD.perWindow=5`, windowHours=12. Shop prices/base-plan terms come from native Google Play product details, not app-controlled legal copy. Gacha rates/guarantees are active-banner disclosure, not a single universal advertised percentage. Current billing defaults contain inactive `eclipse_blessing_30d`: 1600 instant + 60×187 half-day offerings, 14-day claim window. Do not publish those benefits until the live product/config and entitlement lifecycle pass native tests.

Owner decisions outstanding: activated catalog/Play plans/prices, refund/noncurrency clawback terms, audience/age rules and UMP configuration. Optional interstitial placements are not approved by this task. No real purchase, advertisement or media generation was initiated.
