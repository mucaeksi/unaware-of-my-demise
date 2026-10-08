class_name AudioDirector
extends Node
## Autoload "Audio": music, voice and sound effects by stable id (INF-025). Screens never name an audio file.
##
## Runtime paths (DEC-0027; LEGACY `audio/voice/<speaker_id>/<line_id>.ogg` and `audio/music/<id>/`, promoted under the
## content's `assets/` root without the generation version, which stays in narrative staging and its sidecar):
##   voice  res://assets/audio/voice/<speaker_id>/<line_id>.ogg   (the line_id of the story/voice-line packs)
##   music  res://assets/audio/music/<cue_id>.ogg                  (looping is an import setting of the promoted file)
##   sfx    res://assets/audio/sfx/<cue_id>.ogg
##   ambience res://assets/audio/ambience/<cue_id>.ogg            (a looped bed under the music, e.g. rain)
## A file that is not shipped (or mounted from a content patch) is silence, reported once in `missing()`: before the
## audio is produced every call is a no-op, never an error.
##
## Buses (res://default_bus_layout.tres): Music, Voice, SFX -> Master. Volumes are linear 0..1, persisted in
## user://settings.cfg [audio] and applied at start. Music cross-fades; a new voice line cuts the previous one; the app
## going to the background pauses everything and coming back resumes it (Android lifecycle).
##
## Usage:
##   Audio.play_music("bgm_ch1_ash_forest", 1.5)
##   Audio.play_voice("fadyme", "opening_001")   # false when there is no recording: show text only
##   Audio.stop_voice()                          # on line skip / scene exit
##   Audio.set_volume(AudioDirector.BUS_MUSIC, 0.6)
##   Audio.play_flow_cue(AudioCues.FLOW_TITLE)    # a screen's slot; the content names the cue (D-08)
##   Audio.apply_line_audio({"sfx": "sfx_bell_distant", "music": "stop", "fade_seconds": 2.0})   # a story line's changes

const BUS_MUSIC: String = "Music"
const BUS_VOICE: String = "Voice"
const BUS_SFX: String = "SFX"
const BUSES: Array[String] = [BUS_MUSIC, BUS_VOICE, BUS_SFX]
const SETTINGS_PATH: String = "user://settings.cfg"
const SETTINGS_SECTION: String = "audio"
const AUDIO_ROOT: String = "res://assets/audio"
## Owner's future main theme (2026-10-05): reserved filename, not a generated or supplied recording.
const PENDING_MAIN_THEME: String = "bgm_main_theme"
const ENTRY_FADE_SECONDS: float = 5.0
## Below this linear volume a bus is muted instead of driven to -inf dB.
const SILENT: float = 0.001

## path -> bool; tests replace it (the default asks ResourceLoader, which also sees mounted patches).
var exists: Callable = func(path: String) -> bool: return ResourceLoader.exists(path, "AudioStream")
## path -> AudioStream; tests replace it.
var load_stream: Callable = func(path: String) -> Resource: return ResourceLoader.load(path, "AudioStream")

var _music: Array[AudioStreamPlayer] = []
var _active_music: int = 0
var _music_cue: String = ""
var _voice: AudioStreamPlayer = null
var _ambience: AudioStreamPlayer = null
var _ambience_cue: String = ""
## The flow slot table (docs/design/FIRST_LAUNCH_FLOW.md); loaded on first use, tests may replace it.
var cues: AudioCues = null:
	get:
		if cues == null:
			cues = AudioCues.load_pack()
			if not cues.error.is_empty():
				push_warning("Audio: %s" % cues.error)
		return cues
var _sfx: AudioStreamPlayer = null
var _fade: Tween = null
var _paused: bool = false
var _volumes: Dictionary = {}
var _missing: Dictionary = {}
var _settings_path: String = SETTINGS_PATH


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for index: int in 2:
		var player: AudioStreamPlayer = AudioStreamPlayer.new()
		player.bus = BUS_MUSIC
		add_child(player)
		_music.append(player)
	_voice = AudioStreamPlayer.new()
	_voice.bus = BUS_VOICE
	add_child(_voice)
	_ambience = AudioStreamPlayer.new()
	_ambience.bus = BUS_MUSIC
	add_child(_ambience)
	_sfx = AudioStreamPlayer.new()
	_sfx.bus = BUS_SFX
	_sfx.max_polyphony = 4
	add_child(_sfx)
	load_volumes(_settings_path)


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_APPLICATION_FOCUS_OUT:
			set_paused(true)
		NOTIFICATION_APPLICATION_RESUMED, NOTIFICATION_APPLICATION_FOCUS_IN:
			set_paused(false)


static func voice_path(speaker_id: String, line_id: String) -> String:
	return "%s/voice/%s/%s.ogg" % [AUDIO_ROOT, speaker_id, line_id]


static func music_path(cue_id: String) -> String:
	return "%s/music/%s.ogg" % [AUDIO_ROOT, cue_id]


