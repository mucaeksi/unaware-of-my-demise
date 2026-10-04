class_name TrustedClock
extends RefCounted
## Last known server time advanced by a clock the user cannot set (port of core/time_source.py `TrustedClock`), so it can
## report when the device wall clock was moved relative to its anchor. Times are UTC unix seconds (float).
##
## `elapsed_source` is a Callable() -> float of seconds from an arbitrary origin that must not be affected by wall-clock
## changes. The default is the engine's monotonic tick counter. ANDROID: that counter is CLOCK_MONOTONIC and stops while
## the device is in deep sleep, while the reference used CLOCK_BOOTTIME (`SystemClock.elapsedRealtime()`), which keeps
## counting. Before this clock decides anything on a device, the native plugin has to supply elapsedRealtime as
## `elapsed_source` (open item for G5/G7; nothing in G3 depends on it). The server stays the authority for reset windows.

var trusted: bool = true

var _server_anchor: float = 0.0
var _elapsed_source: Callable = Callable()
var _elapsed_anchor: float = 0.0
var _wall_source: Callable = Callable()
var _wall_anchor: float = 0.0
var _tolerance: float = 120.0


## Seconds from an arbitrary origin, never affected by wall-clock changes (see the class note for Android).
static func elapsed_seconds() -> float:
	return float(Time.get_ticks_usec()) / 1000000.0


static func create(server_now_unix: float, elapsed_source: Callable = Callable(), wall_source: Callable = Callable(),
		jump_tolerance_seconds: float = 120.0) -> TrustedClock:
	var clock: TrustedClock = TrustedClock.new()
	clock._server_anchor = server_now_unix
	clock._elapsed_source = elapsed_source
	clock._wall_source = wall_source
	clock._tolerance = jump_tolerance_seconds
	clock._elapsed_anchor = clock._elapsed_now()
	clock._wall_anchor = clock._wall_now()
	return clock


func _elapsed_now() -> float:
	return float(_elapsed_source.call()) if _elapsed_source.is_valid() else elapsed_seconds()


func _wall_now() -> float:
	return float(_wall_source.call()) if _wall_source.is_valid() else Time.get_unix_time_from_system()


## Server time now: the anchor plus the elapsed time since it was received.
func now_unix() -> float:
	return _server_anchor + (_elapsed_now() - _elapsed_anchor)


func now_iso() -> String:
	return ResetClock.iso_utc(int(floorf(now_unix())))


## How far the device wall clock moved beyond real elapsed time. Positive: set forward; negative: set back.
func wall_clock_drift_seconds() -> float:
	var wall_delta: float = _wall_now() - _wall_anchor
	return wall_delta - (_elapsed_now() - _elapsed_anchor)


func clock_jump_detected() -> bool:
	return absf(wall_clock_drift_seconds()) > _tolerance
