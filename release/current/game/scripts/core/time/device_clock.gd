class_name DeviceClock
extends RefCounted
## The device wall clock (port of core/time_source.py `DeviceClock`). Untrusted: the player can set it to any value, so it
## must never decide a reward claim. `wall_source` is a Callable() -> float of UTC unix seconds (default: the system clock).

var trusted: bool = false

var _wall_source: Callable = Callable()


static func create(wall_source: Callable = Callable()) -> DeviceClock:
	var clock: DeviceClock = DeviceClock.new()
	clock._wall_source = wall_source
	return clock


func now_unix() -> float:
	return float(_wall_source.call()) if _wall_source.is_valid() else Time.get_unix_time_from_system()
