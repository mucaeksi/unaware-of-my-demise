extends GutTest
## G3.3: Equipment reproduces parity/fixtures/equipment_rules.json (core/equipment.py): who may equip which weapon,
## the accessory set bonus and validate_loadout (error count and order are contractual, the text is compared too).

var _registry: ContentModels.ContentRegistry = null
var _equipment: Equipment = null
var _case: Dictionary = {}


func before_all() -> void:
	var loader: ContentLoader = ContentLoader.new()
	_registry = loader.load_dir("res://data/content")
	_equipment = Equipment.new(_registry)
	_case = (ParityFixtures.load_fixture("equipment_rules")["cases"] as Array)[0]


func test_can_equip_weapon_for_every_character_and_weapon() -> void:
	for row: Dictionary in _case["can_equip"]:
		var character: ContentModels.Character = _registry.characters[String(row["character_id"])]
		var allowed: Array = row["weapon_ids"]
		var actual: Array[String] = []
		for weapon: ContentModels.Weapon in _registry.weapons.values():
			if _equipment.can_equip_weapon(character, weapon):
				actual.append(weapon.weapon_id)
		assert_eq(actual, Array(allowed), "weapons %s may equip" % character.character_id)


func test_set_bonus_for_every_necklace_and_ring() -> void:
	var rows: Array = _case["set_bonus"]
	assert_gt(rows.size(), 10)
	for row: Dictionary in rows:
		var necklace: ContentModels.AccessoryTemplate = _registry.accessories[String(row["necklace_id"])]
		var ring: ContentModels.AccessoryTemplate = _registry.accessories[String(row["ring_id"])]
		var bonus: Equipment.StatModifier = _equipment.resolve_set_bonus(necklace, ring)
		assert_eq(_equipment.error, "")
		if row["bonus"] == null:
			assert_null(bonus, "%s + %s has no set bonus" % [row["necklace_id"], row["ring_id"]])
		else:
			assert_eq(ParityCompare.diff(bonus, row["bonus"]), "", "%s + %s" % [row["necklace_id"], row["ring_id"]])


func test_validate_loadout_variants() -> void:
	for row: Dictionary in _case["validate_loadout"]:
		var character: ContentModels.Character = _registry.characters[String(row["character_id"])]
		var weapon: ContentModels.Weapon = _registry.weapons[String(row["weapon_id"])]
		var armor: ContentModels.Armor = null if row["armor_id"] == null else _registry.armors[String(row["armor_id"])]
		var necklace: ContentModels.AccessoryTemplate = null if row["necklace_id"] == null else _registry.accessories[String(row["necklace_id"])]
		var ring: ContentModels.AccessoryTemplate = null if row["ring_id"] == null else _registry.accessories[String(row["ring_id"])]
		var errors: Array[String] = _equipment.validate_loadout(character, weapon, armor, necklace, ring)
		var label: String = "%s / %s" % [row["character_id"], row["variant"]]
		assert_eq(errors.size(), int(row["error_count"]), label + " error count")
		assert_eq(errors, Array(row["errors"]), label + " messages")
