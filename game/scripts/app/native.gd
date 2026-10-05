extends Node
## Autoload "Native": facade over the custom Android plugin "UomdNative" (brief 2.11).
## Results that arrive later come as signals, never by polling: the AndroidKeyStore key-wrapping calls, and Google sign-in through
## Credential Manager (`start_google_sign_in` -> `sign_in_finished`, INF-017), and Google Play Billing, Google's consent
## form and rewarded ads (INF-036: `billing_product`, `purchases_updated`, `purchases_queried`, `consent_finished`,
## `ad_finished`). Source: res://android/plugins/uomd_native.

signal sign_in_finished(result: Dictionary)
## {"status": "ok" | "error", "product_id", "title", "price", "offer_token", "error"}
signal billing_product(result: Dictionary)
## {"status": "ok" | "cancelled" | "error", "purchases": [{"token", "products", "state", "acknowledged"}], "error"}
signal purchases_updated(result: Dictionary)
signal purchases_queried(result: Dictionary)
## {"status": "ok" | "error", "can_request_ads", "error"}
signal consent_finished(result: Dictionary)
## {"status": "rewarded" | "closed" | "failed", "error"}
signal ad_finished(result: Dictionary)
## {"status": "ok" | "error", "privacy_options_required", "can_request_ads", "error"}
signal privacy_status(result: Dictionary)
## {"status": "ok" | "error", "error"}
signal privacy_options_finished(result: Dictionary)

const PLUGIN_NAME: String = "UomdNative"
const PLUGIN_SIGNALS: Array[String] = ["sign_in_finished", "billing_product", "purchases_updated", "purchases_queried", "consent_finished", "ad_finished",
	"privacy_status", "privacy_options_finished"]


func _ready() -> void:
	if is_available():
		var plugin: Object = Engine.get_singleton(PLUGIN_NAME)
		for name: String in PLUGIN_SIGNALS:
			plugin.connect(name, _relay.bind(name))


## The plugin signals from the Android UI thread: re-emit on the main thread.
func _relay(result: Dictionary, name: String) -> void:
	emit_signal.call_deferred(name, result)


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


## Starts a Google sign-in for the server's Web client id with the server-issued nonce. False when it cannot start (no plugin, one
## already running); otherwise one `sign_in_finished` follows: {"status": "ok" | "cancelled" | "no_account" | "error", "id_token", "error"}.
func start_google_sign_in(server_client_id: String, nonce: String) -> bool:
	return bool(_call("signIn", [server_client_id, nonce], false))


## Asks Play about a subscription; one `billing_product` follows when true.
func billing_query_product(product_id: String) -> bool:
	return bool(_call("billingQueryProduct", [product_id], false))


## Play's purchase sheet for a product `billing_product` returned, tagged with the game account id; one `purchases_updated`
## follows (also for purchases finished later, e.g. a pending payment).
func billing_purchase(product_id: String, offer_token: String, account_id: String) -> bool:
	return bool(_call("billingPurchase", [product_id, offer_token, account_id], false))


## The subscriptions Play holds for this Google account (restore); one `purchases_queried` follows when true.
func billing_query_purchases() -> bool:
	return bool(_call("billingQueryPurchases", [], false))


## Google's consent form where the law asks for it, before any ad; one `consent_finished` follows when true.
func ads_consent() -> bool:
	return bool(_call("adsConsent", [], false))


## One rewarded ad for `account_id` (AdMob's server-side verification pays it); one `ad_finished` follows when true.
func ads_show_rewarded(ad_unit_id: String, account_id: String) -> bool:
	return bool(_call("adsShowRewarded", [ad_unit_id, account_id], false))


## Whether Settings must offer "Ad privacy choices" (refreshes Google's consent information, shows nothing); one
## `privacy_status` follows when true.
func ads_privacy_status() -> bool:
	return bool(_call("adsPrivacyStatus", [], false))


## Google's privacy options form (change or withdraw ad consent); one `privacy_options_finished` follows when true.
func ads_show_privacy_options() -> bool:
	return bool(_call("adsShowPrivacyOptions", [], false))


## Forgets the account chosen for automatic sign-in (logout).
func clear_credential_state() -> void:
	_call("clearCredentialState", [], null)


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
