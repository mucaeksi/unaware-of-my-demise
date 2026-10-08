extends GutTest
## WorkerJob: the result comes back through `finish()`, and a job dropped while its thread still runs neither blocks the main thread nor
## destroys itself on its own worker (which is an engine error). Found by the UI test that leaves the diagnostics screen mid-benchmark.


func test_a_job_returns_its_result_and_timing() -> void:
	var job: WorkerJob = WorkerJob.start(func() -> Variant: return 6 * 7)
	assert_eq(job.finish(), 42)
	assert_gte(job.elapsed_usec, 0)
	assert_true(job.is_finished())
	assert_eq(job.finish(), 42, "finishing twice is harmless")


func test_a_job_can_be_polled_until_it_is_done() -> void:
	var job: WorkerJob = WorkerJob.start(func() -> Variant:
		OS.delay_msec(60)
		return "done")
	await wait_until(job.is_finished, 5.0, "the worker finishes")
	assert_eq(job.finish(), "done")


func test_a_dropped_job_is_reaped_by_the_next_start() -> void:
	var job: WorkerJob = WorkerJob.start(func() -> Variant:
		OS.delay_msec(150)
		return 1)
	var others: int = WorkerJob.abandoned_count()
	var began: int = Time.get_ticks_msec()
	job = null
	assert_lt(Time.get_ticks_msec() - began, 100, "dropping a running job does not wait for it")
	assert_eq(WorkerJob.abandoned_count(), others + 1)
	await wait_seconds(0.4)
	var next: WorkerJob = WorkerJob.start(func() -> Variant: return 2)
	assert_eq(next.finish(), 2)
	assert_lte(WorkerJob.abandoned_count(), others, "the finished thread was joined by the start")


func test_a_job_dropped_after_it_finished_is_joined_at_once() -> void:
	var others: int = WorkerJob.abandoned_count()
	var job: WorkerJob = WorkerJob.start(func() -> Variant: return 3)
	await wait_until(job.is_finished, 5.0)
	job = null
	assert_eq(WorkerJob.abandoned_count(), others, "nothing was left on the list")
