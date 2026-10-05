extends GutTest
## INF-036 on the client: the Play sheet, the consent form and the ad through a fake bridge with the Native autoload's
## signals and methods, the server through a fake backend. The client only reports; the server's answers decide.

class FakeNative extends RefCounted:
	signal billing_product(result: Dictionary)
	signal purchases_updated(result: Dictionary)
	signal purchases_queried(result: Dictionary)
	signal consent_finished(result: Dictionary)
	signal ad_finished(result: Dictionary)

	var available: bool = true
	var product: Dictionary = {"status": "ok", "product_id": "eclipse_blessing_30d", "price": "€4.99", "offer_token": "offer-1"}
	var purchase_result: Dictionary = {}
	var owned: Dictionary = {}
	var consent: Dictionary = {"status": "ok", "can_request_ads": true, "error": ""}
	var ad: Dictionary = {"status": "rewarded", "error": ""}
	var calls: Array = []

	func billing_query_product(product_id: String) -> bool:
		calls.append(["product", product_id])
		billing_product.emit.call_deferred(product)
		return available

	func billing_purchase(product_id: String, offer_token: String, account_id: String) -> bool:
		calls.append(["purchase", product_id, offer_token, account_id])
		purchases_updated.emit.call_deferred(purchase_result)
		return available

	func billing_query_purchases() -> bool:
		calls.append(["restore"])
		purchases_queried.emit.call_deferred(owned)
		return available

	func ads_consent() -> bool:
		calls.append(["consent"])
		consent_finished.emit.call_deferred(consent)
		return available

	func ads_show_rewarded(ad_unit_id: String, account_id: String) -> bool:
		calls.append(["ad", ad_unit_id, account_id])
		ad_finished.emit.call_deferred(ad)
		return available


class FakeBackend extends GameBackend:
	var status: Dictionary = {"subscribed": false, "claimable_windows": [], "window_tokens": 187, "claimed_this_period": 0}
	var verified: Array = []
	var claimed: Array = []
	var ad_counts: Array = []
	var synced: int = 0
	var snapshot: Dictionary = {}

	func subscription_status() -> Outcome:
		return Outcome.ok(status)

	func subscription_verify(token: String) -> Outcome:
		verified.append(token)
		return Outcome.ok({"instant_eclipse_tokens": 1600, "state": snapshot})

	func subscription_claim(window_id: int = -1) -> Outcome:
		claimed.append(window_id)
		return Outcome.ok({"already_claimed": false, "eclipse_tokens": 187, "state": snapshot})

	func ads_status() -> Outcome:
		return Outcome.ok(ad_counts.pop_front() if ad_counts.size() > 1 else ad_counts[0])

	func fetch_state() -> Outcome:
		synced += 1
		return Outcome.ok({"state": snapshot})


static var _flow: GameFlow = null


func before_all() -> void:
	if _flow == null:
		_flow = GameFlow.create()


func _setup() -> Array:
	assert_true(_flow.is_ready(), _flow.error)
	var native: FakeNative = FakeNative.new()
	var backend: FakeBackend = FakeBackend.new()
	var story: Dictionary = _flow.rules.story.to_persisted_dict(_flow.rules.story.new_player_state())
	backend.snapshot = JSON.parse_string(JSON.stringify({"schema_version": PlayerState.SCHEMA_VERSION, "story_state": story, "wallet": {}}))
	_flow.backend = backend
	_flow.state = null
	var money: Monetization = Monetization.new(native, _flow, "eclipse_blessing_30d")
	money.wait = func(_seconds: float) -> void: await get_tree().process_frame
	return [money, native, backend]


func _purchase(token: String, state: String = "purchased", products: Array = ["eclipse_blessing_30d"]) -> Dictionary:
	return {"token": token, "products": PackedStringArray(products), "state": state, "acknowledged": false}


