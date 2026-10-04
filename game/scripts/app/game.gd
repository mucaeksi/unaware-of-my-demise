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
## Stable asset references -> art (INF-024), built from the shipped content packs on first use. Tests may replace it.
var assets: AssetResolver = null:
	get:
		if assets == null:
			assets = AssetResolver.new(AssetCatalog.from_dir(GameFlow.CONTENT_DIR))
		return assets


## Signed content releases on this device (INF-031); built on first use. Tests may replace it.
var content: ContentInstaller = null:
	get:
		if content == null:
			content = ContentInstaller.new()
		return content
var _content_mounted: bool = false


## Mounts the installed content release over the shipped data, once per process, before any content is loaded (INF-026).
func mount_content() -> Dictionary:
	if not _content_mounted:
		_content_mounted = true
		var mounted: Dictionary = content.mount_installed()
		for problem: Variant in mounted.get("problems", []):
			push_warning("Content: %s" % str(problem))
	return content.report


## Fetches, verifies and installs the current content release (coroutine), signing in first when needed. value:
## {"generation", "content_release", "restart_required"}; when no restart is required the new pack is already mounted and
## the caller reloads the content.
func update_content(backend: GameBackend = null) -> Outcome:
	var online: GameBackend = backend if backend != null else Online.backend()
	if backend == null and online is OnlineBackend and not Online.has_session():
		var signed: Outcome = await Online.sign_in()
		if not signed.is_ok():
			return signed
		online = Online.backend()
	if not (online is OnlineBackend):
		return Outcome.fail(ContentInstaller.KIND_DOWNLOAD, "Game data updates need the game server.")
	var server: OnlineBackend = online
	var release: Outcome = await server.fetch_content_release()
	if not release.is_ok():
		return release
	var installed: Outcome = await content.install(release.value, server.download_pack)
	if installed.is_ok() and not bool((installed.value as Dictionary)["restart_required"]):
		content.mount_new()
	return installed


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


## Adopts a content-loaded flow, connects it to `backend` (null = `Online.backend()`), checks the server's release contract
## (`ClientRelease`), signs in when `Online` has no session yet, and fetches the player's snapshot (coroutine).
func attach(new_flow: GameFlow, backend: GameBackend = null) -> bool:
	flow = null
	boot_error = ""
	boot_error_kind = ""
	if not new_flow.is_ready():
		boot_error = new_flow.error
		return false
	new_flow.backend = backend if backend != null else Online.backend()
	# The release gate first (INF-003): an outdated build or a server in maintenance stops here, before any player state is read.
	var gate: Outcome = await new_flow.backend.fetch_bootstrap()
	if gate.is_ok() and gate.value != null:
		gate = ClientRelease.check(gate.value, ClientRelease.local_rules_hash())
	if not gate.is_ok():
		boot_error = gate.error
		boot_error_kind = gate.error_kind
		return false
	# Then the player (INF-026 order): the Worker backend without a session signs in with Google first.
	if backend == null and new_flow.backend is OnlineBackend and not Online.has_session():
		var signed: Outcome = await Online.sign_in()
		if not signed.is_ok():
			boot_error = signed.error
			boot_error_kind = signed.error_kind
			return false
		new_flow.backend = Online.backend()
	var synced: Outcome = await new_flow.sync()
	if not synced.is_ok():
		boot_error = synced.error
		boot_error_kind = synced.error_kind
		return false
	flow = new_flow
	return true
