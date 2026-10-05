class_name Monetization
extends RefCounted
## The Eclipse Blessing and rewarded ads on the client (INF-036, DEC-0038; port of watch_rewarded_ad and the blessing
## methods of the LEGACY client/game_controller.py). The client never grants anything: a Play purchase token goes to the
## server, which asks Google Play and pays; an ad is paid when AdMob calls the server. This class drives the Play sheet,
## the consent form and the ad through `native` (the Native autoload, or a test double with the same signals and
## methods), reports to the server through `flow`, and adopts the server's state.

const KIND_UNAVAILABLE: String = "unavailable"
const KIND_CANCELLED: String = "cancelled"
const KIND_CAPPED: String = "capped"
## AdMob's reward reaches the server a little after the ad closes: how long to wait for it, and how often to ask.
const AD_WAIT_SECONDS: float = 20.0
const AD_POLL_SECONDS: float = 1.0

## The Eclipse Blessing's Play product (economy_part1.json subscription.id).
var product_id: String = ""
## Waits between server checks after an ad; tests replace it.
var wait: Callable = func(seconds: float) -> void: await Engine.get_main_loop().create_timer(seconds).timeout

var _native: Object = null
var _flow: GameFlow = null
var _consent_asked: bool = false


func _init(native: Object, flow: GameFlow, blessing_product_id: String) -> void:
	_native = native
	_flow = flow
	product_id = blessing_product_id


## The Eclipse Blessing as the screen shows it (coroutine). `value`: {"subscribed", "revoked", "expires_at", "claimable",
## "window_tokens", "claimed_this_period", "windows_per_period"}.
func blessing() -> Outcome:
	var status: Outcome = await _flow.backend.subscription_status()
	if not status.is_ok():
		return status
	var data: Dictionary = status.value
	var windows: Variant = data.get("claimable_windows")
	return Outcome.ok({
		"subscribed": bool(data.get("subscribed", false)),
		"revoked": bool(data.get("revoked", false)),
		"expires_at": str(data["expires_at_utc"]) if data.get("expires_at_utc") is String else "",
		"claimable": (windows as Array).size() if windows is Array else 0,
		"claimable_windows": windows if windows is Array else [],
		"window_tokens": int(data.get("window_tokens", 0)),
		"claimed_this_period": int(data.get("claimed_this_period", 0)),
		"windows_per_period": int(data.get("windows_per_period", 60)),
	})


## Play's price line for the Blessing ("" while Play cannot be asked).
func blessing_price() -> String:
	if not _native.call("billing_query_product", product_id):
		return ""
	var product: Dictionary = await _native.billing_product
	return str(product.get("price", "")) if str(product.get("status", "")) == "ok" else ""


## Play's purchase sheet, then the server (coroutine). `value`: {"instant_eclipse_tokens"} when the purchase was paid.
func buy_blessing(account_id: String) -> Outcome:
	if not _native.call("billing_query_product", product_id):
		return Outcome.fail(KIND_UNAVAILABLE, "Purchases are not available on this device.")
	var product: Dictionary = await _native.billing_product
	if str(product.get("status", "")) != "ok":
		return Outcome.fail(KIND_UNAVAILABLE, "The Eclipse Blessing is not available right now.")
	if not _native.call("billing_purchase", product_id, str(product.get("offer_token", "")), account_id):
		return Outcome.fail(KIND_UNAVAILABLE, "The purchase could not start.")
	var result: Dictionary = await _native.purchases_updated
	return await _report(result)


## Re-reports what Play holds for this Google account (a new device, a purchase the app could not report).
func restore_blessing() -> Outcome:
	if not _native.call("billing_query_purchases"):
		return Outcome.fail(KIND_UNAVAILABLE, "Purchases are not available on this device.")
	var result: Dictionary = await _native.purchases_queried
	return await _report(result)


