class_name ContentLoader
extends RefCounted
## Loads and validates the engine-neutral Part I JSON content registry (port of core/content_loader.py).
##
## Usage:
##   var loader := ContentLoader.new()
##   var registry: ContentModels.ContentRegistry = loader.load_dir("res://data/content")
##   if registry == null: push_error(loader.error)
##
## GDScript has no exceptions, so the first failed check is stored in `error` in the reference's own message format
## ("characters/x: 'age' must be an integer") and the load returns null. Checks run in the same order as in Python, so
## the first message is the same one the reference would raise.
##
## JSON numbers: Godot's parser returns every number as float, so an integer field accepts any whole number. The one
## divergence from the reference is invalid content that spells an integer as `2.0`; the Python validator rejects that
## at build time and the shipped copy is byte-identical (sha256 manifest), so it cannot occur in a build.

const PACK_FILES: Array[String] = [
	"characters_part1.json",
	"enemies_part1.json",
	"weapons_part1.json",
	"armors_part1.json",
	"accessories_part1.json",
	"items_part1.json",
	"stages_part1.json",
	"battle_rules_part1.json",
	# Needed to validate stage drop-table ids and to consume the closed EffectOp schema.
	"drop_tables_part1.json",
	"battle_effects_part1.json",
]

const _SKILL_FIELDS: Array[String] = [
	"skill_id", "name_en", "type", "effect_ops", "element", "target_rule",
	"target_selector_id", "scale_stat", "multiplier", "multipliers_pct",
	"cooldown_turns", "focus_cost", "focus_gain_rule", "description_en",
	"effect_en", "auto_priority", "ai_priority", "damage_type", "phase_ids",
	"telegraph_rules", "event_hooks", "continuous_modifiers", "brand_mark_id",
]
const _CHARACTER_FIELDS: Array[String] = [
	"character_id", "name_en", "gender", "age", "rarity", "element", "class_id",
	"combat_role", "acquisition", "banner_id", "signature_weapon_id", "equip_weapon_type", "brand_mark_id",
	"base_stats_level_1", "growth_per_level", "level_cap", "stat_formula",
	"formation_affinity", "skill_ids", "skills", "balance_status",
]
const _OBJECTIVE_FIELDS: Array[String] = [
	"objective_id", "name_en", "max_hp", "hp", "targetable_by_player",
	"persists_across_phases", "on_destroyed",
]
const _PHASE_FIELDS: Array[String] = [
	"phase_id", "name_en", "transition", "transition_hp_percent", "hp_multiplier",
	"atk_multiplier", "def_multiplier", "weaknesses", "passives", "telegraph",
	"intent_rules", "interruptible_by_control", "tauntable", "break_targets",
	"objectives", "enter_ops", "passive_ops", "signature_action_id",
]
const _ENEMY_FIELDS: Array[String] = [
	"enemy_id", "name_en", "faction_id", "role", "element", "base_stats_level_1",
	"growth_per_level", "weaknesses", "resistances", "status_immunities", "skills",
	"phases", "intent", "passive_hooks", "continuous_modifiers", "passives",
	"boss_id", "phase_ids", "drop_table_id", "brand_mark_id",
]
const _STAGE_FIELDS: Array[String] = [
	"stage_id", "chapter_id", "title_en", "node_type", "recommended_level", "enemy_level",
	"stamina_cost", "enemy_waves", "drop_table_id", "boss_id", "boss_phases",
	"phase_mechanics", "guest_characters", "story_rewards", "story_beat_en", "enemy_stat_multiplier",
]
const _WEAPON_FIELDS: Array[String] = [
	"weapon_id", "name_en", "rarity", "weapon_type", "acquisition", "banner_id",
	"owner_character_id", "level_cap", "base_stats_level_1", "growth_per_level",
	"passive_name_en", "passive_effect_en", "passive_effect_id", "dismantle_xp",
	"dismantle_output", "dismantle_allowed", "brand_mark_id", "balance_status",
]
const _ARMOR_FIELDS: Array[String] = [
	"armor_id", "name_en", "rarity", "armor_type", "slot", "brand_mark_id", "acquisition",
	"level_cap", "base_stats_level_1", "growth_per_level", "dismantle_xp",
	"dismantle_output", "dismantle_allowed", "tier_id",
]
const _ACCESSORY_FIELDS: Array[String] = [
	"accessory_id", "name_en", "rarity", "slot", "set_id", "set_name_en",
	"brand_mark_id", "possible_main_stats", "possible_sub_stats", "rarity_profiles",
	"acquisition", "drop_is_gacha", "flavor_en",
]
const _ITEM_FIELDS: Array[String] = [
	"item_id", "name_en", "kind", "rarity", "brand_mark_id", "stack_cap", "xp_value",
	"description_en", "sources", "consumable",
]
const _DROP_TABLE_FIELDS: Array[String] = ["drop_table_id", "repeatable_rewards", "first_clear_rewards"]
const _STATUS_FIELDS: Array[String] = [
	"status_id", "name_en", "kind", "default_duration_turns", "source_atk_multiplier_per_tick",
	"tags", "stacking",
]

## First failed check ("" = none). Reset by every load call.
var error: String = ""


# -- entry points ----------------------------------------------------------------------------------


## Reads the ten packs from `content_dir` (e.g. "res://data/content") and builds the registry, or returns null.
func load_dir(content_dir: String) -> ContentModels.ContentRegistry:
	error = ""
	var packs: Dictionary = {}
	for file_name: String in PACK_FILES:
		var pack: Variant = _read_pack(content_dir, file_name)
		if not error.is_empty():
			return null
		packs[file_name] = pack
	return _build(packs)


## Builds the registry from already parsed packs (`{file name: Dictionary}`); tests feed broken packs through here.
func load_packs(packs: Dictionary) -> ContentModels.ContentRegistry:
	error = ""
	for file_name: String in PACK_FILES:
		if not packs.has(file_name) or not (packs[file_name] is Dictionary):
			_fail("%s: JSON root must be an object" % file_name)
			return null
	return _build(packs)


