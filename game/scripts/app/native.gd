extends Node
## Autoload "Native": facade over the custom Android plugin "UomdNative" (brief 2.11).
## Results that arrive later come as signals, never by polling. G2: the AndroidKeyStore key-wrapping calls.

signal sign_in_finished(result: Dictionary)
signal purchase_finished(result: Dictionary)
signal rewarded_ad_finished(result: Dictionary)

const PLUGIN_NAME: String = "UomdNative"


## True only on an Android build that ships the plugin.
func is_available() -> bool:
	return Engine.has_singleton(PLUGIN_NAME)


func keystore_has_key(alias: String) -> bool:
	return bool(_call("hasKey", [alias], false))


## Creates the non-exportable AES-256-GCM wrapping key.
func keystore_create_key(alias: String) -> bool:
	return bool(_call("createKey", [alias], false))


func keystore_delete_key(alias: String) -> bool:
	return bool(_call("deleteKey", [alias], false))


## Wraps the plaintext; the blob is iv_length (1 byte) || iv || ciphertext+tag. Empty on failure.
func keystore_wrap(alias: String, plaintext: PackedByteArray) -> PackedByteArray:
	return _call_bytes("wrap", [alias, plaintext])


## Reverses keystore_wrap. Empty on failure (lost key, tampered blob).
func keystore_unwrap(alias: String, blob: PackedByteArray) -> PackedByteArray:
	return _call_bytes("unwrap", [alias, blob])


## The reason the previous plugin call failed, or "".
func last_error() -> String:
	return String(_call("lastError", [], ""))


func _call(method: String, args: Array, fallback: Variant) -> Variant:
	if not is_available():
		return fallback
	var plugin: Object = Engine.get_singleton(PLUGIN_NAME)
	return plugin.callv(method, args)


func _call_bytes(method: String, args: Array) -> PackedByteArray:
	var result: Variant = _call(method, args, PackedByteArray())
	if result is PackedByteArray:
		return result
	return PackedByteArray()
