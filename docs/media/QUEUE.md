# Media production queue — SOL-5

Status: **§4.1 Art-Direction Audit Completed (`2026-10-23`, `argon:art-director`)**. English text; every spoken line is Japanese (`ja-JP`, Chirp 3 HD). [QUEUE_DATA.json](QUEUE_DATA.json) contains the complete English prompts, source hashes, per-asset audit verdicts (`keep` / `fixed` / `regenerate`), runtime fixes, and `phone-landscape` (`1200×540 @ 2x`) texture-memory and frame-time measurements.

## §4.1 Art-Direction Pass Summary (2026-10-23)

- **Audited inventory (`content/approved_art/`, `content/base/`, `content/campaign/`, `branding/`, `store/`):**
  - `53 / 53` character & enemy 6×4 chibi sprite sheets (`1728×1152`, 13 occupied cells, 8 animation states, `foot_y = 0.938` / `maxY = 180`, 0 alpha-fringe pixels) → **`keep`**
  - `1 / 1` boss objective sheet (`atlas_objective.webp`) → **`fixed`** (upgraded from 4×4 `768×768` to 9×3 `1728×576` with 27 cells covering `intact`, `pulse`, and `broken` for all 9 objective families grounded at `foot_y = 0.96` / `maxY = 183`; stripped orphan border whiskers on `ankle_anchor` and `altar_pylon`; crafted distinct cleft/shattered `wax_seal_broken` and `altar_pylon_broken` cells; wired all 13 boss objectives to all 8 animation states in `tools/build_campaign.ts`)
  - `128 / 128` story portraits (`768×1344`, 32 characters × 4 emotions, 0 alpha-fringe pixels) → **`keep`**
  - `47 / 47` battle & story backgrounds (`1920×1080`) → **`keep`**
  - `11 / 11` narrative stills / CGs (`1920×1080`) → **`keep`**
  - `2 / 2` UI crests (`ui_title_crest`, `ui_eclipse_seal`), `96 / 96` icons (`256×256`), `10 / 10` gacha banners (`1600×720`), `17 / 17` store & brand masters → **`keep`**
  - **Queued for §4.3 (`regenerate` / new):** `cael` (Act V reveal antagonist — needs identity lock proposal, `unit_cael.webp` 6×4 sheet, and `portrait_cael_{neutral,confident,irritated,unmasked}.webp`).
- **Runtime animation & inspector fixes applied in §4.1:**
  - Fixed numbered sub-frame pivot lookup (`idle_2`, `idle_3`, `basic_2`, `active_2`, `ultimate_2`) in `apps/game/src/battle/UnitView.ts`, `apps/game/src/scenes/CharacterScene.ts`, and `apps/admin/src/pages/Animations.tsx` (`u.states[f] ?? u.states[f.replace(/_\d+$/, '')] ?? u.states[currentState]`), eliminating horizontal anchor drift during `walk` and `victory` loops.
  - Updated `apps/admin/src/pages/Animations.tsx` (`atlas_inspector`) so the sprite preview renders on a fixed `340×340` stage anchored at `(framePivotX, frameFootY)` on the ground shadow line.
- **Measured `phone-landscape` (`1200×540 @ 2x`) texture memory & frame time (budget: `< 300 MB`, `< 16.7 ms`):**
  - `title`: `23.58 MB` textures (`88.46 MB` total media), `avgStep = 0.23 ms`, `p95 = 1.0 ms`
  - `prologue`: `71.19 MB` textures (`117.70 MB` total media), `avgStep = 0.06 ms`, `p95 = 0.1 ms`
  - `story_t1`: `34.91 MB` textures (`113.41 MB` total media), `avgStep = 0.89 ms`, `p95 = 2.2 ms`
  - `story_t2_cg`: `42.82 MB` textures (`76.69 MB` total media), `avgStep = 0.54 ms`, `p95 = 2.0 ms`
  - `battle_t1`: `43.89 MB` textures (`76.12 MB` total media), `avgStep = 0.55 ms`, `p95 = 1.3 ms`
  - `battle_t3`: `53.62 MB` textures (`86.20 MB` total media), `avgStep = 2.44 ms`, `p95 = 0.9 ms`
  - `hub`: `7.91 MB` textures (`8.02 MB` total media), `avgStep = 0.21 ms`, `p95 = 0.7 ms`
  - `roster`: `7.91 MB` textures (`8.04 MB` total media), `avgStep = 1.24 ms`, `p95 = 0.8 ms`

