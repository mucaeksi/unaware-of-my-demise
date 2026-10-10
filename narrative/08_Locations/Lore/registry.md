# Location Registry — Part I

Every `location_id` used in `content/` (script, companion stories, events), grouped by chapter hub. Generated 2026-09-29 (W3) from the narrative content; re-check after adding scenes. Visual rule: a sub-location without its own brief is drawn as a variant of its hub brief (`prompts/asset_pipeline/location_briefs.md`) with the chapter's ORDER_LEVEL. Unvisited named places: **Carrowgate** (capital, Silent Bell, Council) and **Glassford** (river city above the Undercity) — `glossary.md`.

## CH1 — Whispering Ash Forest

Region: Western forest road.

| location_id | Parent | Uses | Where used | Brief |
|---|---|---|---|---|
| `forest_whispering_ash` | hub | 11 | 1-1, 1-2, 1-3, 1-4, 1-5, ch1_camp, ch1_first_oath, cs_brin_alder_1, cs_brin_alder_2, cs_nixie_vale_1, opening_sad_scene | `location_briefs.md` ch1 |
| `forest_edge_road` | `forest_whispering_ash` | 1 | ch2_road | variant of hub |

## CH2 — Ruined Cathedral of Saint Luthos

Region: Forest edge, lowland.

| location_id | Parent | Uses | Where used | Brief |
|---|---|---|---|---|
| `cathedral_saint_luthos` | hub | 10 | 2-1, 2-2, 2-3, 2-4, 2-5, ch2_camp, cs_mahmut_1, cs_mirel_quill_1, cs_sister_aveline_1, cs_sister_aveline_2 | `location_briefs.md` ch2 |

## CH3 — Oakhaven

Region: Orchard lowlands.

| location_id | Parent | Uses | Where used | Brief |
|---|---|---|---|---|
| `village_oakhaven` | hub | 7 | 3-1, 3-2, 3-3, 3-4, 3-5, cs_kera_voss_1, cs_nixie_vale_2 | `location_briefs.md` ch3 |
| `oakhaven_inn` | `village_oakhaven` | 3 | ch3_camp, cs_pippa_bell_1, event_harvest_inn_meal_2 | variant of hub |
| `oakhaven_forge` | `village_oakhaven` | 2 | cs_jori_flint_1, cs_jori_flint_2 | variant of hub |
| `oakhaven_square` | `village_oakhaven` | 3 | cs_jori_flint_3, event_harvest_inn_meal_1, event_harvest_inn_meal_3 | variant of hub |
| `oakhaven_refuge` | `village_oakhaven` | 2 | cs_nixie_vale_3, cs_pippa_bell_2 | variant of hub |
| `orchard_lowlands` | `village_oakhaven` | 1 | ch3_road | variant of hub |

## CH4 — The Undercity (beneath Glassford)

Region: River city of Glassford.

| location_id | Parent | Uses | Where used | Brief |
|---|---|---|---|---|
| `undercity_subterranean` | hub | 5 | 4-1, 4-2, 4-3, 4-4, 4-5 | `location_briefs.md` ch4 |
| `river_city_gates` | `undercity_subterranean` | 2 | ch4_camp, ch4_road | variant of hub |
| `undercity_red_vial_ward` | `undercity_subterranean` | 5 | cs_clem_marr_2, cs_fadyme_1, cs_iona_mist_1, cs_tilda_fen_1, cs_tilda_fen_2 | variant of hub |
| `undercity_archive_room` | `undercity_subterranean` | 2 | cs_clem_marr_1, cs_thistle_roe_1 | variant of hub |
| `undercity_antidote_archive` | `undercity_subterranean` | 3 | cs_kera_voss_2, cs_odelia_pike_2, event_guild_salt_fever_1 | variant of hub |
| `undercity_cistern` | `undercity_subterranean` | 1 | cs_iona_mist_2 | variant of hub |
| `undercity_cistern_stairs` | `undercity_subterranean` | 1 | cs_odelia_pike_1 | variant of hub |
| `undercity_market` | `undercity_subterranean` | 1 | cs_kera_voss_3 | variant of hub |

## CH5 — Bridge of the Forsaken

Region: Eastern ravine.

