# Missing combat grammar: semantics and conformance vectors

Source revision: `5c83e3d1` (2026-10-11). This is a **handoff specification**, not executable game content or evidence that the current engine supports these effects. Numeric values and user IDs are from the preserved Runtime Snapshot. Where the source is silent, **PROPOSED** behavior is explicit and an `UNKNOWN` is listed for Claude/owner resolution. No canon, engine, release data or balance values were changed.

Sources: `docs/COMBAT_RULES.md`, `packages/content-schema/src/effects.ts`, `packages/combat/src/{engine,types}.ts`, and Runtime Snapshot `battle_rules_part1.json`, `characters_part1.json`, `enemies_part1.json`. The linked `battle_effects_part1.json` adds authoritative authoring contracts for selectors, operations, objective targeting and hooks.

## Coverage audit and baseline

`COMBAT_RULES.md` names **22 missing operations**; all have sections and two vectors below. The character/enemy files contain 31 distinct ops, of which 9 are in the closed runtime grammar. The effects contract declares 32 ops including unused `grant_status_immunity`. The older “34 ops / 15 statuses” statement is stale: rules currently define **16 statuses**, 9 absent from the seven implemented statuses. This handoff does not edit the shared state document.

Baseline: continuous gauge 10000; SPD floor 1; delays cap 5000; tie order overflow, player, slot, stable ID. Stat rounding is half up; damage is floored per packet, minimum 1 except a blocked packet. Physical uses DEF, magic/elemental RES (effective DEF fallback), followed by element, multiplicative damage factors and crit; shield absorption is last. Focus is 0..100, basic +20, active +25, hit +5 capped 15 per victim owner turn, death resets. No extra action Focus for DoT, counters, reactions, HP cost or objective damage unless explicitly approved. Duration/cooldown decrements at owner-turn start; dead targets are filtered before each operation. Nonexistent IDs fail content validation; an empty valid target set skips the op. Array ordering is observable; HP reaches zero immediately and later ops cannot heal/revive that unit.

PROPOSED event sequence: cost → target/taunt/guard selection → per-hit before-outgoing then before-incoming hooks → block/reduction/floor → redirect/share → shield/HP → death snapshot → received/dealt/threshold hooks → next op → action hooks → objective callbacks → phase transition → finish turn. This proposal reconciles the authoring contract’s post-action death checks with its dead-target filtering; confirm C21 before implementation. Hooks order by owner side, slot, stable ID, skill ID and hook index; predicates read effect-time state except `event_target_had_status`, which reads the defeat snapshot.

## Vector format and replay boundary

Each `vectors/<op>.json` contains two isolated conformance scenarios. Synthetic units deliberately use larger integer stats than the compact cast; they are test fixtures, not balance proposals. `initial` fully lists HP/maxHP, ATK/DEF/RES/SPD, Focus, statuses, shields, cooldowns and future-engine transient state. Each step provides an action/event and an expected **full unit snapshot** (HP/status/Focus included) plus encounter state. Unlisted state is unchanged. Seed=1, crit chance=0, neutral Stone-vs-Stone packets; `base_damage` is the pre-multiplier fixture packet, not an override accepted from a player.

The future test adapter must dispatch `execute_ops`, `incoming_attack`, `outgoing_attack`, `owner_turn_start`, `target_action`, `cycle_end`, `objective_destroyed`, `reevaluate_passives` and `resolve_telegraph` at named phase boundaries. Fixtures do not bypass the runtime closed grammar: they live only in docs and require Claude to implement the missing primitives plus a test-only adapter. Do not pass them directly to `Battle.create` today. `status-vectors.json` also covers missing statuses. Acceptance here is parsed JSON + source/op/status/selector coverage + manually checked arithmetic, **not successful engine replay**.

## Operations

### `modify_incoming_damage`

Users: `nara_vell`, `sable_wren`.

Fields: required `target_selector_id`, `multiplier`; optional `when`.

Semantics: Packet-local multiplier at before_damage_received, only for the event target. Multiply it with other reductions before final floor/minimum-one and shield absorption. Never installs a persistent buff.

Stacking, lifetime and edge cases: No duration; multiple hooks multiply. Consume limits only after predicate and filter match. Outside a damage event reject the effect context.

UNKNOWN C01: hook ordering and whether fully shielded/blocked hits consume first-hit protections.

Vectors: [`modify_incoming_damage.json`](vectors/modify_incoming_damage.json) (normal and boundary/order case).

### `apply_regeneration`

Users: `tilda_fen`.

