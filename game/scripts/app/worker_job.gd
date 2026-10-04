class_name WorkerJob
extends RefCounted
## Runs one Callable on a worker Thread and hands its result back to the main thread (brief G3: a battle must not block
## the UI thread). The main thread polls `is_finished()` (for example in `_process`) and then calls `finish()`.
##
## The work must not touch the scene tree or any Node. The core domain classes (`BattleService`, `ContentRegistry`, ...)
## are plain RefCounted objects and qualify, with two rules: a `BattleService` (and everything it owns) belongs to the job
## until `finish()` returns, and at most one job may run the battle code at a time (the lazily filled statics of `Frac`,
## `Progression` and `Crc32` are not synchronized).
##
## A job that is dropped while its thread still runs (a screen left mid-battle) is not waited for on the main thread: the thread goes onto a
## list that the next `start()` reaps. The thread itself never holds the job (only the shared `_Slot`), so the job can be freed by the
## main thread at any time and is never destroyed on its own worker.

## What the job and its thread share.
class _Slot extends RefCounted:
	var mutex: Mutex = Mutex.new()
	var finished: bool = false
	var result: Variant = null
	var elapsed_usec: int = 0


static var _abandoned: Array[Thread] = []

## How long the work took, valid after `finish()`.
var elapsed_usec: int = 0

var _thread: Thread = Thread.new()
var _slot: _Slot = _Slot.new()
var _joined: bool = false


static func start(work: Callable) -> WorkerJob:
	_reap()
	var job: WorkerJob = WorkerJob.new()
	job._thread.start(_run.bind(job._slot, work))
	return job


static func _run(slot: _Slot, work: Callable) -> void:
	var began: int = Time.get_ticks_usec()
	var value: Variant = work.call()
	var spent: int = Time.get_ticks_usec() - began
	slot.mutex.lock()
	slot.result = value
	slot.elapsed_usec = spent
	slot.finished = true
	slot.mutex.unlock()


## Joins the threads of dropped jobs that have finished.
static func _reap() -> void:
	var running: Array[Thread] = []
	for thread: Thread in _abandoned:
		if thread.is_alive():
			running.append(thread)
		else:
			thread.wait_to_finish()
	_abandoned = running


## Dropped jobs whose thread has not been joined yet (tests).
static func abandoned_count() -> int:
	return _abandoned.size()


func is_finished() -> bool:
	_slot.mutex.lock()
	var done: bool = _slot.finished
	_slot.mutex.unlock()
	return done


## Joins the thread and returns what the Callable returned. Blocks until the work is done if it is not finished yet.
func finish() -> Variant:
	if not _joined:
		_thread.wait_to_finish()
		_joined = true
		elapsed_usec = _slot.elapsed_usec
	return _slot.result


func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE and not _joined and _thread.is_started():
		if _thread.is_alive():
			_abandoned.append(_thread)
		else:
			_thread.wait_to_finish()
