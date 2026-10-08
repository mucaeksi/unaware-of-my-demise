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
## Observed operation boundaries, never a fabricated download percentage.
signal entry_phase_changed(phase: String)
signal entry_download_progress(received_bytes: int, total_bytes: int)
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


## Fetch and inspect the signed release for a size/consent popup; performs no download or install write.
func prepare_content_update(backend: GameBackend = null) -> Outcome:
	entry_phase_changed.emit("checking")
	var online: GameBackend = backend if backend != null else Online.backend()
	if backend == null and online is OnlineBackend and not Online.has_session():
		entry_phase_changed.emit("signing_in")
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
	var checked: Outcome = await content.inspect_release_async(release.value)
	if checked.is_ok(): checked.value["backend"] = server
	return checked


## Install exactly the signed release shown in the approval popup, with a fresh integrity check.
func update_content(backend: GameBackend = null, prepared: Dictionary = {}) -> Outcome:
	if prepared.is_empty():
		var checked: Outcome = await prepare_content_update(backend)
		if not checked.is_ok(): return checked
		prepared = checked.value
	var server: OnlineBackend = prepared.get("backend") as OnlineBackend
	if server == null or not (prepared.get("release") is Dictionary):
		return Outcome.fail(ContentManifest.KIND_INVALID, "The update approval is no longer valid. Please retry.")
	content.phase_changed.connect(_content_phase)
	server.download_progress.connect(_content_progress)
	var installed: Outcome = await content.install(prepared["release"], server.download_pack)
	server.download_progress.disconnect(_content_progress)
	content.phase_changed.disconnect(_content_phase)
	if installed.is_ok() and not bool((installed.value as Dictionary)["restart_required"]):
		content.mount_new()
	return installed


func _content_phase(phase: String) -> void:
	entry_phase_changed.emit(phase)

func _content_progress(received: int, total: int) -> void:
	entry_download_progress.emit(received, total)


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
	entry_phase_changed.emit("checking")
	var gate: Outcome = await new_flow.backend.fetch_bootstrap()
	if gate.is_ok() and gate.value != null:
		gate = ClientRelease.check(gate.value, ClientRelease.local_rules_hash())
	if not gate.is_ok():
		boot_error = gate.error
		boot_error_kind = gate.error_kind
		return false
	# A matching rules hash is not proof that the narrative payload was downloaded.
	# Opening AABs retain the rule tables for deterministic combat and server parity.
	if new_flow.opening_only:
		boot_error = "Download the story content to continue beyond the opening."
		boot_error_kind = ClientRelease.KIND_CONTENT_UPDATE
		return false
	# Then the player (INF-026 order): the Worker backend without a session signs in with Google first.
	if backend == null and new_flow.backend is OnlineBackend and not Online.has_session():
		entry_phase_changed.emit("signing_in")
		var signed: Outcome = await Online.sign_in()
		if not signed.is_ok():
			boot_error = signed.error
			boot_error_kind = signed.error_kind
			return false
		new_flow.backend = Online.backend()
	entry_phase_changed.emit("snapshot_sync")
	var synced: Outcome = await new_flow.sync()
	if not synced.is_ok():
		boot_error = synced.error
		boot_error_kind = synced.error_kind
		return false
	flow = new_flow
	return true
