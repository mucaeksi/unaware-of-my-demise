extends GutTest
## G3.5: AccessoryRoller reproduces parity/fixtures/accessories.json (game_logic/accessory_rng.py) draw for draw:
## drops for every template and seed, 300-seed stress rolls, five-step reroll chains, reroll failure paths and the
## half-up rounding rule on exact fractions k/32.

var _registry: ContentModels.ContentRegistry = null
var _roller: AccessoryRoller = null
var _case: Dictionary = {}


func before_all() -> void:
	var loader: ContentLoader = ContentLoader.new()
	_registry = loader.load_dir("res://data/content")
	_roller = AccessoryRoller.new(_registry.accessories)
	_case = (ParityFixtures.load_fixture("accessories")["cases"] as Array)[0]


func test_every_template_and_seed() -> void:
	var drops: Array = _case["drops"]
	assert_eq(drops.size(), 42 * 6)
	for drop: Dictionary in drops:
		var item: Dictionary = _roller.roll_drop_seeded(String(drop["accessory_id"]), String(drop["seed"]).to_int())
		assert_eq(_roller.error, "", "%s seed %s" % [drop["accessory_id"], drop["seed"]])
		assert_eq(ParityCompare.diff(item, drop["item"]), "", "%s seed %s" % [drop["accessory_id"], drop["seed"]])


func test_stress_rolls_of_the_five_star_templates() -> void:
	for entry: Dictionary in _case["stress"]:
		var rolls: Array = entry["rolls"]
		for seed_value: int in range(rolls.size()):
			var item: Dictionary = _roller.roll_drop_seeded(String(entry["accessory_id"]), seed_value)
			var subs: Array = []
			for sub: Dictionary in item["sub_stats"]:
				subs.append([sub["stat_id"], sub["value"]])
			var actual: Array = [item["main_stat"]["stat_id"], item["main_stat"]["value"], subs]
			assert_eq(ParityCompare.diff(actual, rolls[seed_value]), "", "%s seed %d" % [entry["accessory_id"], seed_value])


func test_five_step_reroll_chains() -> void:
	for chain: Dictionary in _case["rerolls"]:
		var item: Dictionary = _roller.roll_drop_seeded(String(chain["accessory_id"]), String(chain["start_seed"]).to_int())
		var inventory: Dictionary = {"items": {String(chain["token"]): 40}, "equipment": [item]}
		for step: Dictionary in chain["steps"]:
			var result: AccessoryRoller.RollResult = _roller.reroll_seeded(item, inventory, String(step["seed"]).to_int())
			assert_eq(_roller.error, "", "%s seed %s" % [chain["accessory_id"], step["seed"]])
			if result == null:
				return
			item = result.item
			inventory = result.inventory
			assert_eq(ParityCompare.diff(item, step["item"]), "", "%s item after seed %s" % [chain["accessory_id"], step["seed"]])
			assert_eq(ParityCompare.diff(inventory, step["inventory"]), "", "%s inventory after seed %s" % [chain["accessory_id"], step["seed"]])


func test_reroll_failure_paths_reject_and_consume_nothing() -> void:
	var templates: Array = []
	for template: ContentModels.AccessoryTemplate in _registry.accessories.values():
		templates.append(template)
	var rerollable: ContentModels.AccessoryTemplate = null
	var fixed_rarity: ContentModels.AccessoryTemplate = null
	for template: ContentModels.AccessoryTemplate in templates:
		var profile: Dictionary = template.rarity_profiles[str(template.rarity)]
		if rerollable == null and bool(profile["is_rerollable"]):
			rerollable = template
		if fixed_rarity == null and not bool(profile["is_rerollable"]):
			fixed_rarity = template
	var fixed: Dictionary = _roller.roll_drop_seeded(rerollable.accessory_id, 5)
	var token_id: String = String((rerollable.rarity_profiles[str(rerollable.rarity)]["reroll_cost"] as Dictionary)["item_id"])
	var locked: Dictionary = fixed.duplicate(true)
	locked["locked"] = true
	var three_star: Dictionary = _roller.roll_drop_seeded(fixed_rarity.accessory_id, 5)
	var cases: Dictionary = {
		"not_enough_tokens": [fixed, {"items": {token_id: 0}, "equipment": [fixed]}],
		"locked": [locked, {"items": {token_id: 9}, "equipment": [locked]}],
		"not_rerollable_rarity": [three_star, {"items": {"any": 9}, "equipment": [three_star]}],
		"instance_not_in_inventory": [fixed, {"items": {token_id: 9}, "equipment": []}],
	}
	var recorded: Array = _case["failures"]
	assert_eq(recorded.size(), 5)
	for row: Dictionary in recorded:
		var name: String = String(row["name"])
		if name == "unknown_template":
			assert_eq(_roller.roll_drop_seeded("no_such_accessory", 1), {}, name)
			assert_ne(_roller.error, "", name)
			continue
		var pair: Array = cases[name]
		var inventory_before: Dictionary = (pair[1] as Dictionary).duplicate(true)
		var result: AccessoryRoller.RollResult = _roller.reroll_seeded(pair[0], pair[1], 1)
		assert_null(result, name + " must be rejected (AccessoryError in the reference)")
		assert_ne(_roller.error, "", name)
		assert_eq(pair[1], inventory_before, name + " leaves the caller's inventory untouched")


func test_the_half_up_rounding_rule_on_exact_fractions() -> void:
	# random() values k/32 are exact doubles, so a real draw can hit them: 0.06 + 0.05 * 0.5 = 0.085 must become 0.09.
	var rows: Array = _case["roll_values"]
	assert_gt(rows.size(), 5)
	for entry: Dictionary in rows:
		var row: Dictionary = {"stat_id": "x", "min_value": entry["min"], "max_value": entry["max"], "unit": entry["unit"]}
		var values: Array = entry["values"]
		for k: int in range(values.size()):
			var rolled: Dictionary = AccessoryRoller.roll_value_from(row, float(k) / 32.0)
			assert_eq(float(rolled["value"]), float(values[k]), "range %s..%s at %d/32" % [entry["min"], entry["max"], k])
