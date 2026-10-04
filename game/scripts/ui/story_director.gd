class_name StoryDirector
extends Node
## Decides which screen comes next (port of client/app.py's `_present_*` sequencing on top of `GameFlow`): boot (content on a worker, then the
## player's snapshot from the server), the hub, the story_order entries (narrative scenes, the First Oath gate, stages: pre-battle scene, roster, battle
## on a worker, replay, post-battle scene, defeat). Every rule lives in `GameFlow` and the services; this only connects screens to them.

const _END_OF_PREVIEW_SCENE: Dictionary = {
	"scene_id": "part1_end_of_preview",
	"title_en": "End of Part I Preview",
	"lines": [{
		"speaker_id": "narrator",
		"speaker_display": "",
		"text_en": "You have reached the end of the currently authored Part I story content. Thank you for playing.",
	}],
}
const BATTLE_ERROR_TITLE: String = "Something went wrong"
const BATTLE_ERROR_MESSAGE: String = "Stage %s could not be completed because of an error. Nothing from this attempt was saved; you can try again."

const HUB_CONTINUE: String = "continue"
const HUB_TEAM: String = "team"
const HUB_INVENTORY: String = "inventory"
const HUB_SETTINGS: String = "settings"
const HUB_DIAGNOSTICS: String = "diagnostics"

const _STOP_REASONS: Dictionary = {
	"silver_crowns": "Not enough Silver Crowns for the next level.",
	"ascension_items": "Ascension materials are needed for the next level.",
	"ascension_account_level": "A higher account level is needed to ascend.",
	"level_cap": "Level cap reached.",
}
const _EQUIPMENT_STOP_REASONS: Dictionary = {
	"milestone_items": "A Blacksmith Rivet upgrade is needed for the next level.",
	"silver_crowns": "Not enough Silver Crowns for the next level.",
	"level_cap": "Level cap reached.",
}
const GENERIC_PROBLEM: String = "Something went wrong; nothing was changed."

var shell: AppShell = null
var flow: GameFlow = null

var _boot_job: WorkerJob = null
var _battle_job: WorkerJob = null
var _battle_stage: String = ""
var _battle_roster: Variant = null


func _ready() -> void:
	set_process(false)


## Begins the boot sequence: content (on a worker unless the shell already has a loaded flow), then the server snapshot, then the first screen.
func start() -> void:
	if shell.flow != null:
		_on_flow_loaded(shell.flow)
		return
	_show_message("Unaware of My Demise", "Loading...")
	_boot_job = WorkerJob.start(func() -> Variant: return GameFlow.create())
	set_process(true)


func _process(_delta: float) -> void:
	if _boot_job != null and _boot_job.is_finished():
		var loaded: GameFlow = _boot_job.finish() as GameFlow
		_boot_job = null
		_on_flow_loaded(loaded)
	if _battle_job != null and _battle_job.is_finished():
		var result: BattleService.BattleResult = _battle_job.finish() as BattleService.BattleResult
		_battle_job = null
		_on_battle_finished(result)
	set_process(_boot_job != null or _battle_job != null)


## True while a worker (content load or battle) is running.
func is_busy() -> bool:
	return _boot_job != null or _battle_job != null


func on_back_unhandled() -> void:
	if shell.current is HubScreen:
		get_tree().quit()


# -- boot ---------------------------------------------------------------------------------------------


func _on_flow_loaded(loaded: GameFlow) -> void:
	# A flow that failed to load is dropped, so "Try again" reloads the content instead of showing the same failure.
	shell.flow = loaded if loaded.is_ready() else null
	if not loaded.is_ready():
		_present_boot_failure("Game data could not be loaded", loaded.error)
		return
	_show_message("Unaware of My Demise", "Connecting...")
	if not await Game.attach(loaded, shell.backend):
		if Game.boot_error_kind == GameBackend.KIND_OFFLINE:
			_present_boot_failure("Server unreachable", "The game server could not be reached. Check your connection and try again.")
		else:
			_present_boot_failure("The game could not start", Game.boot_error)
		return
	flow = Game.flow
	_present_hub()


func _present_boot_failure(title: String, message: String) -> void:
	var screen: MessageScreen = _show_message(title, message, [{"id": "retry", "label": "Try again"}] as Array[Dictionary])
	screen.chosen.connect(func(_action_id: String) -> void: start(), CONNECT_ONE_SHOT)


# -- hub ----------------------------------------------------------------------------------------------