## Source and canon controls

Read each linked character profile, `_visual_matrix.md`, `_voice_matrix.md`, runtime character/enemy snapshots and `narrative/00_Canon/README.md` before production. Current owner decisions and actual scenes outrank derivative catalogs. Use the sole owner poster style described in `VISUAL_REFERENCE_BRIEF_2026-10-05.md`; original poster file/hash is **UNKNOWN**. Preserve each character's own palette, age, props and face. All playable ages are 18 or older in the snapshot; chibi treatment remains practical.

`character_visuals_part1_LEGACY_STALE.json` must not become a source for the fifteen newer characters. Old assets, voice auditions and Fadyme production-v002 are reference/history only, not regenerated launch assets or instructions to use another engine/vendor. No character has a confirmed Chirp voice assignment in the shared audition README. A historical 12+ allure note is not the game's IARC rating.

Enemy design-v001 has **26 unapproved design candidates**, not 27 approved sheets. `boss_bell_widow` is **Yseldra**, whose separate character profile supplies the missing identity; Cael is a reveal antagonist, not a new Part I combat boss. Enemy English lore comes from the cards; silhouette/material interpretations remain proposals. New human faces/hair, review board geometry and target pixel sizes are not locked canon. Separate break-target overlays must retain source IDs and never add mechanics.

## Assets and prompt construction

For **every row**, schedule three portraits (`neutral`, `intent`, `vulnerable`), one four-view chibi design sheet and one full-body key art. These are **five separate single-image assets**, each with its complete prompt in QUEUE_DATA.json. For beings without human expressions, intent and vulnerability are pose/energy changes, not invented faces. Enemy portraits serve bestiary/intent UI; human story expressions remain tied to authored line emotions. This five-image baseline is proposed, not a claim that existing scenes require exactly three expressions.

Generate one identity portrait first; approve it and attach its SHA-256 as an identity reference for the other four. Keep fixed facial proportions/crop/lighting across portraits; no costume mutation. Expand Mahmut/Fadyme's portrait emotions to cover the current tutorial (`watchful`, `protective`, `dry_humor`, `composed`; `dry_amusement`, `soft_smile`, `determined`, `composed`) by curating or adding explicitly budgeted variants. Do not force four emotions into three images. Fadyme's bone-white lock is a **post-5-4** variant, never the opening base. Her maternal bell hairpin, broken-crown clasp and chain bell are three different props. Mahmut keeps the Guard star and empty crown socket. Nara has a compact kite shield.

Proposed masters: portrait 3:4 at 1K; turnaround 4:3 at 2K; key art 3:4 at 2K. Exported transparent sprites, pivots, safe margins, atlas sizing, pose/frame counts and actual Android on-screen sizes require Claude's runtime contract before animation production. A review sheet is neither a packed sprite atlas nor Spine/Live2D rig. Export alpha locally after approval; do not promise alpha from a generated opaque board. Check full equipment visibility, no clipped weapons, left/right consistency and silhouette distinction at actual battle size.

## Budget and production gates

Repository guard: `content/budget/media_budget.json`, `packages/shared/src/budget.ts`, `tools/media_budget.ts`, `tools/gen_image.ts`. Current limit is **1000 TRY/month**, recorded as **$20/calendar month UTC**, **$3/reservation**, **3 paid attempts per asset**. The USD guard does not enforce exchange rate or taxes; before spending, recheck actual TRY cost and remaining monthly reservations. Existing `entries: []` is a source snapshot, not a billing-account audit. Include all art/music/voice/video/SFX spending in the same ledger.

Use Google Gemini image models only. Repository price assumptions (2026-10-11): `gemini-3.1-flash-image` 1K $0.067, 2K $0.101; reverify current provider model availability, API shape and price before production. A standard row costs `3 × .067 + 2 × .101 = $0.403` for one candidate each. **47 rows × $0.403 = $18.941** before emotion expansions, retries, reference sheets, dialogue, music or cinematics. Thus the whole queue cannot safely be funded in one $20 month with audio/video. Three attempts on all assets would be $56.823. Stage work over months or obtain a reviewed owner budget change; do not lower quality or bypass the guard silently.