static func sfx_path(cue_id: String) -> String:
	return "%s/sfx/%s.ogg" % [AUDIO_ROOT, cue_id]


static func ambience_path(cue_id: String) -> String:
	return "%s/ambience/%s.ogg" % [AUDIO_ROOT, cue_id]


## Plays what the content assigned to a flow `slot` (AudioCues): music slots cross-fade (an unassigned music slot fades
## the music out, so a screen never keeps another screen's mood), sfx slots play once, voice slots speak their line.
## False when nothing was played.
func play_flow_cue(slot: String, fade_seconds: float = 1.0) -> bool:
	var cue: String = cues.cue(slot)
	if slot.begins_with("flow."):
		if cue.is_empty():
			stop_music(fade_seconds)
			return false
		return play_music(cue, fade_seconds)
	if cue.is_empty():
		return false
	if slot.begins_with("sfx."):
		return play_sfx(cue)
	if slot.begins_with("voice."):
		var parts: PackedStringArray = cue.split("/")
		return parts.size() == 2 and play_voice(parts[0], parts[1])
	return false


## Entry music starts on the first game-controlled splash and survives Studio/Title/auth/patch.
## An assigned flow.title overrides the reserved filename; null/old patch slots use the built-in reservation.
## The missing future file is intentionally silent. Repeated calls preserve player, cursor and in-flight fade.
func play_entry_theme(fade_seconds: float = ENTRY_FADE_SECONDS) -> bool:
	var cue_id: String = cues.cue(AudioCues.FLOW_TITLE)
	if cue_id.is_empty():
		cue_id = PENDING_MAIN_THEME
	return play_music(cue_id, fade_seconds, true)


## Starts the looped bed `cue_id` ("" or "stop" stops it); the same bed already playing is left alone.
func play_ambience(cue_id: String) -> bool:
	if cue_id.is_empty() or cue_id == "stop":
		_ambience.stop()
		_ambience_cue = ""
		return false
	if cue_id == _ambience_cue and _ambience.playing:
		return true
	var stream: AudioStream = _stream(ambience_path(cue_id))
	_ambience.stop()
	_ambience_cue = ""
	if stream == null:
		return false
	_ambience.stream = stream
	_ambience.play()
	_ambience.stream_paused = _paused
	_ambience_cue = cue_id
	return true


func ambience_cue() -> String:
	return _ambience_cue


## A story scene opening: its music and ambience (docs/design/FIRST_LAUNCH_FLOW.md, story cues). A scene without a
## music_cue_id leaves the current music alone (cues are assigned scene by scene, D-08).
func apply_scene_audio(scene: Dictionary) -> void:
	var music: Variant = scene.get("music_cue_id")
	if music is String and not (music as String).is_empty():
		play_music(music)
	if scene.has("ambience_cue_id"):
		var ambience: Variant = scene["ambience_cue_id"]
		play_ambience(ambience if ambience is String else "")


## A story line's audio changes: {"music": cue | "stop", "ambience": cue | "stop", "sfx": cue, "fade_seconds": n}.
func apply_line_audio(audio: Variant) -> void:
	if not (audio is Dictionary):
		return
	var changes: Dictionary = audio
	var fade: float = float(changes.get("fade_seconds", 1.0)) if (changes.get("fade_seconds") is float or changes.get("fade_seconds") is int) else 1.0
	var music: Variant = changes.get("music")
	if music == "stop":
		stop_music(fade)
	elif music is String:
		play_music(music, fade)
	if changes.get("ambience") is String:
		play_ambience(changes["ambience"])
	if changes.get("sfx") is String:
		play_sfx(changes["sfx"])


## Starts `cue_id`, cross-fading from the current track over `fade_seconds`; the same cue already playing is left alone.
## False when the cue has no file (the current music then fades out: a scene that asks for another mood never keeps the
## old one).
func play_music(cue_id: String, fade_seconds: float = 1.0, force_loop: bool = false) -> bool:
	if cue_id == _music_cue and _music[_active_music].playing:
		return true
	var stream: AudioStream = _stream(music_path(cue_id))
	if stream == null:
		stop_music(fade_seconds)
		return false
	if force_loop and stream is AudioStreamOggVorbis and not (stream as AudioStreamOggVorbis).loop:
		# Keep cached/imported source settings intact; only the entry player's copy loops.
		stream = stream.duplicate() as AudioStreamOggVorbis
		(stream as AudioStreamOggVorbis).loop = true
	_active_music = 1 - _active_music
	var incoming: AudioStreamPlayer = _music[_active_music]
	incoming.stream = stream
	incoming.volume_db = linear_to_db(SILENT) if fade_seconds > 0.0 else 0.0
	incoming.play()
	incoming.stream_paused = _paused
	_music_cue = cue_id
	_crossfade(incoming, fade_seconds)
	return true


func stop_music(fade_seconds: float = 1.0) -> void:
	_music_cue = ""
	_crossfade(null, fade_seconds)


