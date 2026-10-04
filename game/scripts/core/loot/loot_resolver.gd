class_name LootResolver
extends RefCounted
## Resolves Part I battle drops from the drop-table contracts (port of backend/loot_service.py `resolve_battle_rewards`).
##
## The order of `random.Random` draws is the contract: per reward row one chance draw, then quantity, rarity, template
## choice, and for accessories a 64-bit sub-seed for the accessory roller. Fixtures (`loot.json`) pin the whole sequence.
##
## Differences from the reference, all outside the drop-resolution logic itself:
##   * failures the reference raises (`LootResolutionError`, `ValueError`) set `error` / `error_kind` and return an
##     empty array; the first failure wins;
##   * the SQLite `claim_reward` / `claim_in_transaction` first-clear ledger is not part of this resolver. The caller
##     passes `claim_first_clear: Callable(account_id: String, claim_type: String) -> bool` that returns true when the
##     claim is new. It is called only when the table has first-clear rows and runs inside the caller's transaction
##     (G5): if `error` is set after it returned true, the caller must roll the claim back, exactly as the reference's
##     transaction does;
##   * `stage_id` / `boss_id` use "" for "not given";
##   * JSON numbers are floats in Godot, so `2.0` passes an "is an int" check the reference would fail (invalid content
##     only; the same documented divergence as the content loader).

## One resolved reward payload. `item_id` is "" where the reference has None; `rarity` and `payload` are null then.
class GrantedReward extends RefCounted:
	var reward_id: String = ""
	var kind: String = ""
	var quantity: int = 0
	var item_id: String = ""
	var rarity: Variant = null  # int | null
	var payload: Variant = null  # Dictionary | null (a rolled accessory instance)
	var is_first_clear: bool = false


const ERROR_LOOT: String = "LootResolutionError"
const ERROR_VALUE: String = "ValueError"

var _registry: ContentModels.ContentRegistry = null
var _roller: AccessoryRoller = null

## First failure of the last `resolve_battle_rewards` call ("" = none) and the reference's exception class name.
var error: String = ""
var error_kind: String = ""


static func create(content_registry: ContentModels.ContentRegistry) -> LootResolver:
	var resolver: LootResolver = LootResolver.new()
	resolver._registry = content_registry
	resolver._roller = AccessoryRoller.new(content_registry.accessories)
	return resolver


func _fail(message: String, kind: String = ERROR_LOOT) -> void:
	if error.is_empty():
		error = message
		error_kind = kind


static func _is_whole(value: Variant) -> bool:
	if value is bool:
		return false
	if value is int:
		return true
	return value is float and is_finite(value) and value == floorf(value)


## `value == text` that tolerates a value of any type (raw JSON rows may hold anything).
static func _same(value: Variant, text: String) -> bool:
	return value is String and value == text


static func _is_number(value: Variant) -> bool:
	return (value is int or value is float) and not (value is bool)


func _drop_pack_rows(field: String) -> Array[Dictionary]:
	var rows: Array[Dictionary] = []
	var raw: Variant = _registry.drop_pack.get(field)
	if not (raw is Array):
		_fail("drop_tables_part1.json/%s must be an array of objects" % field)
		return rows
	for row: Variant in raw:
		if not (row is Dictionary):
			_fail("drop_tables_part1.json/%s must be an array of objects" % field)
			return rows
		rows.append(row)
	return rows


## Resolves repeatable loot and, when the table has first-clear rows and `is_first_clear` is set, the first-clear loot of
## a claim that `claim_first_clear` reports as new. `rng` is consumed in the reference's draw order.
func resolve_battle_rewards(drop_table_id: String, is_first_clear: bool, account_id: String, claim_first_clear: Callable,
		rng: CpythonRandom, stage_id: String = "", boss_id: String = "") -> Array[GrantedReward]:
	error = ""
	error_kind = ""
	var rewards: Array[GrantedReward] = _resolve(drop_table_id, is_first_clear, account_id, claim_first_clear, rng, stage_id, boss_id)
	if not error.is_empty():
		return [] as Array[GrantedReward]  # the reference raises: no partial result
	return rewards