Recommended first slice: Mahmut, Fadyme, Bellbound Dead, Hollow Pilgrim = $1.612 at the above assumptions. Prepare specs under Claude-owned `art_specs/` only through handoff. Single candidate (`count: 1`), stable asset ID such as `fadyme_portrait_neutral`, exact reference hashes and full prompt; use dry-run first. **Persist a successful reservation before each paid request, then settle actual cost**. A failed/ambiguous paid request is not automatically free; keep reservation until reconciled. Code excludes cancelled entries from attempt counts, so never cancel a paid failed attempt to evade the limit. A new prompt/revision must not silently reset the same asset's cap; after three attempts, inspect/revise and request the review required by the guard. No parallel writers to the JSON budget ledger.

## Scheduling and Japanese audio

1. **P0:** opening/tutorial Mahmut + Fadyme, Bellbound Dead + Hollow Pilgrim; their minimum approved identity, expressions and battle silhouettes first. Source: current opening/tutorial scripts and `Runtime_Snapshot/game/data/entry/tutorial_v001.json`. T-1/T-2/T-3 enemies must be reconciled with Claude's signed-content IDs; base `content/base` currently exposes only t1, with t2 in a patch.
2. **P1:** first chapter's remaining enemies and recruitment cast Brin/Nixie; Kera for the next earliest playable/content slice. Priority is a proposal, not an invented unlock node. Confirm exact recruit timing before a paid batch.
3. **P2 onward:** Jori and chapter-ordered enemy/boss groups, then banner/full roster art. P3 playable ordering uses approved banner rotation Aveline → Sable → Nara → Mirel → Vespera when those launches are scheduled; other gacha cast follows actual content demand. Enemy labels follow first design chapter, not guaranteed release dates.
4. Key art, optional emotion expansions, later story states and promotional compositions follow working tutorial assets. Do not generate every row merely because it is listed.

For Japanese dialogue, bind **canonical `line_id` → unchanged English subtitle → reviewed Japanese performance transcript → approved `ja-JP-Chirp3-HD-*` voice ID**. Adapt sentence rhythm from each character's voice matrix without inventing speeches or changing facts; proper-name readings, voice assignments and director approval are UNKNOWN. Keep `emotion`, scene ID, language, duration, provider/model, transcript hash, reference hashes and recording version in provenance. Historical 30-voice auditions are not assignments; the old 241-line Fadyme batch is not a new production authorization. Narration also needs a Japanese voice decision if spoken. Enemies get no invented dialogue; vocalizations need an approved Google workflow.

BGM uses approved Lyria 3.5, speech Chirp 3 HD, cinematics Veo 3.1 Lite only after actual endpoint/silent-output support and price are verified. SFX workflow is UNKNOWN. No voice/music/video cost is fabricated from image pricing. Audio QA: intelligible Japanese, transcript/subtitle alignment, peak/clipping, loudness, silence boundaries, loop seams where relevant, mono/stereo/sample rates and actual Android decode/playback. Archive originals and keep curated exports distinct.

## Entity queue and identity locks

All prompts below inherit the global style and asset forms above; fully expanded copies are in QUEUE_DATA.json. Every row includes all five baseline assets. P0/P1 prioritization is explicit; later paid order requires actual release demand.


### Playable roster

#### P0 · `mahmut` — Mahmut

Source: `narrative/06_Characters/Playable/mahmut.md`; age 28; acquisition `free_start`.

**Identity prompt:** Tall adult; dark messy hair, brown eyes, stubble, worn repaired dark half-plate, tattered oxblood cloak. Crown Guard star remains on breastplate with crown hammered off and empty socket. Repaired heater shield; arming sword with iron-filled crest socket.

**Japanese performance:** Short, plain; humor Dry; stress Quieter; silence Anger. Preserve the canonical prohibition: "That is an order.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P0 · `fadyme` — Fadyme

Source: `narrative/06_Characters/Playable/fadyme.md`; age 22; acquisition `free_start`.

**Identity prompt:** Adult woman; pale ash-blonde hair, violet eyes, deep plum hood, black dress with fading silver-lilac embroidery, high white scarf. Broken crown fragment at hood clasp; separate tiny maternal silver bell-shaped hairpin. Silver House Veyr bell on chain with motionless silver-thorn clapper. No bone-white lock before 5-4; no bloody scarf in tutorial.

**Japanese performance:** Exact, courteous; humor Dark, wry; stress Shorter; silence Hiding. Preserve the canonical prohibition: "Save me.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P1 · `kera_voss` — Kera Voss

Source: `narrative/06_Characters/Playable/kera_voss.md`; age 20; acquisition `gacha`.

**Identity prompt:** Wide witch-brim hat with goggles, ash-silver hair from an explosion, ember orange and dark brown clothing; brass mortar and vials. Distinguish from Nixie by closed witch-hat silhouette.

