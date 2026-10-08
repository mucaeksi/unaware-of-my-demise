class_name GameFlow
extends RefCounted
## The game flow the screens drive (port of client/game_controller.py on top of DEC-0012): which `story_order` entry is due, the First Oath
## Invitation gate, roster selection, running a stage battle and reporting its clear, and the hub's team/skill/inventory menus. The rules
## live in the core domain; the player's state is the server's (`PlayerState`, read-only here) and every change goes through `backend`
## (`GameBackend`) as a coroutine whose reply carries the new snapshot, adopted into `state` before the call returns.
##
## Threading: the battle itself runs on a `WorkerJob` and touches nothing but the objects it was handed; everything else runs on the calling
## thread. `start_battle` reads what the battle needs from `state` first, `complete_battle` reports the result after `finish()`. While a battle
## job runs, do not call other methods that use `rules.story` (roster checks); the battle owns its own `StoryState` and `BattleService`.
##
## Failures come back as an `Outcome` / `StageOutcome` with `error` and `error_kind`; nothing here raises.

const CONTENT_DIR: String = "res://data/content"
## core.story_state.resolve_battle_roster hardcodes this stage to exactly the two free starters (the guided tutorial exception).
const TUTORIAL_STAGE_ID: String = "1-1"
const ERROR_BATTLE: String = "battle"
const ERROR_FLOW: String = "flow"
## The server replied, but not with a usable player snapshot.
const ERROR_PROTOCOL: String = "protocol"


## One owned hero as the roster and First Oath screens list it.
class RosterCandidate extends RefCounted:
	var character_id: String = ""
	var name_en: String = ""
	var rarity: int = 0
	var element: String = ""
	var class_id: String = ""
	var combat_role: String = ""


## What one stage attempt produced: the battle and, for a first or repeat clear, what the server granted for it.
class StageOutcome extends RefCounted:
	var battle: BattleService.BattleResult = null
	var applied: Array = []
	## The story state after the clear (the current one for a defeat).
	var story_state: StoryState.PlayerStoryState = null
	var first_clear: bool = false
	var error: String = ""
	var error_kind: String = ""

	func is_victory() -> bool:
		return error.is_empty() and battle != null and battle.outcome == "victory"

	func is_defeat() -> bool:
		return error.is_empty() and battle != null and battle.outcome == "defeat"


var registry: ContentModels.ContentRegistry = null
var rules: ServiceRules = null
var story_index: StoryIndex = null
## The battle's own services (see the threading note); never used by the roster checks.
var battle_service: BattleService = null
## Where state changes go; the base class is the "no server" backend (every call fails `GameBackend.KIND_OFFLINE`).
var backend: GameBackend = GameBackend.new()
## The last snapshot the server sent (null until `sync` succeeded).
var state: PlayerState = null
## The attempt the server opened for the battle in progress ({} = none): {"attempt_id", "stage_id", "run_seed"}, plus "roster" and
## "inputs" (the build the server froze) for an attempt resumed from the snapshot (INF-014).
var attempt: Dictionary = {}
## A victory whose report got no reply (it may have committed): kept with `attempt` until `report_again` settles it.
var unreported: BattleService.BattleResult = null
## Why the content or the rules could not be set up ("" = ready).
var error: String = ""
## Opening-only exports load the combat/rules registry before the signed story pack.
var opening_only: bool = false


## Loads the content packs and builds everything derived from them. Slow (the packs are parsed): call it once, off the UI thread on the
## boot screen. Check `error` on the result.
static func create(content_dir: String = CONTENT_DIR, allow_opening_only: bool = false) -> GameFlow:
	var flow: GameFlow = GameFlow.new()
	var loader: ContentLoader = ContentLoader.new()
	flow.registry = loader.load_dir(content_dir)
	if flow.registry == null:
		flow.error = "content load failed: %s" % loader.error
		return flow
	flow.rules = ServiceRules.create(flow.registry, content_dir)
	if not flow.rules.error.is_empty():
		flow.error = "service rules failed: %s" % flow.rules.error
		return flow
	var battle_story: StoryState = StoryState.new(flow.registry, StoryState.load_manifest(content_dir))
	flow.battle_service = BattleService.create(flow.registry, battle_story)
	if not flow.battle_service.error.is_empty():
		flow.error = "battle service setup failed: %s" % flow.battle_service.error
		return flow
	if OS.has_feature("opening_bootstrap") or allow_opening_only:
		var manifest: Dictionary = StoryState.load_manifest(content_dir)
		for chapter: String in manifest.get("chapter_files",[]):
			if not FileAccess.file_exists(content_dir.path_join(chapter)):
				flow.opening_only = true
		if flow.opening_only:
			flow.story_index = StoryIndex.new()
			return flow
	flow.story_index = StoryIndex.load_dir(content_dir)
	if not flow.story_index.load_error.is_empty():
		flow.error = "story script failed: %s" % flow.story_index.load_error
	return flow


func is_ready() -> bool:
	return error.is_empty()


## True once a snapshot is held.
func has_state() -> bool:
	return state != null


## Fetches the player's snapshot from the server (coroutine).
func sync() -> Outcome:
	return _adopt(await backend.fetch_state())


## Takes the snapshot out of a backend reply (`value["state"]`) into `state`; a failed reply passes through and keeps the old state. A
## snapshot older than the one held (lower `state_revision`: a late reply, a replayed request) is not adopted (INF-012); the reply
## itself still succeeds, since what it reports did happen.
func _adopt(reply: Outcome) -> Outcome:
	if not reply.is_ok():
		return reply
	var value: Variant = reply.value
	if not (value is Dictionary) or not (value as Dictionary).has("state"):
		return Outcome.fail(ERROR_PROTOCOL, "the server reply carries no player state")
	var next: PlayerState = PlayerState.from_snapshot((value as Dictionary)["state"], rules.story)
	if not next.is_valid():
		return Outcome.fail(ERROR_PROTOCOL, next.error)
	if state != null and next.revision() < state.revision():
		return reply
	state = next
	return reply


# -- the story cursor ---------------------------------------------------------------------------------


## The next `story_order` entry to present, "" when the story is over.
func current_entry() -> String:
	var cursor: int = state.story_state.story_cursor
	return story_index.story_order[cursor] if cursor < story_index.story_order.size() else ""


func is_finished() -> bool:
	return current_entry().is_empty()


