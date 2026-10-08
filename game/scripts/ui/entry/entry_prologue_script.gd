class_name EntryPrologueScript
extends RefCounted
## Locally shipped timeline. No dependency on the gameplay content registry.
const SOURCE: String = "res://data/entry/prologue_v001.json"
const VISUALS: Array[String] = ["village", "crownfall", "road"]
const SHOTS: Array[String] = ["hours", "names", "ordinary_days", "throne_wars", "crownfall", "roads", "search", "reunion", "beginning"]

static func load_timeline() -> Outcome:
	if not FileAccess.file_exists(SOURCE):
		return Outcome.fail("prologue_data", "The opening story file is missing.")
	var parser: JSON = JSON.new()
	if parser.parse(FileAccess.get_file_as_string(SOURCE)) != OK:
		return Outcome.fail("prologue_data", "The opening story file is invalid JSON.")
	return validate(parser.data)

static func validate(value: Variant) -> Outcome:
	if not value is Dictionary:
		return Outcome.fail("prologue_data", "The opening story must be an object.")
	var data: Dictionary = value
	if int(data.get("schema", 0)) != 1 or str(data.get("locale", "")) != "en":
		return Outcome.fail("prologue_data", "The opening story schema or language is unsupported.")
	if not data.get("scenes") is Array or (data["scenes"] as Array).is_empty():
		return Outcome.fail("prologue_data", "The opening story has no scenes.")
	var duration: float = 0.0
	var identifiers: Array[String] = []
	var shots: Array[String] = []
	for item: Variant in data["scenes"]:
		if not item is Dictionary:
			return Outcome.fail("prologue_data", "An opening scene is invalid.")
		var scene: Dictionary = item
		var seconds: float = float(scene.get("duration_seconds", 0.0))
		var identifier: String = str(scene.get("line_id", ""))
		if not is_finite(seconds) or seconds <= 0.0 or seconds > 30.0:
			return Outcome.fail("prologue_data", "An opening scene has an invalid duration.")
		if identifier.is_empty() or identifier in identifiers or str(scene.get("text_en", "")).is_empty():
			return Outcome.fail("prologue_data", "Opening lines need unique identifiers and English text.")
		if str(scene.get("visual", "")) not in VISUALS:
			return Outcome.fail("prologue_data", "An opening illustration is unknown.")
		var shot: String = str(scene.get("id", ""))
		if shot not in SHOTS or shot in shots:
			return Outcome.fail("prologue_data", "Opening shots must have known unique identifiers.")
		shots.append(shot)
		identifiers.append(identifier)
		duration += seconds
	if not is_equal_approx(duration, 120.0) or not is_equal_approx(float(data.get("duration_seconds", 0.0)), duration):
		return Outcome.fail("prologue_data", "The opening timeline must total 120 seconds.")
	return Outcome.ok(data)