Fields: required `target_selector_id`, `scale_stat`, `multiplier`, `ticks`, `tick_event`, `duration_turns`; optional none.

Semantics: Capture effective caster scale_stat when applied; on each target owner-turn start heal floor(captured_stat × multiplier), minimum 1, apply healing-received multipliers and cap at missing HP. No revival.

Stacking, lifetime and edge cases: PROPOSED: ticks is the authoritative remaining tick count; run after DoT and before owner-turn hooks. Decrement lifetime but permit the last authored tick at expiry, then remove. Same caster/skill refreshes; distinct sources coexist.

UNKNOWN C02: source has duration 2 and ticks 2 but decrements durations before ticks; ordinary expiry would erase the second tick. Snapshot and refresh rules are unstated.

Vectors: [`apply_regeneration.json`](vectors/apply_regeneration.json) (normal and boundary/order case).

### `reduce_status_durations`

Users: `mirel_quill`.

Fields: required `target_selector_id`, `category`, `amount_turns`, `minimum_remaining_turns`; optional none.

Semantics: For each live selected target, reduce each matching category status by amount_turns, bounded by minimum_remaining_turns. Remove at zero; emit a duration-change/removal event. No DoT/heal tick on reduction.

Stacking, lifetime and edge cases: No persistent effect; repeated reductions add. Removing a gust icon must not silently erase already-added pending delay (see C03). Do not count these removals as remove_status cleanse stacks unless approved.

UNKNOWN C03: reducing/cleansing Gust after application: does it also refund pending delay? PROPOSED no.

Vectors: [`reduce_status_durations.json`](vectors/reduce_status_durations.json) (normal and boundary/order case).

### `reduce_cooldowns`

Users: `pippa_bell`.

Fields: required `target_selector_id`, `amount_turns`, `minimum_remaining_turns`; optional none.

Semantics: For positive cooldowns only: new = min(old, max(minimum_remaining_turns, old − amount_turns)). Zero remains zero; a minimum of 1 never raises 0. Applied after normal turn-start decrement if used in that hook.

Stacking, lifetime and edge cases: Immediate; repeated reductions add down to the minimum. Does not change skill definitions or ultimate Focus cost.

UNKNOWN C04: confirm ready cooldown 0 stays ready and positive cooldown 1 stays 1 for Pippa.

Vectors: [`reduce_cooldowns.json`](vectors/reduce_cooldowns.json) (normal and boundary/order case).

### `grant_damage_reduction`

Users: `nara_vell`.

Fields: required `target_selector_id`, `damage_taken_multiplier`, `duration_turns`; optional none.

Semantics: Install a damage_taken_multiplier on the selected ally. Multiply with Sanctuary, packet modifiers and other distinct reductions before floor/shields.

Stacking, lifetime and edge cases: Target owner-turn duration. Same caster/skill refreshes to max duration, replacing magnitude; distinct sources multiply. Death removes it.

UNKNOWN C05: anonymous timed-effect refresh identity is not specified. PROPOSED caster+skill+op-index.

Vectors: [`grant_damage_reduction.json`](vectors/grant_damage_reduction.json) (normal and boundary/order case).

### `grant_opening_guard`

Users: `nara_vell`.

Fields: required `target_selector_id`, `duration_rounds`, `target_override`, `damage_taken_multiplier`; optional none.

Semantics: At battle_start arm the owner for duration_rounds gauge cycles. The first eligible single-target hostile action by each enemy is redirected to the owner and multiplied by damage_taken_multiplier. AoE is unchanged.

Stacking, lifetime and edge cases: One use per enemy over the opening window, not once per cycle. A multi-hit action redirects all its packets. Mark use at first actual damage packet. Expire after closing cycle 2. Ignore if guard dead.

UNKNOWN C06: precedence against Taunt/intercept/redirect and scope of first-per-enemy. PROPOSED Taunt → opening guard → intercept → fractional redirect, one redirect path only.

Vectors: [`grant_opening_guard.json`](vectors/grant_opening_guard.json) (normal and boundary/order case).

### `modify_outgoing_damage`

Users: `clem_marr`.

Fields: required `target_selector_id`, `multiplier`; optional `when`.

Semantics: At before_damage_dealt multiply the current packet only. Does not modify ATK or future actions. Clem’s once-per-target-per-battle limit is keyed by defender identity.

Stacking, lifetime and edge cases: No duration; distinct packet multipliers multiply. A failed condition does not spend the hook limit. For multi-hit attacks consume this limit on first qualifying hit only.