## True for a player who has not finished the first story entry yet (the opening scene): the game takes them straight
## into the story instead of the hub (docs/design/FIRST_LAUNCH_FLOW.md step 9).
func is_at_story_start() -> bool:
	return state.story_state.story_cursor == 0 and not needs_first_oath_selection()


func is_stage(entry_id: String) -> bool:
	return story_index.is_stage_entry(entry_id)


func stage(stage_id: String) -> ContentModels.Stage:
	return registry.stages.get(stage_id)


## Moves past the current (non-stage) entry (coroutine).
func advance() -> Outcome:
	return _adopt(await backend.advance_story())


## True while the First Oath Invitation must be resolved before any further entry is presented (a one-time gate, not tied to a cursor index).
func needs_first_oath_selection() -> bool:
	return state.story_state.first_oath_invitation_available


## Every hero the invitation can grant, in the manifest's authored order.
func first_oath_choices() -> Array[RosterCandidate]:
	var candidates: Array[RosterCandidate] = []
	for character_id: String in rules.story.first_oath_choices():
		var candidate: RosterCandidate = _candidate(character_id)
		if candidate != null:
			candidates.append(candidate)
	return candidates


## Coroutine.
func claim_first_oath(character_id: String) -> Outcome:
	return _adopt(await backend.claim_first_oath(character_id))


# -- roster selection ---------------------------------------------------------------------------------


func party_size() -> int:
	var party: Variant = registry.battle_rules.get("party", {})
	return int((party as Dictionary).get("size", 5)) if party is Dictionary else 5


## The deterministic default party: the roster screen's pre-ticked selection (an empty list at the tutorial, where the party is fixed).
func auto_roster(stage_id: String) -> Array[String]:
	var picked: Array[String] = []
	if stage_id == TUTORIAL_STAGE_ID:
		return picked
	var owned: Array[String] = _owned_ids()
	for index: int in range(mini(party_size(), owned.size())):
		picked.append(owned[index])
	return picked


## False only for the guided two-hero tutorial.
func needs_roster_selection(stage_id: String) -> bool:
	return stage_id != TUTORIAL_STAGE_ID


## Every owned hero by id. Not filtered against the stage's guests: an owned guest can still be picked, then the player's own copy is used.
func roster_candidates() -> Array[RosterCandidate]:
	var candidates: Array[RosterCandidate] = []
	for character_id: String in _owned_ids():
		var candidate: RosterCandidate = _candidate(character_id)
		if candidate != null:
			candidates.append(candidate)
	return candidates


## The story guests the stage fills in (informational; a selection never has to include them).
func guest_display_names(stage_id: String) -> Array[String]:
	var names: Array[String] = []
	var target: ContentModels.Stage = stage(stage_id)
	if target == null:
		return names
	for character_id: String in target.guest_characters:
		if registry.characters.has(character_id):
			names.append(registry.characters[character_id].name_en)
	return names


## "" when `selected` is playable, else the reason. Asks the same rule the battle uses, so the two cannot drift apart.
func validate_roster_selection(stage_id: String, selected: Array) -> String:
	var target: ContentModels.Stage = stage(stage_id)
	if target == null:
		return "Unknown stage_id '%s'" % stage_id
	rules.story.resolve_battle_roster(state.story_state, target, selected)
	return rules.story.error


func _owned_ids() -> Array[String]:
	var ids: Array[String] = []
	for character_id: String in state.story_state.owned_character_ids:
		ids.append(character_id)
	ids.sort()
	return ids


func _candidate(character_id: String) -> RosterCandidate:
	var character: ContentModels.Character = registry.characters.get(character_id)
	if character == null:
		return null
	var candidate: RosterCandidate = RosterCandidate.new()
	candidate.character_id = character.character_id
	candidate.name_en = character.name_en
	candidate.rarity = character.rarity
	candidate.element = character.element
	candidate.class_id = character.class_id
	candidate.combat_role = character.combat_role
	return candidate


# -- battles ------------------------------------------------------------------------------------------


## Asks the server to open an attempt at `stage_id` with `roster` (null = the default party; coroutine). The server checks the stage and the
## party and picks the battle seed (DEC-0013); on success `attempt` holds {"attempt_id", "stage_id", "run_seed"} and the battle must be
## started with that seed. A new attempt replaces any older one, on the server too.
func begin_stage(stage_id: String, roster: Variant = null) -> Outcome:
	attempt = {}
	unreported = null
	var chosen: Array = auto_roster(stage_id) if roster == null else (roster as Array).duplicate()
	var reply: Outcome = _adopt(await backend.begin_stage(stage_id, chosen))
	if not reply.is_ok():
		return reply
	var opened: Variant = (reply.value as Dictionary).get("attempt")
	var valid: bool = opened is Dictionary and (opened as Dictionary).get("attempt_id") is String \
		and ((opened as Dictionary).get("run_seed") is int or (opened as Dictionary).get("run_seed") is float)
	if not valid or (opened as Dictionary).get("stage_id") != stage_id:
		return Outcome.fail(ERROR_PROTOCOL, "the server did not open an attempt for stage %s" % stage_id)
	attempt = {"attempt_id": opened["attempt_id"], "stage_id": stage_id, "run_seed": int(opened["run_seed"])}
	return reply


## What `BattleService.run` needs from the snapshot: levels, equipped gear, skill ranks and Memory Nodes of the OWNED heroes only (a
## story-loan guest keeps its authored kit and stage level), plus the story state.
func battle_options(run_seed: int) -> Dictionary:
	var owned: Dictionary = state.story_state.owned_character_ids
	var levels: Dictionary = {}
	var ranks: Dictionary = {}
	var nodes: Dictionary = {}
	for character_id: String in state.roster_ids():
		if not owned.has(character_id):
			continue
		if state.level(character_id) > 1:
			levels[character_id] = state.level(character_id)
		var skill_ranks: Dictionary = state.skill_ranks(character_id)
		if not skill_ranks.is_empty():
			ranks[character_id] = skill_ranks
		var unlocked: int = state.memory(character_id)[1]
		if unlocked > 0:
			nodes[character_id] = unlocked
	# An unequipped weapon is passed as an explicit `weapon_id: null` (the engine's default for a missing key is the signature weapon).
	var loadouts: Dictionary = {}
	for table: String in PlayerState.EQUIPMENT_TABLES:
		for record: Dictionary in state.instances(table):
			var character_id: Variant = record["equipped_character_id"]
			if character_id == null or not owned.has(character_id):
				continue
			if not loadouts.has(character_id):
				loadouts[character_id] = {"weapon_id": null, "armor_id": null, "accessory_ids": [], "rolled_accessories": []}
			var loadout: Dictionary = loadouts[character_id]
			if table == "inventory_weapons":
				loadout["weapon_id"] = record["template_id"]
				loadout["weapon_level"] = int(record["level"])
			elif table == "inventory_armor":
				loadout["armor_id"] = record["template_id"]
				loadout["armor_level"] = int(record["level"])
			else:
				(loadout["accessory_ids"] as Array).append(record["template_id"])
				(loadout["rolled_accessories"] as Array).append(record["payload"] if record["payload"] != null else {})
	return {
		"story_state": state.story_state,
		"player_levels": levels,
		"equipment": loadouts,
		"skill_ranks": ranks,
		"memory_nodes": nodes,
		"run_seed": run_seed,
	}


