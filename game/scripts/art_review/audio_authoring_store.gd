@tool
extends RefCounted
## Local authoring credentials. This module is excluded from every player export.
const NARRATOR_MODEL: String = "Chirp3-HD"
const MUSIC_MODEL: String = "lyria-3.5"
const SFX_MODEL: String = "lyria-3.5"
const NARRATOR_SPEAKER: String = "narrator"
const TTS_LANGUAGE: String = "ja-JP"
const OWNER_APPROVAL_REQUIRED: bool = true

static func path() -> String:
	return ProjectSettings.globalize_path("res://").trim_suffix("/").get_base_dir().path_join(".local/audio-authoring.cfg")

static func read_config() -> ConfigFile:
	var config: ConfigFile = ConfigFile.new()
	if FileAccess.file_exists(path()): config.load(path())
	# Migrate the initial form without printing or dropping a locally entered key.
	if not config.has_section_key("google_cloud", "api_key"):
		config.set_value("google_cloud", "api_key", config.get_value("gemini", "api_key", ""))
	if config.has_section("gemini"): config.erase_section("gemini")
	if config.has_section("cloud_tts"): config.erase_section("cloud_tts")
	config.set_value("google_cloud", "credential_mode", "single_api_key")
	config.set_value("tts", "model", NARRATOR_MODEL)
	config.set_value("tts", "language", TTS_LANGUAGE)
	config.set_value("tts", "scope", "all_speech_including_narrator_and_characters")
	config.set_value("narrator", "language", TTS_LANGUAGE)
	var selected_voice: String = str(config.get_value("narrator", "voice_id", ""))
	if not selected_voice.is_empty() and not selected_voice.begins_with("ja-JP-Chirp3-HD-"):
		config.set_value("narrator", "voice_id", "")
		config.set_value("narrator", "status", "awaiting_owner_approved_japanese_audition")
	return config

static func save(key: String) -> Error:
	var directory: String = path().get_base_dir()
	var created: Error = DirAccess.make_dir_recursive_absolute(directory)
	if created != OK: return created
	var config: ConfigFile = read_config()
	config.set_value("google_cloud", "api_key", key.strip_edges())
	config.set_value("models", "narrator", NARRATOR_MODEL)
	config.set_value("models", "music", MUSIC_MODEL)
	config.set_value("models", "sfx", SFX_MODEL)
	config.set_value("narrator", "speaker_id", NARRATOR_SPEAKER)
	config.set_value("narrator", "language", TTS_LANGUAGE)
	if not config.has_section_key("narrator", "voice_id"):
		config.set_value("narrator", "voice_id", "")
		config.set_value("narrator", "status", "awaiting_owner_approved_audition")
	config.set_value("generation", "owner_approval_required_per_request", OWNER_APPROVAL_REQUIRED)
	config.set_value("generation", "enabled", false)
	var pending: String = path() + ".tmp"
	var written: Error = config.save(pending)
	if written != OK: return written
	return DirAccess.rename_absolute(pending, path())
