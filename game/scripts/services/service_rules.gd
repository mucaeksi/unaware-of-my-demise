class_name ServiceRules
extends RefCounted
## The content-derived rules the persistence services need beyond the typed registry: the domain objects (`Progression`,
## `QuestProgress`, `StoryState`, `Equipment`, `AccessoryRoller`) plus the few values the reference reads straight from the packs
## (`items_part1.json` progression_rules, the equipment XP resource id, the item stack caps). Built once per content load.

var registry: ContentModels.ContentRegistry = null
var progression: Progression = null
var quest: QuestProgress = null
var story: StoryState = null
var equipment: Equipment = null
var accessory_roller: AccessoryRoller = null

## item_id -> Character XP one such Chronicle item is worth (items_part1.json progression_rules.character_xp).
var character_xp: Dictionary = {}
var dismantle_resource_id: String = ""
var reroll_token_id: String = ""
var equipment_xp_resource_id: String = ""
## item_id -> stack cap (items without one are uncapped).
var stack_caps: Dictionary = {}

var error: String = ""


static func create(content_registry: ContentModels.ContentRegistry, content_dir: String) -> ServiceRules:
	var rules: ServiceRules = ServiceRules.new()
	rules.registry = content_registry
	rules.progression = Progression.create(content_registry)
	rules.quest = QuestProgress.from_content_dir(content_dir)
	rules.story = StoryState.new(content_registry, StoryState.load_manifest(content_dir))
	rules.equipment = Equipment.new(content_registry)
	rules.accessory_roller = AccessoryRoller.new(content_registry.accessories)
	if not rules.quest.error.is_empty():
		rules.error = rules.quest.error
		return rules

	var items_path: String = content_dir.path_join("items_part1.json")
	var items_pack: Variant = JSON.parse_string(FileAccess.get_file_as_string(items_path)) if FileAccess.file_exists(items_path) else null
	if not (items_pack is Dictionary):
		rules.error = "items_part1.json could not be read"
		return rules
	var progression_rules: Variant = (items_pack as Dictionary).get("progression_rules", {})
	if progression_rules is Dictionary:
		var xp_values: Variant = (progression_rules as Dictionary).get("character_xp")
		if xp_values is Dictionary:
			for item_id: String in (xp_values as Dictionary):
				rules.character_xp[item_id] = int((xp_values as Dictionary)[item_id])
		rules.dismantle_resource_id = str((progression_rules as Dictionary).get("dismantle_resource_id", ""))
		rules.reroll_token_id = str((progression_rules as Dictionary).get("reroll_token_id", ""))
	var equipment_rules: Variant = content_registry.battle_rules.get("equipment_progression", {})
	if equipment_rules is Dictionary:
		rules.equipment_xp_resource_id = str((equipment_rules as Dictionary).get("xp_resource_id", ""))
	for item: ContentModels.Item in content_registry.items.values():
		if item.stack_cap is int:
			rules.stack_caps[item.item_id] = int(item.stack_cap)
	return rules