**Japanese performance:** Fast, technical; humor Insulting lists; stress Louder; silence Guilt. Preserve the canonical prohibition: "I don't know" (without "yet"). Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P1 · `brin_alder` — Brin Alder

Source: `narrative/06_Characters/Playable/brin_alder.md`; age 23; acquisition `free_story_recruit_and_banner`.

**Identity prompt:** Sturdy guard with fur collar, long brown braid; pine green, iron and cream; hand axe and round buckler. Weight planted firmly, practical village equipment.

**Japanese performance:** Few words; humor Rare, warm; stress Practical; silence Holding on. Preserve the canonical prohibition: "Someone else will do it.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P1 · `nixie_vale` — Nixie Vale

Source: `narrative/06_Characters/Playable/nixie_vale.md`; age 19; acquisition `free_story_recruit_and_banner`.

**Identity prompt:** Loose hood and tall laced boots, light-brown hair, amber eyes, open grin; teal and ochre; shortbow. Scout mobility, no witch hat or silver hair.

**Japanese performance:** Breathless; humor Genki; stress Flat, serious; silence Scouting. Preserve the canonical prohibition: "I belong to…". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `sister_aveline` — Sister Aveline

Source: `narrative/06_Characters/Playable/sister_aveline.md`; age 26; acquisition `limited_banner`.

**Identity prompt:** Copper-auburn cropped hair, brown eyes, freckles, dove-grey veil; ivory-grey habit and armored field apron, bandage satchel, opaque collar. Dawn-gold sun-disc reliquary lantern staff; no generic modern cross.

**Japanese performance:** Warm, then crisp; humor Gentle; stress Prayer-precise; silence Grief. Preserve the canonical prohibition: "It is God's will.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `sable_wren` — Sable Wren

Source: `narrative/06_Characters/Playable/sable_wren.md`; age 21; acquisition `limited_banner`.

**Identity prompt:** Black bob with one long side lock, pale-grey eyes; charcoal mouth cowl, ink-blue leather, opaque fitted high-neck bodice and cropped off-shoulder jacket; broken courier wax seals, twin daggers and cut bell rope. Adult knowing gaze in portrait only; chibi stays practical.

**Japanese performance:** Whisper, minimal; humor Deadpan; stress Commands; silence Work. Preserve the canonical prohibition: Names indoors. Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `tilda_fen` — Tilda Fen

Source: `narrative/06_Characters/Playable/tilda_fen.md`; age 24; acquisition `gacha`.

**Identity prompt:** Tan skin, freckles, short dark curls, sea-green kerchief; hooded oilcloth cape, rolled sleeves, herb pouches; sea-green, sand and driftwood; reed staff with sea-glass vials.

**Japanese performance:** Blunt; humor Sarcastic; stress Triage; silence Exhaustion. Preserve the canonical prohibition: "It will be fine.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `rikka_ember` — Rikka Ember

Source: `narrative/06_Characters/Playable/rikka_ember.md`; age 18; acquisition `gacha`.

**Identity prompt:** Bright-red thick twin braids, soot cheeks, wide grin; closed red lamellar festival armor and gold cords; ember red, brick and festival gold; spear with bell tassel. No Kera-orange dominant outfit.

**Japanese performance:** Exclamations; humor Boastful; stress Steady breath; silence Danger. Preserve the canonical prohibition: "Be quiet.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `mirel_quill` — Mirel Quill

Source: `narrative/06_Characters/Playable/mirel_quill.md`; age 25; acquisition `limited_banner`.

**Identity prompt:** Petite adult, severe black bun with two brass styluses, round brass glasses, ink-stained fingers; bottle-green long-sleeved opaque square-neck dress, leather document satchel, signet ring; astrolabe folio and stylus dagger.

**Japanese performance:** Precise, footnoted; humor Wry; stress Formal; silence Shame. Preserve the canonical prohibition: "It doesn't matter what it says.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `odelia_pike` — Odelia Pike

Source: `narrative/06_Characters/Playable/odelia_pike.md`; age 22; acquisition `gacha`.

**Identity prompt:** Sun-browned tracker, short salt-stiff dark-brown hair, red knit cap; grey-blue wool jacket with rope toggles; net-knotted arrows, waterproof longbow case; harbor grey-blue, rope tan and red cap.

**Japanese performance:** Hesitant → certain; humor Awkward; stress Calls targets; silence Tracking. Preserve the canonical prohibition: "Let it go.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `pippa_bell` — Pippa Bell