func _present_hub(status: String = "") -> void:
	var money: Dictionary = flow.wallet()
	var summary: String = "Silver Crowns %d   Eclipse Tokens %d\nAccount XP %d" % [int(money.get("silver_crowns", 0)), int(money.get("eclipse_tokens", 0)), int(money.get("account_xp", 0))]
	var over: bool = flow.is_finished() and not flow.needs_first_oath_selection()
	var entries: Array[Dictionary] = [
		{"id": HUB_CONTINUE, "label": "Epilogue" if over else "Continue Story"},
		{"id": HUB_TEAM, "label": "Team"},
		{"id": HUB_INVENTORY, "label": "Inventory"},
		{"id": HUB_SETTINGS, "label": "Settings"},
	]
	if OS.is_debug_build():
		entries.append({"id": HUB_DIAGNOSTICS, "label": "Diagnostics"})
	var hub: HubScreen = HubScreen.new()
	hub.load_hub(summary, entries, status)
	hub.chosen.connect(_on_hub_chosen)
	shell.show_screen(hub)


func _on_hub_chosen(entry_id: String) -> void:
	match entry_id:
		HUB_CONTINUE:
			_present_current_entry()
		HUB_TEAM:
			_present_team()
		HUB_INVENTORY:
			_present_inventory()
		HUB_SETTINGS:
			_present_settings()
		HUB_DIAGNOSTICS:
			_present_diagnostics()


func _present_diagnostics() -> void:
	var scene: PackedScene = load("res://scenes/boot/boot.tscn") as PackedScene
	var diagnostics: Control = scene.instantiate() as Control
	diagnostics.set("embedded", true)
	diagnostics.connect("back_requested", func() -> void: _present_hub())
	shell.show_screen(diagnostics)


# -- the story ----------------------------------------------------------------------------------------


## Checked before the story_order entry: the First Oath Invitation is a one-time gate that has to be resolved before whichever entry is next.
func _present_current_entry() -> void:
	if flow.needs_first_oath_selection():
		_present_first_oath()
		return
	var entry_id: String = flow.current_entry()
	if entry_id.is_empty():
		_present_vn(_END_OF_PREVIEW_SCENE, _present_hub)
		return
	if flow.is_stage(entry_id):
		_present_stage(entry_id)
		return
	_present_vn(flow.story_index.narrative_scene(entry_id), _finish_narrative_entry)


func _present_vn(scene: Dictionary, on_finished: Callable) -> void:
	var screen: VnScreen = VnScreen.new()
	if not screen.load_scene(scene):
		_show_message("This scene cannot be shown", screen.error, [{"id": "hub", "label": "Back to the menu"}] as Array[Dictionary]).chosen.connect(func(_action_id: String) -> void: _present_hub(), CONNECT_ONE_SHOT)
		return
	screen.finished.connect(on_finished, CONNECT_ONE_SHOT)
	shell.show_screen(screen)


func _finish_narrative_entry() -> void:
	var advanced: Outcome = await flow.advance()
	if not advanced.is_ok():
		_present_save_problem(advanced, _finish_narrative_entry)
		return
	_present_current_entry()


func _present_save_problem(outcome: Outcome, retry: Callable) -> void:
	var screen: MessageScreen = _show_message("Progress could not be saved", "%s\nNothing was changed; you can try again." % outcome.error, [
		{"id": "retry", "label": "Try again"}, {"id": "hub", "label": "Back to the menu"}] as Array[Dictionary])
	screen.chosen.connect(_on_save_problem_chosen.bind(retry), CONNECT_ONE_SHOT)


func _on_save_problem_chosen(action_id: String, retry: Callable) -> void:
	if action_id == "retry":
		retry.call()
	else:
		_present_hub()


func _present_first_oath() -> void:
	var selector: SelectorScreen = SelectorScreen.new()
	selector.load_choices(flow.first_oath_choices(), "First Oath Invitation: choose one hero")
	selector.confirmed.connect(_confirm_first_oath)
	shell.show_screen(selector)


func _confirm_first_oath(character_id: String) -> void:
	var claimed: Outcome = await flow.claim_first_oath(character_id)
	if not claimed.is_ok():
		var selector: SelectorScreen = shell.current as SelectorScreen
		if selector != null:
			selector.show_error(claimed.error)
		return
	_present_current_entry()


func _present_stage(stage_id: String) -> void:
	var pre: Dictionary = flow.story_index.pre_battle_scene(stage_id)
	if flow.needs_roster_selection(stage_id):
		_present_vn(pre, func() -> void: _present_roster(stage_id))
	else:
		# The tutorial party is fixed (the two free starters): there is nothing to choose.
		_present_vn(pre, func() -> void: _start_battle(stage_id, null))


func _present_roster(stage_id: String, preselected: Variant = null) -> void:
	var start: Array[String] = []
	if preselected == null:
		start = flow.auto_roster(stage_id)
	else:
		for character_id: Variant in preselected:
			start.append(String(character_id))
	var roster: RosterScreen = RosterScreen.new()
	roster.load_stage(stage_id, flow.party_size(), flow.roster_candidates(), flow.guest_display_names(stage_id), start)
	roster.confirmed.connect(func(selected: Array[String]) -> void: _confirm_roster(stage_id, selected))
	shell.show_screen(roster)


