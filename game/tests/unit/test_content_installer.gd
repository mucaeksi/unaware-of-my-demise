extends GutTest
## INF-031/032: installing signed content releases — resumed downloads, damaged or replayed releases, low disk, the
## last known good fallback, and boot order (mount before content).

const ROOT: String = "user://test_content_installer"

var _key: CryptoKey = null
var _public: CryptoKey = null
var _mounted: Array[String] = []


func before_all() -> void:
	_key = Crypto.new().generate_rsa(2048)
	_public = CryptoKey.new()
	_public.load_from_string(_key.save_to_string(true), true)


func before_each() -> void:
	_remove_tree(ROOT)
	_mounted = []


func after_all() -> void:
	_remove_tree(ROOT)


func _remove_tree(path: String) -> void:
	if not DirAccess.dir_exists_absolute(path):
		return
	for sub: String in DirAccess.get_directories_at(path):
		_remove_tree(path.path_join(sub))
	for file_name: String in DirAccess.get_files_at(path):
		DirAccess.remove_absolute(path.path_join(file_name))
	DirAccess.remove_absolute(path)


func _installer(version_code: int = 1) -> ContentInstaller:
	var installer: ContentInstaller = ContentInstaller.new({"test-key": _public}, version_code, ROOT)
	installer.mount = func(path: String) -> bool:
		_mounted.append(path)
		return true
	installer.space_left = func() -> int: return 1 << 30
	return installer


func _pack(text: String) -> PackedByteArray:
	return ("GDPC" + text).to_utf8_buffer()


func _sha(bytes: PackedByteArray) -> String:
	var hashing: HashingContext = HashingContext.new()
	hashing.start(HashingContext.HASH_SHA256)
	hashing.update(bytes)
	return hashing.finish().hex_encode()


## A signed release of `pack` at `generation`: {"manifest_b64", "signature_b64"}.
func _release(pack: PackedByteArray, generation: int, max_code: int = 1) -> Dictionary:
	var manifest: Dictionary = {
		"schema": 1, "channel": "test", "content_release": "t-%d" % generation, "generation": generation,
		"app": {"min_version_code": 1, "max_version_code": max_code}, "base_pack_sha256": "0".repeat(64), "rules_hash": "1".repeat(64),
		"key_id": "test-key", "issued_at_utc": "2026-10-04T00:00:00Z",
		"packs": [{"name": "content-%d.pck" % generation, "sha256": _sha(pack), "bytes": pack.size()}],
	}
	var bytes: PackedByteArray = JSON.stringify(manifest).to_utf8_buffer()
	var hashing: HashingContext = HashingContext.new()
	hashing.start(HashingContext.HASH_SHA256)
	hashing.update(bytes)
	var signature: PackedByteArray = Crypto.new().sign(HashingContext.HASH_SHA256, hashing.finish(), _key)
	return {"manifest_b64": Marshalls.raw_to_base64(bytes), "signature_b64": Marshalls.raw_to_base64(signature)}


## A download that writes `bytes[offset:]` (or only up to `stop_at`, then fails like a dropped connection).
func _download(bytes: PackedByteArray, calls: Array, stop_at: int = -1) -> Callable:
	return func(sha: String, path: String, offset: int) -> Outcome:
		calls.append(offset)
		var end: int = bytes.size() if stop_at < 0 else stop_at
		var file: FileAccess = FileAccess.open(path, FileAccess.READ_WRITE) if FileAccess.file_exists(path) else FileAccess.open(path, FileAccess.WRITE)
		file.seek_end()
		file.store_buffer(bytes.slice(offset, end))
		file.close()
		return Outcome.ok() if stop_at < 0 else Outcome.fail(GameBackend.KIND_OFFLINE, "dropped")


func test_a_release_installs_and_mounts_at_the_next_boot() -> void:
	var pack: PackedByteArray = _pack("one")
	var installer: ContentInstaller = _installer()
	var calls: Array = []
	var done: Outcome = await installer.install(_release(pack, 1), _download(pack, calls))
	assert_true(done.is_ok(), done.error)
	assert_eq(done.value, {"generation": 1, "content_release": "t-1", "restart_required": false})
	assert_eq(calls, [0])
	assert_eq(installer.installed_generation(), 1)
	var boot: ContentInstaller = _installer()
	assert_eq(boot.mount_installed()["source"], "installed")
	assert_eq(_mounted, [ROOT + "/packs/%s.pck" % _sha(pack)])
	assert_true(boot.is_mounted())


