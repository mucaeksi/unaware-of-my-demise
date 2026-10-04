extends Node
## Autoload "Online": server client state (brief 2.12). Skeleton (G2); the client itself arrives in G6.

signal signed_in(account_id: String)
signal offline_changed(is_offline: bool)

var is_offline: bool = true


## The backend the game flow talks to. Until the Worker API client exists this is the "no server" base (every call fails offline).
func backend() -> GameBackend:
	return GameBackend.new()