func _resolve(drop_table_id: String, is_first_clear: bool, account_id: String, claim_first_clear: Callable,
		rng: CpythonRandom, stage_id: String, boss_id: String) -> Array[GrantedReward]:
	var rewards: Array[GrantedReward] = []
	if rng == null:
		_fail("rng must be an instance of random.Random", "TypeError")
		return rewards
	if account_id.is_empty():
		_fail("account_id must be a non-empty string", ERROR_VALUE)
		return rewards
	if not _registry.drop_tables.has(drop_table_id):
		_fail("Unknown drop table: %s" % drop_table_id)
		return rewards
	var table: ContentModels.DropTable = _registry.drop_tables[drop_table_id]
	var raw_tables: Array[Dictionary] = _drop_pack_rows("drop_tables")
	if not error.is_empty():
		return rewards
	var raw_table: Dictionary = {}
	var found_raw: bool = false
	for row: Dictionary in raw_tables:
		if _same(row.get("drop_table_id"), drop_table_id):
			raw_table = row
			found_raw = true
			break
	if not found_raw:
		_fail("Unknown drop table in JSON pack: %s" % drop_table_id)
		return rewards

	var first_clear_rows: Array[Dictionary] = table.first_clear_rewards if is_first_clear else ([] as Array[Dictionary])
	var needs_boss: bool = false
	for row: Dictionary in table.repeatable_rewards + first_clear_rows:
		if _same(row.get("kind"), "boss_set_accessory"):
			needs_boss = true
	var context: Array = _table_context(drop_table_id, stage_id, boss_id, needs_boss, not first_clear_rows.is_empty())
	if not error.is_empty():
		return rewards
	var stage: ContentModels.Stage = context[0]
	var resolved_boss_id: String = context[1]

	rewards = _resolve_rows(table.repeatable_rewards, rng, false, stage, resolved_boss_id)
	if not error.is_empty():
		return rewards

	if not first_clear_rows.is_empty():
		var claim_scope: Variant = raw_table.get("first_clear_claim_scope")
		var pack_claim_keys: Variant = _registry.drop_pack.get("claim_keys", {})
		if not _same(claim_scope, "account_id+stage_id") or not (pack_claim_keys is Dictionary) \
				or not _same((pack_claim_keys as Dictionary).get("first_clear"), "account_id+stage_id"):
			_fail("%s: first-clear claim scope must be account_id+stage_id" % drop_table_id)
			return rewards
		if stage == null:
			_fail("%s: first-clear rewards require a stage_id" % drop_table_id)
			return rewards
		# The first-clear rows are resolved only for a claim that is new: a duplicate claim grants nothing and draws nothing.
		if claim_first_clear.call(account_id, "first_clear_stage:" + stage.stage_id):
			var granted: Array[GrantedReward] = _resolve_rows(first_clear_rows, rng, true, stage, resolved_boss_id)
			if not error.is_empty():
				return rewards
			rewards.append_array(granted)
	return rewards


## Resolves the encounter context; shared boss tables require an explicit stage. Returns [Stage | null, boss id].
func _table_context(drop_table_id: String, stage_id: String, boss_id: String, needs_boss: bool, require_stage: bool) -> Array:
	var matching_stages: Array[ContentModels.Stage] = []
	for candidate: ContentModels.Stage in _registry.stages.values():
		if candidate.drop_table_id == drop_table_id:
			matching_stages.append(candidate)

	var stage: ContentModels.Stage = null
	if not stage_id.is_empty():
		if not _registry.stages.has(stage_id):
			_fail("Unknown stage_id: %s" % stage_id)
			return [null, ""]
		stage = _registry.stages[stage_id]
		if stage.drop_table_id != drop_table_id:
			_fail("Stage %s uses %s, not %s" % [ContentLoader.py_repr(stage_id), ContentLoader.py_repr(stage.drop_table_id), ContentLoader.py_repr(drop_table_id)])
			return [null, ""]
	elif not boss_id.is_empty():
		var matches: Array[ContentModels.Stage] = []
		for candidate: ContentModels.Stage in matching_stages:
			if candidate.boss_id == boss_id or _stage_has_enemy(candidate, boss_id):
				matches.append(candidate)
		if matches.size() != 1:
			_fail("boss_id %s does not uniquely identify a stage using %s; pass stage_id explicitly" % [ContentLoader.py_repr(boss_id), ContentLoader.py_repr(drop_table_id)])
			return [null, ""]
		stage = matches[0]
	elif matching_stages.size() == 1:
		stage = matching_stages[0]
	elif needs_boss or (require_stage and matching_stages.size() > 1):
		_fail("Drop table %s is shared by multiple stages; pass stage_id (and optionally boss_id) to preserve stage-scoped rewards" % ContentLoader.py_repr(drop_table_id))
		return [null, ""]

	if stage == null:
		return [null, boss_id]

	if not boss_id.is_empty() and not _stage_boss_ids(stage).has(boss_id):
		_fail("boss_id %s does not belong to stage %s" % [ContentLoader.py_repr(boss_id), ContentLoader.py_repr(stage.stage_id)])
		return [null, ""]
	var resolved_boss_id: String = boss_id
	if resolved_boss_id.is_empty():
		var boss_enemies: Array[String] = []
		for wave: Array in stage.enemy_waves:
			for entry: ContentModels.EnemyWaveEntry in wave:
				if entry.enemy_id.begins_with("boss_"):
					boss_enemies.append(entry.enemy_id)
		resolved_boss_id = boss_enemies[0] if boss_enemies.size() == 1 else stage.boss_id
	return [stage, resolved_boss_id]


