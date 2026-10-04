class_name ContentInstaller
extends RefCounted
## Installs and mounts signed content releases (INF-031/032, DEC-0032). A release is one cumulative pack over the app
## (DEC-0031); the device keeps the installed release and the one before it (last known good), nothing else.
##
## Files under `root` (user://content):
##   installed.json / last_good.json   {"manifest_b64", "signature_b64", "pack"}: a verified release and its pack file
##   generation.json                   {"max": N}: the highest generation ever installed (replay floor)
##   packs/<sha256>.pck                 verified packs; packs/<sha256>.pck.part a download in progress (resumed next time)
##
## Boot (INF-026): `mount_installed()` runs before any content is loaded. It re-verifies the record (signature, app
## versionCode, pack SHA-256) and mounts the pack; a record that fails falls back to last_good, then to the content the
## app ships. Nothing is ever mounted while a battle runs: installing happens at boot only, and a newly installed pack
## is mounted at once only if no pack was mounted in this process; otherwise the app restarts first (a cumulative pack
## cannot be layered over another one).
##
## Usage:
##   var installer := ContentInstaller.new()
##   installer.mount_installed()                          # first thing at boot
##   var done: Outcome = await installer.install(release, download)   # release = GET /v1/content/current
##   if done.is_ok() and done.value["restart_required"]: ask the player to restart

const ROOT: String = "user://content"
const KIND_DISK: String = "content_disk"
const KIND_DOWNLOAD: String = "content_download"
## Free space wanted beyond the pack itself (the .part file and the final file briefly coexist on rename failures).
const DISK_MARGIN_BYTES: int = 8 * 1024 * 1024

var root: String = ROOT
var keys: Dictionary = {}
var version_code: int = 0
## path -> bool: mounts a pack over res:// (ProjectSettings.load_resource_pack, replacing files); tests pass their own.
var mount: Callable = func(path: String) -> bool: return ProjectSettings.load_resource_pack(path, true)
## -> int bytes free under `root`, or -1 when unknown; tests pass their own.
var space_left: Callable = func() -> int:
	var dir: DirAccess = DirAccess.open(root)
	return dir.get_space_left() if dir != null else -1

## What `mount_installed` did: {"source": "installed" | "last_good" | "none", "generation", "problems": [String]}.
var report: Dictionary = {}
var _mounted: bool = false


func _init(trusted_keys: Variant = null, app_version_code: int = -1, directory: String = ROOT) -> void:
	keys = trusted_keys if trusted_keys is Dictionary else ContentManifest.trusted_keys()
	version_code = app_version_code if app_version_code >= 0 else ClientRelease.version_code()
	root = directory


## Mounts the installed release (or the last good one) if it still verifies. Returns `report`.
func mount_installed() -> Dictionary:
	report = {"source": "none", "generation": 0, "problems": []}
	for record_name: String in ["installed", "last_good"]:
		var record: Dictionary = _read_json(record_name + ".json")
		if record.is_empty():
			continue
		var checked: Outcome = _verify_record(record)
		if not checked.is_ok():
			(report["problems"] as Array).append("%s: %s" % [record_name, checked.error])
			continue
		var path: String = _pack_path(str(record["pack"]))
		if not mount.call(path):
			(report["problems"] as Array).append("%s: the pack could not be mounted" % record_name)
			continue
		_mounted = true
		report["source"] = record_name
		report["generation"] = int((checked.value as Dictionary)["generation"])
		return report
	return report


func is_mounted() -> bool:
	return _mounted


## The replay floor: no release at or below it is installed again.
func installed_generation() -> int:
	return int(_read_json("generation.json").get("max", 0))


## Verifies and installs `release` ({"manifest_b64", "signature_b64"}) downloading its pack with `download`, a coroutine
## (sha256: String, path: String, offset: int) -> Outcome that writes the pack's bytes from `offset` to `path`.
## value on success: {"generation", "content_release", "restart_required"}.
func install(release: Dictionary, download: Callable) -> Outcome:
	var manifest_bytes: PackedByteArray = Marshalls.base64_to_raw(str(release.get("manifest_b64", "")))
	var signature: PackedByteArray = Marshalls.base64_to_raw(str(release.get("signature_b64", "")))
	var checked: Outcome = ContentManifest.verify(manifest_bytes, signature, keys, version_code, installed_generation())
	if not checked.is_ok():
		return checked
	var manifest: Dictionary = checked.value
	var packs: Array = manifest["packs"]
	if packs.size() != 1:
		return Outcome.fail(ContentManifest.KIND_INVALID, "A content release must carry exactly one cumulative pack.")
	var pack: Dictionary = packs[0]
	var sha: String = str(pack["sha256"])
	var size: int = int(pack["bytes"])
	DirAccess.make_dir_recursive_absolute(root.path_join("packs"))
	var final_path: String = _pack_path(sha + ".pck")
	if not (FileAccess.file_exists(final_path) and FileAccess.get_sha256(final_path) == sha):
		var fetched: Outcome = await _fetch(sha, size, download)
		if not fetched.is_ok():
			return fetched
	# The marker last: until installed.json is replaced, a crash leaves the previous release in place.
	var record: Dictionary = {"manifest_b64": release["manifest_b64"], "signature_b64": release["signature_b64"], "pack": sha + ".pck"}
	if FileAccess.file_exists(root.path_join("installed.json")):
		DirAccess.rename_absolute(root.path_join("installed.json"), root.path_join("last_good.json"))
	if not _write_json_atomic("installed.json", record) or not _write_json_atomic("generation.json", {"max": int(manifest["generation"])}):
		return Outcome.fail(KIND_DISK, "The content release could not be recorded on this device.")
	collect_garbage()
	return Outcome.ok({"generation": int(manifest["generation"]), "content_release": str(manifest["content_release"]), "restart_required": _mounted})