Source: `narrative/06_Characters/Playable/pippa_bell.md`; age 20; acquisition `gacha`.

**Identity prompt:** Rose-pink curls, crooked feather cap, patchwork road jacket made with old concert posters; rose, cream and mustard; lute sling and wrist bell charm. Adult road musician.

**Japanese performance:** Sing-song; humor Rhymes; stress Stops joking; silence Fear. Preserve the canonical prohibition: "Nobody will remember.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `nara_vell` — Nara Vell

Source: `narrative/06_Characters/Playable/nara_vell.md`; age 27; acquisition `limited_banner`.

**Identity prompt:** Petite heavily armored adult, deep brown skin, cropped black hair with shaved sides; stone-grey plate and family crest on knee guards; compact kite shield and glaive, stone/slate/moss-copper. Never a round tower shield.

**Japanese performance:** Measured, numeric; humor Understated; stress Timings; silence Guarding. Preserve the canonical prohibition: "Run.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `clem_marr` — Clem Marr

Source: `narrative/06_Characters/Playable/clem_marr.md`; age 19; acquisition `standard_banner_pool`.

**Identity prompt:** Petite adult with round face, messy mouse-brown bob and chalk dust; heather-grey work jacket, mustard scarf, chalk brushes in pockets; ritual lantern with symbol cut-outs. Quiet macabre curiosity without gore.

**Japanese performance:** Curious, macabre; humor Grave jokes; stress Blunt; silence Conscience. Preserve the canonical prohibition: "Forget it.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `vespera_wisp` — Vespera Wisp

Source: `narrative/06_Characters/Playable/vespera_wisp.md`; age 23; acquisition `limited_banner`.

**Identity prompt:** Long midnight-blue hair with exactly one frost-white streak; pale tired blue eyes, very still adult posture; high-collared closed robe, glass-bead hem, closed gloves; glass lantern and focus ring, pale spirit flame; midnight blue/glass teal/candle gold.

**Japanese performance:** Slow, imagistic; humor Rare; stress Ancient cadence; silence Distance. Preserve the canonical prohibition: "There is plenty of time.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `hana_birch` — Hana Birch

Source: `narrative/06_Characters/Playable/hana_birch.md`; age 18; acquisition `standard_banner_pool`.

**Identity prompt:** Petite adult with short honey-brown hair and birch-white bandana; quilted rust-brown coat with shield plate above knee, rope coils and small bear trap; hatchet; rust/birch white/moss.

**Japanese performance:** Hesitant; humor Almost none; stress Firm; silence Shyness. Preserve the canonical prohibition: "It's not my business.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `thistle_roe` — Thistle Roe

Source: `narrative/06_Characters/Playable/thistle_roe.md`; age 21; acquisition `gacha`.

**Identity prompt:** Chestnut low double buns, wide straw hat, thick wool gloves, earth-stained apron over sage dress; seed tins and thorn crook; sage/straw/earth brown. No pale or silver hair.

**Japanese performance:** Soft, stammer; humor Botanical; stress Stammer vanishes; silence Tending. Preserve the canonical prohibition: "Nothing will grow here.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `iona_mist` — Iona Mist

Source: `narrative/06_Characters/Playable/iona_mist.md`; age 24; acquisition `gacha`.

**Identity prompt:** Olive skin, long straight black hair with river-blue sheen; deep navy oilskin raincoat with hood down; glass river lantern staff with tidal censer and blue mist; navy/lantern amber/fog grey.

**Japanese performance:** Calm, analytic; humor Gentle; stress Direct; silence Listening. Preserve the canonical prohibition: "They are gone.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P2 · `jori_flint` — Jori Flint

Source: `narrative/06_Characters/Playable/jori_flint.md`; age 20; acquisition `free_story_recruit`.

**Identity prompt:** Petite adult with short ginger hair tied with leather, soot on nose, forearm burn freckles; thick leather apron and arm guards; round short shield and small hammer; soot black/iron/copper.

**Japanese performance:** Blunt commands; humor Grumbling; stress Angry; silence Shame. Preserve the canonical prohibition: "It's just a job.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

#### P3 · `marek_vane` — Marek Vane

Source: `narrative/06_Characters/Playable/marek_vane.md`; age 30; acquisition `gacha`.

**Identity prompt:** Tall adult with tied long dark-brown hair, short beard, calm grey eyes; long road cloak and closed dark-leather coat; viola on back and spear-horn with pennant removed; road brown/faded blue/brass.