func music_cue() -> String:
	return _music_cue


## Plays the recording of `line_id` spoken by `speaker_id`, cutting any line still playing. False when there is no
## recording (text-only line, or the voice is not produced yet).
func play_voice(speaker_id: String, line_id: String, audition: AudioStream = null) -> bool:
	_voice.stop()
	if speaker_id.is_empty() or line_id.is_empty():
		return false
	var stream: AudioStream = audition if audition != null else _stream(voice_path(speaker_id, line_id))
	if stream == null:
		return false
	_voice.stream = stream
	_voice.play()
	_voice.stream_paused = _paused
	return true


func stop_voice() -> void:
	_voice.stop()


func is_voice_playing() -> bool:
	return _voice.playing

func voice_duration_seconds() -> float:
	return _voice.stream.get_length() if _voice.playing and _voice.stream != null else 0.0

func voice_position_seconds() -> float:
	return maxf(0.0,_voice.get_playback_position()+AudioServer.get_time_since_last_mix()-AudioServer.get_output_latency()) if _voice.playing else 0.0


func play_sfx(cue_id: String) -> bool:
	var stream: AudioStream = _stream(sfx_path(cue_id))
	if stream == null:
		return false
	_sfx.stream = stream
	_sfx.play()
	_sfx.stream_paused = _paused
	return true


## Pauses (true) or resumes (false) every player in place.
func set_paused(paused: bool) -> void:
	_paused = paused
	for player: AudioStreamPlayer in _music + [_voice, _sfx, _ambience]:
		player.stream_paused = paused
	if _fade != null and _fade.is_valid():
		if paused:
			_fade.pause()
		else:
			_fade.play()


## Linear volume 0..1 of `bus`; applied at once and saved.
func set_volume(bus: String, linear: float) -> void:
	if not BUSES.has(bus):
		push_warning("Audio: no bus %s" % bus)
		return
	_volumes[bus] = clampf(linear, 0.0, 1.0)
	_apply(bus)
	var config: ConfigFile = ConfigFile.new()
	config.load(_settings_path)
	config.set_value(SETTINGS_SECTION, bus, _volumes[bus])
	config.save(_settings_path)


func volume(bus: String) -> float:
	return float(_volumes.get(bus, 1.0))


## Reads the saved volumes from `path` (missing file or values = full volume) and applies them.
func load_volumes(path: String) -> void:
	_settings_path = path
	var config: ConfigFile = ConfigFile.new()
	config.load(path)
	for bus: String in BUSES:
		var saved: Variant = config.get_value(SETTINGS_SECTION, bus, 1.0)
		_volumes[bus] = clampf(float(saved), 0.0, 1.0) if (saved is float or saved is int) else 1.0
		_apply(bus)


## Ids asked for that had no file, sorted (diagnostics, bug reports).
func missing() -> Array[String]:
	var result: Array[String] = []
	for path: String in _missing:
		result.append(path)
	result.sort()
	return result


func _apply(bus: String) -> void:
	var index: int = AudioServer.get_bus_index(bus)
	if index < 0:
		return
	var linear: float = volume(bus)
	AudioServer.set_bus_mute(index, linear < SILENT)
	AudioServer.set_bus_volume_db(index, linear_to_db(maxf(linear, SILENT)))


func _stream(path: String) -> AudioStream:
	if not exists.call(path):
		_missing[path] = true
		return null
	var loaded: Resource = load_stream.call(path)
	if not (loaded is AudioStream):
		if not _missing.has(path):
			push_warning("Audio: %s is not an audio stream" % path)
		_missing[path] = true
		return null
	return loaded


## Fades `incoming` (null = none) in and every other music player out over `seconds`; 0 switches at once. A fade that is
## still running is cut short: a track it was fading out is faded (or stopped) with the rest, never left playing.
func _crossfade(incoming: AudioStreamPlayer, seconds: float) -> void:
	if _fade != null and _fade.is_valid():
		_fade.kill()
	var outgoing: Array[AudioStreamPlayer] = []
	for player: AudioStreamPlayer in _music:
		if player != incoming and player.playing:
			outgoing.append(player)
	if incoming == null and outgoing.is_empty():
		return  # nothing playing and nothing to start: a tween with no work is an engine error
	if seconds <= 0.0 or not is_inside_tree():
		for player: AudioStreamPlayer in outgoing:
			player.stop()
		if incoming != null:
			incoming.volume_db = 0.0
		return
	_fade = create_tween().set_parallel(true)
	if incoming != null:
		_fade.tween_property(incoming, "volume_db", 0.0, seconds)
	for player: AudioStreamPlayer in outgoing:
		_fade.tween_property(player, "volume_db", linear_to_db(SILENT), seconds)
	if not outgoing.is_empty():
		var finished: Callable = func() -> void:
			for player: AudioStreamPlayer in outgoing:
				player.stop()
		_fade.chain().tween_callback(finished)
	if _paused:
		_fade.pause()
