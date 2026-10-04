extends Node
## Autoload "Game": the only surface the UI talks to (the GameController equivalent, brief 2.4 and 2.6).
## Domain code lives in res://scripts/core and never touches the scene tree; this node wires it to the app: it holds the loaded content
## and the game flow (`GameFlow`) and fetches the player's snapshot from the server (DEC-0012). The boot screen loads the content on a
## `WorkerJob` (`GameFlow.create`), then hands the result to `attach` on the main thread; tools and tests can call `boot()` for the same in one go.

## The flow once `attach` succeeded (null before, and after a failure).
var flow: GameFlow = null
## Why `boot`/`attach` failed ("" = it did not), and the failure kind (`GameBackend.KIND_OFFLINE`, `GameFlow.ERROR_PROTOCOL`, ...;
## "" = the content itself failed to load).
var boot_error: String = ""
var boot_error_kind: String = ""


## Engine facts for the boot screen, logs and bug reports.
func engine_info() -> Dictionary:
	var version: Dictionary = Engine.get_version_info()
	return {
		"godot": String(version.get("string", "")),
		"renderer": String(ProjectSettings.get_setting("rendering/renderer/rendering_method", "")),
		"platform": OS.get_name(),
	}


func is_ready() -> bool:
	return flow != null and flow.has_state()


## Content load and first sync in one call (coroutine; the content load blocks, the boot screen does that part on a worker instead).
## `backend` null = the one `Online` provides.
func boot(backend: GameBackend = null) -> bool:
	return await attach(GameFlow.create(), backend)


## Adopts a content-loaded flow, connects it to `backend` (null = `Online.backend()`) and fetches the player's snapshot (coroutine).
func attach(new_flow: GameFlow, backend: GameBackend = null) -> bool:
	flow = null
	boot_error = ""
	boot_error_kind = ""
	if not new_flow.is_ready():
		boot_error = new_flow.error
		return false
	new_flow.backend = backend if backend != null else Online.backend()
	var synced: Outcome = await new_flow.sync()
	if not synced.is_ok():
		boot_error = synced.error
		boot_error_kind = synced.error_kind
		return false
	flow = new_flow
	return true
