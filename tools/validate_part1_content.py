"""Read-only structural and cross-pack audit for the Part I design data.

Migrated from LEGACY ``tools/validate_part1_content.py`` (Drive ``1wxfuSGYev63Q1A7cY5szVbz3KUxuioSq``, git blob
``65a9ff0``, 53,071 B; MIG-0041). Adapted for this repository (INF-021):

* the content packs live in ``game/data/content`` (the single authoring source; LEGACY mirrored ``content/`` there);
* a battle rule key declared runtime-consumed must be read by both engines that judge battles: the Godot client
  (GDScript, as a ``"key"`` string literal) and the Worker (TypeScript, as the identifier ``key``);
* the Ration contract follows DEC-0014 (cap 100, one unit per 300 s).

    python3 tools/validate_part1_content.py     # read-only; exit 1 on any error (CI job ``content``)
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "game" / "data" / "content"
ERRORS: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        ERRORS.append(message)


def load_pack(name: str, content_dir: Path = CONTENT) -> dict:
    path = content_dir / name
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        require(isinstance(value, dict), f"{name}: root must be a JSON object")
        return value
    except (OSError, json.JSONDecodeError) as exc:
        ERRORS.append(f"{name}: cannot load valid UTF-8 JSON ({exc})")
        return {}


def unique_ids(rows: list[dict], field: str, label: str) -> set[str]:
    values = [row.get(field) for row in rows]
    require(all(isinstance(value, str) and value for value in values), f"{label}: missing {field}")
    duplicates = [value for value, count in Counter(values).items() if count > 1]
    require(not duplicates, f"{label}: duplicate {field}: {duplicates}")
    return {value for value in values if isinstance(value, str)}


def collect_mark_ids(value) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            if key in ("logo_id", "mark_id") and isinstance(child, str):
                found.add(child)
            found.update(collect_mark_ids(child))
    elif isinstance(value, list):
        for child in value:
            found.update(collect_mark_ids(child))
    return found


def check_mark_refs(rows: list[dict], known: set[str], label: str) -> None:
    for row in rows:
        mark = row.get("brand_mark_id")
        if mark:
            require(mark in known, f"{label}/{row.get('character_id') or row.get('enemy_id') or row.get('item_id') or row.get('weapon_id') or row.get('armor_id') or row.get('accessory_id')}: unknown brand mark {mark}")


# -- Rule-key consumption audit (Faz 6) -------------------------------------
#
# Every key in battle_rules_part1.json (top level, and one level into object
# blocks) must be classified. A key added to content without being wired
# into the engine -- or without being consciously recorded as descriptive --
# fails validation, so "authored but silently ignored" rules cannot appear.

# path -> (client GDScript file, server TypeScript file); each must read the key (see check_rule_key_consumption).
RUNTIME_RULE_KEYS: dict[str, tuple[str, str]] = {
    **{f"party.{key}": ("game/scripts/core/story/story_state.gd", "server/src/engine/story.ts") for key in ("size", "front", "rear", "tutorial_exception")},
    **{f"turn_queue.{key}": ("game/scripts/core/battle/gauge_rules.gd", "server/src/engine/battle/rules.ts")
       for key in ("gauge_max", "effective_speed_floor", "maximum_pending_delay_fraction")},
    **{f"stat_resolution.{key}": ("game/scripts/core/battle/battle_unit.gd", "server/src/engine/battle/unit.ts")
       for key in ("minimum_hp", "minimum_defense", "minimum_speed")},
    **{f"damage.{key}": ("game/scripts/core/battle/damage.gd", "server/src/engine/battle/damage.ts")
       for key in ("defense_scale", "defense_stat_by_damage_type", "missing_res_stat_fallback",
                   "element_chart", "critical_chance_default", "critical_chance_cap",
                   "critical_multiplier_default", "minimum_final_damage")},
    **{f"focus.{key}": ("game/scripts/core/battle/focus_rules.gd", "server/src/engine/battle/rules.ts")
       for key in ("maximum", "basic_attack_gain", "active_skill_gain", "taking_hit_gain_per_hit",
                   "taking_hit_gain_max_per_actor_turn", "ultimate_cost", "death_resets_focus")},
    "statuses": ("game/scripts/core/battle/effect_interpreter.gd", "server/src/engine/battle/interpreter.ts"),
    "targeting.boss_control_duration_multiplier": ("game/scripts/core/battle/effect_interpreter.gd", "server/src/engine/battle/interpreter.ts"),
    "targeting.boss_control_immunities_default": ("game/scripts/core/battle/effect_interpreter.gd", "server/src/engine/battle/interpreter.ts"),
    **{f"character_progression.{key}": ("game/scripts/core/progression/progression.gd", "server/src/engine/progression.ts")
       for key in ("level_cap", "xp_curve", "level_up_silver_crowns", "ascension")},
    **{f"account_progression.{key}": ("game/scripts/core/progression/progression.gd", "server/src/engine/progression.ts") for key in ("level_cap", "xp_to_next")},
    **{f"equipment_progression.{key}": ("game/scripts/core/progression/progression.gd", "server/src/engine/progression.ts")
       for key in ("level_cap", "xp_to_next", "level_up_silver_crowns", "milestone_item_id", "milestones")},
    "equipment_progression.xp_resource_id": ("game/scripts/services/service_rules.gd", "server/src/equipment.ts"),
    **{f"skill_progression.{key}": ("game/scripts/core/progression/progression.gd", "server/src/engine/progression.ts")
       for key in ("damage_heal_shield_multiplier_bonus_per_rank", "max_rank_by_skill_type",
                   "unlock_character_level", "upgrade_cost", "upgrade_item_by_skill_type")},
    "memory_nodes": ("game/scripts/core/progression/progression.gd", "server/src/engine/progression.ts"),
    **{f"auto_battle.{key}": ("game/scripts/core/battle/auto_battle.gd", "server/src/engine/battle/auto.ts")
       for key in ("heal_priority_hp_percent", "save_ultimate_until_boss",
                   "objective_automatic_targeting_authored")},
    **{f"victory_stars.{key}": ("game/scripts/core/battle/victory_star_rules.gd", "server/src/engine/battle/rules.ts")
       for key in ("victory_requires_at_least_one_living_hero",
                   "loaned_story_heroes_count_as_selected_heroes", "three_stars", "two_stars",
                   "one_star", "defeat_stars")},
    **{f"story_loan_equipment.{key}": ("game/scripts/core/battle/battle_service.gd", "server/src/engine/battle/service.ts")
       for key in ("rarity", "armor_id", "accessory_set_id")},
}

# Metadata, prose, or a behavior the engine implements as fixed code whose
# authored value must therefore stay as pinned (None = free text/metadata).
DESCRIPTIVE_RULE_KEYS: dict[str, object] = {
    "schema_version": None, "pack_id": None, "balance_status": None,
    "effect_interpreter_pack_id": None,  # cross-checked against battle_effects above
    **{f"turn_queue.{key}": None for key in (
        "model", "initial_gauge", "gauge_gain_per_time_unit", "ready_when", "after_action",
        "speed_change_timing", "tie_break", "delay_is_fraction_of_next_action_gauge",
        "delay_resolution", "cycle_definition", "per_round_limit_scope", "new_wave_gauge")},
    "turn_queue.cooldown_decrements_at_owner_turn_start": True,
    **{f"stat_resolution.{key}": None for key in (
        "character_base_stat", "growth_scale_note", "equipment_flat_order",
        "same_stat_percent_modifiers", "effective_stat_rounding", "res_stat_fallback")},
    **{f"damage.{key}": None for key in (
        "formula", "target_defense_resolution", "modifier_order", "same_category_damage_multipliers",
        "critical_roll_scope", "damage_integer_rounding", "hit_count", "shield_absorption_order")},
    **{f"status_timing.{key}": None for key in (
        "turn_start_order", "same_status_refresh", "dot_tick", "control_duration_rounding",
        "status_applied_by_turn_start_hook")},
    "status_timing.duration_decrements_at_owner_turn_start": True,
    "status_timing.cooldown_decrements_at_owner_turn_start": True,
    **{f"targeting.{key}": None for key in ("front_row_protection", "area_targeting", "enemy_taunt")},
    "targeting.critical_telegraph_interruptible": False,
    "character_progression.stat_rounding": "half_up",
    "character_progression.player_level_cap_gate": True,
    "account_progression.xp_source": None,
    "equipment_progression.applies_to": None,
    "skill_progression.balance_status": None,
    "equipment_progression.balance_status": None,
    "auto_battle.deterministic_seed_required": True,
    **{f"auto_battle.{key}": None for key in ("skill_order", "target_tie_break",
                                              "single_target_objective_priority")},
    **{f"boss_phase_health.{key}": None for key in (
        "contract", "maximum_hp_formula", "phase_transition_threshold_source")},
    "boss_phase_health.phase_weakness_overrides_same_element_inherited_resistance": True,
    **{f"story_loan_equipment.{key}": None for key in (
        "template_id", "weapon_selection", "accessory_slots", "accessory_roll_seed")},
}

# Behavioral keys the engine does NOT implement yet. Reported as warnings,
# never silently dropped; move a key to RUNTIME_RULE_KEYS when wired.
KNOWN_UNCONSUMED_RULE_KEYS: dict[str, str] = {}


def rule_key_paths(rules: dict) -> list[str]:
    paths = []
    for key, value in rules.items():
        if isinstance(value, dict):
            paths.extend(f"{key}.{sub}" for sub in value)
        else:
            paths.append(key)
    return paths


def check_rule_key_consumption(rules: dict, root: Path = ROOT) -> list[str]:
    """Return warnings; append errors via ``require``."""

    warnings: list[str] = []
    sources: dict[str, str] = {}
    for path in rule_key_paths(rules):
        if path in RUNTIME_RULE_KEYS:
            key = path.rsplit(".", 1)[-1]
            client_file, server_file = RUNTIME_RULE_KEYS[path]
            for source_file in (client_file, server_file):
                if source_file not in sources:
                    try:
                        sources[source_file] = (root / source_file).read_text(encoding="utf-8")
                    except OSError:
                        sources[source_file] = ""
            require(f'"{key}"' in sources[client_file],
                    f"battle_rules.{path} is declared runtime-consumed but {client_file} never reads \"{key}\"")
            require(re.search(rf"\b{re.escape(key)}\b", sources[server_file]) is not None,
                    f"battle_rules.{path} is declared runtime-consumed but {server_file} never reads {key}")
        elif path in DESCRIPTIVE_RULE_KEYS:
            pinned = DESCRIPTIVE_RULE_KEYS[path]
            if pinned is not None:
                block, _, key = path.partition(".")
                value = rules[block][key] if key else rules[block]
                require(value == pinned,
                        f"battle_rules.{path} = {value!r}, but the engine only implements {pinned!r}")
        elif path in KNOWN_UNCONSUMED_RULE_KEYS:
            warnings.append(f"battle_rules.{path}: not implemented ({KNOWN_UNCONSUMED_RULE_KEYS[path]})")
        else:
            require(False, f"battle_rules.{path} is not consumed by the engine and not recorded as "
                           "descriptive (tools/validate_part1_content.py RUNTIME_RULE_KEYS / DESCRIPTIVE_RULE_KEYS)")
    return warnings


def unused_drop_tables(drop_tables: list[dict], stages: list[dict]) -> list[str]:
    """Drop tables no stage uses. The runtime resolves loot per *stage*
    (backend.loot_service via stage.drop_table_id) only; enemies[].
    drop_table_id (per-kill drops) is never resolved."""

    used = {stage.get("drop_table_id") for stage in stages}
    return sorted(row.get("drop_table_id") for row in drop_tables if row.get("drop_table_id") not in used)


def main(content_dir: Path = CONTENT) -> int:
    ERRORS.clear()
    content_dir = Path(content_dir)
    names = sorted(path.name for path in content_dir.glob("*.json"))
    packs = {name.removesuffix(".json"): load_pack(name, content_dir) for name in names}
    required = {
        "characters_part1", "enemies_part1", "weapons_part1", "armors_part1",
        "accessories_part1", "items_part1", "drop_tables_part1", "stages_part1",
        "battle_rules_part1", "battle_effects_part1", "economy_part1", "chapters_part1", "brand_assets_part1",
        "story_script_part1_manifest",
    }
    require(required <= packs.keys(), f"Missing required packs: {sorted(required - packs.keys())}")
    get = lambda key: packs.get(key, {})

    chars = get("characters_part1").get("characters", [])
    enemies = get("enemies_part1").get("enemies", [])
    weapons = get("weapons_part1").get("weapons", [])
    armors = get("armors_part1").get("armors", [])
    accessories = get("accessories_part1").get("accessories", [])
    items = get("items_part1").get("items", [])
    stages = get("stages_part1").get("stages", [])
    drop_tables = get("drop_tables_part1").get("drop_tables", [])
    chapters = get("chapters_part1").get("chapters", [])

    char_ids = unique_ids(chars, "character_id", "characters")
    enemy_ids = unique_ids(enemies, "enemy_id", "enemies")
    weapon_ids = unique_ids(weapons, "weapon_id", "weapons")
    weapons_by_id = {row.get("weapon_id"): row for row in weapons}
    unique_ids(armors, "armor_id", "armors")
    accessory_ids = unique_ids(accessories, "accessory_id", "accessories")
    item_ids = unique_ids(items, "item_id", "items")
    stage_ids = unique_ids(stages, "stage_id", "stages")
    drop_ids = unique_ids(drop_tables, "drop_table_id", "drop tables")

    require(len(chars) == 20, f"Expected 20 playable characters, found {len(chars)}")
    require(Counter(row.get("gender") for row in chars) == Counter({"female": 18, "male": 2}), "Roster gender distribution must be 18 female / 2 male")
    require(all(isinstance(row.get("age"), int) and row["age"] >= 18 for row in chars), "Every playable character must be explicitly an adult")
    require(len(enemies) == 27 and sum(bool(row.get("boss_id")) for row in enemies) == 7, "Enemy pack must contain 20 normal enemies and 7 bosses")
    require(len(weapons) == 180, f"Expected 180 weapons, found {len(weapons)}")
    require(len(armors) == 36, f"Expected 36 armor records, found {len(armors)}")
    require(len(accessories) == 42, f"Expected 42 accessory templates, found {len(accessories)}")
    require(len(stages) == 35, f"Expected 35 stage nodes, found {len(stages)}")
    require(len(chapters) == 7 and all(len(row.get("nodes", [])) == 5 for row in chapters), "Chapter source must contain seven chapters with five nodes each")

    weapon_type_counts = Counter((row.get("weapon_type"), row.get("rarity")) for row in weapons if not row.get("owner_character_id"))
    weapon_type_ids = {row.get("weapon_type") for row in get("weapons_part1").get("weapon_types", [])}
    require(len(weapon_type_ids) == 20, f"Expected 20 weapon types, found {len(weapon_type_ids)}")
    require(all(weapon_type_counts[(weapon_type, rarity)] == 4 for weapon_type in weapon_type_ids for rarity in (3, 4)), "Each of 20 weapon types must have four common 3-star and four common 4-star weapons")
    signatures = [row for row in weapons if row.get("owner_character_id")]
    require(len(signatures) == 20 and all(row.get("rarity") == 5 and row.get("dismantle_allowed") is False for row in signatures), "Each character must have one non-dismantleable 5-star signature weapon")
    require({row.get("owner_character_id") for row in signatures} == char_ids, "Signature weapons must cover each playable character exactly once")
    accessory_sets = {row.get("set_id") for row in get("accessories_part1").get("sets", [])}
    for accessory in accessories:
        require(accessory.get("slot") in {"necklace", "ring"}, f"{accessory.get('accessory_id')}: unsupported slot")
        require(accessory.get("set_id") in accessory_sets, f"{accessory.get('accessory_id')}: unknown set")
        for pool_name in ("possible_main_stats", "possible_sub_stats"):
            pool = accessory.get(pool_name, [])
            require(bool(pool) and all(float(row.get("weight", 0)) > 0 for row in pool), f"{accessory.get('accessory_id')}: invalid {pool_name} weights")
        rarity = accessory.get("rarity")
        profile = accessory.get("rarity_profiles", {}).get(str(rarity), {})
        require(bool(profile), f"{accessory.get('accessory_id')}: missing rarity profile {rarity}")
        require(profile.get("is_rerollable") is (rarity >= 4), f"{accessory.get('accessory_id')}: reroll availability mismatch for rarity {rarity}")
        if rarity >= 4:
            cost = profile.get("reroll_cost", {})
            require(cost.get("item_id") == "unwritten_hour_cinder" and cost.get("quantity") == (3 if rarity == 4 else 6), f"{accessory.get('accessory_id')}: reroll token cost mismatch for rarity {rarity}")

    for character in chars:
        character_id = character.get("character_id")
        signature_weapon_id = character.get("signature_weapon_id")
        require(signature_weapon_id in weapon_ids, f"{character_id}: missing signature weapon")
        equip_weapon_type = character.get("equip_weapon_type")
        require(isinstance(equip_weapon_type, str) and equip_weapon_type in weapon_type_ids,
                f"{character_id}: equip_weapon_type {equip_weapon_type!r} is not in weapons_part1.weapon_types")
        signature_weapon = weapons_by_id.get(signature_weapon_id)
        if signature_weapon is not None:
            require(equip_weapon_type == signature_weapon.get("weapon_type"),
                    f"{character_id}: equip_weapon_type {equip_weapon_type!r} does not match signature weapon "
                    f"{signature_weapon_id!r} type {signature_weapon.get('weapon_type')!r}")
        skills = character.get("skills", [])
        require(Counter(skill.get("type") for skill in skills) == Counter({"basic": 1, "active": 1, "passive": 1, "ultimate": 1}), f"{character.get('character_id')}: expected one basic/active/passive/ultimate skill")
        for skill in skills:
            has_ops = isinstance(skill.get("effect_ops"), list) and bool(skill["effect_ops"])
            has_passive_contract = skill.get("type") == "passive" and bool(skill.get("event_hooks") or skill.get("continuous_modifiers"))
            require(has_ops or has_passive_contract, f"{skill.get('skill_id')}: missing executable effect or passive hook")
    skill_ids = [skill.get("skill_id") for char in chars for skill in char.get("skills", [])]
    require(len(skill_ids) == len(set(skill_ids)), "Character skill IDs must be globally unique")

    stage_by_id = {stage.get("stage_id"): stage for stage in stages}
    chapter_stage_ids = [node.get("stage_id") for chapter in chapters for node in chapter.get("nodes", [])]
    require(set(chapter_stage_ids) == stage_ids, "Flattened stage IDs do not match chapter source IDs")
    for stage in stages:
        require(stage.get("drop_table_id") in drop_ids, f"{stage.get('stage_id')}: unknown drop table {stage.get('drop_table_id')}")
        story_rewards = stage.get("story_rewards", [])
        require(isinstance(story_rewards, list), f"{stage.get('stage_id')}: story_rewards must be an array")
        for reward in story_rewards:
            require(isinstance(reward, dict), f"{stage.get('stage_id')}: story reward must be an object")
            if not isinstance(reward, dict):
                continue
            if reward.get("recruit_character_id"):
                require(reward["recruit_character_id"] in char_ids,
                        f"{stage.get('stage_id')}: unknown story recruit {reward['recruit_character_id']}")
            if reward.get("grant_item_id"):
                require(reward["grant_item_id"] in item_ids,
                        f"{stage.get('stage_id')}: unknown story item {reward['grant_item_id']}")
        for wave in stage.get("enemy_waves", []):
            for entry in wave:
                require(entry.get("enemy_id") in enemy_ids, f"{stage.get('stage_id')}: unknown enemy {entry.get('enemy_id')}")
        if stage.get("boss_id"):
            boss = next((enemy for enemy in enemies if enemy.get("boss_id") == stage["boss_id"]), None)
            require(boss is not None, f"{stage.get('stage_id')}: unknown boss_id {stage['boss_id']}")
            if boss:
                require(stage.get("boss_phases") == boss.get("phase_ids"), f"{stage.get('stage_id')}: boss phase IDs differ from enemy record")

    currencies = {row.get("id") for row in get("economy_part1").get("currencies", [])}
    currency_refs = {row.get("item_id") for row in get("items_part1").get("currency_references", [])}
    require(currency_refs == currencies, "Items currency references do not match economy currency IDs")
    item_id_set = item_ids | currencies
    for table in drop_tables:
        for reward in table.get("repeatable_rewards", []) + table.get("first_clear_rewards", []):
            kind, item_id = reward.get("kind"), reward.get("item_id")
            if kind in ("item", "currency", "accessory") and item_id:
                known = item_id_set if kind == "currency" else item_ids if kind == "item" else accessory_ids
                require(item_id in known, f"{table.get('drop_table_id')}/{reward.get('reward_id')}: unknown {kind} ID {item_id}")
        for reward in table.get("repeatable_rewards", []) + table.get("first_clear_rewards", []):
            if reward.get("kind") == "item_pool":
                for item_id in reward.get("item_ids", []):
                    require(item_id in item_ids, f"{table.get('drop_table_id')}: unknown pooled item {item_id}")
    for character in chars:
        require(character.get("signature_weapon_id") in weapon_ids, f"{character.get('character_id')}: signature weapon reference invalid")
    for weapon in weapons:
        owner = weapon.get("owner_character_id")
        if owner:
            require(owner in char_ids, f"{weapon.get('weapon_id')}: unknown owner {owner}")
    for pair in get("economy_part1").get("banners", {}).get("signature_pairs", []):
        require(pair.get("character_id") in char_ids, f"{pair.get('banner_id')}: unknown featured character")
        require(pair.get("weapon_id") in weapon_ids, f"{pair.get('banner_id')}: unknown featured weapon")
    selected_signatures = get("economy_part1").get("banners", {}).get("standard_signature_weapon", {}).get("selected_signature_ids", [])
    require(len(selected_signatures) == 15 and len(set(selected_signatures)) == 15 and set(selected_signatures) <= weapon_ids, "Hall of Armaments must target 15 distinct valid signatures")
    paired_signatures = [pair.get("weapon_id") for pair in get("economy_part1").get("banners", {}).get("signature_pairs", [])]
    all_signature_ids = {row.get("weapon_id") for row in signatures}
    require(len(paired_signatures) == 5 and len(set(paired_signatures)) == 5 and set(paired_signatures).isdisjoint(selected_signatures) and set(paired_signatures) | set(selected_signatures) == all_signature_ids, "Five limited pairs plus Hall of Armaments must cover all 20 signature weapons without overlap")
    for guarantee in get("drop_tables_part1").get("boss_set_guarantees", []):
        require(guarantee.get("stage_id") in stage_ids, f"Boss drop guarantee references unknown stage {guarantee.get('stage_id')}")
        require(guarantee.get("accessory_set_id") in accessory_sets, f"Boss drop guarantee references unknown accessory set {guarantee.get('accessory_set_id')}")

    for enemy in enemies:
        if enemy.get("boss_id"):
            require(enemy.get("status_immunities") == [], f"{enemy.get('enemy_id')}: bosses must not have blanket control/status immunity")
            require(enemy.get("control_rules", {}).get("control_duration_multiplier") == 0.5, f"{enemy.get('enemy_id')}: boss control duration must be halved")
            require(all(phase.get("interruptible_by_control") is False for phase in enemy.get("phases", [])), f"{enemy.get('enemy_id')}: critical boss telegraph should be marked uninterruptible")

    battle_rules = get("battle_rules_part1")
    turn_queue = battle_rules.get("turn_queue", {})
    stat_rules = battle_rules.get("stat_resolution", {})
    damage_rules = battle_rules.get("damage", {})
    require(turn_queue.get("model") == "continuous_action_gauge" and turn_queue.get("gauge_max") == 10000 and turn_queue.get("initial_gauge") == 0, "Turn queue must use the versioned 10,000-point Action Gauge contract")
    require(turn_queue.get("effective_speed_floor") == 1 and turn_queue.get("maximum_pending_delay_fraction") == 0.5, "Action Gauge speed/delay bounds are invalid")
    require("pending_delay_gauge" in turn_queue.get("ready_when", "") and "preserve_overflow" in turn_queue.get("after_action", ""), "Action Gauge readiness must include delay debt and preserve overflow")
    require("cycle closes" in turn_queue.get("cycle_definition", "") and turn_queue.get("per_round_limit_scope") == "one_trigger_per_cycle", "Action cycle/per-round trigger contract is missing")
    require(stat_rules.get("equipment_flat_order") == "add_flat_equipment_before_percent_modifiers" and stat_rules.get("same_stat_percent_modifiers") == "sum_additively_then_apply_once" and stat_rules.get("effective_stat_rounding") == "half_up_to_integer", "Effective stat resolution order or rounding is invalid")
    require(stat_rules.get("minimum_speed") == 1 and stat_rules.get("minimum_defense") == 0 and stat_rules.get("minimum_hp") == 1, "Effective combat stat floors are missing")
    require(stat_rules.get("res_stat_fallback") and damage_rules.get("missing_res_stat_fallback") == "def", "RES fallback must remain explicit while no base RES curve exists")
    require(damage_rules.get("critical_chance_default") == 0.05 and damage_rules.get("critical_chance_cap") == 1.0 and damage_rules.get("critical_multiplier_default") == 1.5, "Critical chance/multiplier defaults are invalid")
    require(damage_rules.get("minimum_final_damage") == 1 and damage_rules.get("damage_integer_rounding") == "floor_per_damage_packet", "Damage packet rounding/minimum rule is missing")
    require("shield_absorption" == damage_rules.get("modifier_order", [])[-1], "Shields must absorb after mitigation, critical calculation and final damage rounding")

    # Runtime-facing battle effects must resolve against the closed v1 contract.
    effect_pack = get("battle_effects_part1")
    contract = effect_pack.get("contract", {})
    require(effect_pack.get("schema_version") == 1, "Battle effect pack schema_version must be 1")
    require(effect_pack.get("pack_id") == get("battle_rules_part1").get("effect_interpreter_pack_id"), "Battle rules reference a different effect interpreter pack")
    selectors = set(contract.get("target_selectors", []))
    selector_rules = contract.get("selector_rules", {})
    predicates = set(contract.get("predicates", []))
    events = set(contract.get("events", []))
    operations = set(contract.get("operations", []))
    operation_schemas = contract.get("operation_schemas", {})
    status_ids = {row.get("status_id") for row in get("battle_rules_part1").get("statuses", [])}
    status_tag_groups = contract.get("status_tag_groups", {})
    require(operations == set(operation_schemas), "Battle effect operation list and operation_schemas keys differ")
    require(selectors == set(selector_rules), "Every target selector must have exactly one executable selector rule")
    selector_kinds = {"manual_single", "row_priority_single", "all_by_row", "all_living", "minimum_stat", "maximum_stat", "minimum_stat_by_row", "random_excluding_last_primary", "ordered_minimum_stat_set", "event_reference", "previous_operation_result", "previous_successful_heal_target", "actor", "encounter_boss", "actor_plus_minimum_stat", "actor_plus_tagged_allies", "boss_plus_tagged_allies", "maximum_missing_hp", "lowest_hp_with_status", "maximum_status_count"}
    for selector_id, rule in selector_rules.items():
        require(rule.get("kind") in selector_kinds, f"{selector_id}: unknown target selector rule kind {rule.get('kind')}")
        if rule.get("kind") == "manual_single":
            require(rule.get("auto_fallback") is not None, f"{selector_id}: manual selector needs a defined Auto fallback")
        if rule.get("side"):
            require(rule["side"] in {"actor", "opposing", "boss_team"}, f"{selector_id}: invalid actor-relative side {rule['side']}")
        if rule.get("auto_fallback"):
            require(rule["auto_fallback"] in selectors, f"{selector_id}: unknown Auto target fallback {rule['auto_fallback']}")
        if rule.get("status_id"):
            require(rule["status_id"] in status_ids, f"{selector_id}: unknown status {rule['status_id']}")

    def check_condition(condition, label: str) -> None:
        if not isinstance(condition, dict):
            require(False, f"{label}: condition must be an object")
            return
        if "predicate" in condition:
            require(condition.get("predicate") in predicates, f"{label}: unknown condition predicate {condition.get('predicate')}")
            require(set(condition) <= {"predicate", "value"}, f"{label}: unsupported predicate condition fields {sorted(set(condition) - {'predicate', 'value'})}")
            predicate = condition.get("predicate")
            if predicate in {"owner_has_status", "last_target_has_status", "target_has_status", "event_target_had_status", "count_enemies_with_status"}:
                require(condition.get("value") in status_ids, f"{label}: condition references unknown status {condition.get('value')}")
            if predicate in {"last_target_has_status_tag", "target_has_any_status_tag"}:
                require(condition.get("value") in status_tag_groups or condition.get("value") in {"mark", "dread", "buff", "debuff"}, f"{label}: unknown status tag group {condition.get('value')}")
            return
        branches = set(condition) & {"all", "any", "not"}
        require(len(branches) == 1 and set(condition) == branches, f"{label}: condition must contain one all/any/not node or one predicate")
        if not branches:
            return
        branch = next(iter(branches))
        children = condition[branch]
        if branch == "not":
            check_condition(children, f"{label}.not")
        else:
            require(isinstance(children, list) and bool(children), f"{label}.{branch}: expected a non-empty condition list")
            if isinstance(children, list):
                for index, child in enumerate(children):
                    check_condition(child, f"{label}.{branch}[{index}]")

    def check_effect_tree(value, label: str) -> None:
        if isinstance(value, dict):
            for selector_field, selector in value.items():
                if selector_field.endswith("selector_id") and isinstance(selector, str):
                    require(selector in selectors, f"{label}: unknown {selector_field} {selector}")
            if value.get("op"):
                op_name = value["op"]
                schema = operation_schemas.get(op_name)
                require(op_name in operations and schema is not None, f"{label}: unknown effect operation {op_name}")
                if schema:
                    required_fields = set(schema.get("required", []))
                    allowed_fields = required_fields | set(schema.get("optional", [])) | {"op"}
                    require(required_fields <= value.keys(), f"{label}/{op_name}: missing fields {sorted(required_fields - value.keys())}")
                    require(set(value) <= allowed_fields, f"{label}/{op_name}: fields outside the closed schema {sorted(set(value) - allowed_fields)}")
                for field in ("status_id",):
                    if field in value:
                        require(value[field] in status_ids, f"{label}/{op_name}: unknown status {value[field]}")
                for field in ("status_ids", "immune_status_ids"):
                    if field in value:
                        require(isinstance(value[field], list) and set(value[field]) <= status_ids, f"{label}/{op_name}: unknown status in {field}")
                if "chance" in value:
                    require(isinstance(value["chance"], (int, float)) and 0 <= value["chance"] <= 1, f"{label}/{op_name}: chance must be between 0 and 1")
            if "when" in value:
                check_condition(value["when"], f"{label}.when")
            if "event" in value:
                require(value["event"] in events, f"{label}: unknown battle event {value['event']}")
            for key, child in value.items():
                check_effect_tree(child, f"{label}.{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                check_effect_tree(child, f"{label}[{index}]")

    player_effect_rows = effect_pack.get("player_skill_effects", [])
    player_effect_by_id = {row.get("skill_id"): row for row in player_effect_rows}
    expected_skill_by_id = {skill.get("skill_id"): (character, skill) for character in chars for skill in character.get("skills", [])}
    require(len(player_effect_rows) == 80 and set(player_effect_by_id) == set(expected_skill_by_id), "Effect pack must cover all 80 unique character skills")
    for skill_id, (character, skill) in expected_skill_by_id.items():
        row = player_effect_by_id.get(skill_id, {})
        require(row.get("character_id") == character.get("character_id"), f"{skill_id}: effect pack character link differs")
        require(row.get("skill_type") == skill.get("type"), f"{skill_id}: effect pack skill type differs")
        require(row.get("effect_ops") == skill.get("effect_ops"), f"{skill_id}: effect pack operations differ from character pack")
        require(row.get("event_hooks", []) == skill.get("event_hooks", []), f"{skill_id}: effect pack event hooks differ from character pack")
        require(row.get("continuous_modifiers", []) == skill.get("continuous_modifiers", []), f"{skill_id}: effect pack continuous modifiers differ from character pack")

    expected_enemy_actions = {(enemy.get("enemy_id"), skill.get("skill_id")) for enemy in enemies for skill in enemy.get("skills", [])}
    actual_enemy_actions = {(row.get("enemy_id"), row.get("skill_id")) for row in effect_pack.get("enemy_actions", [])}
    require(actual_enemy_actions == expected_enemy_actions, "Effect pack enemy actions do not cover every enemy basic/signature action exactly")
    enemy_skill_by_key = {(enemy.get("enemy_id"), skill.get("skill_id")): skill for enemy in enemies for skill in enemy.get("skills", [])}
    for row in effect_pack.get("enemy_actions", []):
        source_skill = enemy_skill_by_key.get((row.get("enemy_id"), row.get("skill_id")))
        if source_skill:
            require({key: value for key, value in row.items() if key != "enemy_id"} == source_skill, f"{row.get('enemy_id')}/{row.get('skill_id')}: generated enemy action diverges from enemy pack")
    expected_passives = {enemy.get("enemy_id") for enemy in enemies if enemy.get("passive_hooks") or enemy.get("continuous_modifiers")}
    actual_passives = {row.get("enemy_id") for row in effect_pack.get("enemy_passives", [])}
    require(actual_passives == expected_passives, "Effect pack enemy passive rows do not match authored enemy hooks/modifiers")
    enemy_by_id = {enemy.get("enemy_id"): enemy for enemy in enemies}
    for row in effect_pack.get("enemy_passives", []):
        source_enemy = enemy_by_id.get(row.get("enemy_id"), {})
        require(row.get("event_hooks", []) == source_enemy.get("passive_hooks", []), f"{row.get('enemy_id')}: enemy passive hook data differs")
        require(row.get("continuous_modifiers", []) == source_enemy.get("continuous_modifiers", []), f"{row.get('enemy_id')}: enemy passive modifier data differs")
    expected_boss_actions = {(enemy.get("enemy_id"), skill.get("skill_id")) for enemy in enemies if enemy.get("boss_id") for skill in enemy.get("skills", []) if skill.get("type") == "signature"}
    actual_boss_actions = {(row.get("enemy_id"), row.get("skill_id")) for row in effect_pack.get("boss_actions", [])}
    require(actual_boss_actions == expected_boss_actions, "Boss action index does not match boss signature actions")

    phase_rows = effect_pack.get("boss_phases", [])
    expected_phases = {(enemy.get("enemy_id"), phase.get("phase_id")) for enemy in enemies if enemy.get("boss_id") for phase in enemy.get("phases", [])}
    actual_phases = {(row.get("enemy_id"), row.get("phase_id")) for row in phase_rows}
    require(actual_phases == expected_phases, "Effect pack must cover each authored boss phase exactly")
    source_phase_by_key = {(enemy.get("enemy_id"), phase.get("phase_id")): (enemy.get("boss_id"), phase) for enemy in enemies if enemy.get("boss_id") for phase in enemy.get("phases", [])}
    for row in phase_rows:
        source_phase = source_phase_by_key.get((row.get("enemy_id"), row.get("phase_id")))
        if source_phase:
            source_boss_id, source_phase_body = source_phase
            require(row.get("boss_id") == source_boss_id, f"{row.get('phase_id')}: effect pack boss ID differs from enemy pack")
            require({key: value for key, value in row.items() if key not in {"enemy_id", "boss_id"}} == source_phase_body, f"{row.get('phase_id')}: generated boss phase diverges from enemy pack")
    boss_action_by_id = {row.get("skill_id"): row for row in effect_pack.get("boss_actions", [])}
    for phase in phase_rows:
        action_id = phase.get("signature_action_id")
        require(action_id in boss_action_by_id, f"{phase.get('phase_id')}: unknown signature action {action_id}")
        if action_id in boss_action_by_id:
            require(phase.get("phase_id") in boss_action_by_id[action_id].get("phase_ids", []), f"{phase.get('phase_id')}: signature action does not declare this phase")
        objective_ids = [objective.get("objective_id") for objective in phase.get("objectives", [])]
        require(len(objective_ids) == len(set(objective_ids)), f"{phase.get('phase_id')}: duplicate boss objective ID")
        for objective in phase.get("objectives", []):
            require(isinstance(objective.get("max_hp"), int) and objective["max_hp"] > 0 and objective.get("hp") == objective.get("max_hp"), f"{phase.get('phase_id')}/{objective.get('objective_id')}: invalid encounter-local objective HP")
            require(objective.get("targetable_by_player") is True, f"{phase.get('phase_id')}/{objective.get('objective_id')}: boss objective must be player-targetable")
        require(isinstance(phase.get("enter_ops"), list) and isinstance(phase.get("passive_ops"), list), f"{phase.get('phase_id')}: phase enter/passive operations must be arrays")

    for group_name in ("player_skill_effects", "enemy_actions", "enemy_passives", "boss_actions", "boss_phases"):
        for row_index, row in enumerate(effect_pack.get(group_name, [])):
            row_id = row.get("skill_id") or row.get("phase_id") or row.get("enemy_id") or f"row_{row_index}"
            check_effect_tree(row, f"battle_effects_part1/{group_name}/{row_id}")
            for hook_index, event_hook in enumerate(row.get("event_hooks", [])):
                label = f"battle_effects_part1/{group_name}/{row_id}/event_hooks[{hook_index}]"
                hook_schema = contract.get("event_hook_schema", {})
                hook_required = set(hook_schema.get("required", []))
                hook_allowed = hook_required | set(hook_schema.get("optional", []))
                require(hook_required <= event_hook.keys(), f"{label}: missing event hook fields {sorted(hook_required - event_hook.keys())}")
                require(set(event_hook) <= hook_allowed, f"{label}: unsupported event hook fields {sorted(set(event_hook) - hook_allowed)}")
                require(event_hook.get("event") in events, f"{label}: unknown event {event_hook.get('event')}")
                filter_row = event_hook.get("event_filter", {})
                require(set(filter_row) <= set(hook_schema.get("event_filter_fields", [])), f"{label}: unsupported event filter fields {sorted(set(filter_row) - set(hook_schema.get('event_filter_fields', [])))}")
                limit = event_hook.get("limit", {})
                require(bool(limit) and set(limit) <= set(hook_schema.get("limit_fields", [])), f"{label}: invalid or missing trigger limit")
                if isinstance(limit, dict) and "chance" in limit:
                    require(isinstance(limit["chance"], (int, float)) and 0 <= limit["chance"] <= 1, f"{label}: hook chance must be between 0 and 1")
                if "condition" in event_hook:
                    check_condition(event_hook["condition"], f"{label}.condition")
            for modifier_index, modifier in enumerate(row.get("continuous_modifiers", [])):
                label = f"battle_effects_part1/{group_name}/{row_id}/continuous_modifiers[{modifier_index}]"
                required_modifier_fields = set(contract.get("continuous_modifier_schema", {}).get("required", []))
                require(required_modifier_fields <= modifier.keys(), f"{label}: missing fields {sorted(required_modifier_fields - modifier.keys())}")
                require(modifier.get("event") in events, f"{label}: unknown event {modifier.get('event')}")
                if "condition" in modifier:
                    check_condition(modifier["condition"], f"{label}.condition")
                supported_outputs = contract.get("continuous_modifier_schema", {}).get("supported_outputs", [])
                has_damage_output = "damage_multiplier" in modifier and "damage_multiplier" in supported_outputs
                has_stat_output = {"stat_id", "mode", "amount"} <= modifier.keys() and "stat_id+mode+amount" in supported_outputs
                require(has_damage_output or has_stat_output, f"{label}: no supported continuous modifier output")
                require(set(modifier) <= {"event", "condition", "target", "damage_multiplier", "stat_id", "mode", "amount", "applies_to"}, f"{label}: unsupported continuous modifier fields")
    for phase in phase_rows:
        for objective in phase.get("objectives", []):
            check_effect_tree(objective.get("on_destroyed", []), f"boss_phase/{phase.get('phase_id')}/{objective.get('objective_id')}/on_destroyed")

    brand_ids = collect_mark_ids(get("brand_assets_part1"))
    unique_ids(get("brand_assets_part1").get("statuses", []), "entity_id", "status brand marks")
    check_mark_refs(chars, brand_ids, "character")
    check_mark_refs(enemies, brand_ids, "enemy")
    check_mark_refs(weapons, brand_ids, "weapon")
    check_mark_refs(armors, brand_ids, "armor")
    check_mark_refs(accessories, brand_ids, "accessory")
    check_mark_refs(items, brand_ids, "item")
    for character in chars:
        check_mark_refs(character.get("skills", []), brand_ids, character.get("character_id", "skill"))

    economy = get("economy_part1")
    banners = economy.get("banners", {})
    rarity_rules = banners.get("rarity_resolution", {})
    require(rarity_rules.get("rate_basis") == "unconditional_probability_per_pull", "Gacha rates must declare an unconditional probability basis")
    expected_ratio = rarity_rules.get("base_non_five_star_ratio", {})
    for banner_kind in ("character", "weapon"):
        banner = banners.get(banner_kind, {})
        base_five = banner.get("base_five_star_rate", 0)
        base_four = banner.get("four_star_rate", 0)
        base_three = banner.get("three_star_rate", 0)
        require(abs(base_five + base_four + base_three - 1.0) < 1e-9, f"{banner_kind} banner base rarity rates must sum to 100%")
        non_five_total = base_four + base_three
        actual_ratio = (base_four / non_five_total, base_three / non_five_total) if non_five_total else (0.0, 0.0)
        ratio_total = expected_ratio.get("four_star", 0) + expected_ratio.get("three_star", 0)
        expected_non_five_ratio = (
            expected_ratio.get("four_star", 0) / ratio_total,
            expected_ratio.get("three_star", 0) / ratio_total,
        ) if ratio_total else (0.0, 0.0)
        require(all(abs(actual - expected) < 1e-9 for actual, expected in zip(actual_ratio, expected_non_five_ratio)), f"{banner_kind} banner base 4★/3★ ratio must match rarity_resolution")
        hard_pity = banner.get("hard_pity", 0)
        for pull_number in range(1, hard_pity + 1):
            if pull_number == hard_pity:
                p_five = 1.0
            elif banner_kind == "character" and pull_number >= banner.get("soft_pity_start_pull", 10**9):
                step = banner.get("soft_pity_increment_percentage_points", 0) / 100
                p_five = min(1.0, base_five + step * (pull_number - banner["soft_pity_start_pull"] + 1))
            else:
                p_five = base_five
            remaining = 1.0 - p_five
            p_four = remaining * expected_non_five_ratio[0]
            p_three = remaining * expected_non_five_ratio[1]
            require(min(p_five, p_four, p_three) >= 0 and abs(p_five + p_four + p_three - 1.0) < 1e-9, f"{banner_kind} banner rarity probabilities are invalid on pull {pull_number}")
    f2p = economy.get("f2p_reference", {})
    expected_tokens = f2p.get("daily_windows", 0) * economy.get("daily_schedule", {}).get("maximum_per_window", {}).get("eclipse_token", 0) + f2p.get("complete_week_count", 0) * economy.get("weekly_cycle", {}).get("full_week", {}).get("eclipse_token", 0)
    require(expected_tokens == f2p.get("total_tokens") == 8800, "15-day repeatable F2P token total must be 8,800")
    require(f2p.get("pull_equivalent") == expected_tokens // 160 == 55, "15-day repeatable F2P pull total must be 55")
    subscription = economy.get("subscription", {})
    expected_subscription = subscription.get("instant_eclipse_token", 0) + subscription.get("halfday_entitlement_token", 0) * subscription.get("halfday_entitlement_count", 0)
    require(expected_subscription == subscription.get("expected_total_eclipse_token") == 12820, "30-day subscription token total must be 12,820")
    smallest_xp_item = min(get("items_part1")["progression_rules"]["character_xp"].values())
    quest_xp = [t.get("character_xp", 0) for t in economy["daily_schedule"]["tasks"]]
    quest_xp += [economy["daily_schedule"]["window_completion"]["character_xp"]]
    quest_xp += [s.get("character_xp", 0) for s in economy["weekly_cycle"]["segments"]]
    require(all(x % smallest_xp_item == 0 for x in quest_xp),
            "Every quest Character XP amount must be payable in whole XP items (quest claims convert it)")
    rotation = banners.get("rotation", {})
    pair_ids = [pair.get("banner_id") for pair in banners.get("signature_pairs", [])]
    require(rotation.get("order") == pair_ids and len(pair_ids) == len(set(pair_ids)) > 0,
            "Banner rotation order must list every signature pair exactly once, in pair order")
    require(rotation.get("after_last") == "loop", "Banner rotation after_last must be 'loop' (owner decision)")
    require(rotation.get("permanent_banner_ids") == ["hall_of_ancestors", "hall_of_armaments"],
            "Banner rotation permanent banners must be exactly hall_of_ancestors and hall_of_armaments")
    require(banners.get("limited_duration_days") == 15, "Limited banners run 15 days (GDD)")
    require("active_pull_banner_ids" not in banners, "active_pull_banner_ids was replaced by banners.rotation")
    require(banners.get("weapon", {}).get("hard_pity", 0) * 3 == banners.get("weapon", {}).get("worst_case_pulls_for_target"), "Weapon 3-knot worst-case pull count is inconsistent")
    daily_xp = economy.get("daily_schedule", {}).get("window_completion", {}).get("account_xp", 0)
    boss_xp = 0
    table_by_id = {row.get("drop_table_id"): row for row in drop_tables}
    for stage in stages:
        if stage.get("node_type") == "boss":
            rewards = table_by_id.get(stage.get("drop_table_id"), {}).get("first_clear_rewards", [])
            boss_xp += sum(row.get("quantity", 0) for row in rewards if row.get("kind") == "account_xp")
    account_progression = battle_rules.get("account_progression", {})
    account_curve = account_progression.get("xp_to_next", {})
    require(
        isinstance(account_curve.get("base"), int) and isinstance(account_curve.get("increment"), int)
        and account_curve.get("formula") == "base + (level - 1) * increment",
        "battle_rules.account_progression.xp_to_next must be {base, increment, formula='base + (level - 1) * increment'}",
    )
    account_cap = account_progression.get("level_cap", 0)
    require(account_cap == battle_rules.get("character_progression", {}).get("level_cap"), "Account level cap must match the character level cap")
    level_total = sum(
        account_curve.get("base", 0) + account_curve.get("increment", 0) * (level - 1)
        for level in range(1, account_cap)
    )
    require(daily_xp * economy.get("f2p_reference", {}).get("daily_windows", 0) + boss_xp == level_total, "Daily + story boss Account XP does not match the Level 1–20 XP curve")
    require(daily_xp * 30 == 12000 and boss_xp == 1300 and level_total == 13300, "Expected 12,000 daily + 1,300 first-clear boss XP = 13,300 total")
    require(economy.get("ration", {}).get("cap") == 100 and economy.get("ration", {}).get("regen_seconds_per_unit") == 300, "Ration cap/regen contract drifted from DEC-0014 (cap 100, 300 s per unit)")

    # Check line-addressable scripts for the exact seven chapter files and expected language metadata.
    manifest = get("story_script_part1_manifest")
    story_files = manifest.get("chapter_files", [])
    require(len(story_files) == 7, f"Story manifest should list seven chapter script files, found {len(story_files)}")
    story_character_refs: set[str] = set()
    story_speakers: set[str] = set()
    line_ids: list[str] = []
    silent_narration_lines: list[str] = []

    def inspect_story(value) -> None:
        if isinstance(value, dict):
            speaker = value.get("speaker_id")
            if isinstance(speaker, str):
                story_speakers.add(speaker)
                normalized = speaker.removesuffix("_thought")
                if normalized in char_ids:
                    story_character_refs.add(normalized)
            line_id = value.get("line_id")
            if isinstance(line_id, str):
                line_ids.append(line_id)
                require(isinstance(value.get("text_en"), str) and bool(value["text_en"].strip()), f"{line_id}: missing English line text")
                voice_track = value.get("voice_track")
                if speaker == "narration" and voice_track == "none":
                    silent_narration_lines.append(line_id)
                else:
                    require(isinstance(voice_track, str) and voice_track.startswith("jp"), f"{line_id}: spoken line must reference a Japanese voice track")
            guests = value.get("story_guests", [])
            if isinstance(guests, list):
                story_character_refs.update(guest for guest in guests if isinstance(guest, str))
            for child in value.values():
                inspect_story(child)
        elif isinstance(value, list):
            for child in value:
                inspect_story(child)

    for file_name in story_files:
        script = packs.get(Path(file_name).stem)
        require(script is not None, f"Story manifest references missing file {file_name}")
        if script:
            require(script.get("content_language") == "en" and script.get("voice_language") == "ja", f"{file_name}: expected English text and Japanese voice metadata")
            inspect_story(script)
    allowed_non_roster_speakers = {
        "narrator", "narration", "lady_yseldra_vale", "lord_cael_veyr", "yseldra",
        "yseldra_distant", "rusk", "alchemist", "ashen_lord_wraith",
        "eclipse_construct", "marshal_oren", "red_vial_matron",
        "shrine_keeper", "refugee_woman",
    }
    valid_speakers = char_ids | {f"{char_id}_thought" for char_id in char_ids} | enemy_ids | allowed_non_roster_speakers
    require(not (story_speakers - valid_speakers), f"Story has unresolved speaker IDs: {sorted(story_speakers - valid_speakers)}")
    require(not (story_character_refs - char_ids), f"Story references unknown playable guests: {sorted(story_character_refs - char_ids)}")
    require(char_ids <= story_character_refs, f"Playable characters missing from story guest/dialogue references: {sorted(char_ids - story_character_refs)}")
    require(len(line_ids) == len(set(line_ids)), "Story line IDs must be globally unique")

    rule_warnings = check_rule_key_consumption(battle_rules)
    unused_tables = unused_drop_tables(drop_tables, stages)

    if ERRORS:
        print("Part I content audit: FAILED")
        for error in ERRORS:
            print(f"- {error}")
        return 1
    print(f"Part I content audit passed: {len(names)} JSON files; 20 characters / 80 skills; 27 enemies; 180 weapons; 36 armors; 42 accessory templates; 35 stages.")
    print(f"Battle effect contract: {len(player_effect_rows)} skills; {len(effect_pack.get('enemy_actions', []))} enemy actions; {len(effect_pack.get('enemy_passives', []))} enemy passive profiles; {len(effect_pack.get('boss_actions', []))} boss signature actions; {len(phase_rows)} boss phases; {len(selectors)} selectors; all operation, selector, event, predicate, status, and phase links resolve.")
    print(f"Story coverage: all {len(char_ids)} playable characters and {len(line_ids)} unique line IDs resolve; {len(silent_narration_lines)} text-only narration cards are deliberately unvoiced.")
    print(f"Account XP: 30 daily windows x {daily_xp} + {boss_xp} first-clear boss XP = {level_total} XP through the Level 20 cap.")
    print(f"Stable brand mark references resolved: {len(brand_ids)} registered marks.")
    print(f"Rule keys: {len(rule_key_paths(battle_rules))} battle_rules keys classified "
          f"({len(RUNTIME_RULE_KEYS)} runtime-consumed, {len(DESCRIPTIVE_RULE_KEYS)} descriptive/pinned).")
    for warning in rule_warnings:
        print(f"WARNING: {warning}")
    if unused_tables:
        enemy_refs = {row.get("drop_table_id") for row in get("enemies_part1").get("enemies", [])}
        for table_id in unused_tables:
            where = ("referenced only by enemies[].drop_table_id, which the runtime never resolves"
                     if table_id in enemy_refs else "referenced by nothing")
            print(f"WARNING: drop table {table_id!r} is not used by any stage ({where}); content decision, not deleted")
    print(f"Gacha math: 15-day repeatable baseline {f2p.get('total_tokens')} Tokens / {f2p.get('pull_equivalent')} pulls; subscription {expected_subscription} Tokens; character soft-pity probabilities normalize.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
