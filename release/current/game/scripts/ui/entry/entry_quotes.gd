class_name EntryQuotes
extends RefCounted
## Exact authored dialogue; IDs keep quotations tied to shipped story content rather than duplicated prose.
const SOURCE: String = "res://data/content/story_script_ch01.json"
const LINE_IDS: Array[String] = ["opening_006", "opening_015", "node_1_1_post_002", "node_1_1_post_003",
	"node_1_2_pre_002", "node_1_2_pre_003", "node_1_2_post_001"]
var lines: Array[Dictionary] = []
var _bag: Array[int] = []
var _last: int = -1
var _random: RandomNumberGenerator = RandomNumberGenerator.new()

func _init() -> void:
	_random.randomize()
	var file: FileAccess = FileAccess.open(SOURCE, FileAccess.READ)
	if file != null:
		_collect(JSON.parse_string(file.get_as_text()))

func _collect(value: Variant) -> void:
	if value is Dictionary:
		var item: Dictionary = value
		if str(item.get("line_id", "")) in LINE_IDS and item.get("text_en") is String:
			lines.append({"line_id": item["line_id"], "text": item["text_en"], "speaker": item.get("speaker_display", "")})
		for child: Variant in item.values(): _collect(child)
	elif value is Array:
		for child: Variant in value: _collect(child)

func next() -> String:
	if lines.is_empty(): return ""
	if _bag.is_empty():
		for index: int in lines.size(): _bag.append(index)
		for index: int in range(_bag.size() - 1, 0, -1):
			var other: int = _random.randi_range(0, index)
			var swap: int = _bag[index]
			_bag[index] = _bag[other]
			_bag[other] = swap
		if _bag.size() > 1 and _bag.back() == _last:
			var swap: int = _bag[0]
			_bag[0] = _bag.back()
			_bag[_bag.size() - 1] = swap
	_last = _bag.pop_back()
	return str(lines[_last]["text"])
