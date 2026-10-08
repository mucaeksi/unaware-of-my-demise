class_name FrameRatePolicy
extends RefCounted
## Presentation cap only. Physics tick rate and gameplay simulation remain independent.
const DEFAULT: int = 60
const FUTURE_SETTING: String = "uomd/performance/enable_120_fps"

static func resolve(requested: int, allow_120: bool = false, refresh_hz: float = 60.0) -> int:
	if requested == 30: return 30
	if requested == 120 and allow_120 and refresh_hz >= 119.0: return 120
	return DEFAULT

static func high_refresh_available() -> bool:
	return bool(ProjectSettings.get_setting(FUTURE_SETTING, false)) and DisplayServer.screen_get_refresh_rate() >= 119.0

static func apply(requested: int) -> int:
	var selected: int = resolve(requested, high_refresh_available(), DisplayServer.screen_get_refresh_rate())
	Engine.max_fps = selected
	return selected