**Japanese performance:** Rhythmic tenor; humor Aphorisms; stress Counts beats; silence Memory. Preserve the canonical prohibition: "By order of the Council.". Voice ID UNKNOWN.

**Generate:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art.

### Enemies

#### P1 · `ash_wolf` — Ash Wolf

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 1; role `flanker`.

**Canonical anchor:** Wolves that ate from bell-ash in the Whispering Forest. They hunt whoever walks apart from the pack.

**Candidate identity prompt:** Low agile ash-coated smoke-grey wolf; long wedge body, pointed muzzle and trailing tail; small amber chest cracks. No collar, human weapon, horns, or Ash-Maw-sized jaw.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P0 · `bellbound_dead` — Bellbound Dead

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 1; role `swarm`.

**Canonical anchor:** Hollows wired to a bell by their own chains. Alone they are weak; the bell never sends one alone.

**Candidate identity prompt:** Slumped thin hollow with long hanging arms, charcoal cloth, dirty bone and cold brass; chest bell and its own chains linking chest to wrists. Preserve tutorial identity, no heavy knight armor.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P5 · `bridge_revenant` — Bridge Revenant

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 5; role `spectral_guard`.

**Canonical anchor:** A drowned sentry of the old span. It still hooks anyone who stands at the front, as if the gate had never fallen.

**Candidate identity prompt:** Drowned old bridge sentry hunched in wet lead armor and muddy ash cloth; rusted narrow helmet and one long hooked chain, large negative space. No Bellbound chest bell or living Oren soldier face.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P4 · `chain_cultist` — Chain Cultist

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 4; role `support`.

**Canonical anchor:** Chain-bearers of the First Eclipse. They pray to an eclipse that never moves and share one another's wounds.

**Candidate identity prompt:** Living First Eclipse chain-bearer, closed hood and knotted chest; spread chains form broad triangle, charcoal cloth and lead-grey with restrained violet. Links connect allies; no invented enemy-pull ability.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P2 · `choir_knight` — Choir Knight

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 2; role `elite_guard`.

**Canonical anchor:** Oath-armor of the Saint Luthos choir guard. It sings without breath and strikes back when a brother is struck.

**Candidate identity prompt:** Tall organ-pipe helmet, narrow symmetric dirty-ivory oath armor, oxidized brass and dim dawn gold, straight sword; empty helmet slit. No modern cross or Yseldra mask.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P5 · `corrupted_crown_guard` — Corrupted Crown Guard

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 5; role `elite_guard`.

**Canonical anchor:** Crown Guard soldiers still following Crown-era orders. The shield comes up before the signal strike, as it was drilled.

**Candidate identity prompt:** Living disciplined former Crown Guard; compact rectangle silhouette, large full shield and short spear; old slate steel, matte oxblood and dirty ivory with damaged crest. Not dead Royal Hollow or fully crest-stripped Crownless.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P3 · `corrupted_mercenary` — Corrupted Mercenary

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 3; role `bruiser`.

**Canonical anchor:** Hired blades of the Red Vial ledger wing, fed on red glass that makes them strong and careless.

**Candidate identity prompt:** Living broad-shouldered mercenary; heavy single axe, mismatched rusty armor and dark leather, limited oxblood and red-glass dose pocket. Not a skeleton or demon.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P6 · `crownless_knight` — Crownless Knight

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 7; role `elite_guard`.

**Canonical anchor:** A knight who stripped his own crest, not out of defiance but despair. It hates shields and ignores fear.

**Candidate identity prompt:** Living upright duelist, scraped empty crest area, slim two-handed sword and no shield; charcoal slate, ash ivory and bare scraped metal. Distinguish from dead Lost-Vow by living face and empty crest.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P6 · `eclipse_sentinel` — Eclipse Sentinel

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 7; role `warder`.

**Canonical anchor:** Warders of the First Eclipse who feed the altar's barrier through its pylons.

**Candidate identity prompt:** Living upright First Eclipse warder with broad shoulder mantle; charcoal stone-like cloth, dirty brass and limited veil violet; small pylon-shaped staff/key is candidate. Not robot, no Cael watch/scales.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P6 · `estate_wraith` — Estate Wraith

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 6; role `spectral_caster`.

**Canonical anchor:** A noble shade of the Ashen estate. Having lost its name, it borrows the strongest protection it can see.

