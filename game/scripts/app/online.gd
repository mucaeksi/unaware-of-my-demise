extends Node
## Autoload "Online": server client state (brief 2.12). Hands the game flow its `GameBackend`.

signal signed_in(account_id: String)
signal offline_changed(is_offline: bool)

## Project setting holding the Worker API base URL ("" = no server configured in this build).
const SERVER_URL_SETTING: String = "uomd/online/server_url"

var is_offline: bool = true
## The bearer session from `POST /v1/auth/google`, kept in memory only. Sign-in itself needs the Android Credential
## Manager integration, which is not built yet; until then nothing sets this in a shipped build.
var session_token: String = ""


func server_url() -> String:
	return str(ProjectSettings.get_setting(SERVER_URL_SETTING, ""))


## The backend the game flow talks to: the Worker API once a server is configured and a session exists, otherwise the
## "no server" base (every call fails offline).
func backend() -> GameBackend:
	if server_url().is_empty() or session_token.is_empty():
		return GameBackend.new()
	return OnlineBackend.new(server_url(), session_token)
