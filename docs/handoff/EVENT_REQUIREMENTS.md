# Planned event requirements for the shipped engine/catalog

Audit revision `5c83e3d1`, 2026-10-11; English text, Japanese spoken dialogue (`ja-JP`). Read-only review of **all eight** packages in `narrative/04_Events/Planned_Content/`. No event is published and no canon is rewritten. The package `authoring/` JSONs and scripts are production design sources; `combat_feasibility.json` uses **tutorial-kit proxy units**, not the actual canonical heroes/enemy signatures. Recorded feasibility PASS means the proxies passed a prior run, not that the complete canonical cast is currently supported. These simulations were not rerun for this brief.

## Shared integration gap

- Runtime `StoryCommand` supports say/narrate/show/hide/background/music/fade/flash/shake/wait/choice/label/goto/checkpoint/end. Package orchestration (stage gates, revision-pinned event state, branch-conditioned encounters, replay catalogs) has no corresponding first-class event service/schema. Compile local choices into supported labels where possible; cross-scene conditions/state migration need an explicit versioned contract. Do not ship authoring JSON directly.
- `ChapterNode.requires` is one node ID, not arbitrary compound stage/event gates. Resolve every null runtime_stage_mapping to a server-verified `player_progress` node; record event completion separately from replays. A Borrowed Chair needs a second completion gate and source-event alias resolution.
- Published encounter party is 1..5 units and enemies 1..5, with pre/post stories. Map real owned/free/loan heroes to each canonical role; a speaker is not automatically a playable loan. Story access cannot require gacha ownership. Proxy portraits, copied hero kits and enemy role reinterpretations are not accepted production bindings.
- All packages have owner-undecided rewards (`binding:null`); ration/energy bindings are also unset. No new currency or invented payouts. Later use `NodeRewards` / server progress claims with only `eclipse_token` plus valid material/gear IDs; require idempotent one-time completion rewards, no grants from dialogue callbacks or replay.
- NPCs, medicine crates, archives, chairs, travelers, villagers and relief supplies are story props. Their packages do **not** require escort HP, civilian combat slots, timers or resource meters. Those mechanics must not be invented from narrative imagery. Eclipse observation in Those Who Watch is not a combat stat modifier.
- Stable line/node/choice IDs, scene-end saves, retry at same battle, fresh resources for isolated practice, revision pinning and replay isolation require server/client integration and tests. `player_saves` stores a JSON object but that alone is not a verified event completion ledger.
- Voice tags `jp`/`jp_narration` must map to reviewed Japanese text/Chirp 3 HD audio with English subtitles and stable line IDs. Missing Japanese transcript/voice/media binding is an explicit production blocker; no English text may be sent to TTS merely with a Japanese voice selected.

## Package-by-package dependency matrix

“Cast” below means canonical speakers, **not an approved party assignment**. “Full-kit gaps” are potential dependencies if those heroes/enemies are played with their authored kits; a package may instead use an owner-reviewed encounter profile using the shipped grammar. Enemy IDs existing in Narrative or the D1 admin catalog do not prove they are present in a signed runtime unit pack.

### Archive Watch (`archive_watch` / `tactical_archive_watch`)

Sources: `narrative/04_Events/Planned_Content/archive_watch/authoring/{event,encounters,state_contract,tuning,combat_feasibility}.json` under Planned_Content; package README and KARSILASMALAR/PATCH_DEVRI where present.

Gate: after `4-5`; payment/ownership required = false. Runtime mapping **UNKNOWN**. Battles/run: 3; authored encounter variants: 8.

Design: Three fresh-state archive cases; choose steady/reach, then interrupt/endure, then review. No new canonical attack or clinic siege. Eight encounter variants; bind visible recovery/support/rear threats to real permitted effects.

Cast: `iona_mist`, `kera_voss`, `odelia_pike`, `tilda_fen`. Enemies: `ash_wolf`, `bellbound_dead`, `hollow_pilgrim`. Missing from embedded unit pack: `ash_wolf`, `hollow_pilgrim`.

| Full canonical kit | Missing operations | Missing statuses | Missing selectors | Additional grammar gaps |
|---|---|---|---|---|
| `iona_mist` | `grant_first_hit_guard` | none | `event_target`, `last_heal_target`, `selected_ally` | `event=ally_hp_threshold_crossed`, `predicate=event_target_hp_at_or_below_pct` |
| `kera_voss` | none | `burn` | `random_other_enemy` | `event=after_damage_dealt`, `hit_count`, `modifiers`, `predicate=count_enemies_with_status` |
| `odelia_pike` | none | `soaked` | none | `continuous_modifiers`, `event=before_damage_dealt`, `predicate=target_has_status` |
| `tilda_fen` | `apply_regeneration` | `soaked_immunity` | `event_target`, `last_heal_target` | `event=after_ally_healed` |
| `ash_wolf` | none | `trail_mark` | `lowest_hp_rear_enemy` | none |
| `bellbound_dead` | none | none | none | none |
| `hollow_pilgrim` | none | none | none | none |

