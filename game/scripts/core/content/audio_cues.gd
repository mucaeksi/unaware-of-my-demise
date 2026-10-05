class_name AudioCues
extends RefCounted
## The flow audio slots (docs/design/FIRST_LAUNCH_FLOW.md, owner decision D-08): screens outside the story ask for a slot
## ("flow.title"), the content pack `audio_cues_part1.json` names the cue the narrative team assigned to it (null =
## silent). Engineering owns the slot list (kept in step with tools/validate_part1_content.py AUDIO_SLOTS); the values
## are content and change with a content patch.
##
## Usage:
##   var cues: AudioCues = AudioCues.load_pack()
##   cues.cue(AudioCues.FLOW_TITLE)        # "" while unassigned
##   Audio.play_flow_cue(AudioCues.FLOW_TITLE)

const PACK_PATH: String = "res://data/content/audio_cues_part1.json"

const FLOW_TITLE: String = "flow.title"
const FLOW_HUB: String = "flow.hub"
const FLOW_SUMMON: String = "flow.summon"
const FLOW_BATTLE_DEFAULT: String = "flow.battle_default"
const FLOW_VICTORY: String = "flow.victory"
const FLOW_DEFEAT: String = "flow.defeat"
const SFX_UI_START: String = "sfx.ui_start"
const SFX_UI_CONFIRM: String = "sfx.ui_confirm"
const SFX_UI_BACK: String = "sfx.ui_back"
const SFX_UI_ERROR: String = "sfx.ui_error"
const VOICE_TITLE_CALL: String = "voice.title_call"
const SLOTS: Array[String] = [FLOW_TITLE, FLOW_HUB, FLOW_SUMMON, FLOW_BATTLE_DEFAULT, FLOW_VICTORY, FLOW_DEFEAT,
	SFX_UI_START, SFX_UI_CONFIRM, SFX_UI_BACK, SFX_UI_ERROR, VOICE_TITLE_CALL]

## Why the pack could not be used ("" = it could); a broken pack means silence, never a crash.
var error: String = ""

var _slots: Dictionary = {}


## Reads the pack at `path` (the shipped one, or the mounted content patch's).
static func load_pack(path: String = PACK_PATH) -> AudioCues:
	var cues: AudioCues = AudioCues.new()
	if not FileAccess.file_exists(path):
		cues.error = "%s is missing" % path
		return cues
	var parser: JSON = JSON.new()
	if parser.parse(FileAccess.get_file_as_string(path)) != OK or not (parser.data is Dictionary):
		cues.error = "%s is not a JSON object" % path
		return cues
	cues.adopt((parser.data as Dictionary).get("slots"))
	return cues


## Takes the slot values of a parsed pack; unknown slots and malformed values are ignored (reported in `error`).
func adopt(slots: Variant) -> void:
	_slots.clear()
	if not (slots is Dictionary):
		error = "the pack has no slots object"
		return
	for slot: Variant in slots:
		var value: Variant = (slots as Dictionary)[slot]
		if not (slot in SLOTS):
			error = "unknown slot %s" % str(slot)
		elif value is String and not (value as String).is_empty():
			_slots[slot] = value


## The cue id (music/sfx) or "<speaker_id>/<line_id>" (voice) assigned to `slot`; "" when none is.
func cue(slot: String) -> String:
	return str(_slots.get(slot, ""))