## `battle_options` rebuilt from the inputs an attempt froze on the server (`AttemptInputs`: owned heroes, levels, loadouts, skill ranks,
## Memory Nodes), so a resumed battle runs exactly what the server re-simulates even if the build changed since. JSON numbers become ints
## where `battle_options` has ints.
func frozen_battle_options(inputs: Dictionary, run_seed: int) -> Dictionary:
	var story_dict: Dictionary = rules.story.to_persisted_dict(state.story_state)
	story_dict["owned_character_ids"] = inputs.get("owned_character_ids", []) if inputs.get("owned_character_ids") is Array else []
	var story: StoryState.PlayerStoryState = rules.story.from_persisted_dict(story_dict)
	var ints: Callable = func(values: Variant) -> Dictionary:
		var result: Dictionary = {}
		if values is Dictionary:
			for key: String in values:
				result[key] = int((values as Dictionary)[key])
		return result
	var ranks: Dictionary = {}
	var raw_ranks: Variant = inputs.get("skill_ranks")
	if raw_ranks is Dictionary:
		for character_id: String in raw_ranks:
			ranks[character_id] = ints.call((raw_ranks as Dictionary)[character_id])
	var loadouts: Dictionary = {}
	var raw_equipment: Variant = inputs.get("equipment")
	if raw_equipment is Dictionary:
		for character_id: String in raw_equipment:
			var loadout: Dictionary = ((raw_equipment as Dictionary)[character_id] as Dictionary).duplicate(true)
			for level_key: String in ["weapon_level", "armor_level"]:
				if loadout.has(level_key):
					loadout[level_key] = int(loadout[level_key])
			loadouts[character_id] = loadout
	return {
		"story_state": story,
		"player_levels": ints.call(inputs.get("player_levels")),
		"equipment": loadouts,
		"skill_ranks": ranks,
		"memory_nodes": ints.call(inputs.get("memory_nodes")),
		"run_seed": run_seed,
	}


## Starts the battle of `stage_id` on a worker thread with the seed of the attempt `begin_stage` opened. `roster` null = the default party
## (`auto_roster`). The main thread polls `WorkerJob.is_finished()`, then hands `finish()` and the same `roster` to `complete_battle`. A
## resumed attempt runs on the inputs the server froze.
func start_battle(stage_id: String, roster: Variant, run_seed: int, interactive: bool = false) -> WorkerJob:
	var chosen: Array = auto_roster(stage_id) if roster == null else (roster as Array).duplicate()
	var frozen: Variant = attempt.get("inputs") if attempt.get("stage_id") == stage_id and attempt.get("run_seed") == run_seed else null
	var options: Dictionary = frozen_battle_options(frozen, run_seed) if frozen is Dictionary else battle_options(run_seed)
	var service: BattleService = battle_service
	if interactive:
		options["deferred"] = true
	return WorkerJob.start(func() -> Variant: return service.run(stage_id, chosen, options))


## Reports a finished battle (coroutine). A victory goes to the server, which re-runs the attempt, decides what it is worth and replies with
## the new snapshot; `state` moves only then. A victory whose report got no reply stays `unreported` with its attempt (`report_again`). A
## defeat gives the attempt up on the server (best effort: a failure leaves it open, which costs nothing).
func complete_battle(result: BattleService.BattleResult) -> StageOutcome:
	var outcome: StageOutcome = StageOutcome.new()
	outcome.battle = result
	outcome.story_state = state.story_state
	if not result.error.is_empty():
		outcome.error = result.error
		outcome.error_kind = ERROR_BATTLE
		return outcome
	if result.outcome != "victory":
		if not attempt.is_empty() and attempt.get("stage_id") == result.stage_id and attempt.get("run_seed") == result.run_seed:
			_adopt(await backend.abandon_attempt(String(attempt["attempt_id"])))
		attempt = {}
		return outcome
	if stage(result.stage_id) == null:
		outcome.error = "Unknown stage_id '%s'" % result.stage_id
		outcome.error_kind = ERROR_FLOW
		return outcome
	if attempt.get("stage_id") != result.stage_id or attempt.get("run_seed") != result.run_seed:
		outcome.error = "No open attempt matches the battle of stage %s" % result.stage_id
		outcome.error_kind = ERROR_FLOW
		return outcome
	var client_result: Dictionary = {"outcome": result.outcome, "stars": result.stars, "actions": result.actions, "cycles": result.cycles}
	if not result.combat_mode.is_empty():
		client_result["combat_mode"] = result.combat_mode
		client_result["manual_commands"] = result.manual_commands.duplicate(true)
	var reported: Outcome = _adopt(await backend.submit_victory(String(attempt["attempt_id"]), client_result))
	if not reported.is_ok() and reported.error_kind == GameBackend.KIND_OFFLINE:
		unreported = result
		outcome.error = reported.error
		outcome.error_kind = reported.error_kind
		return outcome
	attempt = {}
	unreported = null
	if not reported.is_ok():
		outcome.error = reported.error
		outcome.error_kind = reported.error_kind
		return outcome
	var value: Dictionary = reported.value
	outcome.applied = value.get("applied", []) if value.get("applied") is Array else []
	outcome.story_state = state.story_state
	outcome.first_clear = bool(value.get("first_clear", false))
	return outcome


## Sends the unreported victory again (coroutine): the same request, so a report that did commit is replayed, never paid twice.
func report_again() -> StageOutcome:
	if unreported == null:
		var none: StageOutcome = StageOutcome.new()
		none.story_state = state.story_state
		none.error = "There is no unreported victory"
		none.error_kind = ERROR_FLOW
		return none
	return await complete_battle(unreported)