UNKNOWN C07: does once-per-target affect one hit or the full action? PROPOSED one packet.

Vectors: [`modify_outgoing_damage.json`](vectors/modify_outgoing_damage.json) (normal and boundary/order case).

### `arm_counter`

Users: `hana_birch`.

Fields: required `target_selector_id`, `event`, `scale_stat`, `multiplier`, `damage_type`, `consume_on_trigger`; optional none.

Semantics: Attach a one-shot watcher to the prior live target. On that target’s next action before the caster’s next owner-turn start, deal caster ATK × multiplier physical damage to it after its action resolves. No automatic basic/active Focus for caster.

Stacking, lifetime and edge cases: Watcher expires at caster next turn, caster death, target death or trigger. Counter/splash does not recursively trigger counters/passives by default; can_trigger_passives must explicitly opt in.

UNKNOWN C08: before vs after the watched action; PROPOSED after so killing with counter does not silently cancel an action already chosen.

Vectors: [`arm_counter.json`](vectors/arm_counter.json) (normal and boundary/order case).

### `arm_next_attack_bonus`

Users: `hana_birch`.

Fields: required `target_selector_id`, `damage_multiplier`, `consume_on_attack`; optional none.

Semantics: Store one pending multiplier for the caster’s next damage action. Multiply every packet/target of that action by damage_multiplier, then consume once. Non-damage healing/support actions do not consume.

Stacking, lifetime and edge cases: One pending bonus (refresh, never multiply repeated arms). Remains until attack or caster death; no authored duration. Does not apply to reaction/counter/DoT packets.

UNKNOWN C09: packet vs action scope and whether a blocked attack consumes. PROPOSED full attack, consume even if completely blocked.

Vectors: [`arm_next_attack_bonus.json`](vectors/arm_next_attack_bonus.json) (normal and boundary/order case).

### `grant_first_hit_guard`

Users: `iona_mist`.

Fields: required `target_selector_id`, `damage_taken_multiplier`, `duration_turns`, `hits_per_target`; optional none.

Semantics: Each selected ally receives its own hits_per_target counter and damage_taken_multiplier. Spend one charge per incoming attack packet before shields.

Stacking, lifetime and edge cases: Owner-turn duration; expire even with unused charges. Distinct sources multiply; same caster/skill refreshes duration and resets charges. AoE spends each victim’s own charge. DoT/cost excluded.

UNKNOWN C10: fully shielded/blocked hits and multi-hit counting. PROPOSED shielded spends; a block spends the guard as well because the attack connected.

Vectors: [`grant_first_hit_guard.json`](vectors/grant_first_hit_guard.json) (normal and boundary/order case).

### `delay_next_action`

Users: `marek_vane`.

Fields: required `target_selector_id`, `gauge_fraction`; optional none.

Semantics: Add floor(gauge_max × gauge_fraction) to pending_delay, capped at 5000 total. Current gauge and SPD do not change. Next readiness is gauge ≥ 10000 + pending_delay.

Stacking, lifetime and edge cases: Additive across delay and Gust. Clear only after the delayed action resolves (including skip). An already-ready unit can become unready before its turn is selected.

No new ambiguity for numeric cap/order; see C03 for cleansing Gust.

Vectors: [`delay_next_action.json`](vectors/delay_next_action.json) (normal and boundary/order case).

### `pay_hp_cost`

Users: `corrupted_mercenary`.

Fields: required `target_selector_id`, `max_hp_fraction`, `cannot_reduce_below`; optional none.

Semantics: Subtract min(max(0, hp − cannot_reduce_below), floor(maxHp × max_hp_fraction)) from caster HP, without defense/shield/reduction/crit. Never grants hit Focus.

Stacking, lifetime and edge cases: Immediate non-damage resource cost; executes in array order. No damage-received/threshold combat hooks. Cannot revive a dead caster.

UNKNOWN C11: cost rounding and threshold hooks unspecified. PROPOSED floor with zero allowed and no combat-damage hooks.

Vectors: [`pay_hp_cost.json`](vectors/pay_hp_cost.json) (normal and boundary/order case).

### `copy_buff`

Users: `boss_ashen_lord_wraith`, `estate_wraith`.

Fields: required `target_selector_id`, `source_selector_id`, `category`, `maximum_count`, `duration_turns`; optional none.

Semantics: Pick source by source_selector_id; copy up to maximum_count matching buff statuses or shield instances without removing originals. Copied entries carry copied=true plus origin source/skill identity.

