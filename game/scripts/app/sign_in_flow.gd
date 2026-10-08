class_name SignInFlow
extends RefCounted
## Google sign-in against the Worker API (INF-017, server/README.md auth routes): the server issues a single-use nonce, Credential
## Manager on the device turns it into a Google ID token carrying that nonce, and the server verifies the token and answers an opaque
## session. The app holds no client secret and no database access; the ID token is passed on once and never stored.
##
## Failures come back as `Outcome`s: `KIND_CANCELLED` (the player closed the account chooser), `KIND_UNAVAILABLE` (no sign-in on this
## device or build), `KIND_FAILED` (Credential Manager failed, or no Google account), or the backend's kinds for the two server calls
## (`offline`, `unauthorized`, `protocol`, ...).

const KIND_CANCELLED: String = "sign_in_cancelled"
const KIND_UNAVAILABLE: String = "sign_in_unavailable"
const KIND_FAILED: String = "sign_in_failed"
const KIND_TRANSIENT: String = "sign_in_transient"
const MAX_ATTEMPTS: int = 3

## Each retry gets a fresh nonce: an exchanged nonce cannot safely be replayed after a lost reply.
## Cancellation, missing accounts, configuration and rejected credentials stop immediately.
static func run_with_retries(backend: OnlineBackend, server_client_id: String, signer: Signer, delay_seconds: float = 0.7, attempt_started: Callable = Callable()) -> Outcome:
	var result: Outcome = Outcome.fail(KIND_FAILED, "Failed to login")
	for attempt: int in MAX_ATTEMPTS:
		if attempt_started.is_valid(): attempt_started.call(attempt + 1)
		result = await run(backend, server_client_id, signer)
		if result.is_ok() or result.error_kind not in [GameBackend.KIND_OFFLINE, KIND_TRANSIENT, "service_unavailable", "internal_error", "rate_limited"]:
			return result
		if attempt < MAX_ATTEMPTS - 1 and delay_seconds > 0.0:
			await (Engine.get_main_loop() as SceneTree).create_timer(delay_seconds * float(attempt + 1)).timeout
	return result


## Where the Google ID token comes from; tests substitute their own. `request_id_token` is a coroutine returning
## {"status": "ok" | "cancelled" | "no_account" | "error" | "unavailable", "id_token": String, "error": String}.
class Signer extends RefCounted:
	func request_id_token(_server_client_id: String, _nonce: String) -> Dictionary:
		return {"status": "unavailable", "id_token": "", "error": "Google sign-in is not available on this device."}


## Credential Manager through the UomdNative Android plugin (`Native` autoload).
class NativeSigner extends Signer:
	func request_id_token(server_client_id: String, nonce: String) -> Dictionary:
		if not Native.start_google_sign_in(server_client_id, nonce):
			var reason: String = Native.last_error()
			return {"status": "unavailable", "id_token": "", "error": reason if not reason.is_empty() else "Google sign-in is not available on this device."}
		var result: Dictionary = await Native.sign_in_finished
		return result


## A fresh Google ID token bound to a new server nonce (coroutine; `value` = the token). Sign-in trades it for a session; account
## deletion sends it as the proof that the player holds the account's identity.
static func request_credential(backend: OnlineBackend, server_client_id: String, signer: Signer) -> Outcome:
	if server_client_id.is_empty():
		return Outcome.fail(KIND_UNAVAILABLE, "Sign-in is not configured in this build.")
	var issued: Outcome = await backend.request_nonce()
	if not issued.is_ok():
		return issued
	var nonce: String = str((issued.value as Dictionary).get("nonce", ""))
	if nonce.is_empty():
		return Outcome.fail(OnlineBackend.KIND_PROTOCOL, "The server issued no sign-in nonce.")
	var token: Dictionary = await signer.request_id_token(server_client_id, nonce)
	match str(token.get("status", "")):
		"ok":
			pass
		"cancelled":
			return Outcome.fail(KIND_CANCELLED, "Sign-in was cancelled. Sign in with a Google account to play.")
		"no_account":
			return Outcome.fail(KIND_FAILED, "There is no Google account on this device. Add one in the device settings to play.")
		"unavailable":
			return Outcome.fail(KIND_UNAVAILABLE, str(token.get("error", "Google sign-in is not available on this device.")))
		_:
			var reason: String = str(token.get("error", "unknown error"))
			if reason.to_lower().contains("network") or reason.to_lower().contains("interrupted") or reason.to_lower().contains("timeout"):
				return Outcome.fail(KIND_TRANSIENT, "Google sign-in failed: %s" % reason)
			return Outcome.fail(KIND_FAILED, "Google sign-in failed: %s" % str(token.get("error", "unknown error")))
	var id_token: String = str(token.get("id_token", ""))
	if id_token.is_empty():
		return Outcome.fail(KIND_FAILED, "Google sign-in returned no credential.")
	return Outcome.ok(id_token)


## Runs one sign-in (coroutine). `value` on success: {"account_id", "session_token", "expires_at_utc", "is_new_account"}.
static func run(backend: OnlineBackend, server_client_id: String, signer: Signer) -> Outcome:
	var credential: Outcome = await request_credential(backend, server_client_id, signer)
	if not credential.is_ok():
		return credential
	var session: Outcome = await backend.exchange_google_credential(str(credential.value))
	if not session.is_ok():
		return session
	var data: Dictionary = session.value
	if not (data.get("session_token") is String) or str(data["session_token"]).is_empty() or not (data.get("account_id") is String):
		return Outcome.fail(OnlineBackend.KIND_PROTOCOL, "The server's sign-in reply carries no session.")
	return Outcome.ok({
		"account_id": str(data["account_id"]),
		"session_token": str(data["session_token"]),
		"expires_at_utc": str(data.get("expires_at_utc", "")),
		"is_new_account": data.get("is_new_account") == true,
	})
