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
const HUB_SUMMON: String = "summon"
const HUB_QUESTS: String = "quests"
const HUB_INN_MEAL: String = "inn_meal"
const HUB_SETTINGS: String = "settings"
const SETTINGS_SIGN_OUT: String = "sign_out"
const SETTINGS_DELETE_ACCOUNT: String = "delete_account"
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
		elif Game.boot_error_kind in [SignInFlow.KIND_CANCELLED, SignInFlow.KIND_FAILED, SignInFlow.KIND_UNAVAILABLE]:
			_present_boot_failure("Sign-in required", Game.boot_error)
		else:
			_present_boot_failure("The game could not start", Game.boot_error)
		return
	flow = Game.flow
	if flow.open_attempt().is_empty():
		_present_hub()
	else:
		_present_unfinished_battle()


func _present_boot_failure(title: String, message: String) -> void:
	var screen: MessageScreen = _show_message(title, message, [{"id": "retry", "label": "Try again"}] as Array[Dictionary])
	screen.chosen.connect(func(_action_id: String) -> void: start(), CONNECT_ONE_SHOT)


# -- hub ----------------------------------------------------------------------------------------------


func _present_hub(status: String = "") -> void:
	var money: Dictionary = flow.wallet()
	var summary: String = "Silver Crowns %d   Eclipse Tokens %d\nFate's Threads %d   Ration %d   Account XP %d" % [int(money.get("silver_crowns", 0)), int(money.get("eclipse_tokens", 0)), int(money.get("fate_threads", 0)), int(money.get("ration", 0)), int(money.get("account_xp", 0))]
	var over: bool = flow.is_finished() and not flow.needs_first_oath_selection()
	var entries: Array[Dictionary] = [
		{"id": HUB_CONTINUE, "label": "Epilogue" if over else "Continue Story"},
		{"id": HUB_TEAM, "label": "Team"},
		{"id": HUB_INVENTORY, "label": "Inventory"},
		{"id": HUB_SUMMON, "label": "Summon"},
		{"id": HUB_QUESTS, "label": "Quests"},
		{"id": HUB_SETTINGS, "label": "Settings"},
	]
	var meal: int = flow.state.inn_meal_amount()
	if meal > 0:
		entries.insert(1, {"id": HUB_INN_MEAL, "label": "Inn Meal (+%d Ration)" % meal})
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
		HUB_SUMMON:
			_present_gacha()
		HUB_QUESTS:
			_present_quests()
		HUB_INN_MEAL:
			_claim_inn_meal()
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
	# A lost connection leaves the change unconfirmed: trying again resends the same request, which the server never applies twice (INF-013).
	var advice: String = "It may already be saved; trying again finishes it and never applies it twice." if outcome.error_kind == GameBackend.KIND_OFFLINE \
		else "Nothing was changed; you can try again."
	var screen: MessageScreen = _show_message("Progress could not be saved", "%s\n%s" % [outcome.error, advice], [
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


## Opens the attempt on the server (which picks the seed), then runs the battle on a worker thread; the loading state shows until it is done.
func _start_battle(stage_id: String, roster: Variant) -> void:
	_battle_stage = stage_id
	_battle_roster = roster
	var battle: BattleScreen = BattleScreen.new()
	battle.show_loading(_stage_title(stage_id))
	shell.show_screen(battle)
	var opened: Outcome = await flow.begin_stage(stage_id, roster)
	if shell.current != battle:
		return
	if not opened.is_ok():
		push_warning("Stage %s could not start: %s" % [stage_id, opened.error])
		_present_defeat(stage_id, roster, BATTLE_ERROR_TITLE, _problem_text(opened))
		return
	_battle_job = flow.start_battle(stage_id, roster, int(flow.attempt["run_seed"]))
	set_process(true)


func _on_battle_finished(result: BattleService.BattleResult) -> void:
	_handle_battle_outcome(_battle_stage, _battle_roster, await flow.complete_battle(result))


func _handle_battle_outcome(stage_id: String, roster: Variant, outcome: GameFlow.StageOutcome) -> void:
	if outcome.error_kind == GameBackend.KIND_OFFLINE and flow.unreported != null:
		_present_unreported_victory(stage_id, roster)
		return
	if not outcome.error.is_empty():
		push_warning("Battle %s failed: %s" % [stage_id, outcome.error])
		_present_defeat(stage_id, roster, BATTLE_ERROR_TITLE, BATTLE_ERROR_MESSAGE % stage_id)
		return
	var battle: BattleScreen = shell.current as BattleScreen
	if battle == null:
		return
	battle.finished.connect(func() -> void: _finish_stage(stage_id, outcome, roster), CONNECT_ONE_SHOT)
	battle.play(BattlePlayback.create(outcome.battle, flow.registry), _stage_title(stage_id))


## The victory's report got no reply: it may have been saved. Trying again resends the same report (never paid twice); leaving keeps the
## attempt open on the server, and the next start offers to resume it.
func _present_unreported_victory(stage_id: String, roster: Variant) -> void:
	var screen: MessageScreen = _show_message("Victory not confirmed",
		"The connection dropped while %s was being saved. The result is kept: try again to confirm it." % _stage_title(stage_id), [
		{"id": "retry", "label": "Try again"}, {"id": "hub", "label": "Back to the menu"}] as Array[Dictionary])
	screen.chosen.connect(func(action_id: String) -> void:
		if action_id == "retry":
			var battle: BattleScreen = BattleScreen.new()
			battle.show_loading(_stage_title(stage_id))
			shell.show_screen(battle)
			_handle_battle_outcome(stage_id, roster, await flow.report_again())
		else:
			_present_hub(), CONNECT_ONE_SHOT)


## INF-014: the server holds a battle that was started but never reported (the app closed or lost its connection). Resuming plays the same
## battle again from the inputs the server froze; giving up costs nothing.
func _present_unfinished_battle() -> void:
	var open: Dictionary = flow.open_attempt()
	var screen: MessageScreen = _show_message("Unfinished battle",
		"%s was started but its result was never saved. Resume it to finish the battle, or give it up." % _stage_title(String(open["stage_id"])), [
		{"id": "resume", "label": "Resume"}, {"id": "give_up", "label": "Give up"}] as Array[Dictionary])
	screen.chosen.connect(func(action_id: String) -> void:
		if action_id == "resume" and flow.resume_open_attempt():
			_battle_stage = String(flow.attempt["stage_id"])
			_battle_roster = flow.attempt["roster"]
			var battle: BattleScreen = BattleScreen.new()
			battle.show_loading(_stage_title(_battle_stage))
			shell.show_screen(battle)
			_battle_job = flow.start_battle(_battle_stage, _battle_roster, int(flow.attempt["run_seed"]))
			set_process(true)
		else:
			await flow.abandon_open_attempt()
			_present_hub(), CONNECT_ONE_SHOT)


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
	if outcome.error_kind in [Outcome.PROGRESSION, Outcome.EQUIPMENT, GameBackend.KIND_OFFLINE, GameBackend.KIND_INSUFFICIENT_FUNDS]:
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


## The banners come from the server on every visit (pity and odds change with each pull).
func _present_gacha(selected: String = "", results_text: String = "", status: String = "") -> void:
	var listed: Outcome = await flow.gacha_banners()
	if not listed.is_ok():
		_present_hub(_problem_text(listed))
		return
	var gacha: GachaScreen = GachaScreen.new()
	var banners: Array[GameViews.BannerView] = []
	banners.assign(listed.value)
	gacha.load_gacha(banners, int(flow.wallet().get("fate_threads", 0)), selected, results_text, status)
	gacha.set_exchange(int(flow.wallet().get("eclipse_tokens", 0)), flow.fate_thread_token_cost())
	gacha.exchange_requested.connect(func(count: int) -> void: _exchange(gacha, count))
	gacha.pull_requested.connect(func(banner_id: String, count: int, target_id: String) -> void: _pull(gacha, banner_id, count, target_id))
	gacha.history_requested.connect(func() -> void: _present_gacha_history(0, selected))
	gacha.back_requested.connect(func() -> void: _present_hub())
	shell.show_screen(gacha)


func _pull(screen: GachaScreen, banner_id: String, count: int, target_id: String) -> void:
	screen.set_busy(true)
	var result: Outcome = await flow.gacha_pull(banner_id, count, target_id)
	if not result.is_ok():
		_present_gacha(banner_id, "", _problem_text(result))
		return
	_present_gacha(banner_id, pull_results_text(flow.pull_entries(result.value)))


func _exchange(screen: GachaScreen, count: int) -> void:
	screen.set_busy(true)
	var selected: String = screen.selected
	var result: Outcome = await flow.convert_fate_threads(count)
	if not result.is_ok():
		_present_gacha(selected, "", _problem_text(result))
		return
	var converted: Dictionary = result.value
	_present_gacha(selected, "", "Exchanged %d Eclipse Tokens for %d Fate's Thread." % [int(converted.get("eclipse_tokens_spent", 0)), int(converted.get("fate_threads_gained", 0))])


## One line per pull, in the order the server resolved them: "5★ Name  NEW", "4★ Name  duplicate (+10 Memory Shards)".
static func pull_results_text(entries: Array[GameViews.PullEntry]) -> String:
	var lines: PackedStringArray = PackedStringArray()
	for entry: GameViews.PullEntry in entries:
		var line: String = "%d★ %s" % [entry.rarity, entry.name_en]
		if entry.featured:
			line += "  featured"
		if entry.is_new:
			line += "  NEW"
		elif entry.duplicate:
			line += ("  duplicate (+%d Memory Shards)" % entry.memory_shards) if entry.memory_shards > 0 else "  duplicate"
		lines.append(line)
	return "\n".join(lines)


func _present_gacha_history(before: int, selected: String) -> void:
	var page: Outcome = await flow.gacha_history(before)
	if not page.is_ok():
		_present_gacha(selected, "", _problem_text(page))
		return
	var lines: Array = (page.value as Dictionary)["lines"]
	var cursor: int = int((page.value as Dictionary)["next_cursor"])
	var actions: Array[Dictionary] = []
	if cursor > 0:
		actions.append({"id": "older", "label": "Older"})
	actions.append({"id": "back", "label": "Back"})
	var screen: MessageScreen = _show_message("Pull history", "\n".join(lines) if not lines.is_empty() else "No pulls yet.", actions)
	screen.chosen.connect(func(action_id: String) -> void:
		if action_id == "older":
			_present_gacha_history(cursor, selected)
		else:
			_present_gacha(selected), CONNECT_ONE_SHOT)


func _present_quests(selected: String = "", status: String = "") -> void:
	var listed: Outcome = await flow.quest_rows()
	if not listed.is_ok():
		_present_hub(_problem_text(listed))
		return
	var rows: Array[GameViews.QuestRow] = []
	rows.assign(listed.value)
	var quests: QuestsScreen = QuestsScreen.new()
	quests.load_quests(rows, selected, status)
	quests.claim_requested.connect(func(kind: String, task_id: String, period: String) -> void: _claim_quest(quests, kind, task_id, period))
	quests.back_requested.connect(func() -> void: _present_hub())
	shell.show_screen(quests)


func _claim_quest(screen: QuestsScreen, kind: String, task_id: String, period: String) -> void:
	screen.set_busy(true)
	var selected: String = screen.selected
	var result: Outcome = await flow.claim_quest(kind, task_id, period)
	var status: String
	if result.is_ok():
		var claimed: Dictionary = result.value
		var granted: Dictionary = claimed.get("granted", {}) if claimed.get("granted") is Dictionary else {}
		status = ("Already claimed: " if claimed.get("already_claimed") == true else "Claimed: ") + GameFlow.reward_text(granted)
	else:
		status = _problem_text(result)
	_present_quests(selected, status)


func _claim_inn_meal() -> void:
	var result: Outcome = await flow.claim_inn_meal()
	if not result.is_ok():
		_present_hub(_problem_text(result))
		return
	var granted: int = int((result.value as Dictionary).get("ration_granted", 0))
	_present_hub("The inn serves a hot meal: +%d Ration." % granted if granted > 0 else "Today's meal is already eaten.")


func _present_settings(status: String = "") -> void:
	var version: Dictionary = Engine.get_version_info()
	var info: String = "Unaware of My Demise  (Godot %s, build %d)" % [str(version.get("string", "")), ClientRelease.version_code()]
	var actions: Array[Dictionary] = []
	if Online.server_url().is_empty():
		info += "\nNo game server is configured in this build."
	elif Online.has_session():
		info += "\nSigned in with Google  (account …%s)" % Online.account_id.right(6)
		actions = [{"id": SETTINGS_SIGN_OUT, "label": "Sign out"}, {"id": SETTINGS_DELETE_ACCOUNT, "label": "Delete account"}]
	var settings: SettingsScreen = SettingsScreen.new()
	settings.load_settings(info, status, actions)
	settings.back_requested.connect(func() -> void: _present_hub())
	settings.action_requested.connect(func(action_id: String) -> void:
		if action_id == SETTINGS_SIGN_OUT:
			_sign_out()
		elif action_id == SETTINGS_DELETE_ACCOUNT:
			_confirm_account_deletion())
	shell.show_screen(settings)


## INF-019: ends the session here and on the server; the next start shows the account chooser again.
func _sign_out() -> void:
	_show_message("Signing out", "...")
	await Online.log_out()
	_present_signed_out("Signed out", "You are signed out of this device.")


## INF-020: deletion is permanent, so it is confirmed twice: here, and by choosing the Google account again.
func _confirm_account_deletion() -> void:
	var screen: MessageScreen = _show_message("Delete your account?",
		"This permanently deletes your account and all its progress, heroes, items and currencies. It cannot be undone.\n" +
		"You will be asked to confirm with your Google account.", [
		{"id": "delete", "label": "Delete permanently"}, {"id": "cancel", "label": "Cancel"}] as Array[Dictionary])
	screen.chosen.connect(func(action_id: String) -> void:
		if action_id != "delete":
			_present_settings()
			return
		_show_message("Deleting your account", "...")
		var deleted: Outcome = await Online.delete_account()
		if deleted.is_ok():
			_present_signed_out("Account deleted", "Your account and all its data were deleted.")
		else:
			_present_settings("The account was not deleted: %s" % deleted.error), CONNECT_ONE_SHOT)


## After a sign-out or a deletion: nothing of the old session is kept; "Sign in" starts over (account chooser).
func _present_signed_out(title: String, message: String) -> void:
	Game.flow = null
	flow = null
	var screen: MessageScreen = _show_message(title, message, [{"id": "sign_in", "label": "Sign in"}] as Array[Dictionary])
	screen.chosen.connect(func(_action_id: String) -> void: start(), CONNECT_ONE_SHOT)

# -- helpers ------------------------------------------------------------------------------------------


func _show_message(title: String, message: String, actions: Array[Dictionary] = []) -> MessageScreen:
	var screen: MessageScreen = MessageScreen.new()
	screen.load_message(title, message, actions)
	shell.show_screen(screen)
	return screen
