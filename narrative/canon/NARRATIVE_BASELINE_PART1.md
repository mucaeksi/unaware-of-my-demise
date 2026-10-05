# Narrative Baseline — Unaware of My Demise (Part I)

**Status:** Reference baseline, written by the Narrative & Visual Director on 2026-09-29 after a full audit (updated the same day with world foundation W1–W4, decisions C15–C32; Part I story pass steps 1–4, C33–C38) of `narrative/`, `lore/`, `content/` and the approved art in `narrative/photos/`.
**Rule:** This file indexes and summarizes canon. It does **not** create canon. Where sources disagree, the conflict is named with an ID from `NARRATIVE_AUDIT_2026-09-29.md` (CC = canon conflict, LK = likely problem, UN = undefined, VIS = visual, TD = technical data, RO = roster, ST = structure). Nothing here overrides a script line or an owner decision.
**Epistemic tags:** CONFIRMED · LIKELY · RUMORED · UNKNOWN · FALSE (in-world misconception).

---

## 0. Source-of-truth order (as found, and as recommended)

| Rank | Source | Governs |
|---|---|---|
| 1 | Owner decisions: `CHANGELOG_NARRATIVE.md`, decision IDs C1–C14 in `lore/canon.md` and Story Bible §9 | Everything |
| 2 | `content/story_script_ch01–07.json` + manifest | Every spoken line, scene order, recruit beats |
| 3 | `lore/canon.md`, `lore/timeline.md`, `lore/world_rules.md`, `lore/glossary.md` | Facts, chronology, magic rules, terms |
| 4 | `lore/world.md`, `lore/history/`, `lore/factions/`, `lore/locations/` | World foundation |
| 5 | `lore/characters/*.md` + `_voice_matrix.md` + `_visual_matrix.md` | Character models, backstory, voice, look |
| 6 | Approved sheets in `art/sheets/` + `lore/visual_reference.md` + `prompts/asset_pipeline/` | Visual canon |
| 7 | `content/character_stories_part1.json`, `events_part1.json`, `lore_text_part1.json`, `character_voice_lines_part1.json` | Canon side content (must obey 1–6) |
| 8 | `docs/STORY_BIBLE_PART1.md`, `docs/VILLAIN_BIBLE_PART1.md` | Structure summaries; must not introduce facts |
| 9 | `docs/CHARACTER_COSTUME_GUIDE.md`, `content/character_visuals_part1.json`, GDD §2/§7 | **Derived and currently stale** for 15 characters (CC-07) |
| — | `docs/PART1_FULL_SCRIPT.md` | Compiled read-only copy, never edited by hand |

---

## 1. Current World Overview

**Veyrhold** — a feudal kingdom named after **House Veyr**, the ancient bell-keeping house (not the reigning dynasty; C3). House Veyr bound **seven bells** that count the hours of the living and keep the dead from crossing back. Six years ago (**Crownfall**, Year −6) the capital fell, the king died, and the royal chancellor **Cael Veyr** was recorded dead. The **Council of Dukes** has ruled since; **Hollows** walk the roads; people measure days by bells they no longer trust. CONFIRMED.