func test_buying_reports_the_purchase_to_the_server_tagged_with_the_account() -> void:
	var setup: Array = _setup()
	var native: FakeNative = setup[1]
	var backend: FakeBackend = setup[2]
	native.purchase_result = {"status": "ok", "purchases": [_purchase("tok-1"), _purchase("other", "purchased", ["gems"])], "error": ""}
	var bought: Outcome = await (setup[0] as Monetization).buy_blessing("acct_1")
	assert_true(bought.is_ok(), bought.error)
	assert_eq(bought.value, {"instant_eclipse_tokens": 1600, "pending": false})
	assert_eq(backend.verified, ["tok-1"], "only the Blessing's purchase is reported")
	assert_eq(native.calls[1], ["purchase", "eclipse_blessing_30d", "offer-1", "acct_1"])
	assert_true(_flow.state != null, "the server's state was adopted")


func test_cancelled_pending_and_failed_purchases_report_nothing() -> void:
	var setup: Array = _setup()
	var money: Monetization = setup[0]
	var native: FakeNative = setup[1]
	var backend: FakeBackend = setup[2]
	native.purchase_result = {"status": "cancelled", "purchases": [], "error": ""}
	assert_eq((await money.buy_blessing("a")).error_kind, Monetization.KIND_CANCELLED)
	native.purchase_result = {"status": "ok", "purchases": [_purchase("tok-p", "pending")], "error": ""}
	assert_eq((await money.buy_blessing("a")).value, {"instant_eclipse_tokens": 0, "pending": true})
	native.purchase_result = {"status": "error", "purchases": [], "error": "billing unavailable (3)"}
	assert_string_contains((await money.buy_blessing("a")).error, "billing unavailable")
	native.product = {"status": "error", "error": "product not found"}
	assert_eq((await money.buy_blessing("a")).error_kind, Monetization.KIND_UNAVAILABLE)
	assert_eq(backend.verified, [])


func test_restore_reports_what_play_holds() -> void:
	var setup: Array = _setup()
	var native: FakeNative = setup[1]
	var backend: FakeBackend = setup[2]
	native.owned = {"status": "ok", "purchases": [_purchase("tok-old")], "error": ""}
	assert_true((await (setup[0] as Monetization).restore_blessing()).is_ok())
	assert_eq(backend.verified, ["tok-old"])
	native.owned = {"status": "ok", "purchases": [], "error": ""}
	assert_eq((await (setup[0] as Monetization).restore_blessing()).error_kind, Monetization.KIND_CANCELLED)


func test_claiming_takes_every_open_window() -> void:
	var setup: Array = _setup()
	var backend: FakeBackend = setup[2]
	backend.status = {"subscribed": true, "claimable_windows": [41001, 41002], "window_tokens": 187, "claimed_this_period": 3, "expires_at_utc": "2026-11-04T06:00:00.000Z"}
	var view: Outcome = await (setup[0] as Monetization).blessing()
	assert_eq([view.value["claimable"], view.value["expires_at"]], [2, "2026-11-04T06:00:00.000Z"])
	var claimed: Outcome = await (setup[0] as Monetization).claim_blessing()
	assert_eq(claimed.value, {"windows": 2, "eclipse_tokens": 374})
	assert_eq(backend.claimed, [41001, 41002])


func test_an_ad_asks_consent_once_and_waits_for_the_servers_reward() -> void:
	var setup: Array = _setup()
	var money: Monetization = setup[0]
	var native: FakeNative = setup[1]
	var backend: FakeBackend = setup[2]
	var open: Dictionary = {"window_views": 1, "window_cap": 4, "day_views": 1, "day_cap": 8, "reward_eclipse_tokens": 30, "ad_unit_id": "unit-1"}
	var paid: Dictionary = {"window_views": 2, "window_cap": 4, "day_views": 2, "day_cap": 8, "reward_eclipse_tokens": 30, "ad_unit_id": "unit-1"}
	backend.ad_counts = [open, open, open, paid]
	var watched: Outcome = await money.watch_ad("acct_1")
	assert_eq(watched.value, {"rewarded": true, "paid": true, "eclipse_tokens": 30})
	assert_eq(backend.synced, 1, "the new wallet is fetched once the server paid")
	assert_true(["ad", "unit-1", "acct_1"] in native.calls)
	backend.ad_counts = [paid]
	await money.watch_ad("acct_1")
	assert_eq(native.calls.count(["consent"]), 1, "consent is asked once per run")