func _confirm_roster(stage_id: String, selected: Array[String]) -> void:
	var problem: String = flow.validate_roster_selection(stage_id, selected)
	if not problem.is_empty():
		var roster: RosterScreen = shell.current as RosterScreen
		if roster != null:
			roster.show_error(problem)
		return
	_start_battle(stage_id, selected)


# -- battle -------------------------------------------------------------------------------------------


func _stage_title(stage_id: String) -> String:
	var stage: ContentModels.Stage = flow.stage(stage_id)
	return "%s  %s" % [stage_id, stage.title_en] if stage != null else stage_id


## Starts the battle on a worker thread; the loading state shows until it is done.
func _start_battle(stage_id: String, roster: Variant) -> void:
	_battle_stage = stage_id
	_battle_roster = roster
	var battle: BattleScreen = BattleScreen.new()
	battle.show_loading(_stage_title(stage_id))
	shell.show_screen(battle)
	_battle_job = flow.start_battle(stage_id, roster, shell.battle_seed)
	set_process(true)


func _on_battle_finished(result: BattleService.BattleResult) -> void:
	var stage_id: String = _battle_stage
	var roster: Variant = _battle_roster
	var outcome: GameFlow.StageOutcome = await flow.complete_battle(result, roster)
	if not outcome.error.is_empty():
		push_warning("Battle %s failed: %s" % [stage_id, outcome.error])
		_present_defeat(stage_id, roster, BATTLE_ERROR_TITLE, BATTLE_ERROR_MESSAGE % stage_id)
		return
	var battle: BattleScreen = shell.current as BattleScreen
	if battle == null:
		return
	battle.finished.connect(func() -> void: _finish_stage(stage_id, outcome, roster), CONNECT_ONE_SHOT)
	battle.play(BattlePlayback.create(outcome.battle, flow.registry), _stage_title(stage_id))


func _finish_stage(stage_id: String, outcome: GameFlow.StageOutcome, roster: Variant) -> void:
	if not outcome.is_victory():
		_present_defeat(stage_id, roster)
		return
	# Back to the hub after every cleared stage, so the player can level up and re-gear with what it granted before continuing.
	var post: Dictionary = flow.story_index.post_battle_scene(stage_id)
	if post.is_empty():
		_present_hub()
	else:
		_present_vn(post, _present_hub)


## A defeat reports nothing, so every option is safe to offer.
func _present_defeat(stage_id: String, roster: Variant, title: String = "", message: String = "") -> void:
	var can_change: bool = flow.needs_roster_selection(stage_id)
	var defeat: DefeatScreen = DefeatScreen.new()
	defeat.load_result(stage_id, can_change, title, message)
	defeat.retry.connect(func() -> void: _start_battle(stage_id, roster))
	defeat.change_party.connect(func() -> void: _present_roster(stage_id, roster))
	defeat.retreat.connect(func() -> void: _present_stage(stage_id))
	shell.show_screen(defeat)


# -- team, skills, inventory, settings ------------------------------------------------------------------


func _name_of(character_id: String) -> String:
	var character: ContentModels.Character = flow.registry.characters.get(character_id)
	return character.name_en if character != null else character_id


## The line a failed server call shows: the rule that refused it, the lost connection, or a generic one for anything unexpected (the detail
## goes to the log).
func _problem_text(outcome: Outcome) -> String:
	if outcome.error_kind in [Outcome.PROGRESSION, Outcome.EQUIPMENT, GameBackend.KIND_OFFLINE]:
		return outcome.error
	push_warning("Service call failed (%s): %s" % [outcome.error_kind, outcome.error])
	return GENERIC_PROBLEM


func _present_team(selected: String = "", status: String = "") -> void:
	var team: TeamScreen = TeamScreen.new()
	team.load_team(flow.team(), flow.xp_items(), "Silver Crowns %d" % int(flow.wallet().get("silver_crowns", 0)), selected, status)
	team.use_item.connect(_level_up)
	team.skills_requested.connect(func(character_id: String) -> void: _present_skills(character_id))
	team.memory_requested.connect(_unlock_memory_node)
	team.back_requested.connect(func() -> void: _present_hub())
	shell.show_screen(team)


func _level_up(character_id: String, item_id: String) -> void:
	var result: Outcome = await flow.level_up(character_id, item_id)
	var status: String
	if not result.is_ok():
		status = _problem_text(result)
	else:
		var gained: Dictionary = result.value
		status = "%s: +%d XP" % [_name_of(character_id), int(gained["xp_gained"])]
		if int(gained["level_after"]) > int(gained["level_before"]):
			status += ", Lv %d -> %d" % [int(gained["level_before"]), int(gained["level_after"])]
		var reason: Variant = gained["stopped_reason"]
		if reason != null and _STOP_REASONS.has(reason):
			status += ". " + str(_STOP_REASONS[reason])
	_present_team(character_id, status)


