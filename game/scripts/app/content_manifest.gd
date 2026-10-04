class_name ContentManifest
extends RefCounted
## The signed description of a content release (INF-028, DEC-0029): which packs, in which order, for which app versions
## and base pack, with which rules. The client installs nothing a manifest does not name, and trusts a manifest only when
## its signature verifies with a public key shipped inside the app (res://data/keys/<key_id>.pem; never in a patch, which
## cannot carry anything outside data/content and imported assets, DEC-0028).
##
## Signature: RSA (PKCS#1 v1.5) over SHA-256 of the exact manifest bytes, as `openssl dgst -sha256 -sign` writes it
## (tools/sign_content_manifest.sh). Godot's Crypto verifies it the same way on every platform (mbedTLS).
##
## Usage:
##   var checked: Outcome = ContentManifest.verify(manifest_bytes, signature, ContentManifest.trusted_keys(),
##       ClientRelease.version_code(), installed_generation)
##   if checked.is_ok(): var manifest: Dictionary = checked.value
##
## Refusals (`error_kind`): KIND_UNTRUSTED (unknown key, bad signature), KIND_INVALID (not a manifest of this schema),
## KIND_INCOMPATIBLE (another app version range), KIND_REPLAY (not newer than the installed generation: an old manifest
## replayed; a rollback is published as a new, higher generation).

const SCHEMA: int = 1
const KEYS_DIR: String = "res://data/keys"
const KIND_UNTRUSTED: String = "manifest_untrusted"
const KIND_INVALID: String = "manifest_invalid"
const KIND_INCOMPATIBLE: String = "manifest_incompatible"
const KIND_REPLAY: String = "manifest_replay"
const _HEX64: String = "^[0-9a-f]{64}$"


## {key_id: CryptoKey} of the public keys in `directory` (file name without ".pem" = key id).
static func trusted_keys(directory: String = KEYS_DIR) -> Dictionary:
	var keys: Dictionary = {}
	if not DirAccess.dir_exists_absolute(directory):
		return keys
	for file_name: String in DirAccess.get_files_at(directory):
		if not file_name.ends_with(".pem"):
			continue
		var key: CryptoKey = CryptoKey.new()
		if key.load_from_string(FileAccess.get_file_as_string(directory.path_join(file_name)), true) == OK:
			keys[file_name.trim_suffix(".pem")] = key
		else:
			push_warning("ContentManifest: %s is not a public key" % file_name)
	return keys


static func verify(manifest_bytes: PackedByteArray, signature: PackedByteArray, keys: Dictionary, version_code: int,
		installed_generation: int) -> Outcome:
	var parser: JSON = JSON.new()
	if parser.parse(manifest_bytes.get_string_from_utf8()) != OK or not (parser.data is Dictionary):
		return Outcome.fail(KIND_INVALID, "The content manifest is not a JSON object.")
	var manifest: Dictionary = parser.data
	var key_id: String = str(manifest.get("key_id", ""))
	if not keys.has(key_id):
		return Outcome.fail(KIND_UNTRUSTED, "The content manifest is signed with an unknown key (%s)." % key_id)
	var hashing: HashingContext = HashingContext.new()
	hashing.start(HashingContext.HASH_SHA256)
	hashing.update(manifest_bytes)
	if signature.is_empty() or not Crypto.new().verify(HashingContext.HASH_SHA256, hashing.finish(), signature, keys[key_id]):
		return Outcome.fail(KIND_UNTRUSTED, "The content manifest signature does not verify.")
	var problem: String = _shape_problem(manifest)
	if not problem.is_empty():
		return Outcome.fail(KIND_INVALID, "The content manifest is malformed: %s." % problem)
	var app: Dictionary = manifest["app"]
	if version_code < int(app["min_version_code"]) or version_code > int(app["max_version_code"]):
		return Outcome.fail(KIND_INCOMPATIBLE, "The content release is for app versions %d-%d, this is %d." % [
			int(app["min_version_code"]), int(app["max_version_code"]), version_code])
	if int(manifest["generation"]) <= installed_generation:
		return Outcome.fail(KIND_REPLAY, "The content release generation %d is not newer than the installed %d." % [
			int(manifest["generation"]), installed_generation])
	return Outcome.ok(manifest)


## "" when `manifest` has every field of schema 1 with the right type, else what is wrong.
static func _shape_problem(manifest: Dictionary) -> String:
	if manifest.get("schema") != float(SCHEMA) and manifest.get("schema") != SCHEMA:
		return "schema %s is not %d" % [str(manifest.get("schema")), SCHEMA]
	for field: String in ["channel", "content_release", "key_id", "issued_at_utc"]:
		if not (manifest.get(field) is String) or str(manifest[field]).is_empty():
			return "%s must be a non-empty string" % field
	for field: String in ["base_pack_sha256", "rules_hash"]:
		if not (manifest.get(field) is String) or not _matches(str(manifest[field]), _HEX64):
			return "%s must be a SHA-256 hex digest" % field
	if not _whole(manifest.get("generation")) or int(manifest["generation"]) < 1:
		return "generation must be a positive integer"
	var app: Variant = manifest.get("app")
	if not (app is Dictionary) or not _whole(app.get("min_version_code")) or not _whole(app.get("max_version_code")) \
			or int(app["min_version_code"]) > int(app["max_version_code"]):
		return "app must be {min_version_code <= max_version_code}"
	var packs: Variant = manifest.get("packs")
	if not (packs is Array) or (packs as Array).is_empty():
		return "packs must be a non-empty list"
	var names: Dictionary = {}
	for pack: Variant in packs:
		if not (pack is Dictionary) or not _matches(str(pack.get("name", "")), "^[a-z0-9][a-z0-9._-]*\\.pck$") \
				or not _matches(str(pack.get("sha256", "")), _HEX64) or not _whole(pack.get("bytes")) or int(pack["bytes"]) <= 0:
			return "every pack needs a plain file name ending .pck, a sha256 and a positive size"
		if names.has(pack["name"]):
			return "pack %s is listed twice" % pack["name"]
		names[pack["name"]] = true
	return ""


static func _whole(value: Variant) -> bool:
	return (value is int) or (value is float and is_equal_approx(value, roundf(value)))


static func _matches(text: String, pattern: String) -> bool:
	var regex: RegEx = RegEx.create_from_string(pattern)
	return regex.search(text) != null
