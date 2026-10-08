extends GutTest
## G3.8: TrustedClock reproduces parity/fixtures/time_source.json (core/time_source.py): last server time plus elapsed time
## since it was received, wall-clock drift and jump detection. Elapsed and wall clocks are injected, as in the reference.

## 2026-01-01T00:00:00Z: the fixture's wall clock is base + a per-point offset (only differences matter).
const BASE_WALL_UNIX: float = 1767225600.0


func test_scenarios() -> void:
	var scenarios: Array = ParityFixtures.load_fixture("time_source")["cases"]
	assert_eq(scenarios.size(), 5)
	for scenario: Dictionary in scenarios:
		var name: String = String(scenario["name"])
		var state: Dictionary = {"elapsed": 1000.0, "wall": 0.0}
		var elapsed_source: Callable = func() -> float: return state["elapsed"]
		var wall_source: Callable = func() -> float: return BASE_WALL_UNIX + float(state["wall"])
		var clock: TrustedClock = TrustedClock.create(float(scenario["server_now_unix"]), elapsed_source, wall_source,
			float(scenario["jump_tolerance_seconds"]))
		assert_true(clock.trusted)
		assert_eq(ResetClock.iso_utc(int(scenario["server_now_unix"])), scenario["server_now_iso"], name)
		var index: int = 0
		for point: Dictionary in scenario["points"]:
			state["elapsed"] = 1000.0 + float(point["elapsed_delta"])
			state["wall"] = float(point["wall_delta"])
			var label: String = "%s point %d" % [name, index]
			assert_eq(clock.now_iso(), point["now_iso"], label)
			assert_eq(clock.now_unix(), float(point["now_unix"]), label)
			assert_eq(clock.wall_clock_drift_seconds(), float(point["drift_seconds"]), label)
			assert_eq(clock.clock_jump_detected(), bool(point["jump_detected"]), label)
			index += 1


func test_tolerance_boundary_is_exclusive() -> void:
	var state: Dictionary = {"elapsed": 0.0, "wall": 0.0}
	var elapsed_source: Callable = func() -> float: return state["elapsed"]
	var wall_source: Callable = func() -> float: return float(state["wall"])
	var clock: TrustedClock = TrustedClock.create(1000.0, elapsed_source, wall_source, 120.0)
	state["wall"] = 120.0
	assert_false(clock.clock_jump_detected(), "exactly the tolerance is not a jump")
	state["wall"] = 120.5
	assert_true(clock.clock_jump_detected())
	state["wall"] = -120.5
	assert_true(clock.clock_jump_detected(), "a clock set back is a jump too")


func test_default_sources_and_device_clock() -> void:
	var clock: TrustedClock = TrustedClock.create(1000.0)
	var first: float = clock.now_unix()
	assert_gte(first, 1000.0)
	assert_false(clock.clock_jump_detected(), "a fresh clock has no drift")
	var device: DeviceClock = DeviceClock.create()
	assert_false(device.trusted)
	assert_gt(device.now_unix(), 1.7e9, "the system clock is after 2023")
	var fixed: DeviceClock = DeviceClock.create(func() -> float: return 42.0)
	assert_eq(fixed.now_unix(), 42.0)
