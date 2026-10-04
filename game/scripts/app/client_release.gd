class_name ClientRelease
extends RefCounted
## The client side of the release contract (INF-003, docs/INFRASTRUCTURE_ROADMAP.md; the server side is server/src/release.ts): what this
## build is (its Android versionCode, the API and snapshot versions it speaks, the rules hash of the content it ships) and whether a
## server's `GET /v1/bootstrap` reply lets it play. Checked at boot before the player's snapshot is fetched.
##
## Until signed content patches exist (roadmap G5), the rules content ships inside the app, so a rules hash that differs from the
## server's means this build must be updated: the server would re-simulate a different battle than the one played here.

const KIND_UPDATE_REQUIRED: String = "update_required"
const KIND_MAINTENANCE: String = "maintenance"
## The bootstrap reply is not the contract this build knows.
const KIND_PROTOCOL: String = "protocol"

## The /v1 wire contract this build speaks (server `API_VERSION`).
const API_VERSION: int = 1
## Project setting holding the Android versionCode of this build; equal to the export preset's `version/code` (tested).
const VERSION_CODE_SETTING: String = "uomd/release/version_code"
const CONTENT_MANIFEST: String = "res://data/content/MANIFEST.json"
## The content packs the server rules are built from, sorted by name. Must equal server `RULES_FILES` (checked by server/test/release.test.ts).
const RULES_FILES: Array[String] = [
	"accessories_part1.json",
	"armors_part1.json",
	"battle_effects_part1.json",
	"battle_rules_part1.json",
	"characters_part1.json",
	"drop_tables_part1.json",
	"economy_part1.json",
	"enemies_part1.json",
	"items_part1.json",
	"stages_part1.json",
	"story_script_part1_manifest.json",
	"weapons_part1.json",
]


static func version_code() -> int:
	return int(ProjectSettings.get_setting(VERSION_CODE_SETTING, 0))


## SHA-256 (hex) of the lines "<file> <sha256 of the file>\n" for `files` in name order, the file hashes taken from a content
## MANIFEST.json object; "" when the manifest lacks one of them. Same algorithm as the server's `rulesHash`.
static func rules_hash(manifest: Variant, files: Array[String] = RULES_FILES) -> String:
	var entries: Variant = (manifest as Dictionary).get("files") if manifest is Dictionary else null
	if not (entries is Dictionary):
		return ""
	var names: Array[String] = files.duplicate()
	names.sort()
	var text: String = ""
	for file: String in names:
		var entry: Variant = (entries as Dictionary).get(file)
		var digest: String = str((entry as Dictionary).get("sha256", "")) if entry is Dictionary else ""
		if digest.length() != 64 or not digest.is_valid_hex_number():
			return ""
		text += "%s %s\n" % [file, digest]
	return text.sha256_text()


## The rules hash of the content this build ships.
static func local_rules_hash(path: String = CONTENT_MANIFEST) -> String:
	return rules_hash(JSON.parse_string(FileAccess.get_file_as_string(path)))


## Whether a `GET /v1/bootstrap` reply lets this build play: ok, or a failure of kind `KIND_UPDATE_REQUIRED` (another API or snapshot
## version, a versionCode below the server's floor, other rules content), `KIND_MAINTENANCE` (with the server's message) or
## `KIND_PROTOCOL` (not a bootstrap reply). An update outranks maintenance, as on the server.
static func check(bootstrap: Variant, local_hash: String, code: int = version_code()) -> Outcome:
	if not (bootstrap is Dictionary):
		return Outcome.fail(KIND_PROTOCOL, "The server's release information is not a JSON object.")
	var data: Dictionary = bootstrap
	for field: String in ["api_version", "snapshot_schema_version", "min_client_version_code"]:
		if not (data.get(field) is float or data.get(field) is int):
			return Outcome.fail(KIND_PROTOCOL, "The server's release information has no %s." % field)
	if not (data.get("rules_hash") is String) or not (data.get("maintenance") is Dictionary):
		return Outcome.fail(KIND_PROTOCOL, "The server's release information is incomplete.")
	if int(data["api_version"]) != API_VERSION or int(data["snapshot_schema_version"]) != PlayerState.SCHEMA_VERSION:
		return Outcome.fail(KIND_UPDATE_REQUIRED, "This version of the game no longer matches the server. Please update the game.")
	if code < int(data["min_client_version_code"]):
		return Outcome.fail(KIND_UPDATE_REQUIRED, "This version of the game is no longer supported. Please update the game.")
	if local_hash.is_empty() or str(data["rules_hash"]) != local_hash:
		return Outcome.fail(KIND_UPDATE_REQUIRED, "The game data on this device does not match the server. Please update the game.")
	var maintenance: Dictionary = data["maintenance"]
	if maintenance.get("active") == true:
		var message: String = str(maintenance.get("message", ""))
		return Outcome.fail(KIND_MAINTENANCE, message if not message.is_empty() else "The game is under maintenance. Please try again later.")
	return Outcome.ok(data)
