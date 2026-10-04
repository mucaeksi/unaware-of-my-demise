extends GutTest
## INF-003/INF-018: the release contract this build checks at boot (`ClientRelease`, server/src/release.ts) and the Android export
## identity it ships with.

## Shared with server/test/release.test.ts: both sides must compute the same rules hash.
const VECTOR_HASH: String = "64b8f81d7fcdaffcbbe2327fb7fa25bbaa634df5fe252024619d8b6cfef76c71"


## A backend whose release contract is `bootstrap`; it records which calls reached it.
class _GatedBackend extends GameBackend:
	var bootstrap: Variant = null
	var calls: Array[String] = []

	func fetch_bootstrap() -> Outcome:
		calls.append("fetch_bootstrap")
		return Outcome.ok(bootstrap)

	func fetch_state() -> Outcome:
		calls.append("fetch_state")
		return _offline()


## A bootstrap reply this build accepts.
func _bootstrap(extra: Dictionary = {}) -> Dictionary:
	var data: Dictionary = {
		"api_version": ClientRelease.API_VERSION,
		"snapshot_schema_version": PlayerState.SCHEMA_VERSION,
		"min_client_version_code": 1,
		"rules_hash": ClientRelease.local_rules_hash(),
		"source_sha": null,
		"maintenance": {"active": false, "message": ""},
		"server_time_utc": "2026-10-04T00:00:00.000Z",
	}
	data.merge(extra, true)
	return JSON.parse_string(JSON.stringify(data))


func test_rules_hash_matches_the_shared_test_vector() -> void:
	var manifest: Dictionary = {"files": {"b.json": {"sha256": "b".repeat(64)}, "a.json": {"sha256": "a".repeat(64)}}}
	assert_eq(ClientRelease.rules_hash(manifest, ["b.json", "a.json"] as Array[String]), VECTOR_HASH)


func test_rules_hash_is_empty_when_the_manifest_lacks_a_file() -> void:
	assert_eq(ClientRelease.rules_hash({"files": {}}, ["x.json"] as Array[String]), "")
	assert_eq(ClientRelease.rules_hash(null), "")
	assert_eq(ClientRelease.rules_hash({"files": {"x.json": {"sha256": "not-hex"}}}, ["x.json"] as Array[String]), "")


func test_the_rules_files_are_sorted_and_shipped() -> void:
	var sorted: Array[String] = ClientRelease.RULES_FILES.duplicate()
	sorted.sort()
	assert_eq(ClientRelease.RULES_FILES, sorted)
	for file: String in ClientRelease.RULES_FILES:
		assert_true(FileAccess.file_exists("res://data/content/" + file), file)
	assert_eq(ClientRelease.local_rules_hash().length(), 64)


func test_a_matching_server_lets_the_build_play() -> void:
	var gate: Outcome = ClientRelease.check(_bootstrap(), ClientRelease.local_rules_hash(), 1)
	assert_true(gate.is_ok(), gate.error)


func test_a_mismatch_requires_an_update() -> void:
	var local: String = ClientRelease.local_rules_hash()
	for changed: Dictionary in [
		{"api_version": ClientRelease.API_VERSION + 1},
		{"snapshot_schema_version": PlayerState.SCHEMA_VERSION + 1},
		{"min_client_version_code": 2},
		{"rules_hash": "0".repeat(64)},
	]:
		assert_eq(ClientRelease.check(_bootstrap(changed), local, 1).error_kind, ClientRelease.KIND_UPDATE_REQUIRED, str(changed))
	assert_eq(ClientRelease.check(_bootstrap(), "", 1).error_kind, ClientRelease.KIND_UPDATE_REQUIRED, "no local hash never matches")


func test_maintenance_carries_the_servers_message_and_yields_to_an_update() -> void:
	var local: String = ClientRelease.local_rules_hash()
	var down: Dictionary = {"maintenance": {"active": true, "message": "Patch in progress"}}
	var gate: Outcome = ClientRelease.check(_bootstrap(down), local, 1)
	assert_eq([gate.error_kind, gate.error], [ClientRelease.KIND_MAINTENANCE, "Patch in progress"])
	down["min_client_version_code"] = 9
	assert_eq(ClientRelease.check(_bootstrap(down), local, 1).error_kind, ClientRelease.KIND_UPDATE_REQUIRED)


func test_a_reply_that_is_not_the_contract_is_a_protocol_error() -> void:
	for reply: Variant in [null, [], {}, _bootstrap({"api_version": "1"}), _bootstrap({"maintenance": true})]:
		assert_eq(ClientRelease.check(reply, "x", 1).error_kind, ClientRelease.KIND_PROTOCOL, str(reply))


func test_the_boot_stops_at_the_release_gate() -> void:
	var flow: GameFlow = GameFlow.create()
	var backend: _GatedBackend = _GatedBackend.new()
	backend.bootstrap = _bootstrap({"min_client_version_code": ClientRelease.version_code() + 1})
	assert_false(await Game.attach(flow, backend))
	assert_eq(Game.boot_error_kind, ClientRelease.KIND_UPDATE_REQUIRED)
	assert_eq(backend.calls, ["fetch_bootstrap"] as Array[String], "no player state is read by an outdated build")
	backend.bootstrap = _bootstrap()
	backend.calls.clear()
	assert_false(await Game.attach(flow, backend))
	assert_eq(backend.calls, ["fetch_bootstrap", "fetch_state"] as Array[String], "a passed gate goes on to the snapshot")
	assert_eq(Game.boot_error_kind, GameBackend.KIND_OFFLINE)


func test_the_android_export_can_reach_the_network_and_names_this_version() -> void:
	var presets: ConfigFile = ConfigFile.new()
	assert_eq(presets.load("res://export_presets.cfg"), OK)
	assert_eq(presets.get_value("preset.0", "platform"), "Android")
	assert_true(presets.get_value("preset.0.options", "permissions/internet", false), "an online game needs the INTERNET permission")
	assert_eq(int(presets.get_value("preset.0.options", "version/code", 0)), ClientRelease.version_code(), "versionCode = uomd/release/version_code")
	assert_gt(ClientRelease.version_code(), 0)
	assert_eq(presets.get_value("preset.0.options", "package/unique_name"), "io.github.mucaeksi.unawareofmydemise")