## The battle the server still holds open (after a restart, INF-014); {} = none. See `PlayerState.open_attempt`.
func open_attempt() -> Dictionary:
	return state.open_attempt() if state != null else {}


## Takes the snapshot's open attempt as the battle in progress, so `start_battle` re-runs it on the server's frozen inputs and
## `complete_battle` reports it. False when there is none.
func resume_open_attempt() -> bool:
	var open: Dictionary = open_attempt()
	if open.is_empty():
		return false
	attempt = open
	unreported = null
	return true


## Gives the snapshot's open attempt up (the player chose not to resume it; coroutine).
func abandon_open_attempt() -> Outcome:
	var open: Dictionary = open_attempt()
	if open.is_empty():
		return Outcome.ok()
	attempt = {}
	return _adopt(await backend.abandon_attempt(String(open["attempt_id"])))


## Runs and reports one attempt, waiting for the worker (headless tests, tools; coroutine). Screens use `start_battle` and poll.
func run_stage(stage_id: String, roster: Variant = null) -> StageOutcome:
	var opened: Outcome = await begin_stage(stage_id, roster)
	if not opened.is_ok():
		var refused: StageOutcome = StageOutcome.new()
		refused.story_state = state.story_state
		refused.error = opened.error
		refused.error_kind = opened.error_kind
		return refused
	var job: WorkerJob = start_battle(stage_id, roster, int(attempt["run_seed"]))
	var result: BattleService.BattleResult = job.finish() as BattleService.BattleResult
	return await complete_battle(result)


# -- team, skills and inventory (the hub's menus) -----------------------------------------------------


func wallet() -> Dictionary:
	return state.wallet()


func item_name(item_id: String) -> String:
	var item: ContentModels.Item = registry.items.get(item_id)
	return item.name_en if item != null else item_id


## Every owned hero with level, XP, ascension and Memory Node state, by id.
func team() -> Array[GameViews.TeamMember]:
	var members: Array[GameViews.TeamMember] = []
	var total_nodes: int = rules.progression.memory_nodes().size()
	for character_id: String in _owned_ids():
		var character: ContentModels.Character = registry.characters.get(character_id)
		if character == null:
			continue
		var info: Dictionary = state.progress(character_id)
		var memory: Array[int] = state.memory(character_id)
		var member: GameViews.TeamMember = GameViews.TeamMember.new()
		member.character_id = character_id
		member.name_en = character.name_en
		member.rarity = character.rarity
		member.level = info["level"]
		member.xp = info["xp"]
		member.xp_to_next = info["xp_to_next"]
		member.ascension = info["ascension"]
		member.level_cap = info["level_cap"]
		member.next_level_silver_crowns = info["level_up_silver_crowns"]
		member.memory_shards = memory[0]
		member.memory_nodes = memory[1]
		member.memory_total = total_nodes
		members.append(member)
	return members


## The character XP items with what each is worth and how many the player has.
func xp_items() -> Array[GameViews.XpItem]:
	var items: Array[GameViews.XpItem] = []
	for item_id: String in rules.character_xp:
		var row: GameViews.XpItem = GameViews.XpItem.new()
		row.item_id = item_id
		row.name_en = item_name(item_id)
		row.xp_each = int(rules.character_xp[item_id])
		row.owned = state.item_quantity(item_id)
		items.append(row)
	return items


## Spends one `item_id` on `character_id` (as many levels as that pays for; coroutine). `value` on success: the server's level-up result.
func level_up(character_id: String, item_id: String) -> Outcome:
	return _adopt(await backend.level_up(character_id, {item_id: 1}))


## The hero's skills with rank and the next upgrade's cost.
func skill_rows(character_id: String) -> Array[GameViews.SkillRow]:
	var rows: Array[GameViews.SkillRow] = []
	var character: ContentModels.Character = registry.characters.get(character_id)
	if character == null:
		return rows
	for skill: ContentModels.Skill in character.skills:
		var row: GameViews.SkillRow = GameViews.SkillRow.new()
		row.skill_id = skill.skill_id
		row.name_en = skill.name_en
		row.type = skill.type
		row.rank = state.skill_rank(character_id, skill.skill_id)
		row.max_rank = rules.progression.skill_max_rank(skill.type)
		var need: Progression.SkillUpgradeRequirement = rules.progression.skill_upgrade_requirement(skill.type, row.rank)
		if need != null:
			row.has_next = true
			row.next_level = need.required_character_level
			row.next_silver_crowns = need.silver_crowns
			row.next_item_id = need.item_id
			row.next_item_name = item_name(need.item_id) if not need.item_id.is_empty() else ""
			row.next_item_quantity = need.item_quantity
		rows.append(row)
	return rows


## Coroutine.
func upgrade_skill(character_id: String, skill_id: String) -> Outcome:
	return _adopt(await backend.upgrade_skill(character_id, skill_id))


## Memory Shards belong to the server (economy authority A); coroutine.
func unlock_memory_node(character_id: String) -> Outcome:
	return _adopt(await backend.unlock_memory_node(character_id))


## Every owned equipment instance, weapons then armor then accessories, each in acquisition order.
func inventory() -> Array[GameViews.InventoryEntry]:
	var entries: Array[GameViews.InventoryEntry] = []
	for table: String in PlayerState.EQUIPMENT_TABLES:
		for record: Dictionary in state.instances(table):
			var entry: GameViews.InventoryEntry = _inventory_entry(table, record)
			if entry != null:
				entries.append(entry)
	return entries