Encounters: `aw_enc_first_steady`, `aw_enc_first_reach`, `aw_enc_second_interrupt`, `aw_enc_second_endure`, `aw_enc_final_steady_interrupt`, `aw_enc_final_steady_endure`, `aw_enc_final_reach_interrupt`, `aw_enc_final_reach_endure`.

Recorded proxy evidence: 8 fixtures / 72 simulations / 24 replay checks; production balance `NOT_CERTIFIED`. This is source evidence, not a new test result.

Rewards: UNKNOWN amounts/items/claim-once policy; no completion or mastery reward configured. Claude must resolve reward/ration mapping, production party/AI kits, true level balance, stage/choice routing and signed media paths before publication.

### A Borrowed Chair (`borrowed_chair` / `side_story_borrowed_chair`)

Sources: `narrative/04_Events/Planned_Content/borrowed_chair/authoring/{event,encounters,state_contract,tuning,combat_feasibility}.json` under Planned_Content; package README and KARSILASMALAR/PATCH_DEVRI where present.

Gate: after `3-5`; payment/ownership required = false. Runtime mapping **UNKNOWN**. Battles/run: 0; authored encounter variants: 0.

Design: Five-scene vignette inside the existing supper-ending montage, one Jori/Pippa voice choice, zero battles. No transport minigame, new day or repaired-chair rewrite.

Cast: `jori_flint`, `pippa_bell`. Enemies: none. Missing from embedded unit pack: none.

Additional gate: `event_harvest_inn_meal`, accepted working alias `event_one_dish_one_name`; runtime completion mapping UNKNOWN. No combat primitive or enemy is required by this package. Cast kits below are roster dependencies only, not requirements for the vignette.

| Full canonical kit | Missing operations | Missing statuses | Missing selectors | Additional grammar gaps |
|---|---|---|---|---|
| `jori_flint` | none | `burn` | none | `continuous_modifiers`, `event=before_damage_dealt`, `predicate=owner_action_type` |
| `pippa_bell` | `reduce_cooldowns` | none | `ally_with_lowest_focus` | `event=after_ally_ultimate` |

Encounters: none.

Recorded proxy evidence: 0 fixtures / 0 simulations / 0 replay checks; production balance `NOT_CERTIFIED`. This is source evidence, not a new test result.

Rewards: UNKNOWN amounts/items/claim-once policy; no completion or mastery reward configured. Claude must resolve reward/ration mapping, production party/AI kits, true level balance, stage/choice routing and signed media paths before publication.

### For the Last Traveler (`last_traveler` / `side_quest_last_traveler`)

Sources: `narrative/04_Events/Planned_Content/last_traveler/authoring/{event,encounters,state_contract,tuning,combat_feasibility}.json` under Planned_Content; package README and KARSILASMALAR/PATCH_DEVRI where present.

Gate: after `1-4`; payment/ownership required = false. Runtime mapping **UNKNOWN**. Battles/run: 1; authored encounter variants: 4.

Design: One battle after route/preparation choices; rear-threat priority, steady front defense and support ordering. Traveler is outside combat; no escort system.

Cast: `brin_alder`, `fadyme`, `mahmut`, `nixie_vale`. Enemies: `ash_wolf`, `bellbound_dead`, `hollow_pilgrim`. Missing from embedded unit pack: `ash_wolf`, `hollow_pilgrim`.

| Full canonical kit | Missing operations | Missing statuses | Missing selectors | Additional grammar gaps |
|---|---|---|---|---|
| `brin_alder` | none | none | none | `continuous_modifiers`, `predicate=owner_has_status` |
| `fadyme` | none | none | none | none |
| `mahmut` | none | none | none | none |
| `nixie_vale` | none | `trail_mark` | `enemy_with_highest_atk`, `enemy_with_lowest_def` | `continuous_modifiers`, `event=after_damage_dealt`, `event=before_damage_dealt`, `predicate=last_target_defeated`, `predicate=target_has_status_tag` |
| `ash_wolf` | none | `trail_mark` | `lowest_hp_rear_enemy` | none |
| `bellbound_dead` | none | none | none | none |
| `hollow_pilgrim` | none | none | none | none |