static func _stage_has_enemy(stage: ContentModels.Stage, enemy_id: String) -> bool:
	for wave: Array in stage.enemy_waves:
		for entry: ContentModels.EnemyWaveEntry in wave:
			if entry.enemy_id == enemy_id:
				return true
	return false


## `{stage.boss_id} | {enemy ids of every wave}`.
static func _stage_boss_ids(stage: ContentModels.Stage) -> Array[String]:
	var ids: Array[String] = []
	if not stage.boss_id.is_empty():
		ids.append(stage.boss_id)
	for wave: Array in stage.enemy_waves:
		for entry: ContentModels.EnemyWaveEntry in wave:
			if not ids.has(entry.enemy_id):
				ids.append(entry.enemy_id)
	return ids


func _resolve_rows(rows: Array[Dictionary], rng: CpythonRandom, is_first_clear: bool, stage: ContentModels.Stage, boss_id: String) -> Array[GrantedReward]:
	var result: Array[GrantedReward] = []
	for row: Dictionary in rows:
		var reward: GrantedReward = _resolve_entry(row, rng, is_first_clear, stage, boss_id)
		if not error.is_empty():
			return result
		if reward != null:
			result.append(reward)
	return result


## One reward row; null when the chance roll fails (or on error, with `error` set).
func _resolve_entry(row: Dictionary, rng: CpythonRandom, is_first_clear: bool, stage: ContentModels.Stage, boss_id: String) -> GrantedReward:
	var reward_id: Variant = row.get("reward_id")
	var kind: Variant = row.get("kind")
	if not (reward_id is String) or (reward_id as String).is_empty() or not (kind is String):
		_fail("Reward row requires non-empty reward_id and kind")
		return null
	var context: String = reward_id
	if not _chance_passes(row, rng, context):
		return null
	if not error.is_empty():
		return null

	var quantity: int = _quantity(row, rng, context)
	if not error.is_empty():
		return null
	var item_id: Variant = row.get("item_id")
	var rarity: Variant = null
	var payload: Variant = null

	match kind:
		"currency", "item", "account_xp":
			if kind != "account_xp" and (not (item_id is String) or (item_id as String).is_empty()):
				_fail("%s: %s reward requires item_id" % [context, kind])
				return null
		"item_pool":
			var item_ids: Variant = row.get("item_ids")
			if not (item_ids is Array) or (item_ids as Array).is_empty():
				_fail("%s: item_pool requires a non-empty item_ids list" % context)
				return null
			for value: Variant in item_ids:
				if not (value is String) or (value as String).is_empty():
					_fail("%s: item_pool requires a non-empty item_ids list" % context)
					return null
			item_id = rng.choice(item_ids)
		"accessory":
			if not (item_id is String):
				_fail("%s: accessory reward requires item_id" % context)
				return null
			if not _registry.accessories.has(item_id):
				_fail("%s: unknown accessory template %s" % [context, ContentLoader.py_repr(item_id)])
				return null
			rarity = _registry.accessories[item_id].rarity
			payload = _roll_accessory(item_id, rng)
			if not error.is_empty():
				return null
		"accessory_pool":
			var pool_rarity: int = _rarity(row, rng, context)
			if not error.is_empty():
				return null
			rarity = pool_rarity
			var slot: Variant = row.get("slot")
			if slot != null and not (slot is String):
				_fail("%s: slot must be a string when specified" % context)
				return null
			var picked: Array = _choose_accessory(pool_rarity, rng, "" if slot == null else String(slot), "")
			if not error.is_empty():
				return null
			payload = picked[1]
			item_id = (picked[0] as ContentModels.AccessoryTemplate).accessory_id
		"boss_set_accessory":
			var guarantee: Dictionary = _boss_set_guarantee(stage, boss_id)
			if not error.is_empty():
				return null
			rarity = int(guarantee["guaranteed_rarity"])
			var equipment_resolution: Variant = _registry.drop_pack.get("equipment_resolution")
			var resolution: Variant = (equipment_resolution as Dictionary).get("boss_set_accessory") if equipment_resolution is Dictionary else null
			if not (resolution is String) or not (resolution as String).contains("equal weight"):
				_fail("Boss-set slot resolution must specify equal-weight slot choice")
				return null
			# The slot draw comes first (it is an argument of the reference's call), then the template choice.
			var boss_slot: String = rng.choice(["necklace", "ring"])
			var boss_pick: Array = _choose_accessory(int(rarity), rng, boss_slot, str(guarantee["accessory_set_id"]))
			if not error.is_empty():
				return null
			payload = boss_pick[1]
			item_id = (boss_pick[0] as ContentModels.AccessoryTemplate).accessory_id
		"weapon_pool":
			var weapon_rarity: int = _rarity(row, rng, context)
			if not error.is_empty():
				return null
			rarity = weapon_rarity
			var wanted_weapon_type: Variant = row.get("weapon_type")
			if wanted_weapon_type != null and not (wanted_weapon_type is String):
				_fail("%s: weapon_type must be a string" % context)
				return null
			var signature_ids: Dictionary = {}
			for character: ContentModels.Character in _registry.characters.values():
				signature_ids[character.signature_weapon_id] = true
			var weapon_candidates: Array[ContentModels.Weapon] = []
			for weapon: ContentModels.Weapon in _registry.weapons.values():
				if weapon.rarity == weapon_rarity and weapon.owner_character_id.is_empty() \
						and not signature_ids.has(weapon.weapon_id) \
						and (wanted_weapon_type == null or weapon.weapon_type == wanted_weapon_type):
					weapon_candidates.append(weapon)
			if weapon_candidates.is_empty():
				_fail("%s: no non-signature weapon exists at rarity %d" % [context, weapon_rarity])
				return null
			item_id = (rng.choice(weapon_candidates) as ContentModels.Weapon).weapon_id
		"armor_pool":
			var armor_rarity: int = _rarity(row, rng, context)
			if not error.is_empty():
				return null
			rarity = armor_rarity
			var wanted_armor_type: Variant = row.get("armor_type")
			if wanted_armor_type != null and not (wanted_armor_type is String):
				_fail("%s: armor_type must be a string" % context)
				return null
			var armor_candidates: Array[ContentModels.Armor] = []
			for armor: ContentModels.Armor in _registry.armors.values():
				if armor.rarity == armor_rarity and (wanted_armor_type == null or armor.armor_type == wanted_armor_type):
					armor_candidates.append(armor)
			if armor_candidates.is_empty():
				_fail("%s: no armor template exists at rarity %d" % [context, armor_rarity])
				return null
			item_id = (rng.choice(armor_candidates) as ContentModels.Armor).armor_id
		_:
			_fail("%s: unsupported reward kind %s" % [context, ContentLoader.py_repr(kind)])
			return null

	var granted: GrantedReward = GrantedReward.new()
	granted.reward_id = context
	granted.kind = kind
	granted.quantity = quantity
	granted.item_id = "" if item_id == null else String(item_id)
	granted.rarity = rarity
	granted.payload = payload
	granted.is_first_clear = is_first_clear
	return granted