func _unlock_memory_node(character_id: String) -> void:
	var result: Outcome = await flow.unlock_memory_node(character_id)
	var status: String
	if result.is_ok():
		var unlocked: Dictionary = result.value
		status = "Memory Node %d unlocked (%d Shards left)" % [int(unlocked["node"]), int(unlocked["shards_remaining"])]
	else:
		status = _problem_text(result)
	_present_team(character_id, status)


func _present_skills(character_id: String, status: String = "", selected: String = "") -> void:
	var skills: SkillsScreen = SkillsScreen.new()
	skills.load_skills("%s - Skills" % _name_of(character_id), flow.skill_rows(character_id), selected, status)
	skills.upgrade_requested.connect(func(skill_id: String) -> void: _upgrade_skill(character_id, skill_id))
	skills.back_requested.connect(func() -> void: _present_team(character_id))
	shell.show_screen(skills)


func _upgrade_skill(character_id: String, skill_id: String) -> void:
	var result: Outcome = await flow.upgrade_skill(character_id, skill_id)
	var status: String
	if result.is_ok():
		var raised: Dictionary = result.value
		status = "Rank %d -> %d" % [int(raised["rank_before"]), int(raised["rank_after"])]
	else:
		status = _problem_text(result)
	_present_skills(character_id, status, skill_id)


func _present_inventory(selected: String = "", status: String = "") -> void:
	var targets: Array[Dictionary] = []
	for member: GameViews.TeamMember in flow.team():
		targets.append({"id": member.character_id, "name": member.name_en})
	var inventory: InventoryScreen = InventoryScreen.new()
	inventory.load_inventory(flow.inventory(), targets, selected, status)
	inventory.action_requested.connect(_inventory_action)
	inventory.back_requested.connect(func() -> void: _present_hub())
	shell.show_screen(inventory)


func _inventory_action(action: String, entry: GameViews.InventoryEntry, target_id: String) -> void:
	var selected: String = entry.instance_id
	var status: String = ""
	var result: Outcome = null
	match action:
		"equip":
			result = await flow.equip(entry.table, entry.instance_id, target_id)
			status = "Equipped %s." % entry.name_en
		"unequip":
			result = await flow.unequip(entry.table, entry.instance_id)
			status = "Unequipped %s." % entry.name_en
		"toggle_lock":
			result = await flow.set_locked(entry.table, entry.instance_id, not entry.locked)
			status = "%s %s." % ["Unlocked" if entry.locked else "Locked", entry.name_en]
		"dismantle":
			result = await flow.dismantle_weapon(entry.instance_id)
			if result.is_ok():
				var parts: PackedStringArray = PackedStringArray()
				var granted: Dictionary = (result.value as Dictionary)["granted"]
				for item_id: String in granted:
					parts.append("+%d %s" % [int(granted[item_id]), flow.item_name(item_id)])
				status = "Dismantled: " + ", ".join(parts)
				selected = ""
		"level_up":
			result = await flow.level_up_equipment(entry.table, entry.instance_id)
			if result.is_ok():
				var leveled: Dictionary = result.value
				if int(leveled["level_after"]) == int(leveled["level_before"]):
					status = "%s: +%d XP stored" % [entry.name_en, int(leveled["xp_spent"])]
				else:
					status = "%s: Lv %d -> %d" % [entry.name_en, int(leveled["level_before"]), int(leveled["level_after"])]
				var reason: Variant = leveled["stopped_reason"]
				if reason != null and _EQUIPMENT_STOP_REASONS.has(reason):
					status += ". " + str(_EQUIPMENT_STOP_REASONS[reason])
		"reroll":
			result = await flow.reroll_accessory(entry.instance_id)
			status = "Rerolled %s." % entry.name_en
	if result != null and not result.is_ok():
		status = _problem_text(result)
	_present_inventory(selected, status)


func _present_settings(status: String = "") -> void:
	var version: Dictionary = Engine.get_version_info()
	var settings: SettingsScreen = SettingsScreen.new()
	settings.load_settings("Unaware of My Demise  (Godot %s)\nNo game server is configured in this build." % str(version.get("string", "")), status)
	settings.back_requested.connect(func() -> void: _present_hub())
	shell.show_screen(settings)

# -- helpers ------------------------------------------------------------------------------------------


func _show_message(title: String, message: String, actions: Array[Dictionary] = []) -> MessageScreen:
	var screen: MessageScreen = MessageScreen.new()
	screen.load_message(title, message, actions)
	shell.show_screen(screen)
	return screen