Stacking, lifetime and edge cases: PROPOSED oldest-applied matching instances first; duration=min(source remaining, authored duration). Status refresh respects unique status_id; shields add within 2×maxHP cap. Never copy watchers/telegraphs or debuffs.

UNKNOWN C12: source ordering, duration, snapshot potency, shield eligibility and whether shields count as buffs for source selection. PROPOSED statuses only for selector count, snapshot potency, shields separately copyable.

Vectors: [`copy_buff.json`](vectors/copy_buff.json) (normal and boundary/order case).

### `remove_shield`

Users: `boss_marshal_oren`, `lost_vow_knight`.

Fields: required `target_selector_id`; optional `amount_fraction`, `shield_source_id`.

Semantics: If shield_source_id exists remove all matching shield instances, keeping other shields. If amount_fraction exists remove floor(total selected shield × fraction), consuming oldest instances first. Neither field means remove all.

Stacking, lifetime and edge cases: Immediate; no HP spillover, damage hooks or Focus. Fraction 0 is no-op; fraction 1 removes all. Reject both filters together pending an explicit combined contract.

UNKNOWN C13: partial-removal rounding/order and combination of optional filters; PROPOSED floor and oldest-first.

Vectors: [`remove_shield.json`](vectors/remove_shield.json) (normal and boundary/order case).

### `grant_intercept`

Users: `noble_retainer`.

Fields: required `target_selector_id`, `protected_ally_selector_id`, `redirected_fraction`, `duration_turns`; optional `maximum_intercepts`.

Semantics: Protector arms a redirect on one own-team ally. Move redirected_fraction of a qualifying single-target damage packet to living protector before absorption; round half up, then each recipient uses its shields.

Stacking, lifetime and edge cases: Duration uses protector owner turns, consistent with current grant_redirect. maximum_intercepts counts hostile actions, not hits. On last intercept, protect the entire multi-hit action then remove. Cannot self-protect, chain or loop.

UNKNOWN C14: action vs hit count and relation to other redirects. PROPOSED action count; see C06.

Vectors: [`grant_intercept.json`](vectors/grant_intercept.json) (normal and boundary/order case).

### `block_attack`

Users: `royal_hollow`.

Fields: required `target_selector_id`, `maximum_hits`; optional none.

Semantics: Within before_damage_received, set up to maximum_hits current action packets to zero before shields; no minimum-one damage for a blocked packet. No received-hit Focus and no damage-trigger hooks.

Stacking, lifetime and edge cases: Event-local, not an indefinite status; Royal Hollow per_round=1 resets on gauge-cycle close. For multi-hit actions only the first maximum_hits are blocked.

UNKNOWN C15: scope of maximum_hits. PROPOSED current action, with per-cycle hook limit controlling rearming.

Vectors: [`block_attack.json`](vectors/block_attack.json) (normal and boundary/order case).

### `cancel_boss_telegraph`

Users: `boss_ash_maw`, `boss_captain_rusk`.

Fields: required `target_selector_id`, `action_id`; optional none.

Semantics: Cancel the currently held telegraph only if its action_id matches. Destroying an authored break objective invokes this effect even when the critical telegraph is immune to generic control.

Stacking, lifetime and edge cases: Idempotent; no match = no-op. Keep unrelated telegraphs. PROPOSED cancelled signature counts as resolved for its cooldown; no damage, spawn, Focus or cost occurs.

UNKNOWN C16: cooldown/gauge cost after cancellation is unstated. PROPOSED finish the held boss turn normally and start signature cooldown.

Vectors: [`cancel_boss_telegraph.json`](vectors/cancel_boss_telegraph.json) (normal and boundary/order case).

### `remove_boss_modifier`

Users: `boss_bell_widow`.

Fields: required `target_selector_id`, `modifier_id`; optional none.

Semantics: Remove the named modifier_id from the encounter boss, without touching other wards, stats or statuses. Emit removal once.

Stacking, lifetime and edge cases: Idempotent; lasts until phase legitimately authors it again. Dead/missing boss = no-op, unknown objective/modifier reference fails cross-reference validation.

UNKNOWN C17: whether later phase passive reevaluation may resurrect a destroyed objective’s ward. PROPOSED never while its objective remains destroyed.

Vectors: [`remove_boss_modifier.json`](vectors/remove_boss_modifier.json) (normal and boundary/order case).

### `boss_damage_taken_modifier`

Users: `boss_bell_widow`, `boss_eclipse_construct`, `boss_red_vial_matron`.