# -- helpers: errors and reprs ----------------------------------------------------------------------


func _fail(message: String) -> void:
	if error.is_empty():
		error = message


## Python `repr` for the values that appear in reference error messages.
static func py_repr(value: Variant) -> String:
	if value == null:
		return "None"
	if value is bool:
		return "True" if value else "False"
	if value is String:
		var text: String = value
		if text.contains("'") and not text.contains("\""):
			return "\"" + text + "\""
		return "'" + text.replace("\\", "\\\\").replace("'", "\\'") + "'"
	if value is int:
		return str(value)
	if value is float:
		var number: float = value
		if is_equal_approx(number, roundf(number)) and absf(number) < 1e16:
			return "%d.0" % int(number)
		return str(number)
	if value is Array:
		var parts: PackedStringArray = PackedStringArray()
		for item: Variant in value:
			parts.append(py_repr(item))
		return "[" + ", ".join(parts) + "]"
	if value is Dictionary:
		var entries: PackedStringArray = PackedStringArray()
		for key: Variant in value:
			entries.append("%s: %s" % [py_repr(key), py_repr(value[key])])
		return "{" + ", ".join(entries) + "}"
	return str(value)


static func _label(value: Variant) -> String:
	if value == null:
		return "<unknown>"
	return str(value)


func _deep(value: Variant) -> Variant:
	if value is Dictionary or value is Array:
		return value.duplicate(true)
	return value


static func _is_whole_number(value: Variant) -> bool:
	if value is int:
		return true
	if value is float:
		var number: float = value
		return is_finite(number) and number == floorf(number)
	return false


static func _is_numeric(value: Variant) -> bool:
	return value is int or value is float


# -- helpers: pack reading and row access (core/content_loader.py 53-205) ---------------------------


func _read_pack(content_dir: String, file_name: String) -> Dictionary:
	var path: String = content_dir.path_join(file_name)
	if not FileAccess.file_exists(path):
		_fail("%s: unable to read valid UTF-8 JSON: file not found" % file_name)
		return {}
	var parser: JSON = JSON.new()
	var status: int = parser.parse(FileAccess.get_file_as_string(path))
	if status != OK:
		_fail("%s: unable to read valid UTF-8 JSON: %s (line %d)" % [file_name, parser.get_error_message(), parser.get_error_line()])
		return {}
	if not (parser.data is Dictionary):
		_fail("%s: JSON root must be an object" % file_name)
		return {}
	return parser.data