func _inventory_entry(table: String, record: Dictionary) -> GameViews.InventoryEntry:
	var entry: GameViews.InventoryEntry = GameViews.InventoryEntry.new()
	entry.table = table
	entry.instance_id = str(record["instance_id"])
	entry.template_id = str(record["template_id"])
	entry.locked = bool(record["locked"])
	var owner: Variant = record["equipped_character_id"]
	if owner != null:
		entry.equipped_character_id = str(owner)
		var owner_character: ContentModels.Character = registry.characters.get(entry.equipped_character_id)
		entry.equipped_character_name = owner_character.name_en if owner_character != null else entry.equipped_character_id
	var parts: PackedStringArray = PackedStringArray()
	match table:
		"inventory_weapons":
			var weapon: ContentModels.Weapon = registry.weapons.get(entry.template_id)
			if weapon == null:
				return null
			entry.name_en = weapon.name_en
			entry.kind = "weapon"
			entry.rarity = weapon.rarity
			entry.level = int(record["level"])
			entry.slot = "weapon"
			for stat: String in weapon.base_stats_level_1:
				if not (weapon.base_stats_level_1[stat] is String):
					parts.append("%s %s" % [stat, GameViews.number_text(weapon.base_stats_level_1[stat])])
			entry.can_dismantle = weapon.dismantle_allowed and entry.equipped_character_id.is_empty() and not entry.locked
			entry.can_level_up = entry.level < weapon.level_cap
		"inventory_armor":
			var armor: ContentModels.Armor = registry.armors.get(entry.template_id)
			if armor == null:
				return null
			entry.name_en = armor.name_en
			entry.kind = "armor"
			entry.rarity = armor.rarity
			entry.level = int(record["level"])
			entry.slot = "armor"
			for stat: String in armor.base_stats_level_1:
				parts.append("%s %s" % [stat, GameViews.number_text(armor.base_stats_level_1[stat])])
			entry.can_level_up = entry.level < armor.level_cap
		_:
			var template: ContentModels.AccessoryTemplate = registry.accessories.get(entry.template_id)
			if template == null:
				return null
			entry.name_en = template.name_en
			entry.kind = "accessory"
			entry.rarity = template.rarity
			entry.slot = str(record["equip_slot"])
			var payload: Dictionary = record["payload"] if record["payload"] is Dictionary else {}
			var stat_rows: Array = []
			if payload.get("main_stat") is Dictionary:
				stat_rows.append(payload["main_stat"])
			if payload.get("sub_stats") is Array:
				stat_rows.append_array(payload["sub_stats"])
			for row: Variant in stat_rows:
				if row is Dictionary:
					parts.append("%s %s" % [str((row as Dictionary).get("stat_id")), GameViews.number_text((row as Dictionary).get("value"))])
			entry.can_reroll = bool(payload.get("is_rerollable", false)) and not entry.locked
	entry.stats_text = ", ".join(parts)
	return entry


# Every equipment change below is a coroutine answered with the new snapshot.


func equip(table: String, instance_id: String, character_id: String) -> Outcome:
	return _adopt(await backend.equip(table, instance_id, character_id))


func unequip(table: String, instance_id: String) -> Outcome:
	return _adopt(await backend.unequip(table, instance_id))


func set_locked(table: String, instance_id: String, locked: bool) -> Outcome:
	return _adopt(await backend.set_locked(table, instance_id, locked))


func dismantle_weapon(instance_id: String) -> Outcome:
	return _adopt(await backend.dismantle_weapon(instance_id))


## One level of a weapon or armor (Weapon Tempering XP, Silver Crowns, Rivets on milestones).
func level_up_equipment(table: String, instance_id: String) -> Outcome:
	return _adopt(await backend.level_up_equipment(table, instance_id))


func reroll_accessory(instance_id: String) -> Outcome:
	return _adopt(await backend.reroll_accessory(instance_id))


# -- social (INF-037; port of friends_overview / friend_action of the LEGACY client/game_controller.py) ---------------


## The friends screen's content: the own profile and every friend and request (coroutine). `value`: GameViews.FriendsView.
func friends_overview() -> Outcome:
	var account: Outcome = await backend.fetch_account()
	if not account.is_ok():
		return account
	var view: GameViews.FriendsView = _friends_view_profile(account.value)
	var cursor: String = ""
	# The server pages 100 at a time; the friend and request limits keep the whole list to a few pages.
	for page: int in 5:
		var listed: Outcome = await backend.friends(cursor)
		if not listed.is_ok():
			return listed
		var reply: Dictionary = listed.value
		if not (reply.get("items") is Array):
			return Outcome.fail(ERROR_PROTOCOL, "the friends reply carries no list")
		for item: Variant in reply["items"]:
			if item is Dictionary:
				view.rows.append(_friend_row(item))
		var counts: Variant = reply.get("counts")
		var limits: Variant = reply.get("limits")
		view.friend_count = int((counts as Dictionary).get("friends", 0)) if counts is Dictionary else 0
		view.friend_limit = int((limits as Dictionary).get("friends", 0)) if limits is Dictionary else 0
		cursor = str(reply["next_cursor"]) if reply.get("next_cursor") is String else ""
		if cursor.is_empty():
			break
	return Outcome.ok(view)


static func _friends_view_profile(profile: Variant) -> GameViews.FriendsView:
	var view: GameViews.FriendsView = GameViews.FriendsView.new()
	var data: Dictionary = profile if profile is Dictionary else {}
	view.friend_code = str(data.get("friend_code", ""))
	view.nickname = str(data.get("nickname", ""))
	view.presence_opt_in = bool(data.get("presence_opt_in", true))
	var next_change: Variant = data.get("nickname_change_available_at_utc")
	view.nickname_change_available_at = str(next_change) if next_change is String else ""
	return view


static func _friend_row(item: Dictionary) -> GameViews.FriendRow:
	var row: GameViews.FriendRow = GameViews.FriendRow.new()
	row.account_id = str(item.get("account_id", ""))
	row.nickname = str(item.get("nickname", ""))
	row.player_level = int(item.get("player_level", 1))
	row.presence = str(item.get("presence", "offline"))
	row.relationship = str(item.get("relationship", ""))
	row.request_id = str(item["request_id"]) if item.get("request_id") is String else ""
	return row


## One friends-screen action (coroutine): "add" (`argument` = the typed friend code), "accept" / "reject" / "cancel"
## (a request), "remove", "block", "report" (`argument` = the reason key) for `row`.
func friend_action(action: String, row: GameViews.FriendRow, argument: String = "") -> Outcome:
	match action:
		"add":
			return await backend.send_friend_request(argument)
		"accept", "reject", "cancel":
			return await backend.answer_friend_request(row.request_id, action)
		"remove":
			return await backend.remove_friend(row.account_id)
		"block":
			return await backend.block_player(row.account_id)
		"report":
			return await backend.report_player(row.account_id, argument)
	return Outcome.fail(ERROR_PROTOCOL, "unknown friend action %s" % action)


func update_profile(changes: Dictionary) -> Outcome:
	return await backend.update_profile(changes)