Fields: required `target_selector_id`, `multiplier`; optional `modifier_id`, `until_objective_destroyed`, `while_any_objective_alive`.

Semantics: Upsert one multiplier per boss+modifier_id. until_objective_destroyed is true while that objective lives; while_any_objective_alive is an OR across named objectives. Multiply all active distinct wards before damage floor/shields.

Stacking, lifetime and edge cases: Encounter/phase lifetime, reevaluate after each objective destruction; repeated passive evaluation cannot stack the same id. Both condition fields together rejected pending explicit contract.

UNKNOWN C18: unlabeled modifier identity and conflicting conditions. PROPOSED compiler requires stable modifier_id and one objective condition.

Vectors: [`boss_damage_taken_modifier.json`](vectors/boss_damage_taken_modifier.json) (normal and boundary/order case).

### `summon_enemies`

Users: `boss_captain_rusk`.

Fields: required `target_selector_id`, `enemy_id`, `count`; optional `only_if_objective_alive`.

Semantics: At effect time require only_if_objective_alive (when present); spawn count copies of enemy_id on caster team at free combat slots, starting gauge 0, Focus 0, scaled to encounter level. Stable instance IDs use caster/action/spawn sequence.

Stacking, lifetime and edge cases: Never exceed 5 living enemy combatants; partial fill uses lowest free slot and authored/default front/rear slot layout. Spawned units join the next gauge-cycle snapshot, never the current cycle.

UNKNOWN C19: capacity overflow, spawn formation/level and repeat summon cap. PROPOSED partial fill (no queued overflow), level=encounter enemy level; author total-summon cap before release.

Vectors: [`summon_enemies.json`](vectors/summon_enemies.json) (normal and boundary/order case).

### `remove_copied_statuses`

Users: `boss_ashen_lord_wraith`.

Fields: required `target_selector_id`, `category`; optional none.

Semantics: Remove only entries carrying copied provenance and matching category from the boss. category=shield includes copied shield instances, not natural phase shields.

Stacking, lifetime and edge cases: Immediate and idempotent. Never removes original source entries or native boss statuses; category buff excludes shield unless explicitly authored.

No copied metadata in current engine: binary/schema extension required, not a data patch.

Vectors: [`remove_copied_statuses.json`](vectors/remove_copied_statuses.json) (normal and boundary/order case).

### `clear_status_if_all_objectives_destroyed`

Users: `boss_eclipse_construct`.

Fields: required `target_selector_id`, `objective_ids`, `status_id`; optional none.

Semantics: If every objective_id is authored and destroyed, remove status_id from the selected boss. If any objective still lives leave the status unchanged.

Stacking, lifetime and edge cases: Immediate, idempotent. Missing IDs are validation errors, not treated as destroyed. Evaluate after objective on_destroyed effects and before phase transition.

UNKNOWN C20: whether status can be reapplied while all objectives remain destroyed. PROPOSED prevent reapplication only if a separate continuous immunity is authored; this op is a cleanse, not immunity.

Vectors: [`clear_status_if_all_objectives_destroyed.json`](vectors/clear_status_if_all_objectives_destroyed.json) (normal and boundary/order case).

### `grant_status_immunity` (declared, unused)

The effects contract declares target_selector_id, status_id and duration_turns, but neither cast file uses it. PROPOSED: install a timed immunity to the named status, checked before chance rolls, refresh by max remaining duration, no retroactive cleanse. UNKNOWN C22: is status_id the protected status or a ward definition? Existing Tilda applies the defined `soaked_immunity` via apply_status; do not replace it silently.

## Missing statuses

All status IDs are unique on a target; refresh to greater remaining duration. PROPOSED new source attribution/potency replaces the previous source on refresh; C23 requests confirmation. Tick/source behavior is not implemented today. Status vectors give explicit owner-turn boundaries.

### Status `burn`

DoT = floor(source ATK × 0.12), minimum 1; default duration 2. PROPOSED source ATK snapshot, no DEF/RES/element/crit or hit Focus; shields absorb. With decrement-before-tick, duration 2 yields one tick (not two).

Users/references: `boss_ash_maw`, `jori_flint`, `kera_voss`, `rikka_ember`.

UNKNOWN C23: snapshot vs live ATK and whether duration 2 was intended to tick twice.

### Status `venom`

As Burn, multiplier 0.10; debuff/poison, duration 2; separate ID so Burn and Venom coexist. Oldest seq ticks first.

Users/references: `glass_viper`, `red_vial_alchemist`, `red_vial_scout`.