## `pack[field]` as an array of row objects; errors when it is not a JSON array or holds a non-object.
func _rows(pack: Dictionary, field: String, file_name: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var rows: Variant = pack.get(field)
	if not (rows is Array):
		_fail("%s: %s must be a JSON array" % [file_name, py_repr(field)])
		return result
	var index: int = 0
	for row: Variant in rows:
		if not (row is Dictionary):
			_fail("%s: %s[%d] must be a JSON object" % [file_name, field, index])
			return result
		result.append(row)
		index += 1
	return result


## `{stable id: row}` in file order; errors on a missing/empty id or a duplicate.
func _index_rows(rows: Array[Dictionary], id_field: String, label: String) -> Dictionary:
	var indexed: Dictionary = {}
	var index: int = 0
	for row: Dictionary in rows:
		var stable_id: Variant = row.get(id_field)
		if not (stable_id is String) or (stable_id as String).is_empty():
			_fail("%s[%d]: missing non-empty %s" % [label, index, id_field])
			return indexed
		if indexed.has(stable_id):
			_fail("%s: duplicate %s %s" % [label, id_field, py_repr(stable_id)])
			return indexed
		indexed[stable_id] = row
		index += 1
	return indexed


func _catalog_rows(pack: Dictionary, field: String, id_field: String, file_name: String) -> Dictionary:
	var rows: Array[Dictionary] = _rows(pack, field, file_name)
	var indexed: Dictionary = _index_rows(rows, id_field, "%s/%s" % [file_name, field])
	var frozen: Dictionary = {}
	for stable_id: String in indexed:
		frozen[stable_id] = _deep(indexed[stable_id])
	return frozen


## A non-empty string, or "" when `optional` and the value is absent/null.
func _text(row: Dictionary, field: String, context: String, optional: bool = false) -> String:
	var value: Variant = row.get(field)
	if optional and value == null:
		return ""
	if not (value is String) or (value as String).is_empty():
		_fail("%s: %s must be a non-empty string" % [context, py_repr(field)])
		return ""
	return value


func _integer(row: Dictionary, field: String, context: String, default: Variant = null) -> int:
	var value: Variant = row.get(field, default)
	if not _is_whole_number(value):
		_fail("%s: %s must be an integer" % [context, py_repr(field)])
		return 0
	return int(value)


func _optional_integer(row: Dictionary, field: String, context: String) -> Variant:
	var value: Variant = row.get(field)
	if value == null:
		return null
	if not _is_whole_number(value):
		_fail("%s: %s must be an integer or null" % [context, py_repr(field)])
		return null
	return int(value)


func _number(row: Dictionary, field: String, context: String) -> float:
	var value: Variant = row.get(field)
	if not _is_numeric(value):
		_fail("%s: %s must be numeric" % [context, py_repr(field)])
		return 0.0
	return float(value)


func _optional_number(row: Dictionary, field: String, context: String) -> Variant:
	var value: Variant = row.get(field)
	if value == null:
		return null
	if not _is_numeric(value):
		_fail("%s: %s must be numeric or null" % [context, py_repr(field)])
		return null
	return float(value)


func _boolean(row: Dictionary, field: String, context: String) -> bool:
	var value: Variant = row.get(field)
	if not (value is bool):
		_fail("%s: %s must be a boolean" % [context, py_repr(field)])
		return false
	return value


func _optional_boolean(row: Dictionary, field: String, context: String) -> Variant:
	var value: Variant = row.get(field)
	if value == null:
		return null
	if not (value is bool):
		_fail("%s: %s must be a boolean or null" % [context, py_repr(field)])
		return null
	return value


func _mapping(row: Dictionary, field: String, context: String) -> Dictionary:
	var value: Variant = row.get(field)
	if not (value is Dictionary):
		_fail("%s: %s must be a JSON object" % [context, py_repr(field)])
		return {}
	return _deep(value)


func _optional_mapping(row: Dictionary, field: String, context: String) -> Dictionary:
	var value: Variant = row.get(field, {})
	if value == null:
		return {}
	if not (value is Dictionary):
		_fail("%s: %s must be a JSON object" % [context, py_repr(field)])
		return {}
	return _deep(value)


func _string_tuple(row: Dictionary, field: String, context: String) -> Array[String]:
	var result: Array[String] = []
	var value: Variant = row.get(field, [])
	var valid: bool = value is Array
	if valid:
		for item: Variant in value:
			if not (item is String):
				valid = false
				break
			result.append(item)
	if not valid:
		_fail("%s: %s must be an array of strings" % [context, py_repr(field)])
		return []
	return result


func _number_tuple(row: Dictionary, field: String, context: String) -> Array[float]:
	var result: Array[float] = []
	var value: Variant = row.get(field, [])
	var valid: bool = value is Array
	if valid:
		for item: Variant in value:
			if not _is_numeric(item):
				valid = false
				break
			result.append(float(item))
	if not valid:
		_fail("%s: %s must be an array of numbers" % [context, py_repr(field)])
		return []
	return result


func _object_tuple(row: Dictionary, field: String, context: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var value: Variant = row.get(field, [])
	var valid: bool = value is Array
	if valid:
		for item: Variant in value:
			if not (item is Dictionary):
				valid = false
				break
			result.append(_deep(item))
	if not valid:
		_fail("%s: %s must be an array of objects" % [context, py_repr(field)])
		return []
	return result


func _extra(row: Dictionary, known_fields: Array[String]) -> Dictionary:
	var extra: Dictionary = {}
	for key: Variant in row:
		if not known_fields.has(key):
			extra[key] = _deep(row[key])
	return extra


# -- effect operations (core/content_loader.py 210-292) ---------------------------------------------


func _validate_operation_schemas(effect_pack: Dictionary) -> Dictionary:
	var contract: Variant = effect_pack.get("contract")
	if not (contract is Dictionary):
		_fail("battle_effects_part1.json: contract must be an object")
		return {}
	var schemas: Variant = (contract as Dictionary).get("operation_schemas")
	var operations: Variant = (contract as Dictionary).get("operations")
	var operations_ok: bool = operations is Array
	if operations_ok:
		for operation: Variant in operations:
			if not (operation is String):
				operations_ok = false
				break
	if not (schemas is Dictionary) or not operations_ok:
		_fail("battle_effects_part1.json: contract operations/schema are missing")
		return {}
	var schema_dict: Dictionary = schemas
	var operation_names: Array = operations
	var same_keys: bool = true
	for name: Variant in operation_names:
		if not schema_dict.has(name):
			same_keys = false
	for name: Variant in schema_dict:
		if not operation_names.has(name):
			same_keys = false
	if not same_keys:
		_fail("battle_effects_part1.json: operations and operation_schemas keys differ")
		return {}
	for operation_name: String in schema_dict:
		var schema: Variant = schema_dict[operation_name]
		if not (schema is Dictionary):
			_fail("battle_effects_part1.json: malformed operation schema")
			return {}
		for field: String in ["required", "optional"]:
			var values: Variant = (schema as Dictionary).get(field, [])
			var strings_ok: bool = values is Array
			if strings_ok:
				for item: Variant in values:
					if not (item is String):
						strings_ok = false
						break
			if not strings_ok:
				_fail("battle_effects_part1.json: %s.%s must be an array of strings" % [operation_name, field])
				return {}
	return schema_dict


func _validate_effect_op(raw: Variant, schemas: Dictionary, context: String) -> void:
	if not (raw is Dictionary):
		_fail("%s: effect operation must be an object" % context)
		return
	var operation: Dictionary = raw
	var op_name: Variant = operation.get("op")
	if not (op_name is String) or not schemas.has(op_name):
		_fail("%s: unknown or missing effect operation %s" % [context, py_repr(op_name)])
		return
	var schema: Dictionary = schemas[op_name]
	var required: Array = schema.get("required", [])
	var optional: Array = schema.get("optional", [])
	var missing: Array[String] = []
	for field: String in required:
		if not operation.has(field) and not missing.has(field):
			missing.append(field)
	var unexpected: Array[String] = []
	for key: String in operation:
		if key != "op" and not required.has(key) and not optional.has(key):
			unexpected.append(key)
	missing.sort()
	unexpected.sort()
	if not missing.is_empty():
		_fail("%s/%s: missing schema fields %s" % [context, op_name, py_repr(missing)])
		return
	if not unexpected.is_empty():
		_fail("%s/%s: fields outside the closed schema %s" % [context, op_name, py_repr(unexpected)])


func _validate_effect_ops(value: Variant, schemas: Dictionary, context: String) -> void:
	if not (value is Array):
		_fail("%s: effect_ops must be an array" % context)
		return
	var index: int = 0
	for operation: Variant in value:
		_validate_effect_op(operation, schemas, "%s[%d]" % [context, index])
		index += 1


func _effect_op(raw: Dictionary) -> ContentModels.EffectOp:
	var effect: ContentModels.EffectOp = ContentModels.EffectOp.new()
	effect.op = raw["op"]
	var selector: Variant = raw.get("target_selector_id")
	effect.target_selector_id = selector if selector is String else ""
	for key: String in raw:
		if key != "op" and key != "target_selector_id":
			effect.parameters[key] = _deep(raw[key])
	return effect


func _effect_ops(row: Dictionary, schemas: Dictionary, context: String, field: String = "effect_ops") -> Array[ContentModels.EffectOp]:
	var result: Array[ContentModels.EffectOp] = []
	var raw_ops: Variant = row.get(field, [])
	_validate_effect_ops(raw_ops, schemas, "%s.%s" % [context, field])
	if not error.is_empty():
		return result
	for operation: Dictionary in raw_ops:
		result.append(_effect_op(operation))
	return result


func _event_hooks(row: Dictionary, schemas: Dictionary, context: String) -> Array[ContentModels.EffectHook]:
	var converted: Array[ContentModels.EffectHook] = []
	var hooks: Variant = row.get("event_hooks", [])
	if not (hooks is Array):
		_fail("%s: 'event_hooks' must be an array" % context)
		return converted
	var index: int = 0
	for hook: Variant in hooks:
		var hook_context: String = "%s/event_hooks[%d]" % [context, index]
		if not (hook is Dictionary):
			_fail("%s: event hook must be an object" % hook_context)
			return converted
		var record: ContentModels.EffectHook = ContentModels.EffectHook.new()
		record.event = _text(hook, "event", hook_context)
		record.effect_ops = _effect_ops(hook, schemas, hook_context)
		record.extra = _extra(hook, ["event", "effect_ops"])
		converted.append(record)
		index += 1
	return converted


# -- records (core/content_loader.py 295-666) -------------------------------------------------------


func _skill(row: Dictionary, schemas: Dictionary, context: String) -> ContentModels.Skill:
	var skill: ContentModels.Skill = ContentModels.Skill.new()
	skill.skill_id = _text(row, "skill_id", context)
	skill.name_en = _text(row, "name_en", context)
	skill.type = _text(row, "type", context)
	skill.effect_ops = _effect_ops(row, schemas, context)
	skill.element = _text(row, "element", context, true)
	skill.target_rule = _text(row, "target_rule", context, true)
	skill.target_selector_id = _text(row, "target_selector_id", context, true)
	skill.scale_stat = _text(row, "scale_stat", context, true)
	skill.multiplier = _optional_number(row, "multiplier", context)
	skill.multipliers_pct = _number_tuple(row, "multipliers_pct", context)
	skill.cooldown_turns = _integer(row, "cooldown_turns", context, 0)
	skill.focus_cost = _integer(row, "focus_cost", context, 0)
	skill.focus_gain_rule = _text(row, "focus_gain_rule", context, true)
	skill.description_en = _text(row, "description_en", context, true)
	skill.effect_en = _text(row, "effect_en", context, true)
	skill.auto_priority = _optional_integer(row, "auto_priority", context)
	skill.ai_priority = _optional_integer(row, "ai_priority", context)
	skill.damage_type = _text(row, "damage_type", context, true)
	skill.phase_ids = _string_tuple(row, "phase_ids", context)
	skill.telegraph_rules = _optional_mapping(row, "telegraph_rules", context)
	skill.event_hooks = _event_hooks(row, schemas, context)
	skill.continuous_modifiers = _object_tuple(row, "continuous_modifiers", context)
	skill.brand_mark_id = _text(row, "brand_mark_id", context, true)
	skill.extra = _extra(row, _SKILL_FIELDS)
	return skill


func _skills_of(raw_skills: Variant, schemas: Dictionary, context: String) -> Array[ContentModels.Skill]:
	var skills: Array[ContentModels.Skill] = []
	var skill_rows: Array[Dictionary] = _rows({"skills": raw_skills}, "skills", context)
	for skill_row: Dictionary in skill_rows:
		skills.append(_skill(skill_row, schemas, "%s/skills/%s" % [context, _label(skill_row.get("skill_id"))]))
	return skills


func _character(row: Dictionary, schemas: Dictionary) -> ContentModels.Character:
	var context: String = "characters/%s" % _label(row.get("character_id"))
	var character: ContentModels.Character = ContentModels.Character.new()
	var skills: Array[ContentModels.Skill] = _skills_of(row.get("skills"), schemas, context)
	character.character_id = _text(row, "character_id", context)
	character.name_en = _text(row, "name_en", context)
	character.gender = _text(row, "gender", context)
	character.age = _integer(row, "age", context)
	character.rarity = _integer(row, "rarity", context)
	character.element = _text(row, "element", context)
	character.class_id = _text(row, "class_id", context)
	character.combat_role = _text(row, "combat_role", context)
	character.signature_weapon_id = _text(row, "signature_weapon_id", context)
	character.equip_weapon_type = _text(row, "equip_weapon_type", context)
	character.skills = skills
	character.base_stats_level_1 = _mapping(row, "base_stats_level_1", context)
	character.growth_per_level = _mapping(row, "growth_per_level", context)
	character.level_cap = _integer(row, "level_cap", context)
	character.acquisition = _deep(row.get("acquisition"))
	character.banner_id = _text(row, "banner_id", context, true)
	character.brand_mark_id = _text(row, "brand_mark_id", context, true)
	character.skill_ids = _string_tuple(row, "skill_ids", context)
	character.stat_formula = _text(row, "stat_formula", context, true)
	character.formation_affinity = _deep(row.get("formation_affinity"))
	character.balance_status = _text(row, "balance_status", context, true)
	character.extra = _extra(row, _CHARACTER_FIELDS)
	return character


func _boss_objective(row: Dictionary, schemas: Dictionary, context: String) -> ContentModels.BossObjective:
	var objective: ContentModels.BossObjective = ContentModels.BossObjective.new()
	objective.objective_id = _text(row, "objective_id", context)
	objective.name_en = _text(row, "name_en", context)
	objective.max_hp = _integer(row, "max_hp", context)
	objective.hp = _integer(row, "hp", context)
	objective.targetable_by_player = _boolean(row, "targetable_by_player", context)
	objective.persists_across_phases = _optional_boolean(row, "persists_across_phases", context)
	objective.on_destroyed = _effect_ops(row, schemas, context, "on_destroyed")
	objective.extra = _extra(row, _OBJECTIVE_FIELDS)
	return objective


func _boss_phase(row: Dictionary, schemas: Dictionary, context: String) -> ContentModels.BossPhase:
	var phase: ContentModels.BossPhase = ContentModels.BossPhase.new()
	phase.phase_id = _text(row, "phase_id", context)
	var objective_rows: Array[Dictionary] = _rows({"objectives": row.get("objectives", [])}, "objectives", context)
	phase.name_en = _text(row, "name_en", context)
	phase.transition = _text(row, "transition", context)
	phase.hp_multiplier = _number(row, "hp_multiplier", context)
	phase.atk_multiplier = _number(row, "atk_multiplier", context)
	phase.def_multiplier = _number(row, "def_multiplier", context)
	phase.weaknesses = _string_tuple(row, "weaknesses", context)
	for objective_row: Dictionary in objective_rows:
		phase.objectives.append(_boss_objective(
			objective_row, schemas, "%s/objectives/%s" % [context, _label(objective_row.get("objective_id"))]))
	phase.transition_hp_percent = _optional_number(row, "transition_hp_percent", context)
	phase.passives = _object_tuple(row, "passives", context)
	phase.telegraph = _text(row, "telegraph", context, true)
	phase.intent_rules = _optional_mapping(row, "intent_rules", context)
	phase.interruptible_by_control = _boolean(row, "interruptible_by_control", context)
	phase.tauntable = _boolean(row, "tauntable", context)
	phase.break_targets = _string_tuple(row, "break_targets", context)
	phase.enter_ops = _effect_ops(row, schemas, context, "enter_ops")
	phase.passive_ops = _effect_ops(row, schemas, context, "passive_ops")
	phase.signature_action_id = _text(row, "signature_action_id", context, true)
	phase.extra = _extra(row, _PHASE_FIELDS)
	return phase


func _enemy(row: Dictionary, schemas: Dictionary) -> ContentModels.Enemy:
	var enemy: ContentModels.Enemy = ContentModels.Enemy.new()
	enemy.enemy_id = _text(row, "enemy_id", "enemies")
	var context: String = "enemies/%s" % enemy.enemy_id
	var skill_rows: Array[Dictionary] = _rows({"skills": row.get("skills", [])}, "skills", context)
	var phase_rows: Array[Dictionary] = _rows({"phases": row.get("phases", [])}, "phases", context)
	enemy.name_en = _text(row, "name_en", context)
	enemy.faction_id = _text(row, "faction_id", context)
	enemy.role = _text(row, "role", context)
	enemy.element = _text(row, "element", context)
	enemy.base_stats_level_1 = _mapping(row, "base_stats_level_1", context)
	enemy.growth_per_level = _mapping(row, "growth_per_level", context)
	enemy.weaknesses = _string_tuple(row, "weaknesses", context)
	enemy.resistances = _string_tuple(row, "resistances", context)
	enemy.status_immunities = _string_tuple(row, "status_immunities", context)
	for skill_row: Dictionary in skill_rows:
		enemy.skills.append(_skill(skill_row, schemas, "%s/skills/%s" % [context, _label(skill_row.get("skill_id"))]))
	for phase_row: Dictionary in phase_rows:
		enemy.phases.append(_boss_phase(phase_row, schemas, "%s/phases/%s" % [context, _label(phase_row.get("phase_id"))]))
	enemy.intent = _optional_mapping(row, "intent", context)
	enemy.passive_hooks = _event_hooks({"event_hooks": row.get("passive_hooks", [])}, schemas, context)
	enemy.continuous_modifiers = _object_tuple(row, "continuous_modifiers", context)
	enemy.passives = _object_tuple(row, "passives", context)
	enemy.boss_id = _text(row, "boss_id", context, true)
	enemy.phase_ids = _string_tuple(row, "phase_ids", context)
	enemy.drop_table_id = _text(row, "drop_table_id", context, true)
	enemy.brand_mark_id = _text(row, "brand_mark_id", context, true)
	enemy.extra = _extra(row, _ENEMY_FIELDS)
	return enemy


func _stage(row: Dictionary) -> ContentModels.Stage:
	var stage: ContentModels.Stage = ContentModels.Stage.new()
	stage.stage_id = _text(row, "stage_id", "stages")
	var context: String = "stages/%s" % stage.stage_id
	var raw_waves: Variant = row.get("enemy_waves")
	if not (raw_waves is Array):
		_fail("%s: 'enemy_waves' must be an array" % context)
		return stage
	var wave_index: int = 0
	for raw_wave: Variant in raw_waves:
		if not (raw_wave is Array):
			_fail("%s: enemy_waves[%d] must be an array" % [context, wave_index])
			return stage
		var wave: Array[ContentModels.EnemyWaveEntry] = []
		var entry_index: int = 0
		for raw_entry: Variant in raw_wave:
			var entry_context: String = "%s/enemy_waves[%d][%d]" % [context, wave_index, entry_index]
			if not (raw_entry is Dictionary):
				_fail("%s: enemy wave entry must be an object" % entry_context)
				return stage
			var entry: ContentModels.EnemyWaveEntry = ContentModels.EnemyWaveEntry.new()
			entry.enemy_id = _text(raw_entry, "enemy_id", entry_context)
			entry.count = _integer(raw_entry, "count", entry_context)
			entry.extra = _extra(raw_entry, ["enemy_id", "count"])
			wave.append(entry)
			entry_index += 1
		stage.enemy_waves.append(wave)
		wave_index += 1
	var phase_mechanics: Variant = row.get("phase_mechanics")
	if phase_mechanics != null and not (phase_mechanics is Dictionary):
		_fail("%s: 'phase_mechanics' must be an object or null" % context)
		return stage
	stage.chapter_id = _text(row, "chapter_id", context)
	stage.title_en = _text(row, "title_en", context)
	stage.node_type = _text(row, "node_type", context)
	stage.recommended_level = _integer(row, "recommended_level", context)
	stage.enemy_level = _integer(row, "enemy_level", context)
	stage.stamina_cost = _integer(row, "stamina_cost", context)
	stage.drop_table_id = _text(row, "drop_table_id", context)
	stage.boss_id = _text(row, "boss_id", context, true)
	stage.boss_phases = _string_tuple(row, "boss_phases", context)
	stage.phase_mechanics = null if phase_mechanics == null else _deep(phase_mechanics)
	stage.guest_characters = _string_tuple(row, "guest_characters", context)
	stage.story_rewards = _object_tuple(row, "story_rewards", context)
	stage.story_beat_en = _text(row, "story_beat_en", context, true)
	stage.enemy_stat_multiplier = _number(row, "enemy_stat_multiplier", context) if row.has("enemy_stat_multiplier") else 1.0
	stage.extra = _extra(row, _STAGE_FIELDS)
	return stage


func _weapon(row: Dictionary) -> ContentModels.Weapon:
	var context: String = "weapons/%s" % _label(row.get("weapon_id"))
	var weapon: ContentModels.Weapon = ContentModels.Weapon.new()
	weapon.weapon_id = _text(row, "weapon_id", context)
	weapon.name_en = _text(row, "name_en", context)
	weapon.rarity = _integer(row, "rarity", context)
	weapon.weapon_type = _text(row, "weapon_type", context)
	weapon.acquisition = _deep(row.get("acquisition"))
	weapon.level_cap = _integer(row, "level_cap", context)
	weapon.base_stats_level_1 = _mapping(row, "base_stats_level_1", context)
	weapon.growth_per_level = _mapping(row, "growth_per_level", context)
	weapon.dismantle_xp = _integer(row, "dismantle_xp", context)
	weapon.dismantle_allowed = _boolean(row, "dismantle_allowed", context)
	weapon.owner_character_id = _text(row, "owner_character_id", context, true)
	weapon.banner_id = _text(row, "banner_id", context, true)
	weapon.brand_mark_id = _text(row, "brand_mark_id", context, true)
	weapon.passive_name_en = _text(row, "passive_name_en", context, true)
	weapon.passive_effect_en = _text(row, "passive_effect_en", context, true)
	weapon.passive_effect_id = _text(row, "passive_effect_id", context, true)
	weapon.dismantle_output = _object_tuple(row, "dismantle_output", context)
	weapon.balance_status = _text(row, "balance_status", context, true)
	weapon.extra = _extra(row, _WEAPON_FIELDS)
	return weapon


func _armor(row: Dictionary) -> ContentModels.Armor:
	var context: String = "armors/%s" % _label(row.get("armor_id"))
	var armor: ContentModels.Armor = ContentModels.Armor.new()
	armor.armor_id = _text(row, "armor_id", context)
	armor.name_en = _text(row, "name_en", context)
	armor.rarity = _integer(row, "rarity", context)
	armor.armor_type = _text(row, "armor_type", context)
	armor.slot = _text(row, "slot", context)
	armor.acquisition = _deep(row.get("acquisition"))
	armor.level_cap = _integer(row, "level_cap", context)
	armor.base_stats_level_1 = _mapping(row, "base_stats_level_1", context)
	armor.growth_per_level = _mapping(row, "growth_per_level", context)
	armor.dismantle_xp = _integer(row, "dismantle_xp", context)
	armor.dismantle_allowed = _boolean(row, "dismantle_allowed", context)
	armor.brand_mark_id = _text(row, "brand_mark_id", context, true)
	armor.dismantle_output = _object_tuple(row, "dismantle_output", context)
	armor.tier_id = _text(row, "tier_id", context, true)
	armor.extra = _extra(row, _ARMOR_FIELDS)
	return armor


func _accessory(row: Dictionary) -> ContentModels.AccessoryTemplate:
	var context: String = "accessories/%s" % _label(row.get("accessory_id"))
	var accessory: ContentModels.AccessoryTemplate = ContentModels.AccessoryTemplate.new()
	accessory.accessory_id = _text(row, "accessory_id", context)
	accessory.name_en = _text(row, "name_en", context)
	accessory.rarity = _integer(row, "rarity", context)
	accessory.slot = _text(row, "slot", context)
	accessory.set_id = _text(row, "set_id", context)
	accessory.set_name_en = _text(row, "set_name_en", context)
	accessory.possible_main_stats = _object_tuple(row, "possible_main_stats", context)
	accessory.possible_sub_stats = _object_tuple(row, "possible_sub_stats", context)
	accessory.rarity_profiles = _mapping(row, "rarity_profiles", context)
	accessory.acquisition = _deep(row.get("acquisition"))
	accessory.drop_is_gacha = _boolean(row, "drop_is_gacha", context)
	accessory.brand_mark_id = _text(row, "brand_mark_id", context, true)
	accessory.flavor_en = _text(row, "flavor_en", context, true)
	accessory.extra = _extra(row, _ACCESSORY_FIELDS)
	return accessory


func _item(row: Dictionary) -> ContentModels.Item:
	var context: String = "items/%s" % _label(row.get("item_id"))
	var xp_value: Variant = row.get("xp_value")
	if xp_value != null and not _is_numeric(xp_value):
		_fail("%s: 'xp_value' must be numeric or null" % context)
	var item: ContentModels.Item = ContentModels.Item.new()
	item.item_id = _text(row, "item_id", context)
	item.name_en = _text(row, "name_en", context)
	item.kind = _text(row, "kind", context)
	item.rarity = _optional_integer(row, "rarity", context)
	item.stack_cap = _optional_integer(row, "stack_cap", context)
	item.xp_value = xp_value
	item.description_en = _text(row, "description_en", context)
	item.sources = _string_tuple(row, "sources", context)
	item.consumable = _boolean(row, "consumable", context)
	item.brand_mark_id = _text(row, "brand_mark_id", context, true)
	item.extra = _extra(row, _ITEM_FIELDS)
	return item


func _drop_table(row: Dictionary) -> ContentModels.DropTable:
	var context: String = "drop_tables/%s" % _label(row.get("drop_table_id"))
	var table: ContentModels.DropTable = ContentModels.DropTable.new()
	table.drop_table_id = _text(row, "drop_table_id", context)
	table.repeatable_rewards = _object_tuple(row, "repeatable_rewards", context)
	table.first_clear_rewards = _object_tuple(row, "first_clear_rewards", context)
	table.extra = _extra(row, _DROP_TABLE_FIELDS)
	return table


func _status(row: Dictionary) -> ContentModels.Status:
	var context: String = "statuses/%s" % _label(row.get("status_id"))
	var status: ContentModels.Status = ContentModels.Status.new()
	status.status_id = _text(row, "status_id", context)
	status.name_en = _text(row, "name_en", context)
	status.kind = _text(row, "kind", context)
	status.default_duration_turns = _integer(row, "default_duration_turns", context)
	status.source_atk_multiplier_per_tick = _optional_number(row, "source_atk_multiplier_per_tick", context)
	status.tags = _string_tuple(row, "tags", context)
	status.stacking = _text(row, "stacking", context)
	status.extra = _extra(row, _STATUS_FIELDS)
	return status


# -- registry (core/content_loader.py 669-811) ------------------------------------------------------


func _build(packs: Dictionary) -> ContentModels.ContentRegistry:
	var character_rows: Array[Dictionary] = _rows(packs["characters_part1.json"], "characters", "characters_part1.json")
	var enemy_rows: Array[Dictionary] = _rows(packs["enemies_part1.json"], "enemies", "enemies_part1.json")
	var weapon_rows: Array[Dictionary] = _rows(packs["weapons_part1.json"], "weapons", "weapons_part1.json")
	var armor_rows: Array[Dictionary] = _rows(packs["armors_part1.json"], "armors", "armors_part1.json")
	var accessory_rows: Array[Dictionary] = _rows(packs["accessories_part1.json"], "accessories", "accessories_part1.json")
	var item_rows: Array[Dictionary] = _rows(packs["items_part1.json"], "items", "items_part1.json")
	var stage_rows: Array[Dictionary] = _rows(packs["stages_part1.json"], "stages", "stages_part1.json")
	var status_rows: Array[Dictionary] = _rows(packs["battle_rules_part1.json"], "statuses", "battle_rules_part1.json")
	var drop_table_rows: Array[Dictionary] = _rows(packs["drop_tables_part1.json"], "drop_tables", "drop_tables_part1.json")
	if not error.is_empty():
		return null

	var character_index: Dictionary = _index_rows(character_rows, "character_id", "characters")
	var enemy_index: Dictionary = _index_rows(enemy_rows, "enemy_id", "enemies")
	var weapon_index: Dictionary = _index_rows(weapon_rows, "weapon_id", "weapons")
	_index_rows(armor_rows, "armor_id", "armors")
	_index_rows(accessory_rows, "accessory_id", "accessories")
	_index_rows(item_rows, "item_id", "items")
	var stage_index: Dictionary = _index_rows(stage_rows, "stage_id", "stages")
	var status_index: Dictionary = _index_rows(status_rows, "status_id", "statuses")
	var drop_table_index: Dictionary = _index_rows(drop_table_rows, "drop_table_id", "drop_tables")
	if not error.is_empty():
		return null

	var schemas: Dictionary = _validate_operation_schemas(packs["battle_effects_part1.json"])
	if not error.is_empty():
		return null

	_check_cross_references(character_rows, stage_rows, enemy_rows, weapon_index, drop_table_index, enemy_index, schemas)
	if not error.is_empty():
		return null

	var registry: ContentModels.ContentRegistry = ContentModels.ContentRegistry.new()
	for key: String in character_index:
		registry.characters[key] = _character(character_index[key], schemas)
		if not error.is_empty():
			return null
	for key: String in enemy_index:
		registry.enemies[key] = _enemy(enemy_index[key], schemas)
		if not error.is_empty():
			return null
	for key: String in weapon_index:
		registry.weapons[key] = _weapon(weapon_index[key])
		if not error.is_empty():
			return null
	for row: Dictionary in armor_rows:
		var armor: ContentModels.Armor = _armor(row)
		registry.armors[String(row["armor_id"])] = armor
		if not error.is_empty():
			return null
	for row: Dictionary in accessory_rows:
		var accessory: ContentModels.AccessoryTemplate = _accessory(row)
		registry.accessories[String(row["accessory_id"])] = accessory
		if not error.is_empty():
			return null
	for row: Dictionary in item_rows:
		var item: ContentModels.Item = _item(row)
		registry.items[String(row["item_id"])] = item
		if not error.is_empty():
			return null
	for key: String in stage_index:
		registry.stages[key] = _stage(stage_index[key])
		if not error.is_empty():
			return null
	for key: String in drop_table_index:
		registry.drop_tables[key] = _drop_table(drop_table_index[key])
		if not error.is_empty():
			return null
	for key: String in status_index:
		registry.statuses[key] = _status(status_index[key])
		if not error.is_empty():
			return null

	for character: ContentModels.Character in registry.characters.values():
		for skill: ContentModels.Skill in character.skills:
			if registry.skills.has(skill.skill_id):
				_fail("skills: duplicate skill_id %s" % py_repr(skill.skill_id))
				return null
			registry.skills[skill.skill_id] = skill
	for enemy: ContentModels.Enemy in registry.enemies.values():
		for skill: ContentModels.Skill in enemy.skills:
			if registry.skills.has(skill.skill_id):
				_fail("skills: duplicate skill_id %s" % py_repr(skill.skill_id))
				return null
			registry.skills[skill.skill_id] = skill

	for enemy: ContentModels.Enemy in registry.enemies.values():
		for phase: ContentModels.BossPhase in enemy.phases:
			if registry.boss_phases.has(phase.phase_id):
				_fail("boss_phases: duplicate phase_id %s" % py_repr(phase.phase_id))
				return null
			registry.boss_phases[phase.phase_id] = phase
			for objective: ContentModels.BossObjective in phase.objectives:
				if registry.boss_objectives.has(objective.objective_id):
					_fail("boss_objectives: duplicate objective_id %s" % py_repr(objective.objective_id))
					return null
				registry.boss_objectives[objective.objective_id] = objective

	var weapons_pack: Dictionary = packs["weapons_part1.json"]
	var accessory_pack: Dictionary = packs["accessories_part1.json"]
	var item_pack: Dictionary = packs["items_part1.json"]
	registry.battle_rules = _deep(packs["battle_rules_part1.json"])
	registry.weapon_types = _catalog_rows(weapons_pack, "weapon_types", "weapon_type", "weapons_part1.json")
	registry.weapon_banners = _catalog_rows(weapons_pack, "weapon_banners", "banner_id", "weapons_part1.json")
	registry.accessory_sets = _catalog_rows(accessory_pack, "sets", "set_id", "accessories_part1.json")
	registry.currency_references = _catalog_rows(item_pack, "currency_references", "item_id", "items_part1.json")
	registry.effect_operation_schemas = _deep(schemas)
	registry.effect_contract = _deep((packs["battle_effects_part1.json"] as Dictionary).get("contract", {}))
	registry.drop_pack = _deep(packs["drop_tables_part1.json"])
	registry.accessory_slots = _deep(accessory_pack.get("accessory_slots"))
	registry.armor_slot_count = _deep((packs["armors_part1.json"] as Dictionary).get("armor_slot_count"))
	if not error.is_empty():
		return null
	return registry


## The selected cross-pack checks of tools/validate_part1_content.py that the loader repeats.
func _check_cross_references(
	character_rows: Array[Dictionary], stage_rows: Array[Dictionary], enemy_rows: Array[Dictionary],
	weapon_index: Dictionary, drop_table_index: Dictionary, enemy_index: Dictionary, schemas: Dictionary
) -> void:
	for character: Dictionary in character_rows:
		var character_id: String = character["character_id"]
		var signature_weapon_id: Variant = character.get("signature_weapon_id")
		if not (signature_weapon_id is String) or not weapon_index.has(signature_weapon_id):
			_fail("characters/%s: unknown signature weapon %s" % [character_id, py_repr(signature_weapon_id)])
			return
		var skill_rows: Array[Dictionary] = _rows({"skills": character.get("skills")}, "skills", "characters/%s" % character_id)
		if not error.is_empty():
			return
		for skill: Dictionary in skill_rows:
			var skill_context: String = "characters/%s/skills/%s" % [character_id, _label(skill.get("skill_id"))]
			var effect_ops: Variant = skill.get("effect_ops", [])
			_validate_effect_ops(effect_ops, schemas, skill_context)
			if not error.is_empty():
				return
			var skill_type: Variant = skill.get("type")
			var has_ops: bool = not (effect_ops as Array).is_empty()
			if not has_ops and skill_type != "passive":
				_fail("%s: non-passive skill has no executable effect_ops" % skill_context)
				return
			if skill_type == "passive" and not (_truthy(skill.get("event_hooks")) or _truthy(skill.get("continuous_modifiers")) or has_ops):
				_fail("%s: passive has no effect_ops, event_hooks or modifiers" % skill_context)
				return

	for stage: Dictionary in stage_rows:
		var stage_id: String = stage["stage_id"]
		var drop_table_id: Variant = stage.get("drop_table_id")
		if not (drop_table_id is String) or not drop_table_index.has(drop_table_id):
			_fail("stages/%s: unknown drop_table_id %s" % [stage_id, py_repr(drop_table_id)])
			return
		var waves: Variant = stage.get("enemy_waves")
		if not (waves is Array):
			_fail("stages/%s: enemy_waves must be an array" % stage_id)
			return
		var wave_index: int = 0
		for wave: Variant in waves:
			if not (wave is Array):
				_fail("stages/%s: enemy_waves[%d] must be an array" % [stage_id, wave_index])
				return
			var entry_index: int = 0
			for entry: Variant in wave:
				var context: String = "stages/%s/enemy_waves[%d][%d]" % [stage_id, wave_index, entry_index]
				if not (entry is Dictionary):
					_fail("%s: enemy entry must be an object" % context)
					return
				var enemy_id: Variant = (entry as Dictionary).get("enemy_id")
				if not (enemy_id is String) or not enemy_index.has(enemy_id):
					_fail("%s: unknown enemy_id %s" % [context, py_repr(enemy_id)])
					return
				entry_index += 1
			wave_index += 1

	# Boss operations and enemy actions use the same closed operation contract.
	for enemy: Dictionary in enemy_rows:
		var enemy_id: String = enemy["enemy_id"]
		var enemy_skill_rows: Array[Dictionary] = _rows({"skills": enemy.get("skills", [])}, "skills", "enemies/%s" % enemy_id)
		if not error.is_empty():
			return
		for skill: Dictionary in enemy_skill_rows:
			_validate_effect_ops(skill.get("effect_ops", []), schemas, "enemies/%s/%s" % [enemy_id, str(skill.get("skill_id", "skill"))])
			if not error.is_empty():
				return
		var phases: Array[Dictionary] = _rows({"phases": enemy.get("phases", [])}, "phases", "enemies/%s" % enemy_id)
		if not error.is_empty():
			return
		for phase: Dictionary in phases:
			var phase_context: String = "enemies/%s/phases/%s" % [enemy_id, _label(phase.get("phase_id"))]
			for field: String in ["enter_ops", "passive_ops"]:
				_validate_effect_ops(phase.get(field, []), schemas, "%s.%s" % [phase_context, field])
				if not error.is_empty():
					return
			var objectives: Array[Dictionary] = _rows({"objectives": phase.get("objectives", [])}, "objectives", phase_context)
			if not error.is_empty():
				return
			for objective: Dictionary in objectives:
				_validate_effect_ops(
					objective.get("on_destroyed", []), schemas,
					"%s/objectives/%s.on_destroyed" % [phase_context, _label(objective.get("objective_id"))])
				if not error.is_empty():
					return


## Python truthiness for the JSON values the passive check looks at.
static func _truthy(value: Variant) -> bool:
	if value == null:
		return false
	if value is Array or value is Dictionary or value is String:
		return not value.is_empty()
	if value is bool:
		return value
	if value is int or value is float:
		return value != 0
	return true
