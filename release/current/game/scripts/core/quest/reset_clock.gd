class_name ResetClock
extends RefCounted
## UTC reset windows (port of core/reset_clock.py): the 00:00/12:00 half-day cycle and the Monday-based 3-3-1 weekly
## segment. Pure calendar arithmetic, no clock: callers pass UTC unix seconds (whole seconds; the reference's
## timezone-aware `datetime` and its "naive datetime is rejected" check have no counterpart, a unix time cannot be naive).
## A server must still validate claims; client clocks are not authoritative.
##
## Divergence: the reference's ISO strings carry microseconds when `now` has them; here `server_now_utc` is the whole
## second (`iso_utc` truncates), the window boundaries are whole seconds either way.
@warning_ignore_start("integer_division")

const SECONDS_PER_DAY: int = 86400
const HALF_DAY_SECONDS: int = 43200
## 1970-01-01 was a Thursday (weekday 3, Monday = 0); the first Monday after the epoch is day 4 (1970-01-05).
const _EPOCH_WEEKDAY: int = 3
const _FIRST_MONDAY_DAY: int = 4


## Floor division for signed ints (GDScript `/` truncates toward zero).
static func floor_div(numerator: int, denominator: int) -> int:
	var quotient: int = numerator / denominator
	if (numerator % denominator != 0) and ((numerator < 0) != (denominator < 0)):
		quotient -= 1
	return quotient


## `{cycle_id, starts_at_utc, ends_at_utc, server_now_utc}` of the active half-day window.
static func half_day_window(now_unix: int) -> Dictionary:
	var cycle_id: int = floor_div(now_unix, HALF_DAY_SECONDS)
	var starts: int = cycle_id * HALF_DAY_SECONDS
	return {
		"cycle_id": cycle_id,
		"starts_at_utc": iso_utc(starts),
		"ends_at_utc": iso_utc(starts + HALF_DAY_SECONDS),
		"server_now_utc": iso_utc(now_unix),
	}


## `{week_start_utc, segment_id, starts_at_utc, ends_at_utc, server_now_utc}` of the active Monday-based 3-3-1 segment.
static func weekly_segment(now_unix: int) -> Dictionary:
	var days: int = floor_div(now_unix, SECONDS_PER_DAY)
	var weekday: int = posmod(days + _EPOCH_WEEKDAY, 7)
	var monday: int = (days - weekday) * SECONDS_PER_DAY
	var segment: String = ""
	var start_day: int = 0
	var end_day: int = 0
	if weekday < 3:
		segment = "cycle_a"
		start_day = 0
		end_day = 3
	elif weekday < 6:
		segment = "cycle_b"
		start_day = 3
		end_day = 6
	else:
		segment = "sun_eclipse"
		start_day = 6
		end_day = 7
	return {
		"week_start_utc": iso_utc(monday),
		"segment_id": segment,
		"starts_at_utc": iso_utc(monday + start_day * SECONDS_PER_DAY),
		"ends_at_utc": iso_utc(monday + end_day * SECONDS_PER_DAY),
		"server_now_utc": iso_utc(now_unix),
	}


## `[week number since the epoch's first Monday, active segment id]`: the `cycle_id` under which weekly task progress is
## stored, so each week (and each segment within it) starts from zero (backend/quest_service.py `weekly_cycle_key`).
static func weekly_cycle_key(now_unix: int) -> Array:
	var days: int = floor_div(now_unix, SECONDS_PER_DAY)
	var monday_day: int = days - posmod(days + _EPOCH_WEEKDAY, 7)
	return [floor_div(monday_day - _FIRST_MONDAY_DAY, 7), weekly_segment(now_unix)["segment_id"]]


## `datetime.isoformat()` of a UTC time: `YYYY-MM-DDTHH:MM:SS+00:00` (whole seconds).
static func iso_utc(unix_seconds: int) -> String:
	var days: int = floor_div(unix_seconds, SECONDS_PER_DAY)
	var second_of_day: int = unix_seconds - days * SECONDS_PER_DAY
	var date: Array = civil_from_days(days)
	return "%04d-%02d-%02dT%02d:%02d:%02d+00:00" % [
		date[0], date[1], date[2], second_of_day / 3600, (second_of_day % 3600) / 60, second_of_day % 60]


## Proleptic Gregorian [year, month, day] of a day count since 1970-01-01 (Hinnant's civil_from_days).
static func civil_from_days(day_count: int) -> Array:
	var shifted: int = day_count + 719468
	var era: int = floor_div(shifted, 146097)
	var day_of_era: int = shifted - era * 146097
	var year_of_era: int = (day_of_era - day_of_era / 1460 + day_of_era / 36524 - day_of_era / 146096) / 365
	var year: int = year_of_era + era * 400
	var day_of_year: int = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100)
	var month_index: int = (5 * day_of_year + 2) / 153
	var day: int = day_of_year - (153 * month_index + 2) / 5 + 1
	var month: int = month_index + 3 if month_index < 10 else month_index - 9
	return [year + (1 if month <= 2 else 0), month, day]