**Candidate identity prompt:** Sliding thin noble shade with fading skirt and small broken oval portrait frame; ash-grey noble cloth, dirty gold and cool glass teal. No invented identity or repeated Ashen Lord face.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P4 · `glass_viper` — Glass Viper

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 4; role `assassin`.

**Canonical anchor:** A glass-scaled serpent bred in the Red Vial cisterns. Fast, fragile, and never sold to anyone who asked what it was for.

**Candidate identity prompt:** Natural slender S-curved serpent with small pointed head; fragile glass scales, dirty translucent blue-grey, cold tidal light and slight red sediment. No cobra wings, humanoid torso or dragon anatomy.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P2 · `hollow_cleric` — Hollow Cleric

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 2; role `ranged_caster`.

**Canonical anchor:** A grave scribe that still keeps its ledger. It mends its own and curses whoever looks weakest.

**Candidate identity prompt:** Bent long ash-ivory robe, dark ink and matte purple-grey; open ledger as large horizontal anchor, thin bone-like fingers and candle traces. Separate mend and curse poses; no invented summons.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P0 · `hollow_pilgrim` — Hollow Pilgrim

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 1; role `slow_vanguard`.

**Canonical anchor:** A pilgrim whose hours ran out on the road but whose feet did not. Slow, stubborn, heavy.

**Candidate identity prompt:** Heavy hunched pilgrim under coarse ash-beige hood, face in shadow; worn brown-leather pack and one thick planted walking staff. Not a floating ghost or fast assassin.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P2 · `inkbound_dead` — Inkbound Dead

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 2; role `ranged_caster`.

**Canonical anchor:** A corpse wrapped in erased records. The ink it bleeds marks the living for the dead.

**Candidate identity prompt:** Corpse wrapped in erased parchment records, asymmetric strips hanging from one arm; dirty parchment, matte ink black and cool grey. No legible spoiler text or Estate Wraith portrait frame.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P5 · `lost_vow_knight` — Lost-Vow Knight

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 5; role `elite_duelist`.

**Canonical anchor:** A dead knight of a broken order. It punishes every shield it sees, because its own failed.

**Candidate identity prompt:** Dead knight of broken order in torn oath cloak; two-handed broad sword and broken former shield fragment at belt; ash steel, faded ivory and stone grey. Fragment is not an active blocking shield.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P6 · `noble_retainer` — Noble Retainer

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 6; role `support_guard`.

**Canonical anchor:** The ghost of a household attendant. It still steps in front of the most wounded master.

**Candidate identity prompt:** Dead household attendant bowing low with arms outspread and broad serving cloth; old matte ivory and charcoal coat with slight cold teal. Tray is a visual candidate only, not a weapon.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P3 · `orchard_ghoul` — Orchard Ghoul

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 3; role `bruiser`.

**Canonical anchor:** The Oakhaven dead, bloated from the red harvest. The more it feeds, the harder it becomes to cut.

**Candidate identity prompt:** Bloated pear-shaped dead orchard worker, small bowed head, broad muddy feet; pale ash skin, harvest oxblood and earth brown; torn work apron and harvest-sack scraps. No exposed gore or tree-monster anatomy.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P4 · `red_vial_alchemist` — Red Vial Alchemist

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 4; role `ranged_caster`.

**Canonical anchor:** A ledger-wing bomber. Break the flask rack and the formula breaks with it.

**Candidate identity prompt:** Living ledger-wing bomber; wide tool apron and distinct left/right flask-rack silhouettes, throwing hand readable; charcoal leather, dirty teal glass and amber. Half respirator is candidate only; no Kera witch hat.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P3 · `red_vial_scout` — Red Vial Scout

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 3; role `flanker`.

**Canonical anchor:** A Guild courier with a poison dart and a route-marking shot. It reports to whoever pays in seals.

**Candidate identity prompt:** Living lean Guild courier angled forward; short charcoal cape, faded leather, small dart crossbow, route cylinder, a few red vials. No Kera costume or invisibility effects.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P6 · `royal_hollow` — Royal Hollow

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 7; role `armored_vanguard`.

**Canonical anchor:** A palace guard still standing at a post that no longer exists. It blocks one blow each round, as it always did.

**Candidate identity prompt:** Dead palace guard at vanished post; very broad rigid shield, tall empty helmet, ash steel, faded ivory tabard and darkened gold; breathless frozen discipline. Not living Corrupted Crown Guard or seated king.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P1 · `boss_ash_maw` — The Ash-Maw

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 1; role `beast_boss`.

**Canonical anchor:** A wolf carcass fused with a shard of the Whispering Bell. Not a wolf: what the bell left wearing one.

