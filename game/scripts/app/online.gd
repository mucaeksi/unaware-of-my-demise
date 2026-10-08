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
## The server's account-creation fact, not the device's automatic-login preference.
var is_new_account: bool = false
var onboarding_path: String = "user://onboarding.cfg"
const OnboardingPreferences = preload("res://scripts/app/onboarding_preferences.gd")
var session_expires_at_utc: String = ""
## Where Google ID tokens come from; tests substitute their own.
var signer: SignInFlow.Signer = SignInFlow.NativeSigner.new()
## The HTTP transport of every backend handed out (null = real HTTP); tests substitute their own.
var transport: OnlineBackend.Transport = null

var _renewing: bool = false
## This remembers a successful sign-in preference, never a bearer or Google credential.
var preferences_path: String = "user://auth_preferences.cfg"
var last_login_attempts: int = 0

func returning_player() -> bool:
	var preferences: ConfigFile = ConfigFile.new()
	return preferences.load(preferences_path) == OK and bool(preferences.get_value("login", "returning", false))

func remember_login(enabled: bool) -> Error:
	var preferences: ConfigFile = ConfigFile.new()
	preferences.load(preferences_path)
	preferences.set_value("login", "returning", enabled)
	return preferences.save(preferences_path)


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
	var result: Outcome = await SignInFlow.run_with_retries(OnlineBackend.new(server_url(), "", transport), google_server_client_id(), signer, 0.7, func(attempt: int) -> void: last_login_attempts = attempt)
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


## Signs out (coroutine): ends the session on the server (best effort: an unreachable server only delays its expiry), then forgets it
## here and the device's automatic sign-in choice, so the next sign-in shows the account chooser.
func log_out() -> Outcome:
	if has_session() and not server_url().is_empty():
		await OnlineBackend.new(server_url(), session_token, transport).log_out()
	sign_out()
	return Outcome.ok()


## Deletes the player's account and everything in it (coroutine; INF-020). The server requires a fresh Google credential of the same
## identity, so this shows the account chooser (or signs in silently with the remembered account). On success the session is gone.
func delete_account() -> Outcome:
	if not has_session():
		return Outcome.fail(KIND_ACCOUNT_CHANGED, "You are signed out.")
	var backend: OnlineBackend = OnlineBackend.new(server_url(), session_token, transport)
	var credential: Outcome = await SignInFlow.request_credential(backend, google_server_client_id(), signer)
	if not credential.is_ok():
		return credential
	var deleted: Outcome = await backend.delete_account(str(credential.value))
	if deleted.is_ok():
		sign_out()
	return deleted


## Forgets the session and the device's automatic sign-in choice.
func sign_out() -> void:
	if remember_login(false) != OK: push_warning("Could not save the automatic sign-in preference.")
	session_token = ""
	account_id = ""
	is_new_account = false
	session_expires_at_utc = ""
	Native.clear_credential_state()


func _adopt(session: Dictionary) -> void:
	session_token = str(session["session_token"])
	account_id = str(session["account_id"])
	is_new_account = session.get("is_new_account") == true
	var saved: Error = OnboardingPreferences.register(onboarding_path, account_id, is_new_account)
	if saved != OK: push_warning("Could not save the opening tutorial preference: " + error_string(saved))
	session_expires_at_utc = str(session.get("expires_at_utc", ""))
	if remember_login(true) != OK: push_warning("Could not save the automatic sign-in preference.")
	signed_in.emit(account_id)