func test_an_interrupted_download_resumes_where_it_stopped() -> void:
	var pack: PackedByteArray = _pack("x".repeat(200))
	var calls: Array = []
	var first: Outcome = await _installer().install(_release(pack, 1), _download(pack, calls, 50))
	assert_eq(first.error_kind, GameBackend.KIND_OFFLINE)
	assert_false(FileAccess.file_exists(ROOT + "/installed.json"), "nothing is recorded before the pack is complete")
	var second: Outcome = await _installer().install(_release(pack, 1), _download(pack, calls))
	assert_true(second.is_ok(), second.error)
	assert_eq(calls, [0, 50], "the second attempt asks only for the missing bytes")


func test_a_damaged_download_is_discarded() -> void:
	var pack: PackedByteArray = _pack("good")
	var calls: Array = []
	var done: Outcome = await _installer().install(_release(pack, 1), _download(_pack("evil"), calls))
	assert_eq(done.error_kind, ContentInstaller.KIND_DOWNLOAD)
	assert_false(FileAccess.file_exists(ROOT + "/packs/%s.pck.part" % _sha(pack)), "the next attempt starts over")
	assert_eq(_installer().mount_installed()["source"], "none")


func test_replayed_untrusted_and_foreign_releases_are_refused() -> void:
	var pack: PackedByteArray = _pack("one")
	var calls: Array = []
	assert_true((await _installer().install(_release(pack, 2), _download(pack, calls))).is_ok())
	assert_eq((await _installer().install(_release(pack, 2), _download(pack, calls))).error_kind, ContentManifest.KIND_REPLAY)
	assert_eq((await _installer().install(_release(pack, 1), _download(pack, calls))).error_kind, ContentManifest.KIND_REPLAY)
	var forged: Dictionary = _release(pack, 3)
	forged["signature_b64"] = Marshalls.raw_to_base64(PackedByteArray([1, 2, 3]))
	assert_eq((await _installer().install(forged, _download(pack, calls))).error_kind, ContentManifest.KIND_UNTRUSTED)
	assert_eq((await _installer(2).install(_release(pack, 3), _download(pack, calls))).error_kind, ContentManifest.KIND_INCOMPATIBLE)


func test_low_disk_space_is_reported_before_downloading() -> void:
	var pack: PackedByteArray = _pack("one")
	var installer: ContentInstaller = _installer()
	installer.space_left = func() -> int: return 1024
	var calls: Array = []
	assert_eq((await installer.install(_release(pack, 1), _download(pack, calls))).error_kind, ContentInstaller.KIND_DISK)
	assert_eq(calls, [], "nothing was downloaded")


func test_a_damaged_installed_pack_falls_back_to_the_last_good_release() -> void:
	var old_pack: PackedByteArray = _pack("old")
	var new_pack: PackedByteArray = _pack("new")
	var calls: Array = []
	assert_true((await _installer().install(_release(old_pack, 1), _download(old_pack, calls))).is_ok())
	assert_true((await _installer().install(_release(new_pack, 2), _download(new_pack, calls))).is_ok())
	var file: FileAccess = FileAccess.open(ROOT + "/packs/%s.pck" % _sha(new_pack), FileAccess.WRITE)
	file.store_string("corrupted")
	file.close()
	var boot: ContentInstaller = _installer()
	var report: Dictionary = boot.mount_installed()
	assert_eq(report["source"], "last_good")
	assert_eq(report["generation"], 1)
	assert_string_contains(str(report["problems"]), "installed")
	assert_eq(_mounted, [ROOT + "/packs/%s.pck" % _sha(old_pack)])


func test_a_release_for_another_app_version_is_not_mounted() -> void:
	var pack: PackedByteArray = _pack("one")
	var calls: Array = []
	assert_true((await _installer().install(_release(pack, 1), _download(pack, calls))).is_ok())
	assert_eq(_installer(2).mount_installed()["source"], "none", "the app was updated past the release's range")
	assert_eq(_mounted, [])


func test_only_the_installed_and_last_good_packs_are_kept() -> void:
	var calls: Array = []
	var packs: Array[PackedByteArray] = [_pack("a"), _pack("b"), _pack("c")]
	for index: int in packs.size():
		assert_true((await _installer().install(_release(packs[index], index + 1), _download(packs[index], calls))).is_ok())
	var kept: PackedStringArray = DirAccess.get_files_at(ROOT + "/packs")
	assert_eq(kept.size(), 2)
	assert_false(kept.has("%s.pck" % _sha(packs[0])), "the oldest release is collected")


func test_installing_after_a_mount_needs_a_restart() -> void:
	var calls: Array = []
	var first: PackedByteArray = _pack("first")
	assert_true((await _installer().install(_release(first, 1), _download(first, calls))).is_ok())
	var running: ContentInstaller = _installer()
	running.mount_installed()
	var second: PackedByteArray = _pack("second")
	var done: Outcome = await running.install(_release(second, 2), _download(second, calls))
	assert_true(done.value["restart_required"], "a cumulative pack is never layered over another in one process")
	assert_false(running.mount_new())
