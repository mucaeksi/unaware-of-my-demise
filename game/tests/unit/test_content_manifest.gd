extends GutTest
## INF-028: content manifests are trusted only with a valid signature from a shipped key, for this app, and newer than
## what is installed. The fixture was signed with `openssl dgst -sha256 -sign` and a throwaway RSA-3072 key whose private
## half was discarded (only the public key is in the repository).

const FIXTURES: String = "res://tests/fixtures/content_manifest"

var _crypto: Crypto = Crypto.new()
## One locally generated signing key for the whole file (RSA generation is slow).
var _local_key: CryptoKey = null


func _fixture() -> PackedByteArray:
	return FileAccess.get_file_as_bytes(FIXTURES + "/manifest.json")


func _signature() -> PackedByteArray:
	return FileAccess.get_file_as_bytes(FIXTURES + "/manifest.json.sig")


func _keys() -> Dictionary:
	return ContentManifest.trusted_keys(FIXTURES)


## A manifest signed here with a fresh key: {"bytes", "signature", "keys"}.
func _signed(manifest: Dictionary, key_id: String = "uomd-test-local") -> Dictionary:
	manifest["key_id"] = key_id
	if _local_key == null:
		_local_key = _crypto.generate_rsa(2048)
	var key: CryptoKey = _local_key
	var public: CryptoKey = CryptoKey.new()
	public.load_from_string(key.save_to_string(true), true)
	var bytes: PackedByteArray = JSON.stringify(manifest).to_utf8_buffer()
	var hashing: HashingContext = HashingContext.new()
	hashing.start(HashingContext.HASH_SHA256)
	hashing.update(bytes)
	return {"bytes": bytes, "signature": _crypto.sign(HashingContext.HASH_SHA256, hashing.finish(), key), "keys": {key_id: public}}


func _valid() -> Dictionary:
	return JSON.parse_string(_fixture().get_string_from_utf8())


func test_an_openssl_signed_manifest_verifies_with_the_shipped_key() -> void:
	assert_eq(_keys().keys(), ["uomd-test-1"])
	var checked: Outcome = ContentManifest.verify(_fixture(), _signature(), _keys(), 1, 0)
	assert_true(checked.is_ok(), checked.error)
	assert_eq(int(checked.value["generation"]), 2)
	assert_eq(checked.value["packs"][0]["name"], "content-test-0001.pck")


func test_a_changed_byte_or_another_signature_is_untrusted() -> void:
	var tampered: PackedByteArray = _fixture()
	tampered[tampered.find(ord("2"))] = ord("9")
	assert_eq(ContentManifest.verify(tampered, _signature(), _keys(), 1, 0).error_kind, ContentManifest.KIND_UNTRUSTED)
	var forged: Dictionary = _signed(_valid(), "uomd-test-1")
	assert_eq(ContentManifest.verify(forged["bytes"], forged["signature"], _keys(), 1, 0).error_kind, ContentManifest.KIND_UNTRUSTED,
		"signed by a key with the trusted id but not the trusted key")
	assert_eq(ContentManifest.verify(_fixture(), PackedByteArray(), _keys(), 1, 0).error_kind, ContentManifest.KIND_UNTRUSTED)
	assert_eq(ContentManifest.verify(_fixture(), _signature(), {}, 1, 0).error_kind, ContentManifest.KIND_UNTRUSTED, "no shipped key")
	assert_eq(ContentManifest.verify("not json".to_utf8_buffer(), _signature(), _keys(), 1, 0).error_kind, ContentManifest.KIND_INVALID)


func test_other_app_versions_and_old_generations_are_refused() -> void:
	assert_eq(ContentManifest.verify(_fixture(), _signature(), _keys(), 2, 0).error_kind, ContentManifest.KIND_INCOMPATIBLE)
	assert_eq(ContentManifest.verify(_fixture(), _signature(), _keys(), 1, 2).error_kind, ContentManifest.KIND_REPLAY, "same generation")
	assert_eq(ContentManifest.verify(_fixture(), _signature(), _keys(), 1, 5).error_kind, ContentManifest.KIND_REPLAY, "older generation")
	assert_true(ContentManifest.verify(_fixture(), _signature(), _keys(), 1, 1).is_ok(), "newer than installed")


func test_a_signed_but_malformed_manifest_is_invalid() -> void:
	var cases: Dictionary = {
		"schema": 2,
		"generation": 0,
		"base_pack_sha256": "abc",
		"rules_hash": null,
		"app": {"min_version_code": 3, "max_version_code": 1},
		"packs": [],
		"channel": "",
	}
	for field: String in cases:
		var manifest: Dictionary = _valid()
		manifest[field] = cases[field]
		var signed: Dictionary = _signed(manifest)
		var checked: Outcome = ContentManifest.verify(signed["bytes"], signed["signature"], signed["keys"], 1, 0)
		assert_eq(checked.error_kind, ContentManifest.KIND_INVALID, field)
	for pack: Dictionary in [{"name": "../evil.pck", "sha256": "0".repeat(64), "bytes": 1}, {"name": "a.zip", "sha256": "0".repeat(64), "bytes": 1},
			{"name": "a.pck", "sha256": "0".repeat(64), "bytes": 0}]:
		var manifest: Dictionary = _valid()
		manifest["packs"] = [pack]
		var signed: Dictionary = _signed(manifest)
		assert_eq(ContentManifest.verify(signed["bytes"], signed["signature"], signed["keys"], 1, 0).error_kind, ContentManifest.KIND_INVALID, str(pack))
	var twice: Dictionary = _valid()
	twice["packs"] = [twice["packs"][0], twice["packs"][0]]
	var signed_twice: Dictionary = _signed(twice)
	assert_eq(ContentManifest.verify(signed_twice["bytes"], signed_twice["signature"], signed_twice["keys"], 1, 0).error_kind, ContentManifest.KIND_INVALID)
	var good: Dictionary = _signed(_valid())
	assert_true(ContentManifest.verify(good["bytes"], good["signature"], good["keys"], 1, 0).is_ok(), "Godot-signed manifests verify too")


func test_the_app_ships_exactly_the_registered_content_key() -> void:
	# Owner decision D-09 registered uomd-content-1 (RSA 3072; its private half is only the CONTENT_SIGNING_KEY secret).
	var shipped: Dictionary = ContentManifest.trusted_keys()
	assert_eq(shipped.keys(), ["uomd-content-1"])
	assert_true(shipped["uomd-content-1"] is CryptoKey)
	assert_true((shipped["uomd-content-1"] as CryptoKey).is_public_only(), "only a public key ever ships")
	assert_false(shipped.has("uomd-test-1"), "the test key is never a shipped key")
	assert_eq(ContentManifest.trusted_keys("res://no/such/dir"), {})