func test_an_ad_reports_closed_capped_refused_and_unconfirmed() -> void:
	var setup: Array = _setup()
	var money: Monetization = setup[0]
	var native: FakeNative = setup[1]
	var backend: FakeBackend = setup[2]
	backend.ad_counts = [{"window_views": 0, "window_cap": 4, "day_views": 0, "day_cap": 8, "ad_unit_id": null}]
	assert_eq((await money.watch_ad("a")).error_kind, Monetization.KIND_UNAVAILABLE, "no unit: the server would not pay")
	assert_false(Monetization.ad_open(backend.ad_counts[0]))
	backend.ad_counts = [{"window_views": 4, "window_cap": 4, "day_views": 4, "day_cap": 8, "ad_unit_id": "unit-1"}]
	assert_eq((await money.watch_ad("a")).error_kind, Monetization.KIND_CAPPED)
	backend.ad_counts = [{"window_views": 0, "window_cap": 4, "day_views": 0, "day_cap": 8, "ad_unit_id": "unit-1"}]
	native.consent = {"status": "ok", "can_request_ads": false, "error": ""}
	assert_eq((await money.watch_ad("a")).error_kind, Monetization.KIND_UNAVAILABLE)
	native.consent = {"status": "ok", "can_request_ads": true, "error": ""}
	native.ad = {"status": "closed", "error": ""}
	assert_eq((await money.watch_ad("a")).value, {"rewarded": false, "paid": false, "eclipse_tokens": 0})
	native.ad = {"status": "rewarded", "error": ""}
	assert_eq((await money.watch_ad("a")).value, {"rewarded": true, "paid": null, "eclipse_tokens": 0}, "no reward seen within the wait")


func test_the_blessing_screen_and_its_messages() -> void:
	var terms: Dictionary = _flow.rules.quest.economy()["subscription"]
	var offer: String = BlessingScreen.info_text({"subscribed": false}, terms, "€4.99")
	assert_string_contains(offer, "Instant 1600, then 187 every twelve hours (12820 in total)")
	assert_string_contains(offer, "Price: €4.99")
	assert_string_contains(BlessingScreen.info_text({"revoked": true}, terms, ""), "refunded or revoked")
	var screen: BlessingScreen = add_child_autofree(BlessingScreen.new())
	screen.load_blessing({"subscribed": true, "claimable": 2, "window_tokens": 187, "expires_at": "2026-11-04T06:00:00Z"}, terms, "", false)
	assert_eq(screen.claim_text(), "Claim (2)")
	assert_eq(screen.buttons_enabled(), {"claim": true, "buy": false, "restore": false}, "no Play Billing here")
	assert_eq(StoryDirector.blessing_result_text("claim", Outcome.ok({"windows": 2, "eclipse_tokens": 374})), "Claimed 2 reward(s): +374 Eclipse Tokens.")
	assert_string_contains(StoryDirector.blessing_result_text("buy", Outcome.ok({"pending": true})), "still processing")
	assert_eq(StoryDirector.ad_button_text({"reward_eclipse_tokens": 30, "window_views": 1, "window_cap": 4}), "Watch an ad (+30)  1/4")


func test_the_quests_screen_offers_the_ad_only_when_it_pays() -> void:
	var quests: QuestsScreen = add_child_autofree(QuestsScreen.new())
	watch_signals(quests)
	quests.load_quests([] as Array[GameViews.QuestRow])
	assert_false(quests.ad_enabled(), "hidden until the server says")
	quests.set_ad("Watch an ad (+30)  4/4", false)
	assert_false(quests.ad_enabled())
	quests.set_ad("Watch an ad (+30)  1/4", true)
	quests.press_ad()
	assert_signal_emit_count(quests, "ad_requested", 1)