## Sends each finished purchase of the Blessing to the server; pending ones are left for Play to finish.
func _report(result: Dictionary) -> Outcome:
	match str(result.get("status", "")):
		"cancelled":
			return Outcome.fail(KIND_CANCELLED, "The purchase was cancelled.")
		"ok":
			pass
		_:
			return Outcome.fail(KIND_UNAVAILABLE, "Google Play: %s" % str(result.get("error", "unknown error")))
	var paid: int = 0
	var reported: int = 0
	var pending: int = 0
	for purchase: Variant in result.get("purchases", []):
		if not (purchase is Dictionary) or not (product_id in Array((purchase as Dictionary).get("products", [])) ):
			continue
		if str((purchase as Dictionary).get("state", "")) != "purchased":
			pending += 1
			continue
		var verified: Outcome = await _flow.verify_subscription(str((purchase as Dictionary)["token"]))
		if not verified.is_ok():
			return verified
		reported += 1
		paid += int((verified.value as Dictionary).get("instant_eclipse_tokens", 0))
	if reported == 0 and pending > 0:
		return Outcome.ok({"instant_eclipse_tokens": 0, "pending": true})
	if reported == 0:
		return Outcome.fail(KIND_CANCELLED, "No Eclipse Blessing purchase was found.")
	return Outcome.ok({"instant_eclipse_tokens": paid, "pending": false})


## Claims every open twelve-hour entitlement. `value`: {"windows", "eclipse_tokens"}.
func claim_blessing() -> Outcome:
	var view: Outcome = await blessing()
	if not view.is_ok():
		return view
	var windows: int = 0
	var tokens: int = 0
	for window: Variant in (view.value as Dictionary)["claimable_windows"]:
		var claimed: Outcome = await _flow.claim_subscription_window(int(window))
		if not claimed.is_ok():
			return claimed if windows == 0 else Outcome.ok({"windows": windows, "eclipse_tokens": tokens})
		if not bool((claimed.value as Dictionary).get("already_claimed", false)):
			windows += 1
			tokens += int((claimed.value as Dictionary).get("eclipse_tokens", 0))
	return Outcome.ok({"windows": windows, "eclipse_tokens": tokens})


## Whether an ad may be offered now. `value`: the server's {"window_views", "window_cap", "day_views", "day_cap",
## "reward_eclipse_tokens", "ad_unit_id"} ("ad_unit_id" null: the server pays no ads, so none is offered).
func ad_status() -> Outcome:
	return await _flow.backend.ads_status()


## Whether the server's counts allow an ad now: a unit it pays for, and room under both caps.
static func ad_open(counts: Dictionary) -> bool:
	return counts.get("ad_unit_id") is String and not str(counts["ad_unit_id"]).is_empty() \
		and int(counts.get("window_views", 0)) < int(counts.get("window_cap", 0)) and int(counts.get("day_views", 0)) < int(counts.get("day_cap", 0))


## Consent (once per run), the ad, then the server's count until AdMob's reward shows up (coroutine).
## `value`: {"rewarded": bool, "paid": true | false | null (null: not seen within the wait), "eclipse_tokens"}.
func watch_ad(account_id: String) -> Outcome:
	var before: Outcome = await ad_status()
	if not before.is_ok():
		return before
	var counts: Dictionary = before.value
	if not (counts.get("ad_unit_id") is String) or str(counts["ad_unit_id"]).is_empty():
		return Outcome.fail(KIND_UNAVAILABLE, "Rewarded ads are not available right now.")
	if not ad_open(counts):
		return Outcome.fail(KIND_CAPPED, "No more rewarded ads for now; they come back with the next twelve-hour window.")
	if not _consent_asked:
		if not _native.call("ads_consent"):
			return Outcome.fail(KIND_UNAVAILABLE, "Ads are not available on this device.")
		var consent: Dictionary = await _native.consent_finished
		_consent_asked = true
		if not bool(consent.get("can_request_ads", false)):
			_consent_asked = false
			return Outcome.fail(KIND_UNAVAILABLE, "Ads cannot be shown without your consent choice.")
	if not _native.call("ads_show_rewarded", str(counts["ad_unit_id"]), account_id):
		return Outcome.fail(KIND_UNAVAILABLE, "An ad is already showing.")
	var shown: Dictionary = await _native.ad_finished
	if str(shown.get("status", "")) != "rewarded":
		return Outcome.ok({"rewarded": false, "paid": false, "eclipse_tokens": 0})
	var waited: float = 0.0
	while waited <= AD_WAIT_SECONDS:
		var now_status: Outcome = await ad_status()
		if now_status.is_ok() and int((now_status.value as Dictionary).get("day_views", 0)) > int(counts.get("day_views", 0)):
			await _flow.sync()
			return Outcome.ok({"rewarded": true, "paid": true, "eclipse_tokens": int(counts.get("reward_eclipse_tokens", 0))})
		await wait.call(AD_POLL_SECONDS)
		waited += AD_POLL_SECONDS
	return Outcome.ok({"rewarded": true, "paid": null, "eclipse_tokens": 0})
