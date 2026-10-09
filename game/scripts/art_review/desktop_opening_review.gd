extends AppShell
## Source-only desktop review: the real opening UI with a local, read-only snapshot.
const Preferences = preload("res://scripts/app/onboarding_preferences.gd")
const REVIEW_ROOT: String = "user://desktop_review"
const REVIEW_ACCOUNT: String = "desktop-opening-review"

class ReviewBackend extends GameBackend:
	var snapshot: Dictionary = {}

	func fetch_state() -> Outcome:
		return Outcome.ok({"state": snapshot.duplicate(true)})

	func _offline() -> Outcome:
		return Outcome.fail(KIND_OFFLINE, "This action requires the online game. The desktop review includes the opening and tutorial.")

func _ready() -> void:
	if not OS.has_feature("editor") or OS.get_name() not in ["Windows", "Linux", "macOS"]:
		push_error("Desktop review requires the desktop Godot editor executable.")
		get_tree().quit(1)
		return
	DirAccess.make_dir_recursive_absolute(REVIEW_ROOT)
	# Preview checkpoints and mounted content are separate from the real account.
	Online.account_id = REVIEW_ACCOUNT
	Online.onboarding_path = REVIEW_ROOT + "/onboarding.cfg"
	Online.preferences_path = REVIEW_ROOT + "/auth.cfg"
	Online.session_token = ""
	Online.is_new_account = true
	ProjectSettings.set_setting(Online.SERVER_URL_SETTING, "")
	Game.content = ContentInstaller.new(null, -1, REVIEW_ROOT + "/content")
	if "--reset-review" in OS.get_cmdline_user_args():
		DirAccess.remove_absolute(Online.onboarding_path)
		DirAccess.remove_absolute(REVIEW_ROOT + "/prologue.cfg")
	Preferences.register(Online.onboarding_path, REVIEW_ACCOUNT, true)
	flow = GameFlow.create()
	var local: ReviewBackend = ReviewBackend.new()
	if flow.is_ready():
		local.snapshot = JSON.parse_string(JSON.stringify({
			"schema_version": PlayerState.SCHEMA_VERSION,
			"story_state": flow.rules.story.to_persisted_dict(flow.rules.story.new_player_state()),
			"wallet": {"silver_crowns": 0, "eclipse_tokens": 0, "account_xp": 0},
		}))
	backend = local
	DisplayServer.window_set_title("Unaware of My Demise · Desktop Review")
	director = StoryDirector.new()
	director.shell = self
	director.prologue_seen_path = REVIEW_ROOT + "/prologue.cfg"
	director.restart_hint_path = REVIEW_ROOT + "/restart.cfg"
	director.restart_client = _continue_review
	add_child(director)
	director.start()

func _continue_review() -> bool:
	# The pulled source already has its story data: review Restart returns to the menu.
	director._entry_busy = false
	director.start(true)
	director._connect_entry()
	return true
