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

7. **Rounds.** A round ends when every living unit has taken a turn since the last round ended. `round_number_at_most`, `per_round` limits,
   "took no damage this round" and opening-guard durations key off it. (Hana's passive text says "during a turn"; the data says "round" — the data is followed.)
8. **Damage over time** (Burn, Venom) ticks at the owner's turn start, after the duration decrement, once for every turn the status was alive
   (a 2-turn Venom ticks twice, the second tick on the turn it expires). Damage = floor(source ATK at application x multiplier), min 1; shields absorb it;
   it gives no Focus and fires no hooks.
9. **Hook scope.** Hooks fire only for events about their owner unless `event_filter.team` is present (then: any unit on the owner's team).
   `exclude_owner`, `source_is_owner`, `incoming_action_type`, `ally_action_type`, `event_target_faction_is` narrow it further.
   `owner_action_type: any_attack` / `damage_action_type: basic_or_skill` = a real Basic/Active/Ultimate/Signature action (never a counter, hook or DOT).
   Damage dealt inside a hook, and any packet marked `can_trigger_passives: false`, fires no further hooks.
10. **Clem Marr — Keep the Names** is listed in the data as the owner's own attacks, but its text says "the first *allied* attack against each Dreaded enemy".
    The text wins: the builder adds `team: player` (tools/lib/data.ts `HOOK_OVERRIDES`).
11. **Packet modifiers.** `modify_incoming_damage`, `modify_outgoing_damage` and `block_attack` act on the damage packet the hook was fired for;
    the selector only names whose rule it is. Order inside a hit: base formula, element/status multipliers, `before_damage_dealt` hooks + always-on
    modifiers, `before_damage_received` hooks + always-on modifiers, opening guard, damage reductions (first-hit guards are spent here), one floor.
12. **Opening Guard (Nara's ultimate).** For N rounds the first single-target attack of every enemy is taken by Nara (even past the Front Row rule)
    at the stated multiplier; area attacks are unaffected. Each enemy is guarded once.
13. **Counters** (Hana's Snare) trigger when the marked unit starts any action before the owner's next turn; the action is cancelled if the unit dies to the counter.
    The counter lapses when the owner's next turn begins. Counter damage uses the owner's stats, physical type, and gives no Focus.
14. **Intercept** (Noble Retainer) is a redirect of 100 % of the next N single-target hits (any action type) from the most injured *other* ally to the caster.
15. **Selector perspective.** "enemy" = the actor's opponents, "enemy ally" = the actor's other allies (excluding itself), except `all_enemy_allies` (includes itself).
    A row-bound pick (`lowest_hp_front_enemy`, `lowest_hp_rear_enemy`) falls back to the whole opposing side when that row is empty.
    `random_other_enemy` draws from the seeded RNG and excludes the primary target of the action.
16. **Soul Link** moves floor(hit x fraction) of each hit (capped at 15 % of the damaged unit's max HP) onto the other linked units, split evenly (min 1 each).
17. **Soaked / reactions.** Tide damage vs a Soaked unit is x1.1; a Gale or Ember hit adds +15 % once and consumes Soaked. Gust delays the next action by 15 % of the gauge.
18. **copy_buff** `category: buff` copies the oldest buff statuses, then positive stat modifiers, of the most-buffed enemy (shields count as buffs when choosing it);
    `category: shield` copies the largest shields. (Estate Wraith's text says it copies a *shield*, its data says `buff` — the data is followed until the owner decides.)
19. **Pay HP cost** takes max(1, floor(maxHP x fraction)) but never below `cannot_reduce_below`.
20. **Ally-targeted skills** (`player_target: ally`, e.g. Nara's Shelter Angle) can be aimed at any living ally including the caster.

## Coverage against the shipped cast data
Measured by `npx tsx tools/combat_coverage.ts` (the same closed-grammar check the content build and the publish gate use).

| Group | Supported | Skills supported |
|---|---|---|
| Playable characters | 20 / 20 | 80 / 80 |
| Regular enemies | 20 / 20 | 40 / 40 |
| Bosses (7) | 7 / 7 | 18 / 18 |

Engine ops implemented: all 25 regular ops of the data (damage, heal, apply/remove status, shield, redirect, intercept, focus, stat modifiers, heal-per-cleanse,
incoming/outgoing packet modifiers, block, damage reduction, first-hit guard, opening guard, regeneration, status-duration and cooldown reduction, delay,
HP cost, counter, next-attack bonus, copy buff, remove shield). All 15 statuses are modelled. `packages/combat/src/mechanics.test.ts` proves each mechanic with
hand-checkable numbers; `roster.test.ts` plays all 20 characters and 20 regular enemies in 5v5 fights (every active/ultimate is exercised, replays are bit-identical).

### Bosses (`packages/combat/src/boss.test.ts`, `roster.test.ts`)
21. **Phases are fresh bars.** A phase's max HP is the level-scaled base HP x `hp_multiplier`; ATK/DEF multipliers apply on top of the level-scaled base (not compounding).
    Phase two begins when the first bar falls to `transition_hp_percent` of itself — the bar can never run out in a non-final phase (a big hit just starts the change).
    The boss falls when the last bar is empty. Phase weaknesses *replace* the unit's own, so a weakness always beats an inherited resistance.
22. **Phase change timing.** It happens at the end of the turn that caused it: an announced (telegraphed) intent resolves first, then debuffs are cleared (except
    `preserve_status_ids`, normally Break; negative stat modifiers too), the new bar/stats/weaknesses apply, objectives of the old phase go (unless
    `persists_across_phases`), the new objectives appear, and the phase's `enter_ops` / `passive_ops` run.
23. **Objectives** (Jaw Bell, Wax Seal, Flask Racks ...) are targets that never act, never count for victory and are never hit by area attacks. They are always legal
    single-target picks for the player. **Every damaging hit removes exactly 1 point** whatever the attacker's numbers (the data's tiny `max_hp` is a hit count; the damage scale
    of a level-12 hero would otherwise break any objective in one touch). Multi-hit skills break them faster. `on_destroyed` ops run as the boss.
24. **Telegraphs.** A signature with a `telegraph` is *announced* on the boss's turn (event `telegraph`, visible to the UI via `snapshot().units[].telegraph` and `intentFor`) and
    resolved on its next turn once at least `player_actions_before_resolution` player actions have happened (a faster party gets more actions in between). Destroying the named
    objective (or all of the named objectives) cancels it; a stun (Break) cancels it unless `interruptible_by_control` is false. A cancelled signature goes on cooldown as if used.
    While an intent is pending and the party has not yet had its action, the boss plays a plain strike.
25. **Wards.** `boss_damage_taken_modifier` multiplies damage taken while its objective condition holds (`until_objective_destroyed` / `while_any_objective_alive`);
    `remove_boss_modifier` removes it explicitly.
26. **Control on bosses** lasts `control_duration_multiplier` (0.5) of its duration, minimum one turn.
27. **Summons** (`summon_enemies`) put full units from the pack into free slots of the boss side (field limit 5); they are skipped when `only_if_objective_alive` names a destroyed objective.
    Summoned units are real enemies: the fight continues until they are down too.
28. **Auto Battle** breaks the objective that would cancel the announced intent, otherwise ignores objectives.
29. **Publishing gate.** `validateContentSet` rejects a unit pack that summons an unknown unit, names an objective no phase defines (summons, wards, telegraphs, multipliers),
    names an unknown status, or lists a skill for a phase the boss does not have.

### Still open
Boss encounters in the chapter graph (the story stages 1-5 ... 7-5 reference these bosses), a Boss/Objective presentation in the battle screen (the engine already emits
`phase_change`, `telegraph`, `telegraph_cancelled`, `objective_destroyed`, `summon` and objectives appear in `snapshot()`), Sweep/AFK, party-based (owned-hero) battles with
equipment/growth stats, and the numeric balance pass (all 7 bosses fall to a level-14 party without losses in the smoke test).
