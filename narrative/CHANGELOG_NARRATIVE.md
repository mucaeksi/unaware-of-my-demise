# Narrative Changelog

Narrative-only history, extracted from `docs/CHANGELOG.md`. From 2026-09-28 new narrative entries are written here first.

### 2026-09-27 — Narrative Master Plan Phase 0: canon lock

- Added: `lore/canon.md` (canon ledger with epistemic status), `lore/timeline.md`, `lore/world_rules.md` (Law of Hours). Five script lines: `node_2_1_pre_000` (Brin departs to escort refugees), `node_2_3_pre_004` (register cut is recent), `node_4_5_post_006` (Jori returns to Oakhaven), `node_6_3_pre_004` (Vespera's earlier Undercity visit), `ending_fadyme_003` ("Uncle."). `ending_fadyme_003` added to the ending scene `dialogue_ids` in `chapters_part1.json`.
- Modified: Story Bible 5-5 (Oren holds the bridge, then leaves by the estate road; dialogue core aligned with script), roster rows for Brin, Jori, Odelia, Vespera, Chapter 4 guest cast, Cael ending scene; new section 9 records decisions C1–C11. Villain Bible: Yseldra's guilt, Cael as Fadyme's maternal uncle, ending-line status. GDD: single Mahmut backstory (C1), House Veyr (C3), Marek age 30 (C12). 7-1 direction names the Inquisition seal on the chains (C11). Manifest `starting_free` now uses character IDs `mahmut`, `fadyme` (C14). Faction ID `ashened_estate_dead` unified to `ashen_estate_dead` in `tools/build_part1_content.py` and `enemies_part1.json` (C13). `tests/test_localization.py` expected line count 308 → 313.
- Removed: Story Bible claim that Oren "escapes"; GDD's conflicting Mahmut backstories. Superseded, not silently erased: see Story Bible section 9.
- Reason: Project owner approved all Narrative Master Plan decisions; the "Uncle." reveal closes Part I.
- Verification: `tools/validate_part1_content.py` passed (313 unique line IDs). Builder drift check reports drift only in `drop_tables_part1.json`, `battle_rules_part1.json` and `stages_part1.json`, files already modified by uncommitted technical work, not by this change. Pytest not run (not installed in this shell).

### 2026-09-27 — Narrative Master Plan Phase 2: Part I targeted revisions

- Added: 19 script lines — `node_2_5_pre_006`–`008`, `node_2_5_post_006`, `node_3_5_post_006`, `node_4_2_post_005`–`006`, `node_5_4_post_005`–`006`, `node_5_5_pre_005`, `node_6_2_post_005`–`006`, `node_6_4_pre_005`–`006`, `node_6_5_pre_004`, `node_7_1_post_004`, `node_7_3_post_005`, `confession_014`–`015`. Story Bible section 10.
- Modified: `opening_013` emotion `quiet` → `too_quick`; 4-4 direction adds the letter beat. `tests/test_localization.py` expected line count 313 → 332.
- Removed: None. R17 (Chapter 7 roll-call trim) deferred.
- Reason: Approved Master Plan revisions R1–R19 (Mahmut's secret, order payoff, Mirel/Jori/Hana arcs, pattern break).
- Verification: all chapter JSON parses; `tools/validate_part1_content.py` passed with 332 unique line IDs. Pytest not run in this shell.

### 2026-09-27 — Narrative Master Plan Phase 1: world foundation

- Added: `lore/world.md` (kingdom, daily life, institutions, beliefs vs truth), `lore/history/seven_bells.md`, `lore/history/crownfall.md`, `lore/locations/part1_route.md` (about four weeks of travel), and eight faction files under `lore/factions/` (Council of Dukes, Inquisition, Crown Guard remnant, Saint Luthos, Red Vial Guild, First Eclipse Cult, Clockless Court, House Veyr).
- Modified: `lore/canon.md` links the new files.
- Removed: None.
- Reason: Master Plan Phase 1, approved by the project owner.
- Verification: Documentation only; no content JSON changed.

### 2026-09-27 — Narrative Master Plan Phase 3: character models

- Added: `lore/characters/` with 20 character model files (tiers A/B/C), `_README.md` and `_voice_matrix.md`. Each file covers identity, psychology, arc, relationships, combat/weapon relationship with a proposed weapon lore line, voice and "never says", and a four-part companion story outline for Tier B/C characters.
- Modified: None of the content JSON. New facts are marked [NEW] in each file (e.g. Kera's past analyses for the ledger wing, Sable's courier past, Odelia's brother, Pippa's Silent Bell charm shard, Vespera's traded hours, Nara's family and Oren, Marek reading the treason decree).
- Removed: None.
- Reason: Master Plan Phase 3, approved by the project owner.
- Verification: Documentation only. Weapon lore lines are ready for a future `lore_en` field (technical requirement in the Master Plan).

### 2026-09-27 — Part I narrative completion pass

- Added: `content/character_stories_part1.json` (76 companion story parts, 388 lines), `content/events_part1.json` (4 canon events, 12 scenes), `content/lore_text_part1.json` (weapon, enemy, item lore and 12 codex entries), `docs/PART1_FULL_SCRIPT.md` (compiled full script). Script lines `node_4_4_pre_005` (Kera on the Chain Cultists) and `node_7_1_pre_006` (Nixie on the chain-bearers).
- Modified: `node_7_4_pre_006` (Hana closes her promise). Story Bible section 11. `tests/test_localization.py` expected line count 332 → 331.
- Removed: `node_7_2_pre_004` (Marek, duplicated by `node_7_2_post_002`), `node_7_4_pre_003` (Iona), `node_7_4_pre_004` (Thistle) — R17 roll-call trim.
- Reason: Project owner asked for every remaining narrative gap in Part I to be written, excluding voice, art, commit and tests.
- Verification: `tools/validate_part1_content.py` passes with 331 main-story line IDs; the new packs parse and all their weapon, enemy, item and character IDs resolve. The new packs are not yet read by `core` or the client (technical integration pending). Pytest not run.

### 2026-09-27 — Part I final scene pass

- Added: 13 non-stage VN scenes in the chapter scripts (`ch1_first_oath`, `ch1_camp`, `ch2_road`, `ch2_camp`, `ch3_road`, `ch3_camp`, `ch4_road`, `ch4_camp`, `ch5_road`, `ch5_camp`, `ch6_road`, `ch6_camp`, `ch7_road`), inserted into manifest `story_order` and `non_stage_scene_ids`. `content/character_voice_lines_part1.json` (220 lines). Banner copy and chapter cards in `content/lore_text_part1.json`. Speakers `shrine_keeper` and `refugee_woman` added to the validator's allowed non-roster speakers. Story Bible section 12.
- Modified: `tests/test_localization.py` expected line count 331 → 409. `docs/PART1_FULL_SCRIPT.md` regenerated with chapter cards, voice lines and banner copy.
- Removed: None.
- Reason: Owner asked that Part I be fully complete, all scenes included, before any Part II work.
- Verification: `tools/validate_part1_content.py` passes with 409 unique main-story line IDs. Technical note: `story_order` now has 51 entries; saves that store `story_cursor` as an index will point to a different entry and need a migration (map old index → entry ID). Pytest not run.

### 2026-09-27 — Full-script tone and repetition pass; technical handoff

- Added: `docs/NARRATIVE_TECH_HANDOFF_PART1.md` (file-to-code mapping, save migration table, unlock rules, voice triggers, location IDs).
- Modified: `node_2_3_pre_001` (register covers visitors since the coronation, removing a conflict with the recent cut), `node_4_2_post_005` (clearer reference to Rusk's order), `node_6_3_pre_001` and `node_6_3_post_001` (removed duplicated Undercity reference and a repeated phrase), `ch6_road_004` (Fadyme no longer quotes a line Sable has not yet said), Cael reveal direction (Yseldra's veil). Companion story and voice-line fixes: one contraction removed (house style), duplicate "Chop." and repeated "I will keep the…" / "no names until we are outside" lines varied. Location IDs `oakhaven` and `bridge_of_the_forsaken` normalized to `village_oakhaven` and `bridge_forsaken`. Full script regenerated.
- Removed: None.
- Reason: Owner-requested read-through before technical handoff.
- Verification: `tools/validate_part1_content.py` passes (409 lines). Pytest not run.

### 2026-09-28 — Art-canon retcon for Mahmut and Fadyme

- Added: `lore/visual_reference.md` (approved art in `photos/`, sheet template, art-vs-text conflicts). Appearance section in `lore/canon.md`.
- Modified: 5-4 direction (Fadyme's ash-pale hair; the lock turns bone-white). `character_visuals_part1.json`, `CHARACTER_COSTUME_GUIDE.md` and GDD §7.1/§7.2 appearance now match the approved sheets: Fadyme's pale ash-blonde hair, violet eyes, hood with crown pin at the clasp, black dress, white scarf, bell focus with a silver-thorn clapper; Mahmut's dark hair and stubble, oxblood cloak, Crown Guard star kept with the crown above it hammered away. Fadyme's signature weapon lore and character files updated.
- Removed: "dark hair" (Fadyme) and the idea that the bell focus has no clapper / is a reforged pin.
- Reason: The owner declared the Mahmut and Fadyme sheets canon; Yseldra and Cael will be regenerated from new prompts.
- Verification: validator passes (409 lines); builder check passed with no generated-content drift.

### 2026-09-28 — Character backstories and visual identities

- Added: "Backstory" and "Visual story" sections to all 20 character files; new `lore/characters/yseldra.md` and `cael.md`; `lore/characters/_visual_matrix.md`. Sheeted characters (Mahmut, Fadyme, Kera, Brin, Nixie) are storied from their approved art; Yseldra and Cael backstories fix the look their new sheets must show.
- Key new facts: Mahmut was Fadyme's escort from her age 13; Fadyme's mother died when she was 7 and was never married to the king; Kera's ash-silver hair came from a lab explosion under her master Hesper Doyle; Brin's father Bram died holding a burning roof; Nixie was raised by the Ochre Wheel caravan; Yseldra was a Vale novice taken by the Inquisition; Cael lost his wife Liora and son Aren two years before Crownfall.
- Modified: Nixie companion story direction ("eighteen winters", matching her age 19); Vespera companion line ("fifteen years", matching Fadyme leaving the estate at 7); Hana file companion outline.
- Removed: None.
- Reason: Owner asked for a distinct past and story for every character before writing sheet prompts.
- Verification: Documentation plus two text-only JSON edits; JSON parses.

### 2026-09-28 — Sable Wren as the alluring character (option A)

- Decision: no new roster slot; Sable Wren uses the full "mildly open" costume allowance as the roster's alluring character, fully opaque and 12+ safe.
- Modified: `prompts/sable_wren_sheet.md` (off-the-shoulder cropped jacket, opaque high-necked bodice, knowing gaze, elegant hero pose, updated negatives), `lore/characters/sable_wren.md`, `lore/characters/_visual_matrix.md`.
- Added earlier the same day: sheet prompts for Yseldra, Cael, Aveline, Sable, Nara and Mirel in `prompts/`.

### 2026-09-29 — Reference photo library

- Added: `photos/README.md` (rules, naming, expected contents), `prompts/kera_voss_sheet.md`.
- Modified: `README.md` and `lore/visual_reference.md` now point to `narrative/photos/` as the reference library for all new sheets and assets.
- Pending: the owner moves the images from the repository-root `photos/` into `narrative/photos/`.

### 2026-09-29 — Production asset pipeline merged with the technical spec

- Added: `prompts/asset_pipeline/` (README, 00_rules.md with the technical spec and narrative addenda, character_briefs.md identity blocks for the 5 approved sheets, location_briefs.md for chapters 1–7 with ORDER_LEVEL, pilot_fadyme.md with 12 prompts + negatives + metadata).
- Decision: sheets (stage 1, identity) and production assets (stage 2) are separate; production uses the same-character reference rule and never carries sheet labels, titles or textures.

### 2026-09-29 — Narrative & visual audit and baseline (documentation only)

- Added: `docs/NARRATIVE_BASELINE_PART1.md` (index of current canon: world, story, roster, factions, locations, timeline, mysteries, threads, arcs, protected facts, visual identity, gameplay links, future setups; source-of-truth order) and `docs/NARRATIVE_AUDIT_2026-09-29.md` (findings with IDs: CC canon conflicts, LK likely problems, UN undefined canon, RO roster, ST structure, VIS visual, TD technical data; owner summary).
- Modified: None. No script, lore, content JSON, prompt or image was changed; every finding awaits an owner decision.
- Removed: None.
- Reason: New Narrative & Visual Director's first task: audit and document the existing IP before any expansion.
- Verification: Findings cross-checked programmatically (ages/rarity/element across JSON, lore and GDD; companion-story speakers vs first main-story appearance; story_guests vs speakers; speaker IDs; byte comparison of narrative/, content/ and game/data/content/) and visually (10 sheets and brand art against prompts and lore).

### 2026-09-29 — World foundation W1: the bell machinery and terms (decisions C15–C21)

- Added: `lore/glossary.md` (world terms and "do not use" list); world rules 6–10 and a derived-lore section in `lore/world_rules.md`; canon facts F-014–F-019 and W-006–W-012 plus a decisions section in `lore/canon.md`; Story Bible §13; Villain Bible W1 decisions section; GDD text-change request in `docs/NARRATIVE_TECH_HANDOFF_PART1.md` §9.
- Modified: F-012 (last living daughter of the Veyr bell line); `lore/timeline.md` (Silent Bell ≤ Year −15, the seven stand-in bearers, Year −15 and −8 deaths, Crownfall sequence); `lore/history/crownfall.md` (seal beneath the Silent Bell, second order to the First Eclipse Altar), `history/seven_bells.md` (Harvest Bell recast, Silent Bell), `world.md` (§1 wording, new §3b, three belief rows); `factions/house_veyr.md`, `saint_luthos.md`, `inquisition.md`; character files `fadyme.md`, `cael.md` (the Rewrite, hidden aim), `yseldra.md` (Crownfall role, calling bell), `mahmut.md` (Crownfall); Story Bible opening wording (the tied bell rings on its own) and a note on the §9 C9 line; Villain Bible Cael role/motive wording.
- Removed: "Unwritten Hour seal" and "last living Veyr blood" as descriptions of Fadyme.
- Reason: Owner approved the W1 proposal on 2026-09-29: matrilineal bell line (Q1), seal beneath the Silent Bell (Q2), Cael's public promise vs hidden aim (Q3), and the rest of the package. Resolves audit items UN-03, UN-04, CC-03, CC-05, LK-08, UN-02 and, in narrative files, CC-09; UN-06 and UN-07 partly (who silenced the Silent Bell stays UNKNOWN).
- Verification: No content JSON changed (md5 check of all 13 files in `content/`); no dialogue line changed. Leftover-term grep clean outside the audit, baseline, compiled script and the glossary's own "do not use" list. The GDD still carries the old wording until the code team applies the §9 request. Root `lore/` is not synced (code team).

### 2026-09-29 — Consolidation: `narrative/` is the single narrative and visual-direction home

- Added: `archive/README.md` (manifest), `archive/2026-09-29_consolidation/`, `concepts/app_icon/`.
- Modified: moved root `docs/ART_BIBLE.md`, `ASSET_CATALOG.md`, `BRAND_MARKS_AND_ICON_GUIDE.md` into `docs/`; `README.md` (scope, contents, pending sync); stale banner on `docs/CHARACTER_COSTUME_GUIDE.md` (CC-07); path-change notice in `docs/NARRATIVE_TECH_HANDOFF_PART1.md` §9.
- Removed (archived, not deleted): root `lore/` tree; root `docs/` copies of the Story Bible, Villain Bible, full script, costume guide, tech handoff and scripting notes; `docs/STORY_SCRIPTING_NOTES_PART1.md` in this folder.
- Reason: Owner asked that all narrative files live in `narrative/`, with outdated copies archived; the technical team reads from here.
- Verification: `mv -n` only; every archived file is listed in the manifest. No content JSON changed. The empty root `lore/` and `assets/concepts/` folders remain (deletion not permitted in this session). Code-side references to the old paths are listed for the technical team; none are read by code, tests or tools (grep).

### 2026-09-29 — World foundation W2: Crownfall night and politics (decisions C22–C28)

- Added: world rule 11 (what leaves the Ledger leaves memory) and two derived-lore notes; canon facts F-020–F-026 and a C22–C28 decisions section; glossary rows for House Carrow, the throne wars and the Council of Dukes; Story Bible §14; Villain Bible W2 note.
- Modified: `lore/timeline.md` (throne-war start, Year −15 secret recognition, Year −9 public declaration, Crownfall details, Council truce); `lore/history/crownfall.md` (King Audren, last page, portrait, Cael's orders, open questions); `lore/world.md` (§1, two belief rows); `factions/council_of_dukes.md` (origin, paying Oren), `factions/crown_guard.md`; `characters/fadyme.md` (childhood, last page), `mahmut.md` (why he was assigned), `cael.md` (orders, fading name); canon open mysteries (killer to lock before the Part II outline).
- Removed: None.
- Reason: Owner approved all four W2 recommendations. Resolves audit CC-04, LK-01, LK-12, UN-05 and the "portrait night" part of UN-08.
- Verification: No content JSON changed (md5 check); no dialogue line changed. Checked against existing lines: 2-3 "the old king", 3-5 Rusk "sealed by someone the Crown buried", `ch1_camp` portrait line, Fadyme never saying "Cael" aloud, Yseldra appearing with Cael at the ending (she carried his orders, so she can still recognize him).

### 2026-09-29 — World foundation W3: geography, names and the clock (decisions C29–C30)

- Added: `lore/locations/registry.md` (all 44 location IDs by hub, uses, brief status); canon W-013–W-015 and a C29–C30 section; glossary rows Carrowgate, Glassford; derived-lore note "witnessing buys time"; Story Bible §15.
- Modified: `lore/locations/part1_route.md` (about three weeks, 6→7 two days per `ch7_road`, the clock, city names); W-005 source; timeline Part I row; `history/seven_bells.md`; `characters/kera_voss.md`, `clem_marr.md`, `mahmut.md`; `factions/council_of_dukes.md`.
- Removed: None.
- Reason: Owner approved all three W3 recommendations. Resolves audit LK-02 and UN-12 (except the seven dukes, deferred to Part II politics).
- Verification: No content JSON changed (md5); no dialogue line changed; registry lists exactly the 44 IDs found in `content/`.

### 2026-09-29 — World foundation W4: elements, faction registry, bestiary (decisions C31–C32)

- Added: `lore/elements.md` (the Six Manners), `lore/bestiary.md` (enemy kinds, 27 enemies), `lore/factions/_registry.md` (data-ID mapping, character affiliations); canon W-016 and a C31–C32 section; glossary row "the Six Manners"; Story Bible §16; data-fix request (`noble_retainer` faction) in the tech handoff §9.
- Modified: `lore/world.md` §4 pointers.
- Removed: None.
- Reason: Owner approved both W4 recommendations. Resolves audit UN-11; CC-15 pending the data fix; TD-06 on the lore side. World foundation W1–W4 complete.
- Verification: No content JSON changed (md5). Element assignments read from `content/characters_part1.json` and `enemies_part1.json`; no data values changed.

### 2026-09-29 — Part I story pass, step 1: Fadyme's purpose and the letter (decisions C33–C35)

- Added: script lines `node_3_1_post_004` (Fadyme thought: "Every year I hid, someone else paid my hours.") and `node_7_3_pre_007` (Fadyme thought: "I came here to be offered. They are asking me to be witnessed."); canon F-027–F-030 and a C33–C35 section; "The letter" section in `lore/characters/fadyme.md`; Story Bible §1 paragraph and §17; sync and GDD requests in the tech handoff §9.
- Modified: `lore/characters/fadyme.md` (false belief, purpose, arc, last two years), `mahmut.md` (the "escape plan" was her altar plan); Villain Bible mirror note; `docs/PART1_FULL_SCRIPT.md` regenerated.
- Removed: the open mystery "contents of the letter" (now locked, SECRET until Part II).
- Reason: Owner approved all three recommendations. Resolves audit UN-01.
- Verification: both script files parse; 411 unique main-story line IDs; `tools/compile.py` run. `tests/test_localization.py` still expects 409 until the code team syncs (request filed).

### 2026-09-30 — Part I story pass, step 2: continuity line fixes (decision C36)

- Added: canon F-031–F-033 and a C36 section; Story Bible §18; sync and visual requirement in the tech handoff §9.
- Modified: lines `ch4_camp_006` ("East, then. The altar road crosses the ravine."), `node_3_5_post_001` ("...Same wax as the seal on your shield..."), `cs_tilda_fen_1_002` speaker Rikka → Jori ("I was not joking. I was complaining."); directions of 3-2, `ch3_camp`, 6-2, 6-3, `cs_mahmut_1`, `cs_sable_wren_2`; unlocks `cs_nixie_vale_2` (3-1 → 3-4), `cs_kera_voss_3` (6-5 → 4-5); Yseldra speaker ID `yseldra` → `lady_yseldra_vale` (7 lines); `story_guests` of 1-5, 2-1, 2-5, 3-2, 3-3, 4-5, 7-4; `lore/characters/sable_wren.md`; Villain Bible story-appearances line; `docs/PART1_FULL_SCRIPT.md` regenerated.
- Removed: None.
- Reason: Owner approved the step-2 list. Resolves audit CC-01, CC-02, CC-06, CC-13 (Villain Bible), CC-14, LK-03, LK-04, LK-05, LK-06, LK-07, LK-10, LK-11, LK-14 (kept), TD-01, TD-02.
- Verification: all JSON parses; 411 unique main-story line IDs; companion parts unlock in order and no speaker appears before their first main-story scene; every on-screen speaker is in `story_guests` (except the 7-5 memory line). Note: the step proposal said `lady_yseldra_vale` → `yseldra`; the reverse was applied because `lady_yseldra_vale` is Yseldra's entity ID in brand and visual assets (like `lord_cael_veyr`).

### 2026-09-30 — Part I story pass, step 3: structure (decision C37)

- Added: 8 script lines (`ch4_road_006`, `ch6_road_005`, `ch6_road_006`, `node_4_5_post_007`, `node_5_5_post_005`, `node_6_1_post_004`, `node_6_3_post_004`, `node_7_3_pre_008`); `ch4_road` and `ch6_road` directions (Yseldra's traces); `unlock` on 40 relationship voice lines; `docs/SPOILER_UNLOCK_POLICY.md`; canon F-034 and C37; Story Bible §19; sync and unlock requests in the tech handoff §9.
- Modified: directions and `location_id` of `cs_pippa_bell_4`, `cs_marek_vane_4` (crater rim), `cs_thistle_roe_4`, `cs_iona_mist_4` (lower pass); 9 codex `unlock` values; `lore/locations/registry.md` uses; `docs/PART1_FULL_SCRIPT.md` regenerated; README line count.
- Removed: None.
- Reason: Owner delegated the step-3 proposals ("önerilerini yapmaya devam et"). Resolves audit LK-09, ST-05, RO-06 (partly), TD-03, TD-04, TD-05 (as requirements).
- Verification: all JSON parses; 419 unique main-story line IDs; new lines cloned from neighbouring lines (voice track `jp`); no contractions; speakers present in their scenes.

### 2026-09-30 — Part I story pass, step 4: the Ashen Lord (decision C38)

- Added: `lore/characters/ashen_lord.md`; canon F-035–F-038 and C38; glossary "Keeper of the Schedule"; Story Bible §20.
- Modified: `lore/timeline.md` (mother hidden at the estate; his death), `history/crownfall.md`, `characters/fadyme.md` (origin), `bestiary.md`; canon open mysteries (Ashen Lord removed).
- Removed: None.
- Reason: Owner approved all three recommendations (Keeper of the Schedule; sealed in the archive, his last order persists; Lord Edric Aske). Resolves audit UN-08.
- Verification: documentation only; no content JSON changed; checked against 6-2, 6-4, 6-5, `ch1_camp`, Sable and Hana companion lines.

### 2026-09-30 — Part I final read-through (decision C39)

- Modified: `lore_text_part1.json` (`weapon_fadyme_signature` text, `oath_04_mirel` tagline), `events_part1.json` (`event_council_herald_2_002`), `character_stories_part1.json` (`cs_mirel_quill_3` direction; `cs_brin_alder_2` direction + lines 002/004 now `shrine_keeper`; `cs_brin_alder_3` direction + lines 002/006 now `nixie_vale`).
- Added / Removed: None. Main story stays at 419 lines.
- Reason: knowledge leak of Fadyme's surname before 7-3; two companion scenes placed characters where the main story has them absent.
- Verification: all `content/*.json` parse; `tools/compile.py` regenerated `docs/PART1_FULL_SCRIPT.md`; only the three files above changed (md5).

### 2026-09-30 — Fadyme production pilot review (decision C40)

- Modified: `prompts/asset_pipeline/pilot_fadyme.md` (prompt revision r2, 12 prompts regenerated from one template), `character_briefs.md` (Fadyme IDENTITY/ADDITIONS/LOCKS; block format), `location_briefs.md` (ch1 wayshrine tended, camp-light in safe area), `00_rules.md` (production prompt template), `lore/canon.md` (A-004, C40), `lore/characters/fadyme.md`, `lore/factions/house_veyr.md`, `docs/ART_BIBLE.md` (eclipse colour).
- Archived: pilot r1 → `archive/2026-09-30_pilot_r1/pilot_fadyme_r1.md`.
- Reason: technical team's pilot prompts predated C15–C39 and missed the bell pin (VIS-03); several details conflicted with canon or the crop spec.
- Verification: documentation only; no content JSON changed.

### 2026-09-30 — Mahmut production prompts

- Added: `prompts/asset_pipeline/mahmut.md` (5 VN busts, 6 battle poses, C40 template; script emotion → bust mapping for all 40 emotion values Mahmut uses).
- Modified: `character_briefs.md` Mahmut block (IDENTITY/ADDITIONS/LOCKS/EXPRESSIONS).
- Reason: second character after the Fadyme pilot, requested by the owner.
- Verification: documentation only; emotion mapping checked against every Mahmut line in the scripts, companion stories and events (132 lines).

### 2026-09-30 — Fadyme warm bust

- Added: prompt 3b `vn_bust_fadyme_warm_v001.png` in `prompts/asset_pipeline/pilot_fadyme.md`; emotion mapping moves warm, amused, laughing, smile, smiling, relieved, touched, hopeful, encouraging to it. `character_briefs.md` lists Fadyme's four expressions.
- Reason: her genuine-joy lines had no matching bust (fadyme.md risk: she must not be only tragic).

### 2026-09-30 — Kera sheet r2; game title removed from sheet prompts

- Modified: `prompts/kera_voss_sheet.md` r2 (two references: her own sheet for identity, Fadyme's for layout; series layout; story-state panels show Kera alone; tagline is Hesper's line). r1 archived.
- Modified: all ten `prompts/*_sheet.md` no longer name the game in the prompt (production rule: never name the game, studio or a living artist).
- Reason: owner request (Kera's sheet style differs from the series); rule compliance.

### 2026-09-30 — Kera Voss production prompts

- Added: `prompts/asset_pipeline/kera_voss.md` (6 VN busts, 6 battle poses, C40 template; emotion → bust mapping for all 29 Kera emotion values, 48 lines). Requires the approved r2 sheet.
- Modified: `character_briefs.md` Kera block (full IDENTITY, LOCKS, EXPRESSIONS).

### 2026-09-30 — Production approval

- Approved for production: `pilot_fadyme.md` (13 prompts), `mahmut.md` (11), `kera_voss.md` (12, after the r2 sheet). Status lines added; README rule 7 (asset count follows story need).
- Deferred: Fadyme curse story-state busts (CC-11 and a runtime story-state request first).

### 2026-09-30 — Brin Alder sheet r2 and production prompts

- Added: `prompts/brin_alder_sheet.md` (series-style re-render; fixes VIS-08 contraction, star typo and file-name spelling; story panels show Brin alone), `prompts/asset_pipeline/brin_alder.md` (3 busts, 6 poses; emotion → bust mapping for all 15 Brin emotion values, 24 lines).
- Modified: `character_briefs.md` Brin block (LOCKS, EXPRESSIONS).
- Found: Nixie's approved sheet paints her hair pale ash-beige under a hood (canon: light brown); at bust size she reads close to Fadyme. To fix with her r2 sheet.

### 2026-09-30 — ChatGPT image project setup

- Added: `docs/CHATGPT_IMAGE_PROJECT.md` (project instructions text, source list, working rules).
- Modified: instructions made roster-agnostic (no per-character locks); no project sources required.

### 2026-09-30 — Art folder, first Fadyme batch review, chibi prompts

- Moved: `photos/` → `art/` (`sheets/`, `sheets/pending/`, `sheets/chibi_ref/`, `production/`, `brand/`, `_rejected/`); metadata embedded in every PNG (`uomd_*` text chunks, pixels verified identical); webp sheets converted to PNG; renames `char-brin-adler` → `char-brin-alder`, `char-lord-caer` → `char-lord-cael-veyr`. Originals in `archive/2026-09-30_photos_originals/`. Index `art/MANIFEST.md`, tool `tools/art_manifest.py`. References updated in all active docs.
- Reviewed Fadyme batch 1: approved `vn_bust_fadyme_{composed,warm,honest_fear}_v001`; rejected quiet_pain, all six battle poses (painterly, not chibi; one with blood), both backgrounds (wrong location and orientation) and the icon set (wrong items, style, size).
- Modified: battle-pose prompts in `pilot_fadyme.md`, `mahmut.md`, `kera_voss.md`, `brin_alder.md` rewritten as chibi sprites (style first, sheet for costume only, chibi-panel crop as second reference for idle, proportions sentence, no injury words, anti-painterly negatives); Fadyme quiet_pain v002. `docs/CHATGPT_IMAGE_PROJECT.md` working rules (fresh chat per asset family, "Avoid:" line).

- 2026-09-30: approved `vn_bust_fadyme_quiet_pain_v002` (Fadyme bust set complete: composed, quiet_pain, honest_fear, warm).

### 2026-09-30 — Image generation tool

- Added: `tools/gen_image.py` (Gemini Interactions API, generateContent fallback; reads the key from `.secrets/image_api.env`, never prints it; writes to `art/_review/` with `uomd_*` metadata, status REVIEW), `.secrets/` (git-ignored, README), `art/_review/`.

### 2026-09-30 — Brand r2 prompts (decision C41)

- Added: `prompts/brand/brand_r2.md` (logo wordmark with the bell emblem; key art portrait without text). `lore/canon.md` C41.

- Added: `tools/gen_batch.py` (Gemini Batch API: submit/status/fetch; reference images uploaded once via the File API and cached 40 h).
- 2026-09-30: `mahmut.md` emotion table completed (22 rarely used values had fallen to the default; all 62 values now mapped).

### 2026-09-30 — Part I asset plan

- Added: `tools/build_asset_plan.py`, `art/asset_plan_part1.json`, `docs/ASSET_PLAN_PART1.md` (554 images in waves 0-4, dependencies validated, cost estimate). Reference set extended with the ch1 background, battle plate, pilot icon set and Fadyme ultimate cut-in.

### 2026-09-30 — Decision C42: Sable, costume allowance, audio and voice

- Decided: Sable keeps the alluring design (audit CC-08 resolved); costume allowance rule for designated adult characters (`lore/canon.md` C42, `00_rules.md`).
- Added: six side-road location briefs (`location_briefs.md`); `docs/AUDIO_VO_PLAN_PART1.md` (33-track list, cue format, diegetic songs, casting sheet, JP script plan, katakana glossary with the Veyr/Vale/Veil collision fixed, dub-writing rules, technical requirements).
- Modified: `story_script_ch01–07.json`: `music_cue` on all 51 main-story scenes (opening cue given a track id). No line changes.
- 2026-09-30: C42 allure tiers (Tier A Sable, Vespera; Tier B Pippa; figure-emphasizing framing limited to banners, cut-ins, victory poses, limited art). `vespera_wisp_sheet.md` costume updated (bare shoulders and upper back, high collar kept).
- 2026-09-30: voice production via Gemini TTS by the Director; characters finished as art + voice packages; Fadyme's voice added to the reference set.

### 2026-09-30 — Music production plan (Lyria)

- Added: `prompts/music/music_part1.md` (51 Lyria prompts; every track except the owner's main theme), `tools/gen_audio.py` (music via Lyria, voice via Gemini TTS; sidecar JSON, status REVIEW), `audio/music/motifs/` (Fadyme's theme in D minor 3/4 72 BPM, unresolved; its D-major resolved variant; the Ledger motif of seven descending bells with the eighth missing; MIDI + OGG preview renders).
- Modified: `docs/AUDIO_VO_PLAN_PART1.md` §1.1b, `lore/canon.md` C42.

### 2026-09-30 — Folder reorganization (owner: everything in `narrative/`)

- Moved: `prompts/*_sheet.md` → `prompts/sheets/`; `concepts/app_icon/` → `art/brand/concepts/app_icon/`; `docs/CHATGPT_IMAGE_PROJECT.md` and the old `photos/README.md` → `archive/2026-09-30_reorg/` (images are now generated with Gemini). Voice files live under `audio/voice/`.
- Modified: references in all active docs, prompts and tools; README folder map; asset plan and art manifest rebuilt.

### 2026-09-30 — Reference set prompts; curse colour (C43)

- Added: `prompts/reference_set/REFERENCE_SET_PART1.md`: R01 logo, R02 key art, R03 Fadyme sheet r2 (new prompt: bell hairpin, family-pins detail, four expressions, chibi panel in the battle ink style so it can be cropped as the chibi reference, story states per C43), R04–R07 busts, R08–R13 chibi poses, R14 ultimate cut-in "The Bell That Forgets" (new), R15–R16 ch1 background and battle plate, R17 pilot icons, R18–R22 music (Fadyme bed, ch1 forest ×3, standard battle), R23 voice plan (30-voice search, 4-voice audition, five audition lines with JP drafts).
- Decided: C43 curse colour (audit CC-11). `docs/ART_BIBLE.md` updated.
- 2026-09-30: C44 one model per medium (images gemini-3.1-flash-image 2K, music lyria-3.5, voice gemini-3.8-flash-tts); prompts, plans and tool defaults updated.
- 2026-09-30: C45 portrait-only 1080×1920; ultimate cut-ins changed from 16:9 to 2:3 portrait (R14 and asset plan), landscape/square brand variants marked store-only.
- 2026-09-30: one Google API key for all services: key file renamed to `.secrets/google_api.env` (`GOOGLE_API_KEY=`; the old `image_api.env` / `GEMINI_API_KEY` still accepted); all tools share `load_key()`.

### 2026-09-30 — Reference set run 1 (R01, R02)

- First live Gemini run (tools work; the API answered on the generateContent route). 7 images, about $0.70.
- R01 logo: v001 rejected (cartoonish letters, whole crown); prompt v002 (book-cover serif, thin ring, broken circlet fragment); candidates `art/_review/brand_logo_wordmark_r2_v002_t1/t2`, Director pick t2. Awaiting owner.
- R02 key art: v001 rejected (both walking toward the viewer, Mahmut not "walking ahead"); prompt v002 (walking away toward the crater, only Fadyme looks back); candidate v002_t1 (Director pick), t2. Awaiting owner. Known issue: her crown fragment is drawn as a small tiara; fix in the R03 sheet.
- 2026-09-30: review folders `_proposed/` added; `tools/art_review.py` (propose / reject / approve: move, rename, retag, rebuild manifest). R01/R02: picks moved to `_proposed/` (+ composite preview), five other candidates to `_rejected/` with reasons.

- 2026-09-30: R01/R02 v003 (owner: v002 too clean/cartoon-like). Key art: painterly style block + old key art attached as a style-only reference; logo: carved weathered stone. Picks in `_proposed/` (+ preview); v002 picks and v003 alternatives moved to `_rejected/` with reasons. 4 more images (~$0.40).
- 2026-09-30: R01/R02 approved by the owner → `art/brand/` (old logo and key art → `art/brand/superseded/`). R03 Fadyme sheet: 4 generations (v001 ×2, v002 ×2, prompt v002 adds four-expression and Fadyme-only chibi instructions); pick v002_t2 in `_proposed/`, three rejected with reasons. Run total so far ~$1.50.
- 2026-09-30: R03 approved → `art/sheets/char-fadyme-uomd.png` (r1 sheet and chibi crop archived in `archive/2026-09-30_sheets_r1/`); new chibi crop. Narrative prompts R04–R16 switched to the dark painterly style sentence. R04 test (2 gens) worse than the existing busts → the four approved busts are kept as R04–R07 after checking them against sheet r2. R08 idle: first true chibi; pick in `_proposed/`. Run total ~$2.30.
- 2026-09-30: R08 approved. R09–R13 poses: 8 generations (3 re-rolled as v003 with a dynamic-pose instruction); five picks in `_proposed/`, three rejected; victory cleaned of two stray artefacts. Run total ~$3.10.
- 2026-09-30: R09–R13 approved. R14 cut-in (2 gens), R15 ch1 background (1), R16 battle plate (2), R17 pilot icons (2): picks in `_proposed/`, four rejected with reasons. Prompts: cut-in and background style sentences darkened; battle plate "painted clearing, not an overlay"; icon cell fixes. Run total ~$3.80.
- 2026-09-30: R14–R17 approved (reference set images complete). R23 Fadyme voice: `tools/voice_audition.py`; 30 prebuilt voices read one line (`audio/voice/audition/fadyme/`, pitch analysis in `analysis.json`); shortlist Vindemiatrix, Sulafat, Erinome, Achernar read the five audition lines (`shortlist/AUDITION_<voice>.wav`). TTS Tier 1 limit is 10 requests/minute: `gen_audio.post` now retries 429/503. Owner to choose by ear.
- 2026-09-30: R18–R22 music. All Lyria takes faded out; uneasy/chaotic came a semitone flat of calm; battle v001 was ~86 BPM C# minor (asked 132 BPM C minor). R22 prompt → v002 (tempo stated first, no "restrained/intimate" tail) and regenerated: ~129 BPM D minor, shifted −2 to C minor (D minor is the elite-battle key). `tools/music_loop.py` builds loops: beat-snapped, level/chroma-matched loop points, 3 s equal-power seam crossfade, pitch via ffmpeg rubberband (uneasy/chaotic +1). Output in `audio/_review/*_loop.ogg` + sidecars, `loop_post.json`, `demos/DEMO_1..3`. Waiting on the owner's listening verdict; Lyria price/terms still unverified.
- 2026-09-30: Fadyme voice. Sadachbia lines varied in tone (F0 182–264 Hz, level spread 11 dB): each line was a separate call with its own emotion direction. Grouped method tested (one call per scene, one fixed style, level-matched): `audio/voice/audition/fadyme/sadachbia/grouped_test/`. Owner switched to Sulafat; `casting.json` updated (audition), Sadachbia never shipped. Sulafat grouped takes in `audio/voice/audition/fadyme/sulafat/`: two story takes land at the same pitch (F0 197/196 Hz), drift within a take ~1.4 semitones (Sadachbia ~4.8).
- 2026-09-30: Owner approved Sulafat as Fadyme's voice (exclusive). `casting.json` status approved, reference pitch ~197 Hz, grouped per-scene method recorded.
- 2026-09-30: Owner approved R18–R22 music (loops and originals kept). Loops rebuilt as intro+loop: file starts at the take's own beginning, loops back to `loop_offset` (sidecar `engine_loop`), seam pre-blended — the first-pass loops had the seam crossfade at the file start (owner heard a rough start) → `audio/_rejected/*_firstpass`. Filed: `audio/music/bgm_fadyme_theme/`, `bgm_ch1_ash_forest/`, `bgm_battle_field/` (`*_loop.ogg` + `*_original.mp3` + sidecars); battle v001 → `audio/_rejected/`; demos → `audio/music/_listening_demos/`; `tools/music_loop_intro.py`. Handoff §9 note on loop offset.
- 2026-09-30: Fadyme JP script `audio/voice/jp_script_fadyme.json` (201 lines, built by `tools/build_jp_script_fadyme.py`; draft for a native editor; TTS reading hints for 刻/棘/籠手/梁/C.V./鐘の舌). Data fix: `node_3_1_post_004`, `node_7_3_pre_007` voice_track jp → jp_inner. Recording: `tools/record_fadyme_vo.py` (grouped calls, resumable) + `tools/split_select_vo.py` (Whisper-aligned split, text check, pitch-based take choice, −20 dB); 25/201 lines filed in `audio/voice/fadyme/`; stopped by the TTS Tier 1 cap (100 requests/day). Reference closed: voice auditions → `archive/2026-09-30_voice_auditions/`; Sulafat reference → `audio/voice/fadyme/reference/`; off-model brand art (old app icon, square/wide key art) → `art/brand/superseded/`; mockups and font comparison → `art/brand/concepts/`; asset plan wave 0 marked approved; README reference-set section; glossary additions in AUDIO_VO_PLAN §2.4.
