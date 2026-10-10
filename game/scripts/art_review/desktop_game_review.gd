extends "res://scripts/art_review/desktop_opening_review.gd"
## All authored source chapters, after the unchanged opening presentation.
const StoryBackend = preload("res://scripts/art_review/desktop_story_backend.gd")
const STORY_SAVE: String = "user://desktop_story_review/story.cfg"

func _init() -> void:
	review_root = "user://desktop_story_review"
	review_account = "desktop-story-review"

func _ready() -> void:
	super._ready()
	set_meta("local_story_review", true)
	DisplayServer.window_set_title("Unaware of My Demise · Full Story Review")

func _create_backend() -> GameBackend:
	if "--reset-review" in OS.get_cmdline_user_args():
		DirAccess.remove_absolute(STORY_SAVE)
	return StoryBackend.new(flow, STORY_SAVE)