UNKNOWN C23 applies; dead source does not erase an already applied DoT under the proposal.

### Status `soaked`

Tide incoming damage ×1.1 while active. First Gale/Ember attack consumes it for Crosscurrent/Steamflare bonus 0.15. PROPOSED multiply that hit by 1.15 before floor rather than add a separately rounded packet; no recursive passive.

Users/references: `odelia_pike`, `tilda_fen`.

UNKNOWN C24: bonus basis, separate packet vs multiplier and exactly when consumed are unstated.

### Status `gust`

On application add 0.15×10000 =1500 pending delay; cap shared delay at 5000. Icon persists until next delayed action, then consumed irrespective of ordinary duration 1.

Users/references: .

UNKNOWN C03: cleanse interaction. C25: does reapplication of the same Gust add another delay? PROPOSED refresh icon, do not add again while Gust is pending.

### Status `dawnward`

Resistance bonus +10%, duration 2; PROPOSED additive RES modifier, effective DEF fallback when no RES. Combine with other RES percent mods before half-up rounding; not a flat 10% damage reduction.

Users/references: `sister_aveline`.

UNKNOWN C26: general RES vs elemental resistance table meaning.

### Status `trail_mark`

Target priority mark, duration 2, tag mark; no inherent damage factor. Nixie/Sable predicates refer to mark tags. PROPOSED only authored selectors/AI prioritize marked targets, no global target override.

Users/references: `ash_wolf`, `inkbound_dead`, `nixie_vale`, `red_vial_scout`.

UNKNOWN C27: auto-target priority beyond duel_marked_enemy is not specified.

### Status `duel_mark`

Duration 2, tags mark/duel; duel_marked_enemy selects lowest HP fraction among marked opponents, slot/ID ties, fallback single_enemy_default. consume_on_single_target_action (when present) removes after resolving that action.

Users/references: `boss_captain_rusk`.

UNKNOWN C28: taunt/mark ownership and which action consumes; PROPOSED applying boss’s matching hostile action, not any attacker.

### Status `soul_link`

Duration 2, buff: default shared fraction .25, per-recipient cap .15 maxHP; explicit op shared_damage_fraction overrides. PROPOSED other living same-team linked recipients split the diverted fraction, no recursion; unshareable remainder stays on original target. Round/cap before each recipient shields.

Users/references: `chain_cultist`.

UNKNOWN C29: source data does not define partner mapping, split rounding or redirect precedence; vectors are proposals and blocked pending decision.

### Status `soaked_immunity`

Dry Ward, buff, duration 1; prevents new Soaked applications, no cleanse of existing Soaked, no immunity to other debuffs. Check before chance; no RNG draw for immune application.

Users/references: `tilda_fen`.

UNKNOWN C30: immunity roll consumption and duration-1 expiry need confirmation; Tilda after-heal application expires next owner-turn start.

## Selectors (all missing selector IDs, plus existing interpretation conflicts)

Selectors use living units and stable slot/ID ties. Explicit row/lowest/highest/random selectors bypass default row protection; eligible single-target hostile actions still obey Taunt. Allies always mean actor team; enemy-authored `enemy_ally` is not the opposite team. Objectives are separate encounter entities and cannot be included accidentally in all_enemies. Invalid manual choices are rejected, not silently replaced; auto uses authored fallback.