## Mounts the just-installed release in this process (only when nothing was mounted yet).
func mount_new() -> bool:
	if _mounted:
		return false
	return mount_installed()["source"] == "installed"


## Deletes packs neither record refers to, and downloads of other packs left half-done.
func collect_garbage() -> void:
	var keep: Dictionary = {}
	for record_name: String in ["installed", "last_good"]:
		var record: Dictionary = _read_json(record_name + ".json")
		if record.get("pack") is String:
			keep[record["pack"]] = true
	var packs_dir: String = root.path_join("packs")
	if not DirAccess.dir_exists_absolute(packs_dir):
		return
	for file_name: String in DirAccess.get_files_at(packs_dir):
		if not keep.has(file_name.trim_suffix(".part")):
			DirAccess.remove_absolute(packs_dir.path_join(file_name))


func _fetch(sha: String, size: int, download: Callable) -> Outcome:
	var part: String = _pack_path(sha + ".pck.part")
	var have: int = FileAccess.open(part, FileAccess.READ).get_length() if FileAccess.file_exists(part) else 0
	if have > size:
		DirAccess.remove_absolute(part)
		have = 0
	var free: int = space_left.call()
	if free >= 0 and free < (size - have) + DISK_MARGIN_BYTES:
		return Outcome.fail(KIND_DISK, "Not enough free space for the game data update (%d MB needed)." % ceili((size - have + DISK_MARGIN_BYTES) / 1048576.0))
	if have < size:
		var got: Outcome = await download.call(sha, part, have)
		if not got.is_ok():
			return got
	var length: int = FileAccess.open(part, FileAccess.READ).get_length() if FileAccess.file_exists(part) else 0
	if length != size or FileAccess.get_sha256(part) != sha:
		# A wrong or corrupt download is never kept: the next attempt starts over.
		DirAccess.remove_absolute(part)
		return Outcome.fail(KIND_DOWNLOAD, "The game data update was damaged in transfer (%d of %d bytes). Please try again." % [length, size])
	if DirAccess.rename_absolute(part, _pack_path(sha + ".pck")) != OK:
		return Outcome.fail(KIND_DISK, "The game data update could not be stored on this device.")
	return Outcome.ok()


func _verify_record(record: Dictionary) -> Outcome:
	# A record installed on this device is re-checked against the replay floor of its own generation (0 here), but
	# still for signature, app version and pack integrity.
	var checked: Outcome = ContentManifest.verify(Marshalls.base64_to_raw(str(record.get("manifest_b64", ""))),
		Marshalls.base64_to_raw(str(record.get("signature_b64", ""))), keys, version_code, 0)
	if not checked.is_ok():
		return checked
	var sha: String = str(((checked.value as Dictionary)["packs"] as Array)[0]["sha256"])
	if str(record.get("pack", "")) != sha + ".pck":
		return Outcome.fail(ContentManifest.KIND_INVALID, "the record names another pack than its manifest")
	var path: String = _pack_path(sha + ".pck")
	if not FileAccess.file_exists(path) or FileAccess.get_sha256(path) != sha:
		return Outcome.fail(KIND_DOWNLOAD, "the pack is missing or damaged")
	return checked


func _pack_path(file_name: String) -> String:
	return root.path_join("packs").path_join(file_name)


func _read_json(file_name: String) -> Dictionary:
	var path: String = root.path_join(file_name)
	if not FileAccess.file_exists(path):
		return {}
	var parser: JSON = JSON.new()
	return parser.data if parser.parse(FileAccess.get_file_as_string(path)) == OK and parser.data is Dictionary else {}


## Writes `data` to a temporary file, then renames it over `file_name` (a crash leaves the old or the new file, never half).
func _write_json_atomic(file_name: String, data: Dictionary) -> bool:
	DirAccess.make_dir_recursive_absolute(root)
	var temporary: String = root.path_join(file_name + ".tmp")
	var file: FileAccess = FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(data))
	file.close()
	return DirAccess.rename_absolute(temporary, root.path_join(file_name)) == OK