Encounters: `lt_enc_scout_tracks`, `lt_enc_scout_sound`, `lt_enc_brace_bank`, `lt_enc_brace_beam`.

Recorded proxy evidence: 4 fixtures / 36 simulations / 12 replay checks; production balance `NOT_CERTIFIED`. This is source evidence, not a new test result.

Rewards: UNKNOWN amounts/items/claim-once policy; no completion or mastery reward configured. Claude must resolve reward/ration mapping, production party/AI kits, true level balance, stage/choice routing and signed media paths before publication.

### One Dish, One Name (`one_dish_one_name` / `event_one_dish_one_name`)

Sources: `narrative/04_Events/Planned_Content/one_dish_one_name/authoring/{event,encounters,state_contract,tuning,combat_feasibility}.json` under Planned_Content; package README and KARSILASMALAR/PATCH_DEVRI where present.

Gate: after `3-5`; payment/ownership required = false. Runtime mapping **UNKNOWN**. Battles/run: 1; authored encounter variants: 3.

Design: One battle among three prepared-task variants; front endurance, rear threats and support pressure. Meal/load remains outside combat. Choice does not spend an event wallet.

Cast: `fadyme`, `jori_flint`, `kera_voss`, `mahmut`, `nixie_vale`, `pippa_bell`. Enemies: `bellbound_dead`, `hollow_pilgrim`. Missing from embedded unit pack: `hollow_pilgrim`.

| Full canonical kit | Missing operations | Missing statuses | Missing selectors | Additional grammar gaps |
|---|---|---|---|---|
| `fadyme` | none | none | none | none |
| `jori_flint` | none | `burn` | none | `continuous_modifiers`, `event=before_damage_dealt`, `predicate=owner_action_type` |
| `kera_voss` | none | `burn` | `random_other_enemy` | `event=after_damage_dealt`, `hit_count`, `modifiers`, `predicate=count_enemies_with_status` |
| `mahmut` | none | none | none | none |
| `nixie_vale` | none | `trail_mark` | `enemy_with_highest_atk`, `enemy_with_lowest_def` | `continuous_modifiers`, `event=after_damage_dealt`, `event=before_damage_dealt`, `predicate=last_target_defeated`, `predicate=target_has_status_tag` |
| `pippa_bell` | `reduce_cooldowns` | none | `ally_with_lowest_focus` | `event=after_ally_ultimate` |
| `bellbound_dead` | none | none | none | none |
| `hollow_pilgrim` | none | none | none | none |

Encounters: `od_enc_wood_road`, `od_enc_road_song`, `od_enc_song_wood`.

Recorded proxy evidence: 3 fixtures / 27 simulations / 9 replay checks; production balance `NOT_CERTIFIED`. This is source evidence, not a new test result.

Rewards: UNKNOWN amounts/items/claim-once policy; no completion or mastery reward configured. Claude must resolve reward/ration mapping, production party/AI kits, true level balance, stage/choice routing and signed media paths before publication.

### An Open Road (`open_road` / `side_quest_open_road`)

Sources: `narrative/04_Events/Planned_Content/open_road/authoring/{event,encounters,state_contract,tuning,combat_feasibility}.json` under Planned_Content; package README and KARSILASMALAR/PATCH_DEVRI where present.

Gate: after `5-5`; payment/ownership required = false. Runtime mapping **UNKNOWN**. Battles/run: 1; authored encounter variants: 2.

Design: One battle selected by teaching supply/passage first; front pressure, support removal and rear threat. Survivors stay behind relief point; no escort/stock meter.

Cast: `marek_vane`, `nara_vell`. Enemies: `bridge_revenant`, `hollow_cleric`, `hollow_pilgrim`, `lost_vow_knight`. Missing from embedded unit pack: `bridge_revenant`, `hollow_cleric`, `hollow_pilgrim`, `lost_vow_knight`.

| Full canonical kit | Missing operations | Missing statuses | Missing selectors | Additional grammar gaps |
|---|---|---|---|---|
| `marek_vane` | `delay_next_action` | none | none | `continuous_modifiers`, `event=stat_snapshot` |
| `nara_vell` | `grant_damage_reduction`, `grant_opening_guard`, `modify_incoming_damage` | none | `event_target`, `selected_ally` | `predicate=round_number_at_most`, `predicate=target_in_row` |
| `bridge_revenant` | none | none | `lowest_hp_front_enemy` | none |
| `hollow_cleric` | none | none | `lowest_hp_enemy`, `most_injured_enemy_ally` | `predicate=enemy_ally_hp_below_pct`, `predicate=no_enemy_ally_below_pct` |
| `hollow_pilgrim` | none | none | none | none |
| `lost_vow_knight` | `remove_shield` | none | `lowest_hp_front_enemy` | none |

