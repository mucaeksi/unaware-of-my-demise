# Signature Weapon Effects Specification (25 Playable Heroes)

All 25 signature weapons in `narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/weapons_part1.json` share a deterministic Ultimate-echo trigger (`after_ally_ultimate` with `event_filter: { team: "player", source_is_owner: true }` and `limit: { per_owner_turn: 1 }`) and use **only** the closed operation grammar (`EffectOp`) and status catalog (`battle_rules_part1.json`) defined in `packages/content-schema/src/effects.ts` and [COMBAT_RULES](../COMBAT_RULES.md).

## 1. Summary Table

| # | Hero (`owner_character_id`) | Weapon (`weapon_id`) | Passive ID (`passive_effect_id`) | Trigger & Limit | Finite Effect Ops (Target · Op · Magnitude · Duration) |
|---|---|---|---|---|---|
| 1 | `mahmut` | `weapon_mahmut_signature` (*The Crestless Oath*) | `signature_echo_mahmut` | Owner Ultimate (`per_owner_turn: 1`) | `self`: `+15% ATK` (2T); `lowest_hp_ally`: Shield `60% DEF` (2T) |
| 2 | `fadyme` | `weapon_fadyme_signature` (*The Hour Between Bells*) | `signature_echo_fadyme` | Owner Ultimate (`per_owner_turn: 1`) | `all_allies`: `sanctuary` (2T); `ally_with_lowest_focus`: `+15 Focus` |
| 3 | `kera_voss` | `weapon_kera_voss_signature` (*Redoubt's Last Vial*) | `signature_echo_kera_voss` | Owner Ultimate (`per_owner_turn: 1`) | `self`: `+15% ATK` (2T); `enemy_with_highest_atk`: `burn` (2T) |
| 4 | `brin_alder` | `weapon_brin_alder_signature` (*Alderwall's Promise*) | `signature_echo_brin_alder` | Owner Ultimate (`per_owner_turn: 1`) | `front_row_allies`: `stoneguard` (2T); `self`: `+15% DEF` (2T) |
| 5 | `nixie_vale` | `weapon_nixie_vale_signature` (*Windneedle Wayfinder*) | `signature_echo_nixie_vale` | Owner Ultimate (`per_owner_turn: 1`) | `self`: `+15% SPD` (2T); `self`: Next Attack `×1.20` (`consume_on_attack: true`) |
| 6 | `sister_aveline` | `weapon_aveline_last_vigil` (*Lantern of the Last Vigil*) | `signature_echo_sister_aveline` | Owner Ultimate (`per_owner_turn: 1`) | `all_allies`: Regen `35% ATK` (2 ticks, 2T); `lowest_hp_ally`: Cleanse 1 debuff (`oldest_applied`) |
| 7 | `sable_wren` | `weapon_sable_broken_bell` (*Quietus at the Broken Bell*) | `signature_echo_sable_wren` | Owner Ultimate (`per_owner_turn: 1`) | `self`: `+20% ATK` (2T); `self`: `+20 Focus` |
| 8 | `tilda_fen` | `weapon_tilda_fen_signature` (*Salt-Road Remedies*) | `signature_echo_tilda_fen` | Owner Ultimate (`per_owner_turn: 1`) | `all_allies`: `soaked_immunity` (*Dry Ward*, 2T); `lowest_hp_ally`: Heal `50% ATK` |
| 9 | `rikka_ember` | `weapon_rikka_ember_signature` (*Procession's First Spark*) | `signature_echo_rikka_ember` | Owner Ultimate (`per_owner_turn: 1`) | `self`: Shield `80% ATK` (2T); `self`: `+15% ATK` (2T) |
| 10 | `mirel_quill` | `weapon_mirel_unwritten_ledger` (*The Unwritten Ledger*) | `signature_echo_mirel_quill` | Owner Ultimate (`per_owner_turn: 1`) | `all_allies`: Cooldown `-1T` (`min: 0`); `all_allies`: `+10% ATK` (2T) |
| 11 | `odelia_pike` | `weapon_odelia_pike_signature` (*Breakwater's Eye*) | `signature_echo_odelia_pike` | Owner Ultimate (`per_owner_turn: 1`) | `enemy_with_highest_atk`: `fracture` (2T) + `soaked` (2T) |
| 12 | `pippa_bell` | `weapon_pippa_bell_signature` (*A Song Kept in Brass*) | `signature_echo_pippa_bell` | Owner Ultimate (`per_owner_turn: 1`) | `all_allies`: `+12% SPD` (2T); `ally_with_lowest_focus`: `+15 Focus` |
| 13 | `nara_vell` | `weapon_nara_gatewarden_promise` (*Gatewarden's Promise*) | `signature_echo_nara_vell` | Owner Ultimate (`per_owner_turn: 1`) | `all_allies`: Shield `70% DEF` (2T); `front_row_allies`: `stoneguard` (2T) |
| 14 | `clem_marr` | `weapon_clem_marr_signature` (*The Name Beneath Stone*) | `signature_echo_clem_marr` | Owner Ultimate (`per_owner_turn: 1`) | `all_enemies`: `dread` (2T); `all_allies`: `dawnward` (2T) |
| 15 | `vespera_wisp` | `weapon_vespera_last_hour` (*Mirror of the Last Hour*) | `signature_echo_vespera_wisp` | Owner Ultimate (`per_owner_turn: 1`) | `self`: `+20% ATK` (2T); `all_enemies`: `decay` (2T) |
| 16 | `hana_birch` | `weapon_hana_birch_signature` (*Stillbark Snare*) | `signature_echo_hana_birch` | Owner Ultimate (`per_owner_turn: 1`) | `front_row_enemies`: `fracture` (2T); `self`: `+15% SPD` (2T) |
| 17 | `thistle_roe` | `weapon_thistle_roe_signature` (*Garden Before Winter*) | `signature_echo_thistle_roe` | Owner Ultimate (`per_owner_turn: 1`) | `all_allies`: Regen `30% ATK` (2 ticks, 2T); `all_allies`: `+10% SPD` (2T) |
| 18 | `iona_mist` | `weapon_iona_mist_signature` (*Safe Harbor Lantern*) | `signature_echo_iona_mist` | Owner Ultimate (`per_owner_turn: 1`) | `all_allies`: Shield `60% ATK` (2T); `all_allies`: `sanctuary` (2T) |
| 19 | `jori_flint` | `weapon_jori_flint_signature` (*Furnace Door's Rivet*) | `signature_echo_jori_flint` | Owner Ultimate (`per_owner_turn: 1`) | `self`: Shield `90% DEF` (2T); `front_row_enemies`: `burn` (2T) |
| 20 | `marek_vane` | `weapon_marek_vane_signature` (*March Without a Banner*) | `signature_echo_marek_vane` | Owner Ultimate (`per_owner_turn: 1`) | `enemy_with_highest_atk`: Delay `15%` gauge; `front_row_allies`: `+15% DEF` (2T) |
| 21 | `garrick_cinder` | `weapon_garrick_cinder_signature` (*The Sixty-First Minute*) | `signature_echo_garrick_cinder` | Owner Ultimate (`per_owner_turn: 1`) | `self`: `+20% ATK` (2T); `self`: `stoneguard` (2T) |
| 22 | `corbin_locke` | `weapon_corbin_locke_signature` (*Seventh Sluice Anchor*) | `signature_echo_corbin_locke` | Owner Ultimate (`per_owner_turn: 1`) | `front_row_allies`: Shield `80% DEF` (2T); `front_row_enemies`: `fracture` (2T) |
| 23 | `cassian_thorne` | `weapon_cassian_thorne_signature` (*Clapperless Verdict*) | `signature_echo_cassian_thorne` | Owner Ultimate (`per_owner_turn: 1`) | `all_allies`: `dawnward` (2T); `lowest_hp_ally`: Heal `60% DEF` |
| 24 | `dorian_kesk` | `weapon_dorian_kesk_signature` (*Seven-Notch Seal-Iron*) | `signature_echo_dorian_kesk` | Owner Ultimate (`per_owner_turn: 1`) | `all_enemies`: `decay` (2T); `self`: `+15% SPD` (2T) |
| 25 | `rowan_reed` | `weapon_rowan_reed_signature` (*Wayshrine's Last Wick*) | `signature_echo_rowan_reed` | Owner Ultimate (`per_owner_turn: 1`) | `all_allies`: Cleanse 1 debuff (`oldest_applied`); `lowest_hp_ally`: `sanctuary` (2T) |

---

## 2. Canonical `EventHook` Definitions (Validated Against `packages/content-schema/src/effects.ts`)

Each entry maps `passive_effect_id` to its exact `EventHook` definition:

```json
{
  "signature_echo_mahmut": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "modify_stat", "target_selector_id": "self", "stat_id": "atk", "mode": "add_pct", "amount": 0.15, "duration_turns": 2 },
      { "op": "grant_shield", "target_selector_id": "lowest_hp_ally", "scale_stat": "def", "multiplier": 0.6, "duration_turns": 2 }
    ]
  },
  "signature_echo_fadyme": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "apply_status", "target_selector_id": "all_allies", "status_id": "sanctuary", "duration_turns": 2 },
      { "op": "gain_focus", "target_selector_id": "ally_with_lowest_focus", "amount": 15 }
    ]
  },
  "signature_echo_kera_voss": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "modify_stat", "target_selector_id": "self", "stat_id": "atk", "mode": "add_pct", "amount": 0.15, "duration_turns": 2 },
      { "op": "apply_status", "target_selector_id": "enemy_with_highest_atk", "status_id": "burn", "duration_turns": 2 }
    ]
  },
  "signature_echo_brin_alder": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "apply_status", "target_selector_id": "front_row_allies", "status_id": "stoneguard", "duration_turns": 2 },
      { "op": "modify_stat", "target_selector_id": "self", "stat_id": "def", "mode": "add_pct", "amount": 0.15, "duration_turns": 2 }
    ]
  },
  "signature_echo_nixie_vale": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "modify_stat", "target_selector_id": "self", "stat_id": "spd", "mode": "add_pct", "amount": 0.15, "duration_turns": 2 },
      { "op": "arm_next_attack_bonus", "target_selector_id": "self", "damage_multiplier": 1.2, "consume_on_attack": true }
    ]
  },
  "signature_echo_sister_aveline": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "apply_regeneration", "target_selector_id": "all_allies", "scale_stat": "atk", "multiplier": 0.35, "ticks": 2, "tick_event": "owner_turn_start", "duration_turns": 2 },
      { "op": "remove_status", "target_selector_id": "lowest_hp_ally", "category": "debuff", "count": 1, "selection": "oldest_applied" }
    ]
  },
  "signature_echo_sable_wren": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "modify_stat", "target_selector_id": "self", "stat_id": "atk", "mode": "add_pct", "amount": 0.2, "duration_turns": 2 },
      { "op": "gain_focus", "target_selector_id": "self", "amount": 20 }
    ]
  },
  "signature_echo_tilda_fen": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "apply_status", "target_selector_id": "all_allies", "status_id": "soaked_immunity", "duration_turns": 2 },
      { "op": "heal", "target_selector_id": "lowest_hp_ally", "scale_stat": "atk", "multiplier": 0.5 }
    ]
  },
  "signature_echo_rikka_ember": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "grant_shield", "target_selector_id": "self", "scale_stat": "atk", "multiplier": 0.8, "duration_turns": 2 },
      { "op": "modify_stat", "target_selector_id": "self", "stat_id": "atk", "mode": "add_pct", "amount": 0.15, "duration_turns": 2 }
    ]
  },
  "signature_echo_mirel_quill": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "reduce_cooldowns", "target_selector_id": "all_allies", "amount_turns": 1, "minimum_remaining_turns": 0 },
      { "op": "modify_stat", "target_selector_id": "all_allies", "stat_id": "atk", "mode": "add_pct", "amount": 0.1, "duration_turns": 2 }
    ]
  },
  "signature_echo_odelia_pike": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "apply_status", "target_selector_id": "enemy_with_highest_atk", "status_id": "fracture", "duration_turns": 2 },
      { "op": "apply_status", "target_selector_id": "enemy_with_highest_atk", "status_id": "soaked", "duration_turns": 2 }
    ]
  },
  "signature_echo_pippa_bell": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "modify_stat", "target_selector_id": "all_allies", "stat_id": "spd", "mode": "add_pct", "amount": 0.12, "duration_turns": 2 },
      { "op": "gain_focus", "target_selector_id": "ally_with_lowest_focus", "amount": 15 }
    ]
  },
  "signature_echo_nara_vell": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "grant_shield", "target_selector_id": "all_allies", "scale_stat": "def", "multiplier": 0.7, "duration_turns": 2 },
      { "op": "apply_status", "target_selector_id": "front_row_allies", "status_id": "stoneguard", "duration_turns": 2 }
    ]
  },
  "signature_echo_clem_marr": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "apply_status", "target_selector_id": "all_enemies", "status_id": "dread", "duration_turns": 2 },
      { "op": "apply_status", "target_selector_id": "all_allies", "status_id": "dawnward", "duration_turns": 2 }
    ]
  },
  "signature_echo_vespera_wisp": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "modify_stat", "target_selector_id": "self", "stat_id": "atk", "mode": "add_pct", "amount": 0.2, "duration_turns": 2 },
      { "op": "apply_status", "target_selector_id": "all_enemies", "status_id": "decay", "duration_turns": 2 }
    ]
  },
  "signature_echo_hana_birch": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "apply_status", "target_selector_id": "front_row_enemies", "status_id": "fracture", "duration_turns": 2 },
      { "op": "modify_stat", "target_selector_id": "self", "stat_id": "spd", "mode": "add_pct", "amount": 0.15, "duration_turns": 2 }
    ]
  },
  "signature_echo_thistle_roe": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "apply_regeneration", "target_selector_id": "all_allies", "scale_stat": "atk", "multiplier": 0.3, "ticks": 2, "tick_event": "owner_turn_start", "duration_turns": 2 },
      { "op": "modify_stat", "target_selector_id": "all_allies", "stat_id": "spd", "mode": "add_pct", "amount": 0.1, "duration_turns": 2 }
    ]
  },
  "signature_echo_iona_mist": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "grant_shield", "target_selector_id": "all_allies", "scale_stat": "atk", "multiplier": 0.6, "duration_turns": 2 },
      { "op": "apply_status", "target_selector_id": "all_allies", "status_id": "sanctuary", "duration_turns": 2 }
    ]
  },
  "signature_echo_jori_flint": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "grant_shield", "target_selector_id": "self", "scale_stat": "def", "multiplier": 0.9, "duration_turns": 2 },
      { "op": "apply_status", "target_selector_id": "front_row_enemies", "status_id": "burn", "duration_turns": 2 }
    ]
  },
  "signature_echo_marek_vane": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "delay_next_action", "target_selector_id": "enemy_with_highest_atk", "gauge_fraction": 0.15 },
      { "op": "modify_stat", "target_selector_id": "front_row_allies", "stat_id": "def", "mode": "add_pct", "amount": 0.15, "duration_turns": 2 }
    ]
  },
  "signature_echo_garrick_cinder": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "modify_stat", "target_selector_id": "self", "stat_id": "atk", "mode": "add_pct", "amount": 0.2, "duration_turns": 2 },
      { "op": "apply_status", "target_selector_id": "self", "status_id": "stoneguard", "duration_turns": 2 }
    ]
  },
  "signature_echo_corbin_locke": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "grant_shield", "target_selector_id": "front_row_allies", "scale_stat": "def", "multiplier": 0.8, "duration_turns": 2 },
      { "op": "apply_status", "target_selector_id": "front_row_enemies", "status_id": "fracture", "duration_turns": 2 }
    ]
  },
  "signature_echo_cassian_thorne": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "apply_status", "target_selector_id": "all_allies", "status_id": "dawnward", "duration_turns": 2 },
      { "op": "heal", "target_selector_id": "lowest_hp_ally", "scale_stat": "def", "multiplier": 0.6 }
    ]
  },
  "signature_echo_dorian_kesk": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "apply_status", "target_selector_id": "all_enemies", "status_id": "decay", "duration_turns": 2 },
      { "op": "modify_stat", "target_selector_id": "self", "stat_id": "spd", "mode": "add_pct", "amount": 0.15, "duration_turns": 2 }
    ]
  },
  "signature_echo_rowan_reed": {
    "event": "after_ally_ultimate",
    "event_filter": { "team": "player", "source_is_owner": true },
    "limit": { "per_owner_turn": 1 },
    "effect_ops": [
      { "op": "remove_status", "target_selector_id": "all_allies", "category": "debuff", "count": 1, "selection": "oldest_applied" },
      { "op": "apply_status", "target_selector_id": "lowest_hp_ally", "status_id": "sanctuary", "duration_turns": 2 }
    ]
  }
}
```
