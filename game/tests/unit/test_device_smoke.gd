extends GutTest
## The device smoke checks that need no device: engine, display and the keystore skip path.


func test_engine_and_display_checks_pass() -> void:
	assert_true(bool(DeviceSmoke.engine_check()["ok"]))
	assert_true(bool(DeviceSmoke.display_check()["ok"]))


func test_keystore_check_is_skipped_off_device() -> void:
	var result: Dictionary = DeviceSmoke.keystore_check()
	assert_true(bool(result["ok"]))
	assert_string_contains(String(result["detail"]), "skipped")


func test_report_lists_every_check() -> void:
	var results: Array[Dictionary] = DeviceSmoke.run_all()
	assert_eq(results.size(), 3)
	assert_true(DeviceSmoke.all_ok(results))
	var text: String = DeviceSmoke.report_text(results)
	for check_name: String in ["engine", "display", "keystore"]:
		assert_string_contains(text, check_name)


func test_final_boss_battle_benchmark_reaches_victory() -> void:
	var result: Dictionary = DeviceSmoke.battle_benchmark()
	assert_true(bool(result["ok"]), String(result["detail"]))
	assert_string_contains(String(result["detail"]), "final boss 7-5: victory")


func test_worker_job_runs_off_the_main_thread_and_returns_its_result() -> void:
	var main_thread: int = OS.get_thread_caller_id()
	var job: WorkerJob = WorkerJob.start(func() -> int: return OS.get_thread_caller_id())
	var deadline: int = Time.get_ticks_msec() + 20000
	while not job.is_finished() and Time.get_ticks_msec() < deadline:
		OS.delay_msec(5)
	assert_true(job.is_finished(), "the worker finishes")
	assert_ne(int(job.finish()), main_thread, "the work ran on another thread")
	assert_gte(job.elapsed_usec, 0)


func test_battle_benchmark_runs_on_a_worker_thread() -> void:
	var job: WorkerJob = WorkerJob.start(func() -> Dictionary: return DeviceSmoke.battle_benchmark())
	var frames_waited: int = 0
	var deadline: int = Time.get_ticks_msec() + 60000
	while not job.is_finished() and Time.get_ticks_msec() < deadline:
		OS.delay_msec(5)  # the main thread stays free to poll (a real frame loop does the same in _process)
		frames_waited += 1
	var result: Dictionary = job.finish()
	assert_true(bool(result["ok"]), String(result["detail"]))
	assert_gt(frames_waited, 0, "the main thread was free while the battle ran")


func test_unjoined_worker_job_is_joined_when_freed() -> void:
	var job: WorkerJob = WorkerJob.start(func() -> int: return 1)
	job = null  # PREDELETE joins the thread: no "Thread destroyed without being joined" error is raised
	assert_null(job)
