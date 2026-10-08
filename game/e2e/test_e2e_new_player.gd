extends GutTest
## INF-042 end to end: the real client (OnlineBackend, SignInFlow, GameFlow, the battle engine) against the real Worker
## over HTTP with a real PostgreSQL (server/e2e/run.sh starts both). Only the identity provider is replaced: the e2e
## Worker accepts "e2e:<subject>|<nonce>" credentials (server/src/e2e-index.ts, never deployed).
## Path: new account → opening VN → 1-1 and 1-2 won and verified by the server → First Oath → the rest of chapter 1's
## first stages → equipment, progression, quests and gacha calls → "relaunch" (a fresh client with the same session)
## sees exactly the same player.

const MAX_TRIES_PER_STAGE: int = 4

var _server: String = OS.get_environment("UOMD_E2E_SERVER")


class E2ESigner extends SignInFlow.Signer:
	var subject: String = ""

	func request_id_token(_server_client_id: String, nonce: String) -> Dictionary:
		return {"status": "ok", "id_token": "e2e:%s|%s" % [subject, nonce], "error": ""}


func _signed_in_flow(subject: String) -> Array:
	var backend: OnlineBackend = OnlineBackend.new(_server)
	var signer: E2ESigner = E2ESigner.new()
	signer.subject = subject
	var session: Outcome = await SignInFlow.run(backend, "e2e-client", signer)
	assert_true(session.is_ok(), session.error)
	backend.session_token = str((session.value as Dictionary)["session_token"])
	var flow: GameFlow = GameFlow.create()
	assert_true(flow.is_ready(), flow.error)
	flow.backend = backend
	return [flow, backend, session.value]


## Plays story entries until `stop_after` has been cleared (stages are retried after a defeat, abandoning nothing open).
func _play_until(flow: GameFlow, stop_after: String) -> Array[String]:
	var played: Array[String] = []
	for step: int in 40:
		if flow.needs_first_oath_selection():
			var choice: String = flow.first_oath_choices()[0].character_id
			var oath: Outcome = await flow.claim_first_oath(choice)
			assert_true(oath.is_ok(), oath.error)
			played.append("first_oath:%s" % choice)
			continue
		var entry: String = flow.current_entry()
		if entry.is_empty():
			break
		if flow.is_stage(entry):
			var won: bool = false
			for attempt: int in MAX_TRIES_PER_STAGE:
				var outcome: GameFlow.StageOutcome = await flow.run_stage(entry)
				assert_eq(outcome.error, "", "stage %s attempt %d" % [entry, attempt])
				if outcome.is_victory():
					won = true
					break
			assert_true(won, "stage %s won within %d tries" % [entry, MAX_TRIES_PER_STAGE])
			if not won:
				return played
		else:
			var advanced: Outcome = await flow.advance()
			assert_true(advanced.is_ok(), advanced.error)
		played.append(entry)
		if entry == stop_after:
			break
	return played


func test_a_new_player_plays_the_first_chapter_and_relaunches_into_the_same_state() -> void:
	if _server.is_empty():
		pending("UOMD_E2E_SERVER is not set (run server/e2e/run.sh)")
		return
	var subject: String = "player%d" % Time.get_ticks_usec()
	var started: Array = await _signed_in_flow(subject)
	var flow: GameFlow = started[0]
	var gate: Outcome = await (started[1] as OnlineBackend).fetch_bootstrap()
	assert_true(ClientRelease.check(gate.value, ClientRelease.local_rules_hash()).is_ok(), "the client and the server run the same rules")
	assert_true((started[2] as Dictionary)["is_new_account"])
	assert_true((await flow.sync()).is_ok())
	assert_eq(flow.current_entry(), "opening_sad_scene")

	var played: Array[String] = await _play_until(flow, "1-3")
	assert_eq(played.slice(0, 3), ["opening_sad_scene", "1-1", "1-2"] as Array[String])
	assert_true(played.any(func(step: String) -> bool: return step.begins_with("first_oath:")), "First Oath after 1-2: %s" % str(played))
	assert_true(played.has("1-3"))
	assert_gt(int(flow.wallet().get("silver_crowns", 0)), 0, "stage rewards were paid by the server")

	# The menus' server calls answer on a real account.
	assert_true((await flow.quest_rows()).is_ok())
	assert_true((await flow.gacha_banners()).is_ok())
	assert_true((await flow.gacha_history()).is_ok())
	var box: Outcome = await flow.mailbox()
	assert_true(box.is_ok(), box.error)
	assert_eq((box.value as Dictionary)["notices"], [], "nothing published on a fresh database")
	var ads: Outcome = await flow.backend.ads_status()
	assert_true(ads.is_ok(), ads.error)
	assert_eq((ads.value as Dictionary).get("ad_unit_id"), null, "no ad unit configured: the app offers no ad")
	assert_eq((await flow.backend.subscription_status()).is_ok(), true)

	# Relaunch: a fresh client process with the stored session sees the same player.
	var before: Dictionary = {"entry": flow.current_entry(), "wallet": flow.wallet(), "revision": flow.state.revision()}
	var relaunched: GameFlow = GameFlow.create()
	relaunched.backend = OnlineBackend.new(_server, (started[1] as OnlineBackend).session_token)
	assert_true((await relaunched.sync()).is_ok())
	assert_eq({"entry": relaunched.current_entry(), "wallet": relaunched.wallet(), "revision": relaunched.state.revision()}, before)

	# Signing in again with the same identity finds the same account.
	var again: Array = await _signed_in_flow(subject)
	assert_false((again[2] as Dictionary)["is_new_account"])
	assert_eq((again[2] as Dictionary)["account_id"], (started[2] as Dictionary)["account_id"])
