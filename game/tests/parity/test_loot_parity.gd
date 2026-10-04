extends GutTest
## G3.7: LootResolver reproduces parity/fixtures/loot.json (backend/loot_service.py `resolve_battle_rewards`): every stage's
## drop table with and without first-clear rows over 12 seeds (rewards, accessory rolls and the position of the RNG stream
## afterwards), a stage cleared twice on one account, the reference's failures, and hand-made tables that reach every
## validation branch of the resolver.

const ACCOUNT: String = "parity_account"
const SYNTHETIC_TABLE: String = "synthetic_table"

var _registry: ContentModels.ContentRegistry = null
var _resolver: LootResolver = null
var _fixture: Dictionary = {}
var _always_new: Callable = func(_account_id: String, _claim_type: String) -> bool: return true


func before_all() -> void:
	var loader: ContentLoader = ContentLoader.new()
	_registry = loader.load_dir("res://data/content")
	assert_not_null(_registry, "content must load")
	_resolver = LootResolver.create(_registry)
	_fixture = ParityFixtures.load_fixture("loot")


func _resolve(stage: ContentModels.Stage, first_clear: bool, rng: CpythonRandom, claim: Callable) -> Array[LootResolver.GrantedReward]:
	return _resolver.resolve_battle_rewards(stage.drop_table_id, first_clear, ACCOUNT, claim, rng, stage.stage_id, stage.boss_id)


func test_every_stage_first_clear_and_seed() -> void:
	var cases: Array = _fixture["cases"]
	assert_eq(cases.size(), 35 * 2 * 12)
	for entry: Dictionary in cases:
		var stage: ContentModels.Stage = _registry.stages[String(entry["stage_id"])]
		var rng: CpythonRandom = CpythonRandom.create_from_int(String(entry["seed"]).to_int())
		var label: String = "%s first_clear=%s seed=%s" % [entry["stage_id"], entry["first_clear"], entry["seed"]]
		var rewards: Array[LootResolver.GrantedReward] = _resolve(stage, bool(entry["first_clear"]), rng, _always_new)
		assert_eq(_resolver.error, "", label)
		assert_eq(ParityCompare.diff(rewards, entry["rewards"]), "", label)
		assert_eq(rng.random_u53(), int(entry["rng_next_u53"]), label + " (draws consumed)")
		assert_eq(String(entry["drop_table_id"]), stage.drop_table_id)


func test_the_same_stage_cleared_twice_pays_first_clear_rows_once() -> void:
	var replays: Array = _fixture["replays"]
	assert_eq(replays.size(), 35)
	for entry: Dictionary in replays:
		var stage: ContentModels.Stage = _registry.stages[String(entry["stage_id"])]
		var rng: CpythonRandom = CpythonRandom.create_from_int(String(entry["seed"]).to_int())
		var claimed: Dictionary = {}
		var ledger: Callable = func(account_id: String, claim_type: String) -> bool:
			var key: String = account_id + "|" + claim_type
			if claimed.has(key):
				return false
			claimed[key] = true
			return true
		var first: Array[LootResolver.GrantedReward] = _resolve(stage, true, rng, ledger)
		var second: Array[LootResolver.GrantedReward] = _resolve(stage, true, rng, ledger)
		assert_eq(_resolver.error, "", stage.stage_id)
		assert_eq(ParityCompare.diff(first, entry["first"]), "", stage.stage_id + " first")
		assert_eq(ParityCompare.diff(second, entry["second"]), "", stage.stage_id + " second")


func test_failures_are_reported_as_errors_without_a_partial_result() -> void:
	var results: Dictionary = {}
	var shared: ContentModels.Stage = null
	for stage: ContentModels.Stage in _registry.stages.values():
		if not stage.boss_id.is_empty() and shared == null:
			shared = stage
	var calls: Dictionary = {
		"shared_boss_table_without_stage": func() -> Array[LootResolver.GrantedReward]:
			return _resolver.resolve_battle_rewards(shared.drop_table_id, true, ACCOUNT, _always_new, CpythonRandom.create_from_int(1)),
		"unknown_drop_table": func() -> Array[LootResolver.GrantedReward]:
			return _resolver.resolve_battle_rewards("no_such_table", false, ACCOUNT, _always_new, CpythonRandom.create_from_int(1)),
		"empty_account": func() -> Array[LootResolver.GrantedReward]:
			return _resolver.resolve_battle_rewards(_registry.drop_tables.keys()[0], false, "", _always_new, CpythonRandom.create_from_int(1)),
	}
	for name: String in calls:
		var rewards: Array[LootResolver.GrantedReward] = (calls[name] as Callable).call()
		assert_ne(_resolver.error, "", name)
		assert_true(rewards.is_empty(), name)
		results[name] = _resolver.error_kind
	for failure: Dictionary in _fixture["failures"]:
		assert_eq(results[failure["name"]], failure["raises"], String(failure["name"]))