## `value`: Array of {"account_id", "nickname"} the player blocked.
func blocked_players() -> Outcome:
	var reply: Outcome = await backend.blocked_players()
	if not reply.is_ok():
		return reply
	var items: Variant = (reply.value as Dictionary).get("items")
	return Outcome.ok(items if items is Array else [])


func unblock_player(account_id: String) -> Outcome:
	return await backend.unblock_player(account_id)


# -- the Eclipse Blessing (INF-036; the server pays, the reply carries the new state) -----------------------------------


## The authored Eclipse Blessing (economy_part1.json `subscription`): {"id", "duration_days", "instant_eclipse_token",
## "halfday_entitlement_token", "halfday_entitlement_count", "expected_total_eclipse_token", ...}.
func blessing_rules() -> Dictionary:
	var subscription: Variant = rules.quest.economy().get("subscription")
	return subscription if subscription is Dictionary else {}


func verify_subscription(purchase_token: String) -> Outcome:
	return _adopt(await backend.subscription_verify(purchase_token))


func claim_subscription_window(window_id: int) -> Outcome:
	return _adopt(await backend.subscription_claim(window_id))


# -- gacha and quests (server-authoritative; ports of the gacha/quest parts of client/game_controller.py) -------------


## The open banners, display-ready (coroutine). `value` on success: Array[GameViews.BannerView].
func gacha_banners() -> Outcome:
	var reply: Outcome = await backend.gacha_banners()
	if not reply.is_ok():
		return reply
	var rows: Variant = (reply.value as Dictionary).get("banners")
	if not (rows is Array):
		return Outcome.fail(ERROR_PROTOCOL, "the banner reply carries no banner list")
	var views: Array[GameViews.BannerView] = []
	for row: Variant in rows:
		if row is Dictionary:
			views.append(_banner_view(row))
	return Outcome.ok(views)


## Every rarity's chance per pull, the guarantees and the featured share of a banner type, as Google Play's policy on
## randomized items asks before a purchase (economy_part1.json `banners`; the server rolls with the same data).
func banner_odds(banner_type: String) -> PackedStringArray:
	var banners: Dictionary = rules.quest.economy().get("banners", {})
	var lines: PackedStringArray = PackedStringArray()
	var config_key: String = {"character": "character", "weapon": "weapon", "standard_character": "standard_character"}.get(banner_type, "")
	var config: Dictionary = banners.get(config_key, {}) if banners.get(config_key) is Dictionary else {}
	if config.is_empty():
		return lines
	var five: float = float(config.get("base_five_star_rate", config.get("five_star_base_rate", 0.0)))
	var hard: int = int(config.get("hard_pity", 0))
	var rate_line: String = "Odds per pull: 5★ %s%%, 4★ %s%%, 3★ %s%%." % [_percent(five), _percent(float(config.get("four_star_rate", 0.0))),
		_percent(float(config.get("three_star_rate", 0.0)))]
	lines.append(rate_line)
	if config.has("soft_pity_start_pull"):
		var start: int = int(config["soft_pity_start_pull"])
		lines.append("From pull %d without a 5★, the 5★ chance rises by %s percentage points each pull (4★ and 3★ share the rest as before); pull %d is a guaranteed 5★." % [
			start, GameViews.number_text(config.get("soft_pity_increment_percentage_points", 0)), hard])
	else:
		lines.append("The 5★ chance stays the same; pull %d without a 5★ is a guaranteed 5★." % hard)
	lines.append("At least one 4★ or better every %d pulls." % int(config.get("minimum_four_star_or_better_every_n_pulls", 10)))
	match banner_type:
		"character":
			lines.append("A 5★ is the featured character %s%% of the time; after a 5★ that is not, the next 5★ is the featured character. Otherwise it is a 5★ from the Hall of Ancestors (%s)." % [
				_percent(float(config.get("featured_chance_on_five_star", 0.0))), ", ".join(_standard_five_star_names(banners))])
		"weapon":
			lines.append("A 5★ is your selected weapon %s%% of the time. Each other 5★ gives a Fate Knot; with %d Fate Knots the next 5★ is your selected weapon (at most %d pulls in all)." % [
				_percent(float(config.get("selected_target_chance_on_unprotected_five_star", 0.0))), int(config.get("fate_knots_to_guarantee", 2)),
				int(config.get("worst_case_pulls_for_target", 0))])
		"standard_character":
			lines.append("5★ characters in this hall, equally likely: %s." % ", ".join(_standard_five_star_names(banners)))
	return lines


func _standard_five_star_names(banners: Dictionary) -> PackedStringArray:
	var names: PackedStringArray = PackedStringArray()
	var standard: Variant = banners.get("standard_character")
	for character_id: Variant in ((standard as Dictionary).get("five_star_character_ids", []) if standard is Dictionary else []):
		names.append(_name_of(str(character_id)))
	return names


## 0.1691326 -> "16.91", 0.025 -> "2.5".
static func _percent(fraction: float) -> String:
	return GameViews.number_text(roundf(fraction * 10000.0) / 100.0)


func _banner_view(row: Dictionary) -> GameViews.BannerView:
	var view: GameViews.BannerView = GameViews.BannerView.new()
	view.banner_id = str(row.get("banner_id", ""))
	view.banner_type = str(row.get("banner_type", ""))
	view.pull_cost = int(row.get("pull_cost", 1))
	var next_pull: Variant = row.get("next_pull")
	view.five_star_percent = roundf(float((next_pull as Dictionary).get("five_star", 0.0)) * 10000.0) / 100.0 if next_pull is Dictionary else 0.0
	view.pity = int(row.get("pity", 0))
	view.hard_pity = int(row.get("hard_pity", 0))
	var guarantee: Variant = row.get("guarantee")
	view.guarantee = str((guarantee as Dictionary).get("text", "")) if guarantee is Dictionary else ""
	view.closes_at = str(row["closes_at"]) if row.get("closes_at") != null else ""
	view.selected_target = str(row["selected_target_id"]) if row.get("selected_target_id") != null else ""
	view.odds = banner_odds(view.banner_type)
	var pair_id: String = view.banner_id.get_slice(":", 1) if view.banner_id.contains(":") else ""
	var pair: Dictionary = _signature_pair(pair_id)
	match view.banner_type:
		"character":
			view.featured_name = _name_of(str(pair.get("character_id", "")))
			view.title = "Oath: %s" % view.featured_name
		"weapon":
			if view.banner_id == "hall_of_armaments":
				view.title = "Hall of Armaments"
				var target_ids: Variant = row.get("target_ids")
				for weapon_id: Variant in (target_ids if target_ids is Array else []):
					view.targets.append({"id": str(weapon_id), "name": _name_of(str(weapon_id))})
			else:
				view.featured_name = _name_of(str(pair.get("weapon_id", "")))
				view.title = "Arms: %s" % view.featured_name
		_:
			view.title = "Hall of Ancestors"
	return view


