class_name Outcome
extends RefCounted
## What a service call returns (the reference raises on failure and returns a value on success): `error` is "" on success,
## otherwise the message, with `error_kind` naming the class of failure. `value` carries the result on success.
##
## Kinds: `progression`, `equipment`, `reward` (a request the rules reject; nothing was written), plus the transport kinds of
## `GameBackend` (`offline`) and `GameFlow` (`protocol`).

const PROGRESSION: String = "progression"
const EQUIPMENT: String = "equipment"
const REWARD: String = "reward"

var error: String = ""
var error_kind: String = ""
var value: Variant = null


static func ok(result: Variant = null) -> Outcome:
	var outcome: Outcome = Outcome.new()
	outcome.value = result
	return outcome


static func fail(kind: String, message: String) -> Outcome:
	var outcome: Outcome = Outcome.new()
	outcome.error_kind = kind
	outcome.error = message
	return outcome


func is_ok() -> bool:
	return error.is_empty()
