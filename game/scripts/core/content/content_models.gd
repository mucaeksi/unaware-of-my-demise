class_name ContentModels
extends RefCounted
## Engine-neutral, read-only-by-convention records for the Part I content packs (port of core/models.py).
##
## Field names are the Python dataclass names, so parity tests can compare registries generically.
## Conventions of the port:
##   * `str | None` fields are "" when absent (the loader never accepts an empty string for a present value);
##   * `int | None`, `float | None`, `bool | None` and `Any` fields are Variants (null when absent);
##   * tuples are typed Arrays, `Mapping[str, Any]` is a Dictionary whose numbers are floats (Godot's JSON parser
##     does not tell 2 from 2.0; convert with Dec / int() where the reference does);
##   * `extra` holds every JSON key that has no dedicated field, so authored content is never silently dropped.


class EffectOp extends RefCounted:
	var op: String = ""
	var target_selector_id: String = ""
	var parameters: Dictionary = {}


class EffectHook extends RefCounted:
	var event: String = ""
	var effect_ops: Array[EffectOp] = []
	var extra: Dictionary = {}


class Skill extends RefCounted:
	var skill_id: String = ""
	var name_en: String = ""
	var type: String = ""
	var effect_ops: Array[EffectOp] = []
	var element: String = ""
	var target_rule: String = ""
	var target_selector_id: String = ""
	var scale_stat: String = ""
	var multiplier: Variant = null  # float | null
	var multipliers_pct: Array[float] = []
	var cooldown_turns: int = 0
	var focus_cost: int = 0
	var focus_gain_rule: String = ""
	var description_en: String = ""
	var effect_en: String = ""
	var auto_priority: Variant = null  # int | null
	var ai_priority: Variant = null  # int | null
	var damage_type: String = ""
	var phase_ids: Array[String] = []
	var telegraph_rules: Dictionary = {}
	var event_hooks: Array[EffectHook] = []
	var continuous_modifiers: Array[Dictionary] = []
	var brand_mark_id: String = ""
	var extra: Dictionary = {}


class Character extends RefCounted:
	var character_id: String = ""
	var name_en: String = ""
	var gender: String = ""
	var age: int = 0
	var rarity: int = 0
	var element: String = ""
	var class_id: String = ""
	var combat_role: String = ""
	var signature_weapon_id: String = ""
	var equip_weapon_type: String = ""
	var skills: Array[Skill] = []
	var base_stats_level_1: Dictionary = {}
	var growth_per_level: Dictionary = {}
	var level_cap: int = 0
	var acquisition: Variant = null
	var banner_id: String = ""
	var brand_mark_id: String = ""
	var skill_ids: Array[String] = []
	var stat_formula: String = ""
	var formation_affinity: Variant = null
	var balance_status: String = ""
	var extra: Dictionary = {}


class BossObjective extends RefCounted:
	var objective_id: String = ""
	var name_en: String = ""
	var max_hp: int = 0
	var hp: int = 0
	var targetable_by_player: bool = false
	var persists_across_phases: Variant = null  # bool | null
	var on_destroyed: Array[EffectOp] = []
	var extra: Dictionary = {}


class BossPhase extends RefCounted:
	var phase_id: String = ""
	var name_en: String = ""
	var transition: String = ""
	var hp_multiplier: float = 0.0
	var atk_multiplier: float = 0.0
	var def_multiplier: float = 0.0
	var weaknesses: Array[String] = []
	var objectives: Array[BossObjective] = []
	var transition_hp_percent: Variant = null  # float | null
	var passives: Array[Dictionary] = []
	var telegraph: String = ""
	var intent_rules: Dictionary = {}
	var interruptible_by_control: bool = false
	var tauntable: bool = true
	var break_targets: Array[String] = []
	var enter_ops: Array[EffectOp] = []
	var passive_ops: Array[EffectOp] = []
	var signature_action_id: String = ""
	var extra: Dictionary = {}


class Enemy extends RefCounted:
	var enemy_id: String = ""
	var name_en: String = ""
	var faction_id: String = ""
	var role: String = ""
	var element: String = ""
	var base_stats_level_1: Dictionary = {}
	var growth_per_level: Dictionary = {}
	var weaknesses: Array[String] = []
	var resistances: Array[String] = []
	var status_immunities: Array[String] = []
	var skills: Array[Skill] = []
	var phases: Array[BossPhase] = []
	var intent: Dictionary = {}
	var passive_hooks: Array[EffectHook] = []
	var continuous_modifiers: Array[Dictionary] = []
	var passives: Array[Dictionary] = []
	var boss_id: String = ""
	var phase_ids: Array[String] = []
	var drop_table_id: String = ""
	var brand_mark_id: String = ""
	var extra: Dictionary = {}


class EnemyWaveEntry extends RefCounted:
	var enemy_id: String = ""
	var count: int = 0
	var extra: Dictionary = {}