func _signature_pair(pair_id: String) -> Dictionary:
	var banners: Variant = rules.quest.economy().get("banners")
	var pairs: Variant = (banners as Dictionary).get("signature_pairs") if banners is Dictionary else null
	for pair: Variant in (pairs if pairs is Array else []):
		if pair is Dictionary and str((pair as Dictionary).get("banner_id", "")) == pair_id:
			return pair
	return {}


## A character's or weapon's display name (the id when the content does not know it).
func _name_of(content_id: String) -> String:
	var character: ContentModels.Character = registry.characters.get(content_id)
	if character != null:
		return character.name_en
	var weapon: ContentModels.Weapon = registry.weapons.get(content_id)
	return weapon.name_en if weapon != null else content_id


## Pulls `count` times on `banner_id` (coroutine); `target_id` is the Hall of Armaments target ("" = none). `value` on success: the server
## reply, whose new snapshot is adopted; `pull_entries(value)` turns it into result rows.
func gacha_pull(banner_id: String, count: int, target_id: String = "") -> Outcome:
	return _adopt(await backend.gacha_pull(banner_id, count, target_id))


func pull_entries(reply_value: Dictionary) -> Array[GameViews.PullEntry]:
	var entries: Array[GameViews.PullEntry] = []
	var pull: Variant = reply_value.get("pull")
	var results: Variant = (pull as Dictionary).get("results") if pull is Dictionary else null
	for row: Variant in (results if results is Array else []):
		if not (row is Dictionary):
			continue
		var result: Dictionary = row
		var grant: Dictionary = result["grant"] if result.get("grant") is Dictionary else {}
		var entry: GameViews.PullEntry = GameViews.PullEntry.new()
		entry.rarity = int(result.get("rarity", 3))
		entry.name_en = _name_of(str(result.get("reward_id", "")))
		entry.duplicate = bool(grant.get("duplicate", false))
		entry.is_new = not grant.is_empty() and not entry.duplicate
		entry.memory_shards = int(grant.get("memory_shards", 0))
		entry.featured = result.get("is_featured") == true
		entries.append(entry)
	return entries


## One page of the account's pulls, newest first (coroutine). `value` on success: {"lines": Array[String], "next_cursor": int (0 = last
## page)}.
func gacha_history(before: int = 0, limit: int = 50) -> Outcome:
	var reply: Outcome = await backend.gacha_history(limit, before)
	if not reply.is_ok():
		return reply
	var page: Dictionary = reply.value
	var lines: Array[String] = []
	var items: Variant = page.get("items")
	for item: Variant in (items if items is Array else []):
		if not (item is Dictionary):
			continue
		var row: Dictionary = item
		var marks: PackedStringArray = PackedStringArray()
		if row.get("is_featured") == true:
			marks.append("featured")
		if row.get("hard_pity_triggered") == true:
			marks.append("pity")
		var stamp: String = str(row.get("created_at_utc", "")).substr(0, 16).replace("T", " ")
		var line: String = "%s  %d★ %s" % [stamp, int(row.get("rarity", 0)), _name_of(str(row.get("reward_id", "")))]
		if not marks.is_empty():
			line += "  (%s)" % ", ".join(marks)
		lines.append(line)
	var cursor: Variant = page.get("next_cursor")
	return Outcome.ok({"lines": lines, "next_cursor": int(cursor) if cursor != null else 0})


## Daily tasks, the window chest, the active weekly segment and unclaimed weekly mail, with their claim state (coroutine). Progress and
## claims are the server's (`GET /v1/quests/status`); titles and rewards come from economy_part1.json. `value`: Array[GameViews.QuestRow].
func quest_rows() -> Outcome:
	var reply: Outcome = await backend.quest_status()
	if not reply.is_ok():
		return reply
	var scope: Dictionary = reply.value
	var economy: Dictionary = rules.quest.economy()
	var schedule: Dictionary = economy.get("daily_schedule", {})
	var weekly: Dictionary = economy.get("weekly_cycle", {})
	var claimed: Dictionary = {}
	for key: Variant in (scope.get("claimed") if scope.get("claimed") is Array else []):
		claimed[str(key)] = true
	var progress: Dictionary = {}
	for list_key: String in ["daily_tasks", "weekly_tasks"]:
		for task: Variant in (scope.get(list_key) if scope.get(list_key) is Array else []):
			if task is Dictionary:
				progress[str(task["task_id"])] = [int(task["progress"]), int(task["target"])]
	var daily_prefix: String = "daily:%d:" % int(scope.get("daily_cycle_id", 0))
	var rows: Array[GameViews.QuestRow] = []
	for task: Variant in (schedule.get("tasks") if schedule.get("tasks") is Array else []):
		if not (task is Dictionary) or progress.get(str(task["id"])) == null:
			continue  # only counted tasks (the rewarded-ad task has its own flow)
		var counts: Array = progress[str(task["id"])]
		rows.append(_quest_row("daily", str(task["id"]), str(task["id"]).capitalize(), counts[0], counts[1],
				_quest_state(claimed.has(daily_prefix + str(task["id"])), counts[0] >= counts[1]), task))
	var chest: Dictionary = schedule.get("window_completion", {})
	var required: Array = chest.get("requires", [])
	var required_claimed: int = required.filter(func(task_id: Variant) -> bool: return claimed.has(daily_prefix + str(task_id))).size()
	rows.append(_quest_row("daily", "window_completion", "Window Completion Chest", required_claimed, required.size(),
			_quest_state(claimed.has(daily_prefix + "window_completion"), required_claimed == required.size()), chest))
	var segments: Array = weekly.get("segments", [])
	var active_id: String = str(scope.get("weekly_segment", ""))
	for segment: Variant in segments:
		if segment is Dictionary and str(segment["id"]) == active_id:
			var counts: Array = progress.get("weekly:" + active_id, [0, int((segment["objective"] as Dictionary).get("count", 0))])
			rows.append(_quest_row("weekly", active_id, "Weekly: %s" % str(segment.get("focus", active_id)).capitalize(), counts[0], counts[1],
					_quest_state(claimed.has("weekly:%s:%s" % [str(scope.get("weekly_key", "")), active_id]), counts[0] >= counts[1]), segment))
	for mail: Variant in (scope.get("mail") if scope.get("mail") is Array else []):
		if not (mail is Dictionary) or mail.get("claimed") == true:
			continue
		var segment_row: Dictionary = {}
		for segment: Variant in segments:
			if segment is Dictionary and str(segment["id"]) == str(mail["segment"]):
				segment_row = segment
		var row: GameViews.QuestRow = _quest_row("weekly", str(mail["segment"]),
				"Mail: %s (week of %s)" % [str(segment_row.get("focus", mail["segment"])).capitalize(), str(mail["week_key"])],
				int(mail.get("progress", 0)), int(mail.get("target", 0)),
				_quest_state(false, int(mail.get("progress", 0)) >= int(mail.get("target", 0))), segment_row)
		row.period = str(mail["week_key"])
		rows.append(row)
	return Outcome.ok(rows)


