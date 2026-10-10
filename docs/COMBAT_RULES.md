# Combat rules: source, interpretation, coverage

Source of truth: `narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/battle_rules_part1.json` (+ characters/enemies).
Implementation: `packages/combat` (pure TypeScript, deterministic, no I/O). The engine only understands the closed effect
grammar in `packages/content-schema/src/effects.ts`; data naming any other `op`, status, selector or field is rejected by
the schema (on the device before activation, and on the server before publishing).

## Implemented as written
- Continuous action gauge (10000, gain = effective SPD, ties → greatest overflow, then player team, slot, id).
- Damage: `max(1, floor(ATK × mult × 10/(10+DEF|RES) × element × status × crit))`, DEF for physical / RES for magic, shields after.
- Element chart (Ember→Gale→Stone→Tide→Ember ×1.2/×0.9; Dawn↔Veil ×1.2; explicit weakness/resistance override).
- Front-row protection for single-target attacks; taunt redirects single-target actions.
- Focus (+20 basic, +25 active, +5 per hit capped 15/turn, ultimate at 100, death resets), cooldowns/status durations
  decrement at the owner's turn start, `owner_turn_start` and `before_damage_received` hooks with per-turn / per-battle limits.
- Seeded RNG (mulberry32) for crits and chance statuses; auto battle policy (emergency heal < 40 %, active, basic; ultimates saved for bosses).
- Stars: 3 = nobody lost, 2 = one lost, 1 = two or more lost; 300-turn safety limit counts as defeat.

## Interpretations (the data was ambiguous — flag for owner review)
1. `lowest_hp_ally` compares absolute HP (ties: slot, id); `self_and_lowest_hp_ally` = self + lowest-HP *other* ally.
2. Shield/heal amounts are floored (min 1). `heal_per_removed_status` heals each of the N lowest-HP allies for `floor(ATK × mult × stacks)`.
3. `grant_redirect` moves `round_half_up(damage × fraction)` of a single-target hit to the protector (so 1 damage moves fully).
4. `modify_stat veil_res add_pct` is implemented as that fraction less Veil-element damage taken.
5. `no_focus_gain` on a damage op = that packet gives the target no "hit" focus.
6. Enemy AI: highest `ai_priority` skill off cooldown (signature first, then basic); target = front-first, lowest HP %, slot, id.

## Coverage against the shipped cast data
Engine ops implemented: `damage, heal, apply_status, remove_status, grant_shield, grant_redirect, gain_focus, modify_stat,
heal_per_removed_status` (9 of 34 distinct ops in the data). Statuses implemented: dread, stoneguard, taunt, break, decay,
fracture, sanctuary (7 of 15; missing: burn, venom, soaked, gust, dawnward, marks, …).

| Group | Fully supported | Skills supported |
|---|---|---|
| Playable characters | 3 / 20 (Mahmut, Fadyme, Brin Alder) | 48 / 80 |
| Enemies and bosses | 9 / 27 | 39 / 58 |

Missing ops (each needs engine code + tests before any content may use it): `modify_incoming_damage, apply_regeneration,
reduce_status_durations, reduce_cooldowns, grant_damage_reduction, grant_opening_guard, modify_outgoing_damage, arm_counter,
arm_next_attack_bonus, grant_first_hit_guard, delay_next_action, pay_hp_cost, copy_buff, remove_shield, grant_intercept,
block_attack, cancel_boss_telegraph, remove_boss_modifier, boss_damage_taken_modifier, summon_enemies,
remove_copied_statuses, clear_status_if_all_objectives_destroyed` + the extra selectors/predicates (rows, objectives, events).