**The Law of Hours** (`world_rules.md`, CONFIRMED):
1. An hour is a substance: counted, taken, given, owed.
2. Bells count, they do not heal; they ring to record each hour taken and need no clapper ("the debt makes the sound"). Each ring near the bearer speeds Fadyme's curse.
3. Names are witnesses. An hour cannot be written without a name that remembers it; the bearer's name is erased as the ledger counts her as paid. Writing it back delays payment, it does not cancel it.
4. The **Unwritten Hour**: the last hour before Crownfall, removed from time and kept by Cael. Rewriting it needs enough paid hours.
5. Consent limit: an hour moves only with a witness and consent.
6. The Ledger: the seven bells are one account; a death witnessed by a name closes, an unwitnessed death leaves a **Hollow**. Erasing names makes Hollows. (C15)
7. A bell is a place, not bronze: recast bells and shards keep counting (the Flint forge recast the Harvest Bell; Pippa's charm is a Silent Bell shard). (C15)
8. The guarantor is the Veyr **bell line**, mother to daughter. A bell-line daughter sealed to the Ledger is its **Last Bell**: the seven bells count, the Last Bell pays. Cael is Veyr by birth, not of the bell line. (C16, C17)
9. Distance slows payment, never stops it; a bell ringing nearby speeds it. (C15)
10. A calling bell stays tuned to the bearer it called and rings on its own when her debt moves. (C21)

**The Offering and the Sevenfold Crown (C17, C18).** When the kingdom cannot pay the Ledger, the Crown seals a bell-line daughter; the first Offering stopped the sun over the crater (the **First Eclipse**). The throne's custody of bells, Inquisition, Church rites and Altar is the old **Sevenfold Crown** compact. The capital's **Silent Bell** fell silent in the throne wars (at least 15 years ago; who/why UNKNOWN); seven bell-line daughters were spent standing in for it before Fadyme. Terms: `lore/glossary.md`.

**Daily life** (`world.md`): time kept by the nearest bell; name boards on doors, carved names on trees, wayshrine registers; losing your name from a register is feared more than losing property; unregistered roadside children are written in as **"Vale"**; Silver Crowns; guilds run alchemy and carting; nobles hold grain and passes; refugees everywhere since Crownfall; inns feed travelers twice a day for free so they give their names at the door (event lore).

**The dead and the unnatural:** Hollows (repeat old tasks, drawn to bells) · Bellbound / Inkbound dead (wired to a bell or wrapped in erased records) · Wraiths (great-house dead held by portraits and mirrors) · Ashbound beasts (ate bell-ash: Ash Wolves, the Ash-Maw).

**Public belief vs truth** (FALSE = the public belief):

| Public belief (FALSE) | Truth (CONFIRMED) |
|---|---|
| The bells protect the living | They count and collect hours; protection is a side effect |
| The royal line died at Crownfall | Fadyme survives |
| Cael Veyr died at Crownfall | He stepped out of recorded time with the Unwritten Hour |
| Mahmut is a traitor who abandoned the heir | He defied the order to deliver her |
| Hollows are punishment for the throne wars | They are unpaid hours |
| The altar eclipse ends when the kingdom is forgiven | The altar mechanism holds it |
| The Clockless Court is a children's story (RUMORED) | It exists |

---

## 2. Current Main Story (Part I — *Unaware, I Fade*)

**Premise.** Fadyme, the hidden heir and last bearer of the Last Bell seal, knows from the first scene that the seal is spending her hours: a physician wrote "one month, perhaps less" in her mother's prayer book. She hides it so her last days feel like a journey, not a vigil. Mahmut, the knight branded traitor for saving her at Crownfall, believes the curse is a mechanism he can break at the **Altar of the First Eclipse**. Both are concealing something: she her dying, he that he knew the Inquisitor who chose her. Her real purpose (C33): to pay her debt in full at the Altar, by choice, because while she hid her slow payment fell on the villages; she does not know the Altar is now Cael's Hinge. At 7-3 she wants to be witnessed instead of offered; at 7-5 she refuses.

**Emotional contract.** The recurring line "I'm fine" moves from humor → deflection → reassurance → a choice to spend one more moment together. Mahmut is not foolish: symptoms are explained away, records are falsified, and the player sees more through Fadyme's thoughts.

**Structure.** Opening VN + 7 chapters × 5 battle nodes (35) + 13 road/camp scenes + confession + Cael reveal = 51 story entries (manifest `story_order`). 419 main-story lines (two thoughts added by C35, eight lines by C37).

| Ch | Place | What happens | Curse beat | Reveal / clue |
|---|---|---|---|---|
| Opening | Forest road shrine | Letter, prognosis; Yseldra stops them; Mahmut says "No." too fast | shaking hand | seven-notched gray seal left on Mahmut's shield |
| 1 | Whispering Ash Forest | Brin (1-2), First Oath selector, Kera loan (1-3), Nixie (1-4), Ash-Maw (1-5) | cold, pale fingertips | carved names lose letters; "the map is lying" (companion story: drawn so travelers skip the shrine register) |
| 2 | Ruined Cathedral of Saint Luthos | Aveline, Mirel; register cut; rite page "a life held against the dark"; Yseldra boss 2-5 exposes Mahmut's lie | — | name cut *last winter* (companion story: by a court-trained hand); Mahmut admits he knew her (ch2_camp) |
| 3 | Oakhaven | Blank name boards; Jori joins (3-4); Pippa; Captain Rusk | blood on the white scarf / Mahmut's gauntlet | Rusk's order: seven-notch seal, **C.V.** beneath; Fadyme recognizes her father's last page |
| 4 | The Undercity | Odelia, Tilda, Iona, Clem, Thistle; Rusk's order asks for her **blood**; Red Vial Matron | alchemist: "weeks, perhaps less" | Fadyme's elixir lie; Clem and Kera become keepers of the lie |
| 5 | Bridge of the Forsaken | Marek, Nara, Sable, Rikka, Odelia; Marshal Oren | white lock at 5-4 | Oren: "Yseldra carried the order… I signed it"; "The Ashen estate has the full schedule"; Oren holds the span, leaves by the estate road |
| 6 | The Ashen Lord's Estate | Hana, Vespera, Sable; portraits without names; manor collapse; Ashen Lord's Wraith | forbidden burst; Hana sees her arm | Fadyme's mother's portrait; Mirel's own hand on the erasure order; ledger page + handless-watch diagram + C.V.; "a schedule for the heir" |
| 7 | Altar of the First Eclipse | Everyone returns; name written back ("Fadyme **Veyr**"); Eclipse Construct | black-gold lines to the heart; collapse | "THE HOUR IS UNPAID" / "HOUR STILL OWED"; confession (both stop pretending); **Cael** in the mirror: "Uncle." |

**Ending state (CONFIRMED).** Villages safe, Red Vial ledger wing broken, construct destroyed but the bells still ring; Fadyme not cured, remaining time "weeks" because the 7-3 rewrite delayed payment (W-005, C29). Cael offers to return her hours for **"one hour that belongs to you"** (Mahmut) at the **Clockless Court**. Part II: *The Hours We Have Left*.

**Central conflict.** External: the bell ledger and the people who feed it (Inquisition seals, Red Vial ledger wing, Crown Guard remnant, the cult, Cael). Internal: protection vs truth — every protector in Part I hides something from the person they protect.

---

## 3. Current Character Roster

Data from `content/characters_part1.json` (ages, rarity, element and role are consistent across JSON, lore files and GDD — CONFIRMED). Tier: A carries the main story, B carries a main mystery, C deepens through a four-part companion story. No character has a faction field in data (TD-06); affiliations below come from lore.

### 3.1 Leads and antagonists

**Mahmut** (A · 28 · M · 5★ Stone tank-bruiser · free start). Former Crown Guard shield-bearer, Fadyme's escort from her age 13; defied Oren's order at Crownfall, branded traitor by the Council, lost her in the flight, searched four years, found her two years ago. Wants: keep her walking beside him. Fears: arriving too late again; obeying the wrong order. False belief: you can carry a truth for someone by hiding it. Secret (resolved in Part I): he saw Yseldra call Fadyme to the altar. End of Part I: knows she is dying; facing Cael's offer. Arc: reactive guardian → must learn "giving vs paying" (Part II). Gameplay: *Broken Crest Guard* redirects hits from the weakest ally — his life as a skill. Look: dark messy hair, stubble, brown eyes, worn half-plate with the Crown Guard star and the empty hammered socket above it, tattered oxblood cloak, arming sword (*The Crestless Oath*), repaired heater shield. Voice: short, dry, silence = anger; never "That is an order."

**Fadyme Veyr** (A · 22 · F · 5★ Veil support-DPS · free start). Recognized daughter of the king and a Veyr bell-keeper's daughter (never married); last living daughter of the Veyr bell line; spent her first years in the Ashen estate nursery; mother died when she was 7; recognized in secret by King Audren of House Carrow and raised in a guarded hunting lodge; declared publicly and brought to court at 13 (C23); carries her father's last page, Cael's unanswered letter (C24); at 16 sealed by Yseldra as Last Bell beneath the Silent Bell, standing in for its share (C19); fled the order to take her to the First Eclipse Altar; alone in hill villages four years, far from every bell (which slowed her payment); Mahmut found her two years ago. Wants: to be a companion, not a mission. Fears: being seen as "a final hour"; her name vanishing before she does. Secrets: prognosis and letter; C.V. is her uncle. End of Part I: confessed; named Cael "Uncle."; has not said the name Cael aloud before. Gameplay: *Borrowed Hour*, *A Smile Kept* (shields the team when she is under half HP — hiding pain as a mechanic); the curse never penalizes the player. Look: pale ash-blonde hair, violet eyes, deep plum hood with a broken silver crown pin at the clasp, black dress with fading silver-lilac embroidery (a quiet curse "progress bar"), white scarf, silver bell of House Veyr with a silver-thorn clapper (*The Hour Between Bells*). She also wears a **bell pin** in the script (VIS-04). Voice: exact, courteous, wry; shorter when afraid; never "Save me."

**Lady Yseldra Vale, the Bell-Widow** (antagonist · 34 · F · not playable · boss 2-5). Vale foundling taken by the Royal Inquisition; keeper of sealed records and bell rites; seven bearers died in her service (seven gray seals cut through); chose Fadyme at Crownfall believing the seal would protect her and sealed her beneath the Silent Bell; then carried the second order (deliver her to the First Eclipse Altar) to Oren, LIKELY not yet knowing what the Altar would do. Now: guilt-driven; her tied calling bell still rings whenever Fadyme's debt moves, and she follows it (C21). She wants Fadyme far from every bell — half right: distance slows, never stops. Refuses to harm civilians. Mirror of Mahmut: protection by removing choice. Look: tall, veil over a separate bone-white half-mask cracked across one eye, black-plum surcoat over mail, seven clapper rings, cracked brass calling bell tied with red thread (it rings anyway, C21), chain of seven gray seals.

**Lord Cael Veyr, the Clockless Chancellor** (antagonist · 41 at Crownfall, current age uncertain · M · not playable · not a boss in Part I). Fadyme's maternal uncle, Veyr by birth but not of the bell line (C16); the only Veyr who chose court over bells; royal chancellor who removed the hands of the court chronometer; lost wife **Liora** and son **Aren** two years before Crownfall in a siege he lost by one hour; designed **the Rewrite**: took **the Unwritten Hour** (the last unrecorded hour before Crownfall) out of the Ledger, to be rewritten at the Altar with a Last Bell's hours routed by **the Schedule**, through **the Hinge** (the Eclipse Construct) that makes the Altar count backward; recorded dead. Public promise: the minute before Crownfall. Hidden aim (SECRET until Part II, C20): keep counting back to the hour he lost Liora and Aren. Believes one life is a fair price and "temporary". Has never asked Fadyme what she wants. Mirror of Fadyme: she gives time forward, he takes it backward. Look: black high-collared court coat over antique-gold scale panels, empty signet, watch with an empty dial and no hands, face fractured in mirror shards, never masked.

### 3.2 Playable companions

| ID | Tier · age · ★ · element · role | Affiliation (lore) | Narrative function / theme | Want · fear | Part I position at end | Arc status | Visual anchor (lore) |
|---|---|---|---|---|---|---|---|
| kera_voss | B · 20 · 4★ Ember alchemist DPS | Red Vial archive wing | Knowledge ethics; complicity by not asking | cure without a victim · her work already killed someone | At the altar; writing a formula as rival to Cael's offer | Part I done; Part II hook | wide field hat + ember goggles, ash-silver hair (explosion), brass mortar |
| brin_alder | C · 23 · 4★ Stone tank | Forest-road village guard | Holding alone vs shared weight | nobody left behind · choosing who to hold | Returned at 7-2 having led refugees | Complete | long brown braid, pine cloak, fur collar, axe + round buckler |
| nixie_vale | C · 19 · 4★ Gale ranged | Ex-Ochre Wheel caravan scout; Vale | Belonging by choice | belong by choice · being claimed/filed | Returned at 7-1; "not staying behind again" | Complete | teal/ochre hood, feather pin, light brown hair, shortbow |
| sister_aveline | B · 26 · 5★ Dawn healer · Oath Banner 1 | Church of Saint Luthos | Institution vs truth; care first | people first · her Church let heirs die | Keeping vigil; holds the book of offerings | Part II: Church vs truth | copper cropped hair, dove-grey veil, sun-disc lantern staff |
| sable_wren | C · 21 · 5★ Veil assassin · Oath Banner 2 | Ex-Wren Post courier | Carried secrets; silence | stop carrying others' secrets · what she delivered | Told Hana her secret | Complete (see CC-02) | black bob + side lock, cowl, ink blue, broken wax seals, twin blades with bell-rope |
| tilda_fen | C · 24 · 4★ Tide healer | Undercity clinic | Honest prognosis — direct foil to Fadyme | keep the living living · false hope | Clinic door open | Complete | curly dark hair, sea-green kerchief, oilcloth cape, reed staff with sea-glass |
| rikka_ember | C · 18 · 4★ Ember bruiser | Kiln company (eastern hills) | Noise vs silence; courage as performance | make people brave enough to laugh · silence | Chose quiet beside Fadyme | Complete | red twin braids, soot, red lamellar, bell-tassel spear |
| mirel_quill | B · 25 · 5★ Dawn buffer · Oath Banner 4 | Ex-court scribe, Saint Luthos archivist | Records and erasure; atonement | truthful records · her hand erased people | Wrote the name back; recanted under court seal (Council reprisal pending) | Part II: restoring names | black bun with styluses, round spectacles, bottle green, astrolabe folio |
| odelia_pike | C · 22 · 4★ Tide debuff archer | Salt-road harbor watcher | Grief as pursuit | close every track · stopping | Brother Tomas's name found and witnessed | Complete | short salt-stiff hair, red harbor cap, grey-blue jacket, longbow |
| pippa_bell | C · 20 · 4★ Gale bard | Travelling singer | Witness through song | no one forgotten · her songs fading | Silent Bell charm rang at 7-3 | Hook to capital | rose-pink curls, feathered cap, poster-patch jacket, lute-sling, charm |
| nara_vell | C · 27 · 5★ Stone tank support · Oath Banner 3 | Vell bridge wardens | Duty to people over orders (Oren's teacher's daughter) | everyone crosses · not enough stone | Knows Oren left alive; refuses to guess more | Complete | deep brown skin, cropped hair with shaved sides, stone plate, glaive + kite shield |
| clem_marr | B · 19 · 3★ Veil debuffer | Grave-register decoder | Names of the dead; first witness of the lie | every dead person named · causing a living person to be forgotten | Keeps Fadyme's name in her book daily | Part II: "you knew too" | mouse-brown bob, chalk dust, heather grey, ritual lantern |
| vespera_wisp | B · 23 · 5★ Veil mage · Oath Banner 5 | Wandering glass mage | Time paid knowingly; the Law's scholar | understand time unowned · becoming an absence | Verdict: hours carry something; consent later | Part II: judge of Cael's offer | midnight-blue hair with one frost-white streak, glass lantern |
| hana_birch | C · 18 · 3★ Stone counter | Ashen estate gamekeeper's daughter | Timid courage; keeper of promises | prove shaking hands can open doors · speaking up | Released from her promise | Complete | honey-brown hair, birch-white bandana, rust, hatchet + snare |
| thistle_roe | C · 21 · 4★ Gale healer support | Saint Luthos bell garden | Growth after loss; practical bell lore (owing-bell) | plant after every burial · breaking what she can't mend | Gave winter seeds | Complete | chestnut double buns, wide straw hat, sage, thorn crook |
| iona_mist | C · 24 · 4★ Tide healer | River lantern keepers | Witnessing the lost | bring the lost home · a name nobody calls | Reads Fadyme's name nightly | Complete | long black hair with blue sheen, navy oilskin, river lantern |
| jori_flint | B · 20 · 3★ Ember guard · free recruit | Flint forge, Oakhaven | Maker's complicity; key vs hammer | protect instead of wall in · her family built a prison | Making "a key, not a hammer" | Part II: the tool that opens a chain | short ginger hair, soot, apron, hammer + round shield |
| marek_vane | C · 30 · 4★ Gale control buffer | Ex-border guard, ex-Crown herald | Proclamation vs truth; public retraction | walkable roads · marching without reason | Will follow Mahmut to the Court | Hook | long dark-brown hair, beard, road cloak, viola, spear-horn without pennant |

**Recurring NPCs.** Marshal **Oren** (Crown Guard remnant; Mahmut's teacher; signed the order; held the span; whereabouts UNKNOWN) · Captain **Rusk** (mercenary, carried the C.V. order) · the **Red Vial Matron** (ledger wing head) · the **Ashen Lord** (Lord Edric Aske, the Crown's Keeper of the Schedule; hid Fadyme's mother; a Wraith repeating "hide them from the Crown", C38) · the shrine keeper · the Undercity alchemist · the old priest · Council herald. **Off-screen names:** Hesper Doyle (Kera's master), Old Marta (Tilda's teacher), Tomas Pike, Bram Alder, Liora and Aren Veyr, the Ochre Wheel, the Wren Post.

---

## 4. Current Factions

| Faction (lore file) | Ideology | Part I role | Hidden layer | Enemy data ID |
|---|---|---|---|---|
| Council of Dukes | Order before legitimacy | Records, bounties, treason decree; new "impostor" decree (event) | Keep the throne empty; erased the Veyr name | — |
| Royal Inquisition (broken) | Feed the bells correctly; seal the truth | Seals still circulate (Rusk's order, altar chains) | Chose bearers; seven-notched gray seal | (Yseldra: `villain_boss`) |
| Crown Guard remnant | An order is a promise | Oren's companies hunt the heir | Knew her blood was tied to the rite | `crown_remnant` (TD-06) |
| Church of Saint Luthos | A bell is a prayer the village hears | Cathedral, shrines, Aveline, Thistle | Book of offerings listed heirs "with no date" | (choir/clerics as `hollow_host`) |
| Red Vial Guild | Everything has a formula | Archive wing (Kera) vs ledger wing (Matron, Rusk) | Heir's blood as "last ingredient"; taps the Glass Bell | `red_vial_guild` |
| First Eclipse Cult | The eclipse is a held breath; paying the hour restores the kingdom | Chain-bearers, sentinels at the altar | LIKELY seeded by Cael | `first_eclipse_cult` |
| Clockless Court | — | Named only in Cael's offer | Location, members UNKNOWN | — |
| House Veyr | Bell-keepers; guarantor of the Ledger through the bell line (mother to daughter) | Name written back at 7-3 | Almost extinct because the Crown spent its daughters as Offerings (C16, C18) | — |

Also in data: `hollow_host`, `ashen_estate_dead`, `ashbound_beasts` (enemy groupings, not political factions).

---

## 5. Current Important Locations

Route (about three weeks, C29; days follow the script): Whispering Ash Forest (west, Whispering Bell) → 1 day → Cathedral of Saint Luthos (Ropeless Bell) → 3 days → Oakhaven (Harvest Bell) → 2 days → the Undercity beneath **Glassford** (Glass Bell) → 4 days → Bridge of the Forsaken (eastern ravine; Forsaken Bell) → 2 days → Ashen Lord's Estate (eastern highlands; no bell, holds the schedule) → 2 days → Altar of the First Eclipse (crown-shaped crater; Eclipse Bell). The capital **Carrowgate** (Silent Bell, Council) lies north, unvisited. Location briefs exist for the seven chapter hubs (`prompts/asset_pipeline/location_briefs.md`); the 37 sub-location IDs have none (VIS-10). Full list: `lore/locations/registry.md`.

**The seven bells** (`history/seven_bells.md`): 1 Whispering (cracked; Ash-Maw's jaw is a shard) · 2 Ropeless (rings with no rope or clapper) · 3 Harvest (recast by the Flint forge; the count moved into their bronze) · 4 Glass (tapped by the ledger wing) · 5 Forsaken (signal bell; rope cut by Sable) · 6 Silent (capital; silent at least 15 years; Fadyme was sealed at its altar and stands in for its share; why/by whom UNKNOWN) · 7 Eclipse (in the Construct's hollow core; still ringing).

---

## 6. Current Timeline (Year 0 = start of Part I)

| When | Event | Status |
|---|---|---|
| Ancient | House Veyr binds the seven bells; the Sevenfold Crown holds the border | CONFIRMED |
| Generations ago | First Eclipse: bells first fixed with an heir's hours; Flint family forges/repairs the altar chains | CONFIRMED |
| ≤ Year −15 | The Silent Bell fails in the throne wars (Fadyme's mother told her; `cs_pippa_bell_2`) | CONFIRMED (C18; who/why UNKNOWN) |
| Year −47 | Cael born (41 at Crownfall) | derived |
| Year −22 | Fadyme born; first years in the Ashen estate nursery | CONFIRMED |
| Year −15 | Fadyme's mother dies (Fadyme 7); Fadyme leaves the estate; to court (see CC-04) | CONFIRMED / conflict |
| Year −13 | Mahmut (15) joins the Crown Guard | CONFIRMED |
| Year −9 | Mahmut (19) becomes escort of Fadyme (13) | CONFIRMED |
| Year −8 | Cael's wife Liora and son Aren die in the throne wars | CONFIRMED |
| Silencing → Crownfall | Seven bell-line daughters sealed to stand in for the Silent Bell, held at the Altar, spent within about ten years (Yseldra's service) | CONFIRMED (C18) |
| **Year −6** | **Crownfall.** King killed (killer UNKNOWN); Inquisition ordered to seal a bell-line bearer; Yseldra seals Fadyme (16) beneath the Silent Bell; second order sends her to the First Eclipse Altar — Yseldra carries it, Oren signs it, Mahmut (22) defies it; Cael steps out of time with the Unwritten Hour; Mahmut and Fadyme separated; treason decree (Marek reads it in eleven villages); crest hammered off | CONFIRMED |
| Year −6 (month after) | Mirel (19) copies forty erasure orders incl. the Veyr name | CONFIRMED |
| Year −6 (first winter) | Brin's father dies holding a burning roof | CONFIRMED |
| Year −3 | Kera's blood-sample analyses for the ledger wing ("heir line, maternal"); Hesper expelled; Nara's last cart; Vespera lets the Glass Bell ward read her; Sable leaves the Wren Post | CONFIRMED |
| Year −2 | Mahmut finds Fadyme; Tomas Pike enters the Undercity; Tilda and Iona open the clinic; Nixie leaves the Ochre Wheel | CONFIRMED |
| Year −1 (winter) | Fadyme's name cut from the Saint Luthos register by a court-trained hand | CONFIRMED (who: UNKNOWN) |
| Year 0, before 1-1 | Prognosis "one month, perhaps less"; first Yseldra encounter | CONFIRMED |
| Year 0, Ch1–7 | About three weeks; Ch4 estimate falls to "weeks"; the 7-3 rewrite delays payment | CONFIRMED (C29) |
| After 7-5 | Confession; Cael's offer; companion epilogues at dawn on the dais | CONFIRMED |

---

## 7. Known Mysteries (and who knows)

| Mystery | Player knows | Characters know | Status |
|---|---|---|---|
| Fadyme is dying | Opening | Clem, Kera (4-3/4-4), Tilda suspects, Thistle's flower, Hana (6-4); Mahmut after 7-5 | Resolved |
| Mahmut knew Yseldra | 2-5 | Fadyme (2-5), Aveline (companion) | Resolved |
| Who is C.V. | Fadyme's thought 3-5 (her father's last page) | Fadyme only; everyone else's memory of the chancellor's name has faded (rule 11, C26) | Resolved at ending |
| The letter's contents | Exists, "for after" | Fadyme; Clem knows it exists | Locked (C34, SECRET): the truth, release from the oath, "Let no one pay for my hours. Not even you.", the king's last page inside; revealed at the Part II opening |
| Mahmut's "one hour" | Asked in `cs_mahmut_2` | Mahmut suspects Crownfall night | UNKNOWN (UN-09) |
| Is Cael's offer real | Vespera: hours can move; "hours are not empty rooms" | Vespera, Kera | Part II |
| Where is the Clockless Court | Upward-drifting ash | Nobody | UNKNOWN |
| Why/by whom the Silent Bell was silenced | Pippa's charm; rang at 7-3 | Nobody | UNKNOWN |
| Who the Ashen Lord was | He hid "the bell-keeper's daughter" | — | Resolved in lore (C38): Lord Edric Aske, Keeper of the Schedule; name never spoken in Part I |
| Who killed the king | — | No one: it happened inside the Unwritten Hour (C26) | Design answer to lock before the Part II outline |
| Who still erases the name (court hand) | Register cut last winter; Council herald event: "same scribe… still in the capital" | Mirel, Nara | Part II thread |
| Oren's whereabouts | Left by the estate road | Nara saw him leave alive | UNKNOWN (intentional) |
| The seven previous bearers | "Seven women like me" | Old priest, Aveline, Yseldra | Resolved in lore (C18); their names UNKNOWN |

---

## 8. Unresolved Plot Threads (carry into Part II)

Fadyme's hours and the prognosis clock · Cael's offer and the price · the letter · the Clockless Court · Kera's formula (scientific alternative) · Jori's key (open a chain without breaking it) · the Silent Bell and Pippa's charm · Aveline's book of offerings and the Church's complicity · Mirel's recantation and the Council's reaction · the Council's "present yourself or be recorded as an impostor" decree · Oren · Yseldra's allegiance after the mirror scene (she warns against Cael) · planned in lore only, not yet on screen: Yseldra's gentleness toward Nixie (shared Vale register mark) · the nineteen unmarked graves (Clem, Hana) · Marek's public retraction spreading ("WHO GAVE THE ORDER?") · Sable's and Hana's carried secrets · the Construct's "WITNESS… RESTORED. HOUR… STILL OWED."

---

## 9. Existing Character Arcs (status)

| Arc | Part I status |
|---|---|
| Fadyme: "I'm fine" → confession | Complete; Part II: from hiding time to spending it on purpose; will she let others pay |
| Mahmut: guardian → learns the truth | Complete; Part II: giving vs paying; must get real choices (lore risk note) |
| Yseldra: guilt as pursuit | Retreat at 2-5; reappears only at the mirror (LK-09) |
| Cael: hidden architect | Revealed; motive stated; no on-screen history yet |
| Kera, Mirel, Aveline, Jori, Clem, Vespera (Tier B) | Part I beat done; each holds a Part II job |
| Tier C (12) | Four-part companion arcs complete; most end at "dawn on the dais" (ST-05) |
| Oren | Deliberately unfinished (C2) |

---

## 10. Important Canon Facts (protect)

- Fadyme knows she is dying from the opening; Mahmut learns only after 7-5 (F-001, emotional contract).
- The two-beat ending: confession first, Cael second; Cael is not the final battle.
- Law of Hours, ten rules (world rules 1–10), including consent + witness, the bell line and the Ledger; terms in `lore/glossary.md` (C15–C21).
- Crownfall six years ago; order chain: Inquisition → Yseldra carries → Oren signs → Mahmut defies.
- House Veyr is the bell-keeping house, not the dynasty; Cael is Fadyme's maternal uncle.
- Vale = unregistered roadside child; Nixie and Yseldra unrelated.
- Seven-notched **gray** seal = Inquisition; seven cut seals = seven dead bearers.
- Fadyme's appearance lock (pale ash-blonde, violet eyes, plum hood, bell with thorn clapper); Mahmut's star-with-empty-socket.
- Story recruits: Brin 1-2, Nixie 1-4, Jori 3-4; First Oath choice of seven 4★ before 1-3; no gacha gate on story; banners follow story appearance.
- Yseldra is a retreat, never a kill; no villain is playable.
- House style: no contractions in dialogue; voice matrix "never says" lines.

---

## 11. Continuity Risks (summary; details in the audit)

Resolved by W1/W2 (2026-09-29): CC-03, CC-04, CC-05, LK-01, LK-08, LK-12, UN-02, UN-03, UN-04, UN-05, LK-02, UN-01, UN-11, and C36 (2026-09-30): CC-01, CC-02, CC-06, CC-14, LK-03–LK-07, LK-10, LK-11, TD-01, TD-02, CC-15 (data fix pending), CC-09 (GDD text pending).

High: CC-07 (two competing visual sources for 15 characters) .

Medium: CC-08 (Sable design).

---

## 12. Visual Identity Summary

- **Brand:** near-black, bone white, blood-red accent; logo "UNAWARE" with a red cross-sword and a thorned eclipse arc. Key art and app icon predate the character lock (CC-12).
- **Locked art modes** (`prompts/asset_pipeline/00_rules.md`): NARRATIVE MODE (polished hand-painted anime / light-novel, gothic dark fantasy, soft consistent light) and PLAY MODE (2–3-head chibi, adult cues, bold uneven black ink outline, flat 2–3-step cel shading, sparse hatching, 3–4 colors + one accent, no glow). Crimson is an omen accent, never a fill; no micro-patterns; no text in images.
- **Sheet pipeline:** stage 1 identity sheets in `art/sheets/`; stage 2 production uses the same-character sheet and the identity block "LOCKS". Approved + extracted: Mahmut, Fadyme, Kera, Brin, Nixie. Present but undocumented/unconfirmed: Aveline, Sable, Nara, Yseldra, Cael (VIS-02). Missing: Tilda, Rikka, Mirel, Odelia, Pippa, Clem, Vespera, Hana, Thistle, Iona, Jori, Marek.
- **Differentiation rule:** no two characters share silhouette anchor + hair + dominant palette; no new pale/ash/silver hair (Vespera's single streak excepted). Known risk: Fadyme/Kera/Nixie light hair (RO-04).
- **Recurring symbols:** bells (cracked, ropeless, clapperless, thorn-clappered); seven-notched gray wax; cut seals; name boards and carved names going blank; upward-drifting ash (Cael's trail); handless watch / empty dial; empty signet and empty crest socket (removed identity); chains; the unmoving eclipse over a crown-shaped crater; lanterns (Aveline, Sable, Iona, Clem, Vespera); chalk arrows; hood up = hiding.
- **Curse progression (script + sheet):** pale fingertips → blood on the white scarf → one bone-white lock (5-4) → black-gold lines spreading from the hand (7-5); embroidery fades over time. Art Bible wording differs (CC-11).
- **Location language:** Ch1 damp ash forest with wayshrine and distant Saint Luthos spire; ORDER_LEVEL ordered/uneasy/chaotic; Ch7 is the one place a crimson eclipse ring is the focal omen (conflicts with Art Bible's white ring, CC-10).

---

## 13. Gameplay / Narrative Relationships

- **Skills tell backstory:** Broken Crest Guard (redirect), A Smile Kept (hidden pain), Measure Twice (Kera), Familiar Footsteps (Nara), Decree of the Unfallen / Corrected Record (Mirel), Keep the Names (Clem), Candle-Eater (Vespera), March Without a Banner (Marek). Signature weapons are story objects (Sable's cut bell-rope, Nixie's lying map, Jori's chain-die rivet).
- **Recruitment is diegetic:** story recruits at 1-2/1-4/3-4; First Oath Invitation explained in-world (`ch1_first_oath`: the oath binds roads before paths cross, so a chosen companion can still meet you "as a stranger"). Story loans never add a copy; banners follow story appearance; no story is gated by gacha.
- **Convention to record:** story recruits leave the story party (Brin 2-1, Nixie after 2-5/Ch3, Jori 4-5) but stay deployable. Signature weapons that are unique heirlooms (House Veyr's bell, Mahmut's sword) are pullable in the Hall of Armaments; the in-world meaning of duplicates is undefined.
- **Economy tie-ins:** Inn Meal (12-hour Ration) justified by the Red Harvest Supper; `sun_eclipse_token` ↔ Sun-Eclipse Day; memory shards; Hall of Ancestors tagline echoes the First Oath.
- **Curse never penalizes the player;** Aether Ward is boss-only, not a seventh element.
- **Elements** (Ember, Tide, Gale, Stone, Dawn, Veil; Veil = plum/silver) are the in-world **Six Manners** of spending an hour: Ember burns, Gale carries, Stone holds, Tide returns, Dawn witnesses, Veil hides; Dawn↔Veil is witnessing against hiding (C31, `lore/elements.md`). Enemy kinds: `lore/bestiary.md`; faction IDs: `lore/factions/_registry.md`.

---

## 14. Major Future Setup Already Present

The letter (Part II opening) · Mahmut's "one hour" (planned link: the hour he chose to disobey) · Clockless Court (upward ash; children's story) · Cael's offer vs Kera's formula vs Vespera's warning vs Jori's key — four competing answers · Silent Bell + Pippa's charm + the capital · the Council's impostor decree and the court scribe still in the capital · Mirel's recantation · Aveline's book of offerings (seven previous bearers) · Oren (and Nara's refusal to guess) · Yseldra's guilt and her warning against Cael (planned in lore only: her gentleness toward Nixie) · the Construct's "HOUR STILL OWED" · the Unwritten Hour needs "enough paid hours" to be rewritten · Thistle's winter seeds (someone else sees the spring) · Marek's "WHO GAVE THE ORDER?" · Part II title *The Hours We Have Left*.