## Each reward row makes exactly one independent draw from the supplied RNG (even at chance 1.0).
func _chance_passes(row: Dictionary, rng: CpythonRandom, context: String) -> bool:
	var chance: Variant = row.get("chance", 1.0)
	if not _is_number(chance) or float(chance) < 0.0 or float(chance) > 1.0:
		_fail("%s: chance must be a number between 0 and 1" % context)
		return false
	return rng.random() < float(chance)


func _quantity(row: Dictionary, rng: CpythonRandom, context: String) -> int:
	var quantity: Variant = row.get("quantity")
	if quantity != null:
		if not _is_whole(quantity) or int(quantity) < 0:
			_fail("%s: quantity must be a non-negative integer" % context)
			return 0
		return int(quantity)
	var minimum: Variant = row.get("quantity_min", 1)
	var maximum: Variant = row.get("quantity_max", minimum)
	if not _is_whole(minimum) or not _is_whole(maximum) or int(minimum) < 0 or int(maximum) < int(minimum):
		_fail("%s: invalid quantity_min/quantity_max range" % context)
		return 0
	return rng.randint(int(minimum), int(maximum))


func _rarity(row: Dictionary, rng: CpythonRandom, context: String) -> int:
	var rarities: Variant = row.get("rarities")
	if not (rarities is Array) or (rarities as Array).is_empty():
		_fail("%s: rarities must be a non-empty list" % context)
		return 0
	for value: Variant in rarities:
		if not _is_whole(value) or int(value) < 1:
			_fail("%s: rarities must contain positive integers" % context)
			return 0
	return int(rng.choice(rarities))


