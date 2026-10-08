# Narrative & Visual Audit — 2026-09-29

**Author:** Narrative & Visual Director (first audit on taking over the IP).
**Scope read:** `narrative/` (all lore, docs, content JSON, prompts, 10 reference images), runtime `content/*.json` narrative packs and the Godot mirror (byte comparison), `characters_part1.json`, `weapons_part1.json`, `enemies_part1.json`, `chapters_part1.json`, GDD §2/§3/§5/§7, `docs/ART_BIBLE.md`, `docs/PART1_CODE_AND_CANON_QA.md`, the G0 report. Code, tests and server were not read (outside narrative scope).
**Nothing was changed by the audit itself.** Findings are closed only by owner decisions; see the resolution log below. Companion document: `NARRATIVE_BASELINE_PART1.md`.
**Method:** full read of the compiled script (main story, 76 companion parts, 4 events, codex, 220 voice lines), then programmatic cross-checks (ages/rarity/element across JSON, lore and GDD; companion-story speakers vs first main-story appearance; `story_guests` vs speakers; speaker IDs; narrative vs runtime vs Godot copies), then visual comparison of every sheet against its prompt and the lore.

Severity: **H** high (player-visible contradiction, core rule, or production risk) · **M** medium · **L** low.

## Resolution log

| ID | Status | Resolved by |
|---|---|---|
| UN-03 | Resolved | World foundation W1, C15–C20 (2026-09-29) |
| UN-04 | Resolved | C17, `lore/glossary.md` |
| UN-02 | Resolved | C19: sealed at the bell altar beneath the Silent Bell; second order to the First Eclipse Altar |
| CC-03 | Resolved | C16: bell line passes mother to daughter; Cael is Veyr by birth, not of the bell line |
| CC-05 | Resolved | C21: calling bells stay tuned and ring on their own; Story Bible wording corrected |
| LK-08 | Resolved | C15 / world rule 7: a bell is a place, not bronze |
| CC-09 | Resolved in narrative files; GDD text pending | C16, C17; request in `docs/NARRATIVE_TECH_HANDOFF_PART1.md` §9 |
| UN-06 | Partly resolved | C18: why seven and why clustered; the seven names stay UNKNOWN |
| UN-07 | Partly resolved | C18: silent at least 15 years; who silenced it and why stay UNKNOWN |
| CC-16 (found during W1) | Resolved | Cael's household died two years **before** Crownfall, so "the minute before Crownfall" could not give them back. C20: public promise vs hidden aim (SECRET until Part II) |
| CC-04 | Resolved | C23 (W2): secret recognition at 7, public declaration and court at 13 |
| LK-01 | Resolved | C26 / world rule 11: Cael's name fades from memory; only holders of his writing recognize him |
| LK-12 | Resolved | C27: the Council pays Oren's company to finish the Crownfall order |
| UN-05 | Resolved | C22–C23: King Audren of House Carrow, no legitimate children, throne wars as ducal succession war; the killer is hidden in the Unwritten Hour (C26), design answer before the Part II outline |
| UN-08 | Resolved | C28 (portrait night) and C38: the Ashen Lord is Lord Edric Aske, the Crown's Keeper of the Schedule; `lore/characters/ashen_lord.md` |
| LK-02 | Resolved | C29 (W3): Part I about three weeks; the 7-3 rewrite delays payment, so "weeks" remain |
| UN-12 | Mostly resolved | C30: Carrowgate (capital), Glassford (river city); the seven dukes deferred to Part II politics |
| VIS-07 / VIS-10 | Partly | `lore/locations/registry.md` lists all 44 IDs; briefs for side roads still to write |
| UN-11 | Resolved | C31 (W4): the Six Manners, `lore/elements.md` |
| CC-15 | Resolved in lore; data fix pending | C32: `lore/factions/_registry.md`; `noble_retainer` request in handoff §9 |
| TD-06 | Lore side resolved | C32: registry and character affiliations; no data schema change requested |
| UN-01 | Resolved | C33–C35 (Part I step 1): she walks to pay in full by choice; letter locked; two thought lines added (411 lines) |
| LK-14 (found during W1) | Closed (kept on purpose) | C36: the double meaning of "A Smith's Last Bell" stays as foreshadowing |
| CC-01, CC-02, CC-06, CC-14 | Resolved | C36 (Part I step 2, 2026-09-30): line, direction and unlock fixes |
| CC-13 | Resolved | Canon, timeline (W1) and Villain Bible (C36) corrected; photos README is part of the visual step |
| LK-03, LK-04, LK-05, LK-06, LK-07, LK-10, LK-11 | Resolved | C36 (LK-05 and LK-07 recorded as intentional: F-031, F-033) |
| TD-01 | Resolved / half withdrawn | `narration` vs `narrator` is intentional (silent vs voiced); Yseldra unified to `lady_yseldra_vale` |
| LK-09 | Resolved | C37: Yseldra's traces in `ch4_road` and `ch6_road` (she moves ahead toward the Altar) |
| ST-05 | Resolved | C37: post-7-5 parts spread over night, dawn and the road down |
| RO-06 | Partly resolved | C37: one line each for Rikka, Iona, Clem, Thistle, Pippa (419 lines) |
| TD-03, TD-04, TD-05 | Resolved as requirements | C37: `docs/SPOILER_UNLOCK_POLICY.md`; unlock data in voice lines and codex |
| TD-02 | Resolved | `story_guests` list every on-screen speaker (7-5 memory line excepted) |
| RT-01 (final read-through) | Resolved | C39: Fadyme's Veyr surname no longer exposed before 7-3 (weapon lore, `cs_mirel_quill_3`, `event_council_herald_2`, `oath_04_mirel` tagline) |
| RT-02 (final read-through) | Resolved | C39: `cs_brin_alder_2` shrine keeper replaces Jori; `cs_brin_alder_3` Nixie replaces Marek (companion geography) |