Encounters: `or_enc_supply`, `or_enc_passage`.

Recorded proxy evidence: 2 fixtures / 18 simulations / 6 replay checks; production balance `NOT_CERTIFIED`. This is source evidence, not a new test result.

Rewards: UNKNOWN amounts/items/claim-once policy; no completion or mastery reward configured. Claude must resolve reward/ration mapping, production party/AI kits, true level balance, stage/choice routing and signed media paths before publication.

### Somewhere Dry (`somewhere_dry` / `side_quest_somewhere_dry`)

Sources: `narrative/04_Events/Planned_Content/somewhere_dry/authoring/{event,encounters,state_contract,tuning,combat_feasibility}.json` under Planned_Content; package README and KARSILASMALAR/PATCH_DEVRI where present.

Gate: after `2-3`; payment/ownership required = false. Runtime mapping **UNKNOWN**. Battles/run: 1; authored encounter variants: 2.

Design: One battle in shelf/desk work variants; armored front and cleric support. Records/people stay outside fight; no archive durability or damage-to-paper mechanic.

Cast: `mirel_quill`, `sister_aveline`. Enemies: `choir_knight`, `hollow_cleric`, `inkbound_dead`. Missing from embedded unit pack: `choir_knight`, `hollow_cleric`, `inkbound_dead`.

| Full canonical kit | Missing operations | Missing statuses | Missing selectors | Additional grammar gaps |
|---|---|---|---|---|
| `mirel_quill` | `reduce_status_durations` | none | `selected_ally` | `event=after_ally_action`, `predicate=event_actor_has_any_buff` |
| `sister_aveline` | none | `dawnward` | `event_target` | `event=ally_hp_threshold_crossed`, `predicate=event_target_hp_at_or_below_pct` |
| `choir_knight` | none | none | none | `event=ally_damaged` |
| `hollow_cleric` | none | none | `lowest_hp_enemy`, `most_injured_enemy_ally` | `predicate=enemy_ally_hp_below_pct`, `predicate=no_enemy_ally_below_pct` |
| `inkbound_dead` | none | `trail_mark` | `lowest_hp_enemy` | none |

Encounters: `dr_enc_shelf`, `dr_enc_desk`.

Recorded proxy evidence: 2 fixtures / 18 simulations / 6 replay checks; production balance `NOT_CERTIFIED`. This is source evidence, not a new test result.

Rewards: UNKNOWN amounts/items/claim-once policy; no completion or mastery reward configured. Claude must resolve reward/ration mapping, production party/AI kits, true level balance, stage/choice routing and signed media paths before publication.

### Those Who Watch (`those_who_watch` / `event_those_who_watch`)

Sources: `narrative/04_Events/Planned_Content/those_who_watch/authoring/{event,encounters,state_contract,tuning,combat_feasibility}.json` under Planned_Content; package README and KARSILASMALAR/PATCH_DEVRI where present.

Gate: after `6-5`; payment/ownership required = false. Runtime mapping **UNKNOWN**. Battles/run: 3; authored encounter variants: 5.

Design: Three battles per route, ridge/terrace observation and mixed support/reaching threats. No eclipse pulse effect or mandatory fast kill. Villagers remain on safe ground.

Cast: `clem_marr`, `thistle_roe`, `vespera_wisp`. Enemies: `choir_knight`, `hollow_cleric`, `hollow_pilgrim`, `inkbound_dead`. Missing from embedded unit pack: `choir_knight`, `hollow_cleric`, `hollow_pilgrim`, `inkbound_dead`.

| Full canonical kit | Missing operations | Missing statuses | Missing selectors | Additional grammar gaps |
|---|---|---|---|---|
| `clem_marr` | `modify_outgoing_damage` | none | none | `event=before_damage_dealt`, `predicate=target_has_status`, `remove_status.selection=random_applied_buff` |
| `thistle_roe` | none | none | `last_heal_target` | `predicate=owner_hp_above_pct` |
| `vespera_wisp` | none | none | `lowest_hp_enemy` | `event=after_enemy_defeated`, `modifiers`, `predicate=event_target_had_status`, `predicate=target_has_status` |
| `choir_knight` | none | none | none | `event=ally_damaged` |
| `hollow_cleric` | none | none | `lowest_hp_enemy`, `most_injured_enemy_ally` | `predicate=enemy_ally_hp_below_pct`, `predicate=no_enemy_ally_below_pct` |
| `hollow_pilgrim` | none | none | none | none |
| `inkbound_dead` | none | `trail_mark` | `lowest_hp_enemy` | none |