class Stage extends RefCounted:
	var stage_id: String = ""
	var chapter_id: String = ""
	var title_en: String = ""
	var node_type: String = ""
	var recommended_level: int = 0
	var enemy_level: int = 0
	var stamina_cost: int = 0
	var enemy_waves: Array[Array] = []  # waves of EnemyWaveEntry
	var drop_table_id: String = ""
	var boss_id: String = ""
	var boss_phases: Array[String] = []
	var phase_mechanics: Variant = null  # Dictionary | null
	var guest_characters: Array[String] = []
	var story_rewards: Array[Dictionary] = []
	var story_beat_en: String = ""
	## Multiplies every enemy's HP and ATK (level-one value and per-level growth) in this stage. 1.0 = authored stats.
	var enemy_stat_multiplier: float = 1.0
	var extra: Dictionary = {}


class Weapon extends RefCounted:
	var weapon_id: String = ""
	var name_en: String = ""
	var rarity: int = 0
	var weapon_type: String = ""
	var acquisition: Variant = null
	var level_cap: int = 0
	var base_stats_level_1: Dictionary = {}
	var growth_per_level: Dictionary = {}
	var dismantle_xp: int = 0
	var dismantle_allowed: bool = false
	var owner_character_id: String = ""
	var banner_id: String = ""
	var brand_mark_id: String = ""
	var passive_name_en: String = ""
	var passive_effect_en: String = ""
	var passive_effect_id: String = ""
	var dismantle_output: Array[Dictionary] = []
	var balance_status: String = ""
	var extra: Dictionary = {}


class Armor extends RefCounted:
	var armor_id: String = ""
	var name_en: String = ""
	var rarity: int = 0
	var armor_type: String = ""
	var slot: String = ""
	var acquisition: Variant = null
	var level_cap: int = 0
	var base_stats_level_1: Dictionary = {}
	var growth_per_level: Dictionary = {}
	var dismantle_xp: int = 0
	var dismantle_allowed: bool = false
	var brand_mark_id: String = ""
	var dismantle_output: Array[Dictionary] = []
	var tier_id: String = ""
	var extra: Dictionary = {}


class AccessoryTemplate extends RefCounted:
	var accessory_id: String = ""
	var name_en: String = ""
	var rarity: int = 0
	var slot: String = ""
	var set_id: String = ""
	var set_name_en: String = ""
	var possible_main_stats: Array[Dictionary] = []
	var possible_sub_stats: Array[Dictionary] = []
	var rarity_profiles: Dictionary = {}
	var acquisition: Variant = null
	var drop_is_gacha: bool = false
	var brand_mark_id: String = ""
	var flavor_en: String = ""
	var extra: Dictionary = {}


class Item extends RefCounted:
	var item_id: String = ""
	var name_en: String = ""
	var kind: String = ""
	var rarity: Variant = null  # int | null
	var stack_cap: Variant = null  # int | null
	var xp_value: Variant = null  # int | float | null (float here: Godot cannot tell)
	var description_en: String = ""
	var sources: Array[String] = []
	var consumable: bool = false
	var brand_mark_id: String = ""
	var extra: Dictionary = {}


class DropTable extends RefCounted:
	var drop_table_id: String = ""
	var repeatable_rewards: Array[Dictionary] = []
	var first_clear_rewards: Array[Dictionary] = []
	var extra: Dictionary = {}


class Status extends RefCounted:
	var status_id: String = ""
	var name_en: String = ""
	var kind: String = ""
	var default_duration_turns: int = 0
	var tags: Array[String] = []
	var stacking: String = ""
	var source_atk_multiplier_per_tick: Variant = null  # float | null
	var extra: Dictionary = {}


class ContentRegistry extends RefCounted:
	## Part I content indexed by stable ids for direct runtime lookup.
	var characters: Dictionary[String, Character] = {}
	var skills: Dictionary[String, Skill] = {}
	var enemies: Dictionary[String, Enemy] = {}
	var boss_phases: Dictionary[String, BossPhase] = {}
	var boss_objectives: Dictionary[String, BossObjective] = {}
	var stages: Dictionary[String, Stage] = {}
	var weapons: Dictionary[String, Weapon] = {}
	var armors: Dictionary[String, Armor] = {}
	var accessories: Dictionary[String, AccessoryTemplate] = {}
	var items: Dictionary[String, Item] = {}
	var drop_tables: Dictionary[String, DropTable] = {}
	var statuses: Dictionary[String, Status] = {}
	var weapon_types: Dictionary = {}
	var weapon_banners: Dictionary = {}
	var accessory_sets: Dictionary = {}
	var currency_references: Dictionary = {}
	var battle_rules: Dictionary = {}
	var effect_operation_schemas: Dictionary = {}
	## Read by core/equipment.py straight from the packs (validated on use there, not at load): the accessory slot
	## names (`accessories_part1.json`) and the armor slot count (`armors_part1.json`). Raw JSON values, null if absent.
	## The `contract` object of battle_effects_part1.json (selector rules, predicates, events, operation schemas): the
	## effect interpreter's rulebook, raw JSON.
	var effect_contract: Dictionary = {}
	## The raw `drop_tables_part1.json` object (claim keys, boss-set guarantees, equipment resolution notes, per-table
	## claim scopes): the loot resolver reads them straight from the pack, as backend/loot_service.py does.
	var drop_pack: Dictionary = {}
	var accessory_slots: Variant = null
	var armor_slot_count: Variant = null