---

## 1. CANON CONFLICT (confirmed contradictions between sources)

| ID | Sev | Conflict | Evidence |
|---|---|---|---|
| CC-01 | H | **Mahmut knows about the estate schedule a chapter early.** He says "East, then. The estate schedule is somewhere past the ravine." after 4-5; the Ashen estate schedule is first revealed by Oren at 5-5. Nothing in Ch1–4 mentions the estate. This line is also the only causal link from Ch4 to Ch5. | `ch4_camp_006` vs `node_5_5_post_001` |
| CC-02 | M | **Who carried Oren's order.** Main script, Villain Bible and Yseldra's file: Yseldra carried it, Oren signed. Sable's file and two companion parts: Sable (15) carried "the first order he ever received about the heir, six years old" / "the order that sent Oren after her". Reconcilable only if Sable's was a later hunt order, but "first order" contradicts that. | `node_5_5_pre_005`; `lore/characters/yseldra.md`; `sable_wren.md`; `cs_sable_wren_2`, `cs_sable_wren_4` |
| CC-03 | H | **"Last living Veyr blood" while Cael lives.** F-012, `house_veyr.md` and `fadyme.md` call Fadyme the last living Veyr blood; `cael.md` makes Cael a born Veyr, alive at the ending. It also leaves open why the Inquisition needed Fadyme as bearer when an adult Veyr (Cael) existed. | `canon.md` F-012; `house_veyr.md`; `cael.md` |
| CC-04 | M | **When Fadyme came to court.** `fadyme.md`: after her mother died (Fadyme 7) the king brought her to court. `mahmut.md`: at 19 he escorted Fadyme, "then thirteen and newly brought to court". Both from the same 2026-09-28 pass. | `fadyme.md` Backstory; `mahmut.md` Backstory |
| CC-05 | M | **Yseldra's handbell cannot ring, but rings.** Her clapper is tied with red thread "so it would never ring for a rite again" (lore, Villain Bible, sheet prompt). The opening (Story Bible: she "rings a cracked handbell") and `ch1_camp` ("a cracked handbell rings once"; Fadyme: "The widow's bell") have it ringing. World rule 2 ("the debt makes the sound") could explain it, but no source says so. | `yseldra.md`; `VILLAIN_BIBLE` §1; `ch1_camp` |
| CC-06 | L | **Where Mahmut's empty crest socket is.** Art canon A-003, 5-1 and the approved sheet: on the breastplate. `cs_mahmut_1`: "turning his helmet so the empty crest socket catches candlelight". The sheet shows a helmet only as a mood prop. | `canon.md` A-003; `cs_mahmut_1` |
| CC-07 | H | **Two competing visual sources for 15 characters.** `CHARACTER_COSTUME_GUIDE.md` and `content/character_visuals_part1.json` (a builder input, `tools/build_part1_content.py` line 58) still carry the pre-2026-09-28 designs; the lore files, `_visual_matrix.md`, sheet prompts and new sheets carry the new ones. Contradictions at weapon level: **Rikka** forge hammer vs spear (weapon data `equip_weapon_type: spear`); **Hana** recurve-bow staff vs hatchet + snare (`hatchet_trap`); **Marek** carries a banner pennant vs pennant removed after Crownfall (his signature weapon's whole meaning); **Odelia** marsh archer with reeds and fishbone fletching vs harbor watcher with net-knotted arrows; **Sable** one bare shoulder, overskirt over shorts, message tube. Palette/silhouette: **Vespera** violet/silver (Fadyme's palette) vs midnight blue/glass teal; **Mirel** midnight blue/gold vs bottle green/brass; **Pippa** honey/moss vs rose/cream/mustard; **Thistle** hood vs wide straw hat; **Clem** oversized hood + bone lantern vs chalky bob; **Iona** glass ampoule vs river lantern; **Brin** tower buckler vs round buckler. The JSON still says `image_status: prompt_ready` and "no generated raster files" for all 20. | the two files vs `lore/characters/*.md`, `_visual_matrix.md`, `weapons_part1.json` |
| CC-08 | M | **Sable's design exists in three versions.** Owner decision 2026-09-28 + prompt: the roster's alluring character, both shoulders bare, off-shoulder cropped jacket. Costume guide/visuals JSON: one bare shoulder, overskirt over shorts. The new Sable sheet in `photos/`: fully covered courier, no bare shoulders. | `CHANGELOG_NARRATIVE.md` 2026-09-28; `prompts/sheets/sable_wren_sheet.md`; `photos/ChatGPT Image 29 Eyl 2026 15_37_15.png` |
| CC-09 | M | **Whose blood feeds the bells.** GDD §2: the seven bells were "sealed with the blood of crown heirs" (taç varislerinin kanı) and §7.2 calls Fadyme "heir to the throne". C3: Veyr is not the dynasty; bell blood comes through her Veyr mother. "Heir" is used for both lines everywhere. | GDD §2, §7.2; Story Bible §9 C3 |
| CC-10 | M | **Eclipse color.** Art Bible: "ink black, pale brass, a thin ring of white light". Ch7 location brief, key art and the new Aveline/Yseldra/Cael sheets: crimson ring ("the one place a crimson ring is allowed"). | `docs/ART_BIBLE.md` Color; `location_briefs.md` ch7 |
| CC-11 | L | **Curse progression color.** Art Bible: "muted violet, silver, then a single cold-white strand or vein" and "rare crimson curse marks". Script and approved sheet: pale fingers → blood on scarf → bone-white lock → **black-gold** lines / "ash-dark veins" (7-5). | `ART_BIBLE.md`; 7-5 directions; Fadyme sheet "Late Story" |
| CC-12 | M | **Brand art is off-model.** App icon and key art: Fadyme with **red eyes** and a black-red hood (canon: violet eyes, plum hood); key art Mahmut in a fur mantle (canon: plate + oxblood cloak); two unidentified pale-haired figures (breaks the no-new-pale-hair rule). Store-facing. | `art/brand/brand_app_icon_512.png`, `uomd-wide.png` vs A-001, identity blocks |
| CC-13 | L | **Documentation drift.** `canon.md` open mystery "which bell was silenced" and `timeline.md` "(which bell: UNKNOWN)" vs `seven_bells.md` (the Silent Bell, in the capital; only why/by whom is open). Villain Bible "silent reflection cameo" vs the script where Yseldra speaks (the Bible's own C8 says the script wins). `photos/README.md` expected file names vs actual files. | as listed |
| CC-14 | L | **Companion parts use characters before the player meets them.** `cs_nixie_vale_2` (after 3-1) has Pippa speaking; her first main appearance is 3-4. `cs_tilda_fen_1` (after 4-2, Undercity) has Rikka speaking; her first appearance is 5-3 and her kiln company is in the eastern hills. Programmatic check found no other cases. | `character_stories_part1.json` |
| CC-15 | L | **Enemy faction data vs lore.** `noble_retainer` ("ghost of a household attendant", Ch6 estate) is tagged `crown_remnant`; the lore faction is `crown_guard`, data uses `crown_remnant`. | `enemies_part1.json`, `lore_text_part1.json` |

---

## 2. LIKELY (probable problems that need a decision or an explicit in-world reason)

| ID | Sev | Finding |
|---|---|---|
| LK-01 | H | **The C.V. clue should be solvable by people who served at court.** The chancellor's death is public (codex "Crownfall"), and he removed the hands of the court chronometer the day he took office (`cael.md`), a gesture a palace would remember. Mahmut spent three years in the palace; Mirel was a palace scribe who copied the Veyr erasures. At 3-5 and 6-4 nobody links "C.V." + a court signet + a handless watch to the late chancellor Cael Veyr. Needs a reason (e.g., erasing the Veyr name also erases memory of it under the Law of Hours; or he was only ever known by title), otherwise players will call the ending obvious and the cast slow. |
| LK-02 | M | **The prognosis clock doesn't fit the route.** "One month, perhaps less" before 1-1; "weeks, perhaps less" at 4-3 (about day 10–12 by the route guide); Part I spans about four weeks; canon W-005 says "weeks" remain at the end. By its own numbers she should be at or past the limit. Part II's clock depends on this. |
| LK-03 | L | Kera says "Same wax as the cathedral" (3-5) but was not in Chapter 2. Explainable (the seal on Mahmut's shield), but not shown. |
| LK-04 | L | `cs_kera_voss_3` unlocks after 6-5 but is set in the Undercity market with Iona, who is at the estate (6-3) and the altar (7-4) in that window. Companion parts have no in-world timestamp. |
| LK-05 | L | Vespera at 6-3: "I left before I understood what it was drinking." Her file: she let the ward read her and paid hours. Almost certainly an intentional lie — must be recorded as one so no writer treats it as fact. |
| LK-06 | M | Mahmut at 6-4: "The handless watch was in the portrait." No script direction shows such a portrait (Story Bible §2 puts it in the conservatory). This becomes a hard requirement for the 6-2/6-3 background art. |
| LK-07 | L | Vespera in `event_sun_eclipse_day` (after 6-5, before the reveal): "Machines keep calendars. So do chancellors." Either deliberate foreshadowing or a knowledge leak; she has no established reason to think of a chancellor. |
| LK-08 | M | The Harvest Bell was "cast in the Flint forge" for festivals, yet House Veyr bound the seven bells in ancient times. Needs a rule (the binding belongs to the site or the metal; bells can be recast). |
| LK-09 | M | Yseldra, the "recurring rival", has no on-screen scene between 2-5 and the final mirror (seals only). The mid-part antagonist pressure is carried by one-off bosses. |
| LK-10 | L | Chapter 6 reunion logistics: Aveline and Mirel (cathedral), Clem, Tilda, Iona, Thistle (Undercity) reach the estate although the destination was learned only at 5-5; there is no on-screen message path. |
| LK-11 | L | Kera's return at 3-2 and Nixie's second departure after 3-1 are not narrated. |
| LK-12 | M | Oren's present-day motive: six years after Crownfall, on whose authority is he still hunting the heir to deliver her to "the altar", and what would delivery achieve now? |
| LK-13 | M | **Clues with no recorded payoff:** Kera's sample "heir line, maternal: stable, remarkable" three winters ago, while Fadyme was hiding (whose blood — Cael's?); the Ochre Wheel's sealed crates for the ledger wing; who drew the false forest map ("wanted one person to disappear"); the court-trained hand that cut the register last winter (partial path: the Council Herald event). |

---

## 3. UNKNOWN (undefined canon that future work depends on)

| ID | Priority | Undefined |
|---|---|---|
| UN-01 | H | **What Fadyme intends to do at the altar.** Mahmut's goal is stated (break the mechanism). Hers, the reason she "had already planned to leave for the altar" before Mahmut found her, is never stated. The letter's payoff depends on it. |
| UN-02 | H | **Where the Crownfall rite happened.** "Deliver the heir to the altar" and "I saw her call you to the altar that night" happened in the capital; the First Eclipse Altar is a crater days to the east. Is there a capital altar, or was the rite performed away from the altar? |
| UN-03 | H | **How the three systems relate:** the ancient Last Bell bearer system (heirs' hours since the First Eclipse), the Crownfall "protective rite" Fadyme completed, and Cael's Unwritten Hour design. Also who ordered the Inquisition to deliver a bearer at Crownfall. |
| UN-04 | H | **Terminology:** "Last Bell" names no bell among the seven; "Unwritten Hour" means Fadyme's seal (GDD, `fadyme.md`), Cael's rite (`cael.md`) and the single stolen hour (`world_rules.md`); "heir" means both throne heir and bell-line heir; "Sevenfold Crown" (magic order) is barely defined. |
| UN-05 | M | Succession: the king's name and dynasty; Fadyme's legitimacy (unmarried mother); "tolerated as a **spare** heir" implies another heir who is never accounted for; who killed the king. |
| UN-06 | M | The seven previous bearers: names, Veyr blood, why all seven fall inside Yseldra's service and an old priest's "lifetime". |
| UN-07 | M | The Silent Bell: when, why, by whom. Constraint already implied: Fadyme's mother (died Year −15) spoke of it, so it failed at least 15 years ago and the throne wars lasted about a decade. |
| UN-08 | M | The Ashen Lord: identity, date of death, why a man who hid Veyr blood from the Crown kept the Crown's bell schedule, why his wraith is hostile; which portrait "came down" on which night (`ch1_camp`). |
| UN-09 | M | Mahmut's "one hour" (planned: the hour he chose to disobey at Crownfall). |
| UN-10 | M | Clockless Court: location, who serves there, whether the Silent Bell is inside. |
| UN-11 | L | The six combat elements have no in-world meaning. |
| UN-12 | L | Names: the river city, the capital, the seven dukes. |
| UN-13 | — | Oren's whereabouts (intentionally unknown; keep). |

---

## 4. RUMORED (in-world beliefs to keep tracked as rumor)

- The Clockless Court is a children's story about a court where no one ages (true in design).
- The eclipse "breathes" on Sun-Eclipse Day (grave-keepers yes, scholars no; Vespera: it recounts).
- Kiln bell-tassels "confuse the counting" (false; nothing happens under the Law, but it comforts people).
- "Seven notches" as a nursery threat.
- Sun-Eclipse tokens make the eclipse "know you watched" (superstition).
- Pippa's charm "came off a bell that stopped" (a refugee's claim; lore says a Silent Bell shard: LIKELY true).
- Saying your name aloud so the bell "hears the living" (folk practice that happens to fit the Law).

## 5. FALSE / MISCONCEPTION (believed by characters or the public; keep them false on purpose)

- The six public beliefs in `world.md` §5 (bells protect; royal line died; Cael died; Mahmut abandoned the heir; Hollows are punishment; the eclipse ends with forgiveness).
- Mahmut: the machine is the curse and breaking it will cure her.
- Oren and the Crown Guard: the rite would save the kingdom without consuming its heir.
- Yseldra: keeping Fadyme far from the altar halts the curse.
- The cult: paying the hour restores the kingdom (Cael's plan in religious form).
- Marek's decree: "abandoned the heir".
- Deliberate lies on screen: Mahmut's "No." (opening), Fadyme's "the elixir might work" (4-4), Vespera's 6-3 omission (LK-05).

## 6. CONFIRMED (checks that passed)

- Ages, rarity and element identical for all 20 characters across `characters_part1.json`, `lore/characters/*.md` and GDD §7.
- The 20 signature weapon names are identical in `weapons_part1.json`, `lore_text_part1.json` and the character files.
- Backstory arithmetic around Crownfall (Year −6) holds for Mahmut, Fadyme, Brin, Sable, Mirel, Kera, Aveline, Nixie ("eighteen winters"), Vespera ("fifteen years") and the Cael/Yseldra ages — apart from CC-04.
- Story recruits in the manifest match the script narration (Brin 1-2, Nixie 1-4, Jori 3-4); the First Oath list matches.
- Every limited-banner character appears in the story before the story tie their banner copy names.
- Mahmut's lie chain is continuous: `opening_013` → 2-5 → `ch2_camp` → confession.
- The C.V. chain is continuous: 3-5 (Fadyme's thought) → 6-4 → reveal; the player knows before the cast.
- Voice matrix "never says" rules hold in spot checks (Kera never "I don't know" without "yet"; Nara in numbers; Sable "no names until we are outside").
- Events carry `canon_status: canon` and a `timeline_placement`.
- The new Yseldra and Cael sheets fix V2–V4 from `visual_reference.md` (gray, cut seals; a separate bone half-mask; an empty dial in the watch detail).
- Narrative runtime JSON (scripts, manifest, events, lore text, voice lines) is identical in `narrative/`, `content/` and `game/data/content/`. Only `character_stories_part1.json` differs (the two pending text fixes). The backstory pass (20 character files, `yseldra.md`, `cael.md`, `_visual_matrix.md`) and `visual_reference.md` are not synced to root `lore/` (tech report G0.2 is blocked on this).

---

## 7. Character roster analysis

**What makes the roster work:** every character has a separate want/fear pair, a "never says" line, a signature object with a story, and a companion arc that shows something the main story cannot. The six quiet characters are quiet for six stated reasons. Skills are named after the character's history.

| ID | Sev | Overlap / distinctness risk |
|---|---|---|
| RO-01 | H | **The same reveal five times.** Kera (her own apprentice hand in the ledger), Mirel (her own scribe hand on the erasure order), Sable (her own courier knot on Oren's order), Jori (her family's die mark on the chains and the bell), Marek (he read the treason decree): each discovers "I served the machine without asking". It fits the title ("Unaware") and is the roster's strongest shared theme, but structurally it is one beat. What separates them is the response (Kera publishes, Mirel restores names, Sable lights lanterns, Jori makes a key, Marek retracts in public). Protect those responses; no new character should get this beat. |
| RO-02 | M | **Tilda and Iona:** same age (24), element (Tide), rarity, role (healer), clinic, arrival year. The difference is philosophy only (the living and present vs memory and the lost). Their kits must carry it. |
| RO-03 | L | Four shield-bearers (Mahmut, Brin, Nara, Jori; Hana also front row). Narrative differentiation is documented (person / village / road for strangers / the door); visually only the weapon separates them. |
| RO-04 | M | **Light-hair trio confirmed on the approved sheets:** Fadyme, Kera and Nixie all read pale-haired; Kera and Nixie both have amber eyes; Nixie is drawn hood-up almost everywhere although her file says "hood usually back or loose, unlike Fadyme's". |
| RO-05 | L | Violet/plum is shared by Fadyme, Yseldra (both hooded, both violet magic) and the Veil element color. If the echo is intentional (the woman who chose her), record it. |
| RO-06 | M | **Main-story presence is very uneven:** Thistle 1 line, Pippa 3, Rikka/Iona/Clem 4, Tilda/Nara/Marek 5 — versus Kera 21, Nixie 16, Mirel 15. Thistle and Pippa are First Oath options, so some players choose a companion who barely speaks in the main story. |
| RO-07 | L | "Nameless origin" cluster: Nixie, Thistle (foundling, not written as Vale — rule question), Yseldra, Sable (a seal instead of a surname). |
| RO-08 | L | Loss/complicity density: nearly every backstory turns on a death, abandonment or guilt. Project rule: do not rely on constant trauma. Part II needs arcs driven by desire and joy. |
| RO-09 | — | Observation, not a defect: 18 of 20 playable characters are women; the men are Mahmut and Marek (plus Cael, Oren, Rusk, the Ashen Lord). Relevant to future roster planning. |

---

## 8. Story structure analysis

| ID | Finding |
|---|---|
| ST-01 | **Strong:** proper setup (letter, prognosis, lie in the opening), escalation by symptom (fingers → blood → white lock → black-gold lines), a mirror of concealment that resolves in a single confession, a deliberate pattern break at 5-4, joy beats that make the loss count (cheese, the sun, the festival), and a two-beat ending that keeps grief and twist apart. |
| ST-02 | Chapter causality is mostly "a found document sends us to the next place". It works, but the Ch4→Ch5 link currently depends on the CC-01 leak. |
| ST-03 | Mahmut is reactive for all of Part I; his first real choice arrives with Cael's offer (his own file flags this for Part II). |
| ST-04 | Yseldra's mid-part absence (LK-09). |
| ST-05 | **Epilogue clustering:** 16 of 76 companion parts unlock after 7-5, most set "at dawn on the dais"; six are a variation of "a gift or witness for the dying Fadyme" (Thistle's seeds, Iona's nightly name, Clem's daily name, Aveline's vigil, Pippa's verse, Rikka's quiet). Played back to back they will blur. |
| ST-06 | Companion parts only have unlock gates, no in-world time or place anchor, which produces CC-14 and LK-04. |
| ST-07 | The one missing load-bearing motivation in an otherwise causal plot is Fadyme's own objective (UN-01). |

---

## 9. Visual narrative audit

| ID | Sev | Finding |
|---|---|---|
| VIS-01 | H | = CC-07 (two visual sources). Until reconciled, anyone building assets from `character_visuals_part1.json` or the costume guide produces off-canon characters. |
| VIS-02 | M | Ten sheets exist, not seven. Five new ones (Aveline, Sable, Nara, Yseldra, Cael; modified 2026-09-29 15:36–15:40) are not in `visual_reference.md`, `photos/README.md` or `character_briefs.md`, carry generator file names, and their approval status is unknown. Checked against the lore files and visual matrix: Aveline, Nara, Yseldra and Cael match (Yseldra and Cael also pass their prompt checklists for seals, mask and empty dial); Sable does not match her prompt (CC-08). |
| VIS-03 | M | **Fadyme's bell pin is missing from every visual source.** It is story-critical (soldiers hunt "a woman with a bell pin", ch5_road; Hana matches it to the portrait at 6-2; the nursery pillow; the House Veyr symbol), yet the approved sheet, identity block and costume guide define only the crown pin at the hood clasp. |
| VIS-04 | M | = CC-12 (brand art off-model), CC-10 (eclipse color), CC-11 (curse color). |
| VIS-05 | L | Sheet story panels contain errors: Hana drawn silver-haired in Sable's "Lanterns", Fadyme dark-haired in Nara's "The Measure". Safe only while sheets stay stage-1 identity references; never crop story panels as production references. |
| VIS-06 | M | Props the script needs in background art: handless-watch portrait (6-2/6-3), seven-notched seals on the 7-1 chains, blank name boards (3-1), Yseldra's seal on Mahmut's shield rim, the ropeless tower (2-1). |
| VIS-07 | L | Briefs exist for the 7 chapter hubs only; the 37 sub-locations in the tech handoff §8 have none. |
| VIS-08 | L | Brin sheet: "4★★", a contraction in the tagline (house style avoids them), file name typo "adler". |

**Consistent and strong:** the Mahmut and Fadyme sheets now define the look; the star-with-empty-socket and the thorn-clapper bell are good story-bearing props; the Yseldra/Cael redesigns land the clue objects (cut gray seals, empty dial, empty signet, mirror shards); Nara's Vell crest (bridge arch over water) and Aveline's bell-with-candle symbol match their faction files.

---

## 10. Technical / data items (narrative requirements, not implementation)

| ID | Sev | Requirement |
|---|---|---|
| TD-01 | M | One speaker ID per speaker: Yseldra appears as `yseldra`, `yseldra_distant`, `lady_yseldra_vale`; narration as `narration` and `narrator`. |
| TD-02 | L | `story_guests` omits on-screen speakers in 1-5, 2-1, 2-5, 3-2, 3-3, 4-5, 7-4, 7-5 (VN portrait staging needs to know who is present). |
| TD-03 | M | Voice relationship lines have no unlock gate and several spoil later reveals (Pippa: "Veyr rhymes with stayed here" gives away the surname before 7-3; Mirel: "I wrote her name back"; Iona, Clem, Kera, Vespera, Nara, Hana, Sable lines assume post-7-5 knowledge). |
| TD-04 | M | All 12 codex entries are `unlock: always`; some state hidden truths at game start (First Eclipse: "fixed with an heir's hours"; Council: "keep… the throne empty"; Red Vial: "a ledger of people"). |
| TD-05 | M | Boss lore planned for the intent panel/bestiary spoils the fight's reveal if shown before the fight (Oren, Ashen Lord's Wraith, Rusk, Matron). |
| TD-06 | L | No faction field in character data; enemy faction IDs do not match the lore faction files (CC-15). |
| TD-07 | M | Sync: two `character_stories` text fixes and the whole backstory/visual pass are not in the repository (G0.2 blocked). |

These are candidates for `docs/NARRATIVE_TECH_HANDOFF_PART1.md` §9. Not filed yet, pending the owner's go-ahead.

---

## 11. After the audit — summary for the owner

**Already strong**
- The emotional core: two people protecting each other with lies, resolved in one mutual confession; "I'm fine" as a line that changes meaning.
- The Law of Hours: a small, strict, generative magic system that explains the bells, the names, the Hollows, the consent limit on Cael's offer and a lot of everyday culture (name boards, Vale children, the inn-meal count, river lantern readers).
- Voice discipline (voice matrix, "never says", no contractions) — the characters are identifiable without name tags.
- Clue chains that pay off (Mahmut's lie; C.V.; Mirel's hand; Hana's promise; Odelia's brother found through Mirel's list).
- Gacha integrated with the world: diegetic recruits, a First Oath with an in-world explanation, banners that follow story appearance, signature weapons that are story objects, nothing gated behind a pull.
- Antagonists with coherent motives and clean mirrors (Yseldra ↔ Mahmut, Cael ↔ Fadyme); Yseldra is never cheapened by a kill.
- Canon tooling: an epistemic canon ledger, decision IDs, a narrative changelog, stable line IDs, canon status on events.

**Unclear:** UN-01 (Fadyme's purpose), UN-02 (where the rite happened), UN-03 (how bearer system, protective rite and Cael's design relate), UN-04 (terminology), LK-01 (why nobody recognizes C.V.).

**Inconsistent:** CC-01, CC-02, CC-03, CC-04, CC-05, CC-06, CC-09, CC-14; visual CC-07, CC-08, CC-10, CC-11, CC-12, VIS-03.

**Underdeveloped:** Yseldra between 2-5 and the ending; Cael's on-screen history; the Council, the capital and succession; the seven previous bearers; the Ashen Lord; elements; main-story presence of Thistle, Pippa, Rikka, Iona, Clem; the post-7-5 epilogue cluster.

**Protect as core canon:** baseline §10, plus the approved Mahmut/Fadyme sheets, the Law of Hours, the order chain, the two-beat ending, and the rule that the curse never penalizes the player.

**Clarify before any expansion (in this order)**
1. ~~UN-03 + UN-04~~ **done (W1, 2026-09-29):** terminology sheet (`lore/glossary.md`) and the ritual machinery (world rules 6–10, C15–C21).
2. ~~UN-01~~ (done, C33–C35).
3. ~~CC-03~~ (done, C16) + ~~LK-01~~ (done, C26).
4. LK-02: the prognosis clock at the end of Part I.
5. CC-07/CC-08: which visual source wins (recommended: lore files + prompts + approved sheets; regenerate the costume guide and visuals JSON from them), and Sable's final design.
6. The Part I text fixes (CC-01, CC-02, CC-04, CC-05, CC-06, CC-14) — each is one or two lines once 1–4 are decided.

**Missing narrative systems / documentation**
- A knowledge-state register (who knows what, from which line) — `canon.md` only tracks "player learns".
- A mystery register pairing every setup with its planned payoff and owner decision (LK-13 shows clues drifting without one).
- A terminology glossary (heir, bearer, Last Bell, Unwritten Hour, Sevenfold Crown, Hollow types).
- A registry of named NPCs and off-screen names.
- A location registry covering all 44 location IDs with briefs and ORDER_LEVEL rules.
- A faction ID registry aligned with data IDs.
- A single visual canon register (per character: approved sheet, identity block, locks, status).
- A spoiler/unlock policy for codex, voice lines and enemy lore.
- In-world time/place anchors for companion parts.
- Element lore.

**Long-term source of truth (recommendation)**
Keep the current layered model but make it explicit and one-directional: owner decisions → scripts → `canon.md` / `timeline.md` / `world_rules.md` → lore files (characters, factions, locations, history) → approved sheets + identity blocks → side content → bibles and costume guide as **derived summaries only** → runtime copies synced from `narrative/`. `NARRATIVE_BASELINE_PART1.md` is the index; every future change updates the ledger first, then the derived files, with a changelog entry.