| Selector | Exact source rule / proposed missing edge behavior | Users |
|---|---|---|
| `lowest_hp_enemy` | Minimum opposing HP/maxHP; slot, ID ties. | `boss_eclipse_construct`, `hollow_cleric`, `inkbound_dead`, `sable_wren`, `vespera_wisp` |
| `enemy_with_lowest_def` | Minimum effective DEF of opponents; slot, ID ties. | `nixie_vale` |
| `enemy_with_highest_atk` | Maximum effective ATK of opponents; slot, ID ties. | `nixie_vale` |
| `lowest_hp_rear_enemy` | Opposing rear, minimum HP fraction; empty row skips (no implicit front fallback). | `ash_wolf`, `glass_viper`, `red_vial_scout` |
| `lowest_hp_front_enemy` | Opposing front, minimum HP fraction; empty row skips. | `bridge_revenant`, `lost_vow_knight` |
| `random_other_enemy` | Seeded choice from sorted living opponents excluding last primary; contract empty fallback lowest_hp_enemy can re-hit primary (C31). No choice/no RNG if zero candidates; one draw when >1 (PROPOSED). | `kera_voss`, `sable_wren` |
| `selected_ally` | Manual living actor-team choice, automatic lowest_hp_ally. | `iona_mist`, `mirel_quill`, `nara_vell` |
| `ally_with_lowest_focus` | Minimum own-team Focus, slot/ID ties. | `pippa_bell` |
| `front_row_allies` | All living own-team front units, slot/ID order. |  |
| `event_target` | Live event victim; missing/dead skips. Defeat predicates retain event snapshot separately. | `iona_mist`, `nara_vell`, `sister_aveline`, `tilda_fen` |
| `last_heal_target` | Last unit actually healed (>0 HP), not last attempted heal; if multiple, PROPOSED final slot/ID-ordered healed unit (C32). | `iona_mist`, `thistle_roe`, `tilda_fen` |
| `boss` | Encounter-designated living boss, independent of actor relation; missing skips. | `boss_ash_maw`, `boss_ashen_lord_wraith`, `boss_bell_widow`, `boss_captain_rusk`, `boss_eclipse_construct` |
| `self_and_enemy_guards` | Actor union living actor-team units with guard tag; deduplicate, slot/ID sort. C33: guard tagging not present in runtime UnitDef. | `boss_marshal_oren` |
| `boss_and_enemy_guards` | Boss union living boss-team guard-tagged units; same ordering/dedup. | `boss_marshal_oren` |
| `all_enemy_allies` | Alias all_allies for enemy-authored effects; includes caster. | `chain_cultist`, `eclipse_sentinel` |
| `lowest_hp_enemy_ally` | Alias lowest_hp_ally, includes caster unless explicitly excluded. | `corrupted_crown_guard`, `noble_retainer` |
| `most_injured_enemy_ally` | Maximum absolute missing HP (maxHP−HP), not lowest fraction. | `hollow_cleric` |
| `duel_marked_enemy` | Minimum HP fraction opposing duel_mark targets, fallback default; C28 consumption. | `boss_captain_rusk` |
| `enemy_with_most_buffs` | Maximum buff-tag status count; PROPOSED shields/stat mods not in count (C12); ties slot/ID. | `boss_ashen_lord_wraith`, `estate_wraith` |

UNKNOWN C34: authoring `lowest_hp_ally` uses HP fraction, while `COMBAT_RULES.md` and current engine deliberately use absolute HP. Also authoring default target picks lowest slot whereas engine picks lowest HP fraction within front. Preserve existing runtime behavior until Claude/owner chooses and versions the changed selector semantics. Source self_and_lowest_hp_ally does not state “other”; current engine excludes self. Proposed new selectors use source HP fractions and do not silently alter existing selectors.

Selector checks: opposing front HP 80/100 slot0, rear HP 20/50 slot1 → lowest_hp_enemy/rear = rear, front/default = front; equal ratios → lower slot, equal slot → stable ID. Own-team 60/100 vs 40/50 → fraction lowest is first, absolute lowest is second (C34). Own-team missingHP 40 vs10 → most_injured first. Dead candidate excluded; empty row/event reference skips; duel with no mark falls back; boss/guards union deduplicates. These are adapter assertions, not production overrides.

## Predicates, compound conditions, fields and hooks

Each missing predicate has a defined meaning below; value ranges/types must be validated and unsupported leaves rejected at load time. Boolean `all`/`any` evaluate in array order, `not` negates one node; PROPOSED empty all/any rejected. Numeric threshold comparisons use ratios without display rounding. Any absent event/last-target context returns false, not an arbitrary target.

