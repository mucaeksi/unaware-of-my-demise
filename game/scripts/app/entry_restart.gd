class_name EntryRestart
extends RefCounted
## One-use navigation hint. Credentials stay in memory; the next process obtains a new Google session.
const PATH: String = "user://entry_restart.cfg"

static func pending(path: String = PATH) -> bool:
	var config: ConfigFile = ConfigFile.new()
	return config.load(path) == OK and bool(config.get_value("entry", "resume_patch", false))

static func arm(path: String = PATH) -> Error:
	var config: ConfigFile = ConfigFile.new()
	config.set_value("entry", "resume_patch", true)
	return config.save(path)

static func consume(path: String = PATH) -> bool:
	var resume: bool = pending(path)
	if resume and DirAccess.remove_absolute(path) != OK:
		push_warning("Could not consume the patch restart hint.")
		return false
	return resume

static func request() -> bool:
	# OS restart is a desktop export feature. Android uses the engine's GodotActivity process rebirth.
	if OS.has_feature("editor") or OS.has_feature("web") or OS.has_feature("ios"):
		return false
	if arm() != OK:
		return false
	if OS.has_feature("android"):
		if Native.restart_client(): return true
		consume()
		return false
	OS.set_restart_on_exit(true, OS.get_cmdline_args())
	(Engine.get_main_loop() as SceneTree).quit()
	return true