Encounters: `tw_enc_ridge_1`, `tw_enc_ridge_2`, `tw_enc_terrace_1`, `tw_enc_terrace_2`, `tw_enc_return`.

Recorded proxy evidence: 5 fixtures / 45 simulations / 15 replay checks; production balance `NOT_CERTIFIED`. This is source evidence, not a new test result.

Rewards: UNKNOWN amounts/items/claim-once policy; no completion or mastery reward configured. Claude must resolve reward/ration mapping, production party/AI kits, true level balance, stage/choice routing and signed media paths before publication.

### Two Labels (`two_labels` / `event_two_labels`)

Sources: `narrative/04_Events/Planned_Content/two_labels/authoring/{event,encounters,state_contract,tuning,combat_feasibility}.json` under Planned_Content; package README and KARSILASMALAR/PATCH_DEVRI where present.

Gate: after `4-5`; payment/ownership required = false. Runtime mapping **UNKNOWN**. Battles/run: None; authored encounter variants: 8.

Design: Gate, coast/load route and final lane variants plus clean/scout preparation variants. Full multi-act state persists; alternate routes replay in isolated sessions. Optional mastery ideas have no approved predicates/rewards; bind an actual visible support/rear intent before promising interrupt mastery.

Cast: `iona_mist`, `kera_voss`, `odelia_pike`, `tilda_fen`. Enemies: `bellbound_dead`, `hollow_pilgrim`. Missing from embedded unit pack: `hollow_pilgrim`.

| Full canonical kit | Missing operations | Missing statuses | Missing selectors | Additional grammar gaps |
|---|---|---|---|---|
| `iona_mist` | `grant_first_hit_guard` | none | `event_target`, `last_heal_target`, `selected_ally` | `event=ally_hp_threshold_crossed`, `predicate=event_target_hp_at_or_below_pct` |
| `kera_voss` | none | `burn` | `random_other_enemy` | `event=after_damage_dealt`, `hit_count`, `modifiers`, `predicate=count_enemies_with_status` |
| `odelia_pike` | none | `soaked` | none | `continuous_modifiers`, `event=before_damage_dealt`, `predicate=target_has_status` |
| `tilda_fen` | `apply_regeneration` | `soaked_immunity` | `event_target`, `last_heal_target` | `event=after_ally_healed` |
| `bellbound_dead` | none | none | none | none |
| `hollow_pilgrim` | none | none | none | none |

Encounters: `tl_enc_gate`, `tl_enc_coast_wall`, `tl_enc_coast_turn`, `tl_enc_load_sheds`, `tl_enc_load_cart`, `tl_enc_boundary_clean`, `tl_enc_boundary_scout`, `tl_enc_last_lane`.

Recorded proxy evidence: 8 fixtures / 72 simulations / 24 replay checks; production balance `NOT_CERTIFIED`. This is source evidence, not a new test result.

Rewards: UNKNOWN amounts/items/claim-once policy; no completion or mastery reward configured. Claude must resolve reward/ration mapping, production party/AI kits, true level balance, stage/choice routing and signed media paths before publication.

## Acceptance and proposed implementation order

1. Map For the Last Traveler after 1-4 with free/loan heroes; implement the full Nixie kit only if that is the approved party contract. Test both choices, retry, reconnect and replay without duplicated completion/reward.
2. Somewhere Dry after 2-3: approve cleric healing/Decay support and choir retaliation instead of proxy labels. Then One Dish, One Name and its zero-battle Borrowed Chair gate.
3. Two Labels and Archive Watch after 4-5: support canonical Kera/Tilda/Iona/Odelia kits (regeneration, first-hit guard, Soaked/Dry Ward/reactions, hook recursion), or explicitly approve equivalent restricted profiles without claiming full kits.
4. Open Road after 5-5: Nara guard/reduction and Marek delay; cleric/support/front hooks and shield stripping. Those Who Watch after 6-5: Clem/Dread, Vespera/Soul Link, Thistle cleanse/after-heal predicates.
5. For each package validate closed grammar, complete branch graph/labels, stage/spoiler gate, exact canonical enemy definitions, server replay, five-party availability without pulls, English subtitle/Japanese VO mapping, atomic signed patch activation and rollback. Completion is a server event; replay has no economy mutations.

The full-kit gap inventory intentionally includes more than a package’s minimum restricted-profile needs. UNKNOWN E01: production kit/profile bindings; E02: stage/event alias mapping; E03: event reward/ration values; E04: revision-pinned event completion/replay persistence; E05: mastery semantics (Two Labels only); E06: Japanese adaptation and voice cue bindings. These need Claude/owner decisions, not new canon from Sol.