**Candidate identity prompt:** Great low four-legged wolf carcass; deep chest, soot-black fur plates, ash-white cracks and amber throat; asymmetric broken lower jaw fused with Whispering Bell shard. Separate jaw_bell target; no second head or dragon horns.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P2 · `boss_bell_widow` — The Bell-Widow

Source: `narrative/06_Characters/Antagonists_NPCs/yseldra.md`; first design chapter 2; role `ritual_boss`.

**Canonical anchor:** Yseldra is the Bell Widow encounter, the same non-playable woman; no additional monster identity.

**Candidate identity prompt:** Adult Lady Yseldra Vale, 34, tall and straight-backed; opaque mourning veil over separate cracked bone-white half-mask, black-plum split surcoat over fitted mail, leather gloves with seven small bell-clapper rings. Seven gray wax seals cut through center and stamped seven-notched Inquisition mark; cracked brass handbell clapper tied with red thread. Black plum, ash ivory and cold brass. No skull motif; never seven red seals.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P3 · `boss_captain_rusk` — Captain Rusk

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 3; role `duelist_boss`.

**Canonical anchor:** A mercenary captain carrying an order sealed by someone the Crown buried years ago.

**Candidate identity prompt:** Living mercenary captain with long asymmetric cloak, slender long dueling blade and separate signal_banner; charcoal leather, old copper, matte oxblood, hard silver. Face/hair undecided; no royal Oren uniform or bell mask.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P4 · `boss_red_vial_matron` — The Red Vial Matron

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 4; role `alchemist_boss`.

**Canonical anchor:** Head of the Red Vial ledger wing. She believes the heir's blood is the last ingredient.

**Candidate identity prompt:** Adult living ledger-wing leader upright in broad work apron and charcoal coat, wine red, dirty teal glass and matte copper; ledger and two separate low flask racks. Face/hair unapproved; no pin-up or gore.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P5 · `boss_marshal_oren` — Marshal Oren

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 5; role `commander_boss`.

**Canonical anchor:** Mahmut's former commander. He signed the order; he did not know the rite would hollow her out.

**Candidate identity prompt:** Living mature former commander with heavy heater shield and long command sword; matte slate steel, oxblood cloak, worn ivory and limited old gold; inverted old Crown crest, separate signal_standard. Short grey hair is candidate, no demon or corpse face.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P6 · `boss_ashen_lord_wraith` — The Ashen Lord's Wraith

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 6; role `spectral_boss`.

**Canonical anchor:** The Ashen Lord, who once hid the bell-keeper's daughter from the Crown. He kept her face and lost her name.

**Candidate identity prompt:** Tall noble shade upper body, lower body fading into smoke; large rectangular mirror_frame separate from body, ash grey, tarnished gold and cool glass teal; portrait-like older noble. No skull, gore, personal-name spoiler or mirror merged into torso.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

#### P6 · `boss_eclipse_construct` — Eclipse Construct

Source: `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`; first design chapter 7; role `mythic_construct_boss`.

**Canonical anchor:** The hinge of the First Eclipse Altar, built around the Eclipse Bell. It is the instrument, not the author.

**Candidate identity prompt:** Great upright altar hinge mechanism around Eclipse Bell: charcoal stone, old bronze, ash ivory and small cold violet core; broken crown ring, two arms/two feet, external chain joints, separate ankle anchor and three separate altar pylons. Not a god or Cael body; no invented third phase.

**Generate after design approval:** neutral/intent/vulnerable portrait set; four-view chibi sheet; full-body key art. No new spoken lines.

## UNKNOWN / acceptance handoff

M01 original owner poster and usable approved identity-reference hashes; M02 enemy candidate approval and faces/hair; M03 final export/atlas/animation contract; M04 Japanese transcript/name readings and voice casting; M05 verified current Chirp/Veo/SFX prices and workflow; M06 exact expression demands and recruit/release nodes; M07 budget allocation across assets/audio and FX/tax margin. Claude owns production tools, signed-content integration, R2 publication and runtime/device checks; this queue changes none of those.

Planning acceptance: exact catalog ID set equality (20/27), five nonempty English asset prompts per entity, existing source paths, canonical adult ages, distinct identity anchors, tutorial-first order and checked budget arithmetic. Production acceptance remains separate: approved reference, reserved cost, Google provenance, canon review, duplicate/hash inspection, alpha/pivot exports, signed-manifest mapping and actual Android rendering/audio checks.
