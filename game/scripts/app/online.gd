extends Node
## Autoload "Online": server client state (brief 2.12). Hands the game flow its `GameBackend` and owns the player's session: Google
## sign-in (`SignInFlow`, INF-017) and its renewal when the session expires (INF-019).

signal signed_in(account_id: String)
signal offline_changed(is_offline: bool)
signal _renewal_finished(result: Outcome)

## Project setting holding the Worker API base URL ("" = no server configured in this build).
const SERVER_URL_SETTING: String = "uomd/online/server_url"
## Project setting holding the game server's Web OAuth client id: Credential Manager's server client id, one of the Worker's
## GOOGLE_CLIENT_IDS (the ID token audience). Public, not a secret.
const GOOGLE_CLIENT_SETTING: String = "uomd/online/google_server_client_id"
const KIND_ACCOUNT_CHANGED: String = OnlineBackend.KIND_ACCOUNT_CHANGED

var is_offline: bool = true
## The bearer session from `POST /v1/auth/google`, kept in memory only (a new launch signs in again; a returning player is not prompted).
var session_token: String = ""
## The account the session belongs to ("" = never signed in since launch).
var account_id: String = ""
var session_expires_at_utc: String = ""
## Where Google ID tokens come from; tests substitute their own.
var signer: SignInFlow.Signer = SignInFlow.NativeSigner.new()
## The HTTP transport of every backend handed out (null = real HTTP); tests substitute their own.
var transport: OnlineBackend.Transport = null

var _renewing: bool = false


func server_url() -> String:
	return str(ProjectSettings.get_setting(SERVER_URL_SETTING, ""))


func google_server_client_id() -> String:
	return str(ProjectSettings.get_setting(GOOGLE_CLIENT_SETTING, ""))


func has_session() -> bool:
	return not session_token.is_empty()


## The backend the game flow talks to: the Worker API once a server is configured (without a session it can still read the release
## contract; `Game.attach` signs in before reading player state), otherwise the "no server" base (every call fails offline).
func backend() -> GameBackend:
	if server_url().is_empty():
		return GameBackend.new()
	var online: OnlineBackend = OnlineBackend.new(server_url(), session_token, transport)
	online.reauthenticate = renew_session
	return online


## Signs the player in with Google and keeps the session (coroutine).
func sign_in() -> Outcome:
	var result: Outcome = await SignInFlow.run(OnlineBackend.new(server_url(), "", transport), google_server_client_id(), signer)
	if result.is_ok():
		_adopt(result.value)
	return result


## A new session for the same account after the old one expired (coroutine; `value` = the new token). Signing in as another account
## ends the session instead (`KIND_ACCOUNT_CHANGED`) and the account stays bound, so every later renewal fails the same way: a request
## made for one account is never sent for another; only a new boot (`sign_in`) may change the account. Without a bound account (after
## `sign_out`) nothing is renewed. Concurrent callers share one renewal.
func renew_session() -> Outcome:
	if account_id.is_empty():
		return Outcome.fail(KIND_ACCOUNT_CHANGED, "You are signed out. Restart the game to sign in.")
	if _renewing:
		var shared: Outcome = await _renewal_finished
		return shared
	_renewing = true
	var result: Outcome = await SignInFlow.run(OnlineBackend.new(server_url(), "", transport), google_server_client_id(), signer)
	if result.is_ok():
		var session: Dictionary = result.value
		if str(session["account_id"]) != account_id:
			session_token = ""
			session_expires_at_utc = ""
			Native.clear_credential_state()
			result = Outcome.fail(KIND_ACCOUNT_CHANGED, "You signed in with a different account. Restart the game to play as that account.")
		else:
			_adopt(session)
			result = Outcome.ok(session_token)
	_renewing = false
	_renewal_finished.emit(result)
	return result


## Forgets the session and the device's automatic sign-in choice.
func sign_out() -> void:
	session_token = ""
	account_id = ""
	session_expires_at_utc = ""
	Native.clear_credential_state()


func _adopt(session: Dictionary) -> void:
	session_token = str(session["session_token"])
	account_id = str(session["account_id"])
	session_expires_at_utc = str(session.get("expires_at_utc", ""))
	signed_in.emit(account_id)