| location_id | Parent | Uses | Where used | Brief |
|---|---|---|---|---|
| `bridge_forsaken` | hub | 9 | 5-1, 5-2, 5-3, 5-4, 5-5, cs_marek_vane_1, cs_nara_vell_2, cs_odelia_pike_3, cs_sable_wren_2 | `location_briefs.md` ch5 |
| `bridge_gate` | `bridge_forsaken` | 1 | cs_nara_vell_1 | variant of hub |
| `bridge_signal_tower` | `bridge_forsaken` | 2 | cs_rikka_ember_1, cs_sable_wren_1 | variant of hub |
| `bridge_far_bank` | `bridge_forsaken` | 1 | ch5_camp | variant of hub |
| `eastern_ravine_road` | `bridge_forsaken` | 1 | ch5_road | variant of hub |

## CH6 — The Ashen Lord's Estate

Region: Eastern highlands.

| location_id | Parent | Uses | Where used | Brief |
|---|---|---|---|---|
| `estate_ashen_lord` | hub | 5 | 6-1, 6-2, 6-3, 6-4, 6-5 | `location_briefs.md` ch6 |
| `ashen_estate_gallery` | `estate_ashen_lord` | 1 | cs_mirel_quill_2 | variant of hub |
| `ashen_estate_conservatory` | `estate_ashen_lord` | 5 | cs_thistle_roe_2, cs_tilda_fen_3, cs_vespera_wisp_1, cs_vespera_wisp_2, cs_vespera_wisp_3 | variant of hub |
| `ashen_estate_servants_wing` | `estate_ashen_lord` | 3 | cs_clem_marr_3, cs_hana_birch_1, cs_sable_wren_3 | variant of hub |
| `ashen_estate_ruins` | `estate_ashen_lord` | 2 | ch6_camp, cs_hana_birch_2 | variant of hub |
| `eastern_highland_road` | `estate_ashen_lord` | 4 | ch6_road, cs_fadyme_2, cs_mirel_quill_3, event_sun_eclipse_day_1 | variant of hub |
| `eastern_village_square` | `estate_ashen_lord` | 4 | cs_marek_vane_3, event_council_herald_1, event_council_herald_2, event_council_herald_3 | variant of hub |

## CH7 — Altar of the First Eclipse

Region: Crown-shaped crater, mountains.

| location_id | Parent | Uses | Where used | Brief |
|---|---|---|---|---|
| `altar_first_eclipse` | hub | 16 | 7-1, 7-2, 7-3, 7-4, 7-5, cs_clem_marr_4, cs_hana_birch_4, cs_jori_flint_4, cs_kera_voss_4, cs_mahmut_2, cs_mirel_quill_4, cs_nara_vell_4, cs_odelia_pike_4, cs_rikka_ember_4, cs_sister_aveline_4, cs_vespera_wisp_4 | `location_briefs.md` ch7 |
| `altar_first_eclipse_outer_dais` | `altar_first_eclipse` | 1 | part1_emotional_confession | variant of hub |
| `altar_first_eclipse_reflection` | `altar_first_eclipse` | 1 | part1_clockless_reveal | variant of hub |
| `altar_outer_stair` | `altar_first_eclipse` | 1 | cs_rikka_ember_3 | variant of hub |
| `altar_round_archive` | `altar_first_eclipse` | 2 | cs_pippa_bell_3, cs_sister_aveline_3 | variant of hub |
| `altar_east_passage` | `altar_first_eclipse` | 2 | cs_hana_birch_3, cs_sable_wren_4 | variant of hub |
| `altar_field_infirmary` | `altar_first_eclipse` | 3 | cs_iona_mist_3, cs_thistle_roe_3, cs_tilda_fen_4 | variant of hub |
| `mountain_crater_rim` | `altar_first_eclipse` | 3 | ch7_road, cs_marek_vane_4, cs_pippa_bell_4 | variant of hub |
| `mountain_lower_pass` | `altar_first_eclipse` | 4 | cs_brin_alder_4, cs_iona_mist_4, cs_nixie_vale_4, cs_thistle_roe_4 | variant of hub |

## Side roads (companion stories and events)

| location_id | Parent | Uses | Where used | Brief |
|---|---|---|---|---|
| `lowland_refuge` | road / side content | 1 | cs_brin_alder_3 | none (write one before production) |
| `lowland_refuge_road` | road / side content | 2 | cs_marek_vane_2, cs_nara_vell_3 | none (write one before production) |
| `kiln_town` | road / side content | 1 | cs_rikka_ember_2 | none (write one before production) |
| `salt_road_coast` | road / side content | 2 | event_guild_salt_fever_2, event_guild_salt_fever_3 | none (write one before production) |
| `highland_ridge` | road / side content | 1 | event_sun_eclipse_day_2 | none (write one before production) |
| `highland_village` | road / side content | 1 | event_sun_eclipse_day_3 | none (write one before production) |

Total IDs: 44. Unlisted IDs found in content: none.