static func _quest_state(is_claimed: bool, complete: bool) -> String:
	return "claimed" if is_claimed else ("claimable" if complete else "locked")


static func _quest_row(kind: String, task_id: String, title: String, done: int, target: int, state_text: String, reward: Dictionary) -> GameViews.QuestRow:
	var row: GameViews.QuestRow = GameViews.QuestRow.new()
	row.kind = kind
	row.task_id = task_id
	row.title = title
	row.progress = done
	row.target = target
	row.state = state_text
	row.reward_text = reward_text(reward)
	return row


## "80 Eclipse Tokens, 1,500 Character XP, 10,000 Silver Crowns" from a reward row (`_reward_text`).
static func reward_text(reward: Dictionary) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for pair: Array in [["eclipse_token", "Eclipse Tokens"], ["character_xp", "Character XP"], ["silver_crown", "Silver Crowns"], ["account_xp", "Account XP"]]:
		var amount: int = int(reward.get(pair[0], 0))
		if amount != 0:
			parts.append("%s %s" % [grouped(amount), pair[1]])
	return ", ".join(parts)


## 12345 -> "12,345" (Python's `{:,}`).
static func grouped(value: int) -> String:
	var digits: String = str(absi(value))
	var out: String = ""
	while digits.length() > 3:
		out = "," + digits.substr(digits.length() - 3) + out
		digits = digits.substr(0, digits.length() - 3)
	return ("-" if value < 0 else "") + digits + out


## Claims a quest reward (coroutine); `period` is a mail row's week ("" = current). `value` on success: the server's claim result.
func claim_quest(kind: String, task_id: String, period: String = "") -> Outcome:
	return _adopt(await backend.claim_quest(kind, task_id, period))


## The notices running now and the account's open mail (INF-035, coroutine). `value`: {"notices": [{"title", "body"}],
## "mail": Array[GameViews.MailRow]}. Notices are best effort: when they cannot be read the mail is still shown.
func mailbox() -> Outcome:
	var listed: Outcome = await backend.mail()
	if not listed.is_ok():
		return listed
	var raw: Variant = (listed.value as Dictionary).get("mail")
	if not (raw is Array):
		return Outcome.fail(ERROR_PROTOCOL, "the mail reply carries no mail list")
	var rows: Array[GameViews.MailRow] = []
	for entry: Variant in raw:
		if not (entry is Dictionary):
			continue
		var mail: Dictionary = entry
		var row: GameViews.MailRow = GameViews.MailRow.new()
		row.mail_id = str(mail.get("mail_id", ""))
		row.title = str(mail.get("title_en", ""))
		row.body = str(mail.get("body_en", ""))
		row.reward_text = mail_reward_text(mail.get("rewards") if mail.get("rewards") is Dictionary else {})
		row.expires_at = str(mail.get("expires_at_utc", "")).left(16).replace("T", " ")
		row.claimed = mail.get("claimed") == true
		rows.append(row)
	var notices: Array[Dictionary] = []
	var live: Outcome = await backend.liveops()
	if live.is_ok() and (live.value as Dictionary).get("notices") is Array:
		for notice: Variant in (live.value as Dictionary)["notices"]:
			if notice is Dictionary:
				notices.append({"title": str((notice as Dictionary).get("title_en", "")), "body": str((notice as Dictionary).get("body_en", ""))})
	return Outcome.ok({"notices": notices, "mail": rows})


## "1,000 Silver Crowns, 50 Eclipse Tokens, 3× Ember Shard" from a mail's rewards ("" when it has none).
func mail_reward_text(rewards: Dictionary) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for pair: Array in [["silver_crowns", "Silver Crowns"], ["eclipse_tokens", "Eclipse Tokens"]]:
		var amount: int = int(rewards.get(pair[0], 0))
		if amount > 0:
			parts.append("%s %s" % [grouped(amount), pair[1]])
	var items: Variant = rewards.get("items")
	if items is Dictionary:
		var ids: Array = (items as Dictionary).keys()
		ids.sort()
		for item_id: Variant in ids:
			parts.append("%s× %s" % [grouped(int((items as Dictionary)[item_id])), item_name(str(item_id))])
	return ", ".join(parts)


## Claims one mail (coroutine); the reply's snapshot is adopted. `value`: {"mail_id", "granted", "state"}.
func claim_mail(mail_id: String) -> Outcome:
	return _adopt(await backend.claim_mail(mail_id))


## Today's Inn Meal (coroutine); the reply's snapshot is adopted.
func claim_inn_meal() -> Outcome:
	return _adopt(await backend.claim_inn_meal())


## Eclipse Tokens one Fate's Thread costs (economy_part1.json `currencies[fates_thread].token_conversion_cost`; 0 = none).
func fate_thread_token_cost() -> int:
	for currency: Variant in (rules.quest.economy().get("currencies") if rules.quest.economy().get("currencies") is Array else []):
		if currency is Dictionary and str((currency as Dictionary).get("id", "")) == "fates_thread":
			return int((currency as Dictionary).get("token_conversion_cost", 0))
	return 0


## Eclipse Tokens -> `count` Fate's Threads on the server (coroutine); the reply's snapshot is adopted.
func convert_fate_threads(count: int) -> Outcome:
	return _adopt(await backend.convert_fate_threads(count))
