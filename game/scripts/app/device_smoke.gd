class_name DeviceSmoke
extends RefCounted
## Device smoke checks shown on the boot screen and written to user://smoke_report.txt (brief G2 spikes). They run
## headless on a desktop too (GUT), so the same code proves the parts that need no device. Every check returns
## {"name": String, "ok": bool, "detail": String}. There is no on-device save to check (DEC-0012).

const REPORT_PATH: String = "user://smoke_report.txt"
const KEYSTORE_ALIAS: String = "uomd_device_smoke"


static func run_all() -> Array[Dictionary]:
	var results: Array[Dictionary] = []
	results.append(engine_check())
	results.append(display_check())
	results.append(keystore_check())
	return results


## The brief's G3 measurement: the final-boss battle (stage 7-5, five heroes at level 20) from a cold registry, so the
## time includes loading the content packs. Run it on a WorkerJob (`boot.gd` does) to see that the UI keeps drawing.
static func battle_benchmark() -> Dictionary:
	var began: int = Time.get_ticks_usec()
	var loader: ContentLoader = ContentLoader.new()
	var registry: ContentModels.ContentRegistry = loader.load_dir("res://data/content")
	if registry == null:
		return _result("battle", false, "content load failed: %s" % loader.error)
	var loaded: int = Time.get_ticks_usec()
	var story: StoryState = StoryState.new(registry, StoryState.load_manifest("res://data/content"))
	var service: BattleService = BattleService.create(registry, story)
	if not service.error.is_empty():
		return _result("battle", false, "service setup failed: %s" % service.error)
	var roster: Array = ["mahmut", "fadyme", "brin_alder", "nixie_vale", "kera_voss"]
	var state: StoryState.PlayerStoryState = story.new_player_state()
	state.owned_character_ids = {}
	var levels: Dictionary = {}
	for character_id: String in roster:
		state.owned_character_ids[character_id] = true
		levels[character_id] = 20
	var ready: int = Time.get_ticks_usec()
	var result: BattleService.BattleResult = service.run("7-5", roster, {"story_state": state, "player_levels": levels, "run_seed": 2026})
	var finished: int = Time.get_ticks_usec()
	var ok: bool = result.error.is_empty() and result.outcome == "victory"
	var detail: String = "final boss 7-5: %s, %d actions, %d events | content load %d ms | setup %d ms | battle %d ms" % [
		result.outcome if result.error.is_empty() else result.error,
		result.actions, result.state.battle_events.size() if result.state != null else 0,
		roundi(float(loaded - began) / 1000.0), roundi(float(ready - loaded) / 1000.0), roundi(float(finished - ready) / 1000.0),
	]
	return _result("battle", ok, detail)


static func report_text(results: Array[Dictionary]) -> String:
	var lines: PackedStringArray = PackedStringArray()
	for result: Dictionary in results:
		lines.append("%s  %s: %s" % ["PASS" if bool(result["ok"]) else "FAIL", result["name"], result["detail"]])
	return "\n".join(lines)


static func all_ok(results: Array[Dictionary]) -> bool:
	for result: Dictionary in results:
		if not bool(result["ok"]):
			return false
	return true


static func _result(name: String, ok: bool, detail: String) -> Dictionary:
	return {"name": name, "ok": ok, "detail": detail}


static func engine_check() -> Dictionary:
	var info: Dictionary = Engine.get_version_info()
	var adapter: String = RenderingServer.get_video_adapter_name()
	var detail: String = "Godot %s | renderer %s | adapter %s | %s | 64-bit %s" % [
		info["string"],
		ProjectSettings.get_setting("rendering/renderer/rendering_method", "?"),
		adapter if adapter != "" else "n/a",
		OS.get_name(),
		str(OS.has_feature("64")),
	]
	return _result("engine", true, detail)


static func display_check() -> Dictionary:
	var window_size: Vector2i = DisplayServer.window_get_size()
	var safe_area: Rect2i = DisplayServer.get_display_safe_area()
	var detail: String = "window %s | screen %s | safe area %s | dpi %d | scale %.2f" % [
		str(window_size), str(DisplayServer.screen_get_size()), str(safe_area),
		DisplayServer.screen_get_dpi(), DisplayServer.screen_get_scale(),
	]
	return _result("display", true, detail)


static func keystore_check() -> Dictionary:
	if not Native.is_available():
		return _result("keystore", true, "skipped: UomdNative exists only in Android builds")
	var failed: PackedStringArray = PackedStringArray()
	if Native.keystore_has_key(KEYSTORE_ALIAS):
		Native.keystore_delete_key(KEYSTORE_ALIAS)
	if not Native.keystore_create_key(KEYSTORE_ALIAS):
		return _result("keystore", false, "createKey failed: %s" % Native.last_error())
	var secret: PackedByteArray = Crypto.new().generate_random_bytes(32)
	var blob: PackedByteArray = Native.keystore_wrap(KEYSTORE_ALIAS, secret)
	if blob.is_empty():
		failed.append("wrap failed: " + Native.last_error())
	elif Native.keystore_unwrap(KEYSTORE_ALIAS, blob) != secret:
		failed.append("unwrap did not return the key")
	else:
		var tampered: PackedByteArray = blob.duplicate()
		tampered[tampered.size() - 1] = tampered[tampered.size() - 1] ^ 1
		if not Native.keystore_unwrap(KEYSTORE_ALIAS, tampered).is_empty():
			failed.append("a tampered blob was accepted")
		if not Native.keystore_unwrap(KEYSTORE_ALIAS + "_missing", blob).is_empty():
			failed.append("an unknown alias was accepted")
	Native.keystore_delete_key(KEYSTORE_ALIAS)
	if not Native.keystore_unwrap(KEYSTORE_ALIAS, blob).is_empty():
		failed.append("unwrap succeeded after the key was deleted")
	if failed.is_empty():
		return _result("keystore", true, "AndroidKeyStore AES-256-GCM: wrap/unwrap, tamper and lost-key rejected")
	return _result("keystore", false, "; ".join(failed))
