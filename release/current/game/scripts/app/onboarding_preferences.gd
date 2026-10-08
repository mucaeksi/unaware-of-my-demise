extends RefCounted
## Account-scoped presentation checkpoints, never server story clears/rewards.

static func _section(account: String) -> String:
	return "tutorial_" + account.sha256_text()

static func register(path: String, account: String, is_new: bool) -> Error:
	if account.is_empty() or not is_new: return OK
	var config: ConfigFile = ConfigFile.new()
	config.load(path)
	var section: String = _section(account)
	if config.has_section(section): return OK
	config.set_value(section, "eligible", true)
	config.set_value(section, "completed", false)
	config.set_value(section, "index", 0)
	config.set_value(section, "phase", "before")
	return config.save(path)

static func pending(path: String, account: String) -> bool:
	if account.is_empty(): return false
	var config: ConfigFile = ConfigFile.new()
	if config.load(path) != OK: return false
	var section: String = _section(account)
	return bool(config.get_value(section, "eligible", false)) and not bool(config.get_value(section, "completed", false))

static func cursor(path: String, account: String) -> Dictionary:
	var config: ConfigFile = ConfigFile.new()
	config.load(path)
	var section: String = _section(account)
	return {"index":clampi(int(config.get_value(section,"index",0)),0,2), "phase":str(config.get_value(section,"phase","before")), "intro_done":bool(config.get_value(section,"intro_done",false))}

static func completed(path: String, account: String) -> bool:
	if account.is_empty(): return false
	var config: ConfigFile = ConfigFile.new()
	if config.load(path) != OK: return false
	return bool(config.get_value(_section(account), "completed", false))

static func checkpoint(path: String, account: String, index: int, phase: String, is_completed: bool = false) -> Error:
	if account.is_empty(): return OK
	var config: ConfigFile = ConfigFile.new()
	config.load(path)
	var section: String = _section(account)
	config.set_value(section,"index",index)
	config.set_value(section,"phase",phase)
	config.set_value(section,"intro_done",true)
	config.set_value(section,"completed",is_completed)
	return config.save(path)