## The loot RNG seeds its local accessory roller with 64 bits, so seeded replays stay deterministic.
func _roll_accessory(accessory_id: String, rng: CpythonRandom) -> Dictionary:
	var item: Dictionary = _roller.roll_drop_seeded(accessory_id, rng.getrandbits_u64())
	if not _roller.error.is_empty():
		_fail(_roller.error, ERROR_VALUE)
	return item


## [template, rolled accessory]; the slot draw (when no slot is given) precedes the template choice.
func _choose_accessory(rarity: int, rng: CpythonRandom, slot: String, set_id: String) -> Array:
	var pack_slots: Variant = _registry.accessory_slots
	var slots_valid: bool = pack_slots is Array and not (pack_slots as Array).is_empty()
	if slots_valid:
		for value: Variant in pack_slots:
			if not (value is String):
				slots_valid = false
	if not slots_valid:
		_fail("accessories_part1.json/accessory_slots is invalid")
		return []
	var chosen_slot: String = slot
	if chosen_slot.is_empty():
		chosen_slot = rng.choice(pack_slots)
	if not (pack_slots as Array).has(chosen_slot):
		_fail("Unknown accessory slot: %s" % ContentLoader.py_repr(chosen_slot))
		return []
	var candidates: Array[ContentModels.AccessoryTemplate] = []
	for template: ContentModels.AccessoryTemplate in _registry.accessories.values():
		if template.rarity == rarity and template.slot == chosen_slot and (set_id.is_empty() or template.set_id == set_id):
			candidates.append(template)
	if candidates.is_empty():
		var description: String = "rarity %d, slot %s" % [rarity, ContentLoader.py_repr(chosen_slot)]
		if not set_id.is_empty():
			description += ", set %s" % ContentLoader.py_repr(set_id)
		_fail("No accessory template matches %s" % description)
		return []
	var template: ContentModels.AccessoryTemplate = rng.choice(candidates)  # All matching templates have equal weight.
	var rolled: Dictionary = _roll_accessory(template.accessory_id, rng)
	if not error.is_empty():
		return []
	return [template, rolled]


func _boss_set_guarantee(stage: ContentModels.Stage, boss_id: String) -> Dictionary:
	if stage == null:
		_fail("Boss-set drops require stage_id or uniquely resolvable boss context")
		return {}
	var guarantees: Array[Dictionary] = []
	var raw: Variant = _registry.drop_pack.get("boss_set_guarantees")
	var valid: bool = raw is Array
	if valid:
		for row: Variant in raw:
			if row is Dictionary:
				guarantees.append(row)
			else:
				valid = false
	if not valid:
		_fail("drop_tables_part1.json/boss_set_guarantees is invalid")
		return {}
	var matches: Array[Dictionary] = []
	for row: Dictionary in guarantees:
		if _same(row.get("stage_id"), stage.stage_id):
			matches.append(row)
	if not boss_id.is_empty():
		var exact: Array[Dictionary] = []
		for row: Dictionary in matches:
			if _same(row.get("enemy_id"), boss_id):
				exact.append(row)
		if not exact.is_empty():
			matches = exact
		elif not _stage_boss_ids(stage).has(boss_id):
			matches = []
	if matches.size() != 1:
		_fail("No unique boss_set_guarantees entry matches stage %s" % ContentLoader.py_repr(stage.stage_id))
		return {}
	var guarantee: Dictionary = matches[0]
	if not (guarantee.get("accessory_set_id") is String):
		_fail("Boss set guarantee is missing accessory_set_id")
		return {}
	var rarity: Variant = guarantee.get("guaranteed_rarity")
	if not _is_whole(rarity) or int(rarity) < 1:
		_fail("Boss set guarantee has invalid guaranteed_rarity")
		return {}
	return guarantee