func test_claim_ledger_is_asked_only_for_first_clear_rows() -> void:
	var asked: Array = []
	var ledger: Callable = func(account_id: String, claim_type: String) -> bool:
		asked.append([account_id, claim_type])
		return true
	var stage: ContentModels.Stage = _registry.stages["1-1"]
	_resolve(stage, false, CpythonRandom.create_from_int(1), ledger)
	assert_eq(asked, [], "no claim without the first-clear flag")
	_resolve(stage, true, CpythonRandom.create_from_int(1), ledger)
	assert_eq(asked, [[ACCOUNT, "first_clear_stage:1-1"]])
	# A refused (duplicate) claim grants and draws nothing beyond the repeatable rows.
	var refusing: Callable = func(_account_id: String, _claim_type: String) -> bool: return false
	var rng_refused: CpythonRandom = CpythonRandom.create_from_int(1)
	var rng_plain: CpythonRandom = CpythonRandom.create_from_int(1)
	var refused: Array[LootResolver.GrantedReward] = _resolve(stage, true, rng_refused, refusing)
	var plain: Array[LootResolver.GrantedReward] = _resolve(stage, false, rng_plain, refusing)
	assert_eq(refused.size(), plain.size())
	assert_eq(rng_refused.random_u53(), rng_plain.random_u53())


# -- hand-made tables --------------------------------------------------------------


func _drop_table_of(rows: Array, first_clear_rows: Array) -> ContentModels.DropTable:
	var table: ContentModels.DropTable = ContentModels.DropTable.new()
	table.drop_table_id = SYNTHETIC_TABLE
	for row: Dictionary in rows:
		table.repeatable_rewards.append(row)
	for row: Dictionary in first_clear_rows:
		table.first_clear_rewards.append(row)
	return table


func test_synthetic_tables_reach_every_validation_branch() -> void:
	var synthetic: Array = _fixture["synthetic"]
	assert_gt(synthetic.size(), 70)
	var raised: int = 0
	var succeeded: int = 0
	for entry: Dictionary in synthetic:
		var scenario: Dictionary = entry["scenario"]
		var expected: Dictionary = entry["result"]
		var name: String = String(scenario["name"])
		var first_clear_rows: Array = scenario.get("first_clear", [])
		var raw: Dictionary = {
			"drop_table_id": SYNTHETIC_TABLE, "repeatable_rewards": scenario["repeatable"],
			"first_clear_rewards": first_clear_rows,
			"first_clear_claim_scope": scenario.get("claim_scope", "account_id+stage_id"),
		}
		var bound: String = String(scenario.get("bind_stage", ""))
		var original_table: String = ""
		_registry.drop_tables[SYNTHETIC_TABLE] = _drop_table_of(scenario["repeatable"], first_clear_rows)
		(_registry.drop_pack["drop_tables"] as Array).append(raw)
		if not bound.is_empty():
			original_table = _registry.stages[bound].drop_table_id
			_registry.stages[bound].drop_table_id = SYNTHETIC_TABLE
		var rng: CpythonRandom = CpythonRandom.create_from_int(int(scenario["seed"]))
		var stage_id: String = String(scenario.get("stage_id", bound))
		var rewards: Array[LootResolver.GrantedReward] = _resolver.resolve_battle_rewards(
			SYNTHETIC_TABLE, bool(scenario.get("is_first_clear", false)), ACCOUNT, _always_new, rng, stage_id, String(scenario.get("boss_id", "")))
		var error: String = _resolver.error
		var error_kind: String = _resolver.error_kind
		var next_draw: int = rng.random_u53()
		_registry.drop_tables.erase(SYNTHETIC_TABLE)
		(_registry.drop_pack["drop_tables"] as Array).erase(raw)
		if not bound.is_empty():
			_registry.stages[bound].drop_table_id = original_table
		if expected["raises"] != null:
			raised += 1
			assert_eq(error_kind, String(expected["raises"]), name)
			assert_eq(error, String(expected["message"]), name)
			assert_true(rewards.is_empty(), name)
		else:
			succeeded += 1
			assert_eq(error, "", name)
			assert_eq(ParityCompare.diff(rewards, expected["rewards"]), "", name)
			assert_eq(next_draw, int(expected["rng_next_u53"]), name + " (draws consumed)")
	assert_gt(raised, 40)
	assert_gt(succeeded, 20)