| Missing predicate | Semantics | Users |
|---|---|---|
| `owner_hp_above_pct` | Owner HP/maxHP strictly > value/100. | `thistle_roe` |
| `owner_has_status` | Owner has exact active status ID. | `brin_alder` |
| `owner_action_type` | Current action type equals value, not passive skill type. | `jori_flint` |
| `owner_took_no_damage_this_round` | Owner HP damage accumulator for current gauge cycle is zero; absorbed/blocked hits do not count (PROPOSED). | `hana_birch` |
| `last_target_has_status_tag` | Last primary target active tags contain value; snapshot if defeated (PROPOSED). |  |
| `last_target_defeated` | Last primary damaged target is now HP 0; retain identity after live filtering. | `nixie_vale` |
| `last_primary_target_defeated` | As last_target_defeated, excluding splash/counter targets. | `sable_wren` |
| `target_has_status` | Current packet target has exact active status ID. | `clem_marr`, `odelia_pike`, `rikka_ember`, `vespera_wisp` |
| `target_has_status_tag` | Current packet target has a status whose tags contain value. | `nixie_vale` |
| `target_has_any_status_tag` | Expand contract mark_or_dread=[mark,dread], then any matching tag; unknown group rejected. | `sable_wren` |
| `target_has_acted_this_battle` | At least one resolved/skip action on this stable unit ID; spawned units start false (PROPOSED). | `hana_birch` |
| `target_in_row` | Current event/damage target row equals front/rear. | `nara_vell` |
| `event_target_hp_at_or_below_pct` | Live event target HP/maxHP ≤ value/100; threshold event only crosses from above to ≤. | `iona_mist`, `sister_aveline` |
| `event_target_had_status` | Read status snapshot immediately before defeat; allows Vespera Focus after Dread target dies. | `vespera_wisp` |
| `event_actor_has_any_buff` | Event actor has at least one buff-tag status; C12 shield/mod classification applies. | `mirel_quill` |
| `event_source_faction_is` | Event source definition faction_id equals value; missing source false. |  |
| `count_enemies_with_status` | Count living opponents carrying exact value ID; clamp to modifier maximum_count; adds multiplier per count, not a standalone boolean (C35). | `kera_voss` |
| `enemy_ally_hp_below_pct` | Any living actor-team unit HP fraction strictly < value/100. | `hollow_cleric` |
| `no_enemy_ally_below_pct` | Negation of above over living actor team. | `hollow_cleric` |
| `damage_dealt_at_least_pct_of_target_hp` | Actual HP damage ≥ value/100 × target maxHP (PROPOSED C36; source phrase target_hp could mean pre-hit HP). | `orchard_ghoul` |
| `round_number_at_most` | Gauge cycle (1-based), not action count, ≤ value. | `nara_vell` |

Damage extensions: `hit_count` resolves each hit separately, with one crit draw per target per hit and one received-hit Focus gain per unblocked hit (cap 15). `can_trigger_passives=false` suppresses damage passive recursion, not HP/death bookkeeping. `modifiers` conditions evaluate per target after previous ops; add_multiplier_per_count adds to skill multiplier before other multiplicative factors. `shield_damage_multiplier` modifies shield absorption demand only; UNKNOWN C37: how to convert overflow back to HP and whether the source intends separate shield damage. `multiplier_if_objective_alive` / `multiplier_if_all_objectives_alive` must read encounter objectives before each packet; UNKNOWN C38: field value shape and composition must follow boss-actions source, not an inferred runtime union. `remove_status.selection=random_applied_buff` consumes the seeded stream over seq-sorted eligible statuses; no removal/no RNG for empty set. `apply_status.shared_damage_fraction` overrides Soul Link definition; `consume_on_single_target_action` applies to marks as C28.

Hooks missing from runtime: battle_start (after unit construction, before first gauge tick); stat_snapshot (pure continuous modifiers, no state mutation/RNG); before_damage_dealt; after_damage_dealt; after_damage_received; after_ally_healed (>0 actual heal); ally_hp_threshold_crossed (nonlethal crossing only, PROPOSED); after_ally_action; after_ally_ultimate (subset, once); ally_damaged (>0 HP damage); after_enemy_defeated (once, pre-defeat status snapshot); after_round_end (gauge cycle snapshot closes); target_action_before_owner_next_turn (counter watcher). Users and exact authored hook/filter/limit objects are transcribed in `SOURCE_USAGE.json`; do not equate these event IDs to turn-start automatically.

Limits: per_event keyed by immutable event ID; per_battle keyed owner/skill/hook; per_round resets only at gauge-cycle closure; per_owner_turn resets at that owner’s turn start; per_target_per_battle additionally keys target ID; per_damage_action keys action ID across all hits; chance draws once after filter/predicate/available limit match; one_pending_bonus refreshes one stored bonus. UNKNOWN C39: RNG consumption order, which limits count a zero-result effect, team filter when enemy owns a passive, threshold healing reentrancy and hook recursion depth are unstated. PROPOSED consume on qualifying dispatch, bind player literal filters to player side, generated damage cannot reenter unless explicitly authored, and cap recursion at 16 with deterministic rejection (not silent skipping).

## Handoff decisions

All UNKNOWN C01–C39 are decisions to resolve before committing a new binary grammar. Vectors encode the labeled proposed semantics; approving/altering these decisions requires updating the matching vector expectations. Canon numeric definitions remain unchanged. Prioritize tutorial-compatible effects first; objective and advanced cast effects must remain rejected by the current closed schema until implemented and server replay tests pass.
