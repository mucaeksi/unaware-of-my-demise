# UI v2 — Gemini prompts (owner runs, Claude-authored)

Design rules: [UI_V2_BRIEF](UI_V2_BRIEF.md) and [ART_BIBLE](../media/ART_BIBLE.md). Prompts never name a game, studio,
artist or franchise (ART_BIBLE §2); the references in the brief are principles for us, not words for the model.

## How to run

- Model: Gemini image generation (the project specs use `gemini-3.1-flash-image`), landscape **16:9**, highest size offered.
- Paste **STYLE BLOCK + one screen prompt** as a single message. Generate 3–4 variants per prompt.
- Attach the listed reference images when the prompt asks for them (Gemini app: add images to the message).
- Save results as `narrative/15_Art_Workbench/ui_v2/mockups/<id>_v001.png`, `_v002`, … and tell Claude which ids are done.
- Mockups may contain the short English labels written in the prompt; garbled text is fine at this stage (we only judge
  layout, mood and materials). Mockups are never shipped.

Reference files (repository paths):
- `REF-FADYME` = `content/base/art/portrait_fadyme_composed.webp` (identity, render style)
- `REF-MAHMUT` = `content/base/art/portrait_mahmut_watchful.webp` (identity, render style)
- `REF-KEYART` = `narrative/14_References/recovered_locked_v001/key_art/brand_key_art_portrait_r2_v003.png` (finish, palette)
- `REF-FOREST` = `content/base/art/bg_forest_whispering_ash.webp` (environment)
- `REF-CHIBI` = `content/base/art/atlas_fadyme.webp` (battle sprite proportions, B1 only)

## STYLE BLOCK (prepend to every prompt)

```
Design target for a premium dark gothic anime mobile RPG, landscape phone screen, polished final-quality UI mockup.
Visual language "The Bell Ledger": the interface is a pilgrim's chronicle carried through a cursed land under an
eclipsed sky — dark ink-black grounds, thin gilt hairline rules, cut-corner rectangular frames and sharp diagonal
slashes (no rounded pills, no bubbly shapes), wax-seal discs for the single primary action, small bell and thin
eclipse-ring motifs used sparingly, aged vellum only as accents on cards and headers, inked marginal notes.
Editorial layout: asymmetric composition, large confident serif capitals with wide letter-spacing for headings,
elegant italic serif for flavour lines, generous negative space, a clear grid, every number crisp and legible.
Cinematic, grim, quiet dignity; high contrast between near-black grounds and bone-ivory text.
Palette: void #0A0610, ink #120A18, plum #2A1530 and #4A2548, bone ivory #E9E2D4 for text, gilt #B8975A with
highlights #E3C37D, silver-lilac #C9B6E4 for ornament, one aggressive accent of crimson #8F1D3A / #D4325C used only
for the primary action seal, clash slashes and enemy marks, one warm candle amber #D9A441 light per screen.
Characters are painterly dark gothic anime light-novel illustrations: thin soft plum-black linework, soft cel shading,
matte cloth, worn dull metal, visible brush grain. Adults only.
Avoid: neon, glow-heavy sci-fi panels, glossy plastic, 3D render look, rounded mobile-game bubbles, rainbow rarity
colours, cartoon icons, cluttered HUD, red glowing eyes, crosses or angelic motifs, logos, watermarks.
```

## Screen mockups (stage 1 — approve one per screen before stage 2)

### `uiv2_home` — Home hub (attach REF-FADYME, REF-KEYART)
```
Screen: the main hub. Left 55% of the frame: Fadyme from the reference (adult woman, pale ash-blonde wavy hair, violet
eyes, raised deep plum hood with silver-lilac vine embroidery, white high scarf, black high-collar dress, a small silver
bell on a chain in one gloved hand) standing three-quarter, large, cropped at the thighs, in a dusk shelter courtyard
of old stone and timber with drifting ash; soft amber lantern rim light on her right side.
Right 40%: a vertical "ledger page" column on a near-black ground separated by a thin gilt hairline. Small spaced caps
header "THE COMPANY". Below, four numbered entries with roman numerals in crimson and gilt: "I  CHAPTERS" (largest,
with italic line "Campaign and star rewards" and a small crimson wax-seal button "CONTINUE"), "II  SUMMON",
"III  ROSTER", "IV  TEAM", each with a short italic subtitle, divided by hairline rules. Under them a single row of
small spaced-caps links: "ERRANDS · DEEDS · TRIALS · ARMORY · SHOP · MAIL".
Top-left: a slim dateline "PART I · UNAWARE, I FADE" with a thin crimson vertical rule. Top-right: a small currency
counter with a bell icon and "SIGN IN". Bottom-left: four small inked icons on a dark cut-corner plate: settings seal,
bell, book, crown. A faint giant roman numeral "I" watermark behind the ledger column.
```

### `uiv2_battle_wide` — 2.5D battle, wide shot (attach REF-FOREST, REF-FADYME, REF-MAHMUT)
```
Screen: a turn-based battle seen from a low three-quarter perspective camera, 2.5D: painted 2D characters standing
in a scene with strong depth — foreground fog and dead branches blurred at the bottom corners, a mid ground of cracked
stone road through an ashen dead forest, distant tree silhouettes and an eclipsed sky with a thin crimson ring.
Left side, nearer to camera: the party of two — Mahmut (tall weathered knight, dark messy hair, stubble, dark worn
half-plate with a star on the breastplate, tattered oxblood cloak, heater shield and arming sword) and Fadyme (as in
the reference, holding her silver bell). Right side, a little farther: two Bellbound Dead — slumped, thin hollow
undead with caved chests and long hanging arms, charcoal rags and dirty bone, each with a cold brass bell on its chest
held by its own chains that link chest and wrists; not armoured knights, no red glow. Characters are full-body, about
one third of the screen height, painterly anime style, grounded with soft contact shadows, readable silhouettes.
HUD on top, minimal and sharp: top-left a horizontal turn-order strip of small cut-corner portrait tiles; top-centre
"ROUND 2" in spaced caps; top-right three small square buttons "AUTO", "×2", "MENU". Thin hairline HP bars with
numbers under each unit. Bottom-right: three angular skill cards slanted slightly like playing cards, dark ink with
gilt edges, labels "VEILGLASS THORN" (basic), "BORROWED HOUR" (skill) and "THE BELL THAT FORGETS" (the ultimate, with
a crimson seal and a ring gauge "FOCUS 100"). Bottom-left: the active hero's name in large serif caps with a thin crimson slash behind it.
```

### `uiv2_battle_cutin` — counter close-up cut-in (attach REF-MAHMUT)
```
Screen: a cinematic close-up cut-in during battle, shown for under a second when a hero counter-attacks. The frame
is split by two sharp diagonal crimson slashes into angled panels: the left panel a tight close-up of Mahmut's face
and shoulder driving forward behind his heater shield, eyes narrowed; the right panel a close-up of a Bellbound Dead
(thin hollow undead in charcoal rags) as its wrist chain snaps taut and its cold brass chest bell tilts. Dust and ash
particles, a hard white-gold impact flash where the panels meet, speed lines rendered as thin ink strokes. Large
spaced serif caps along one slash: "COUNTER", and the damage number "-18" in bold gilt. Dark, grim, high contrast;
no blood.
```

### `uiv2_title` — title screen (attach REF-KEYART, REF-FADYME)
```
Screen: the title. Full-bleed key art: Fadyme and Mahmut seen from behind and in profile on a stone bridge under a
huge eclipse with a thin crimson ring, dark slate sky, distant mountains, drifting ash. Left third: the wordmark
"UNAWARE OF MY DEMISE" stacked in large bone-ivory serif capitals with a small bell emblem, and an italic line
"Part I · Unaware, I Fade". Centre bottom: "TAP TO BEGIN" in widely spaced caps between two thin gilt rules. Top-right:
two small text buttons "REPLAY INTRO" and "SETTINGS". Bottom-left: a slim crimson-sealed "SIGN IN" tab. Calm, sparse,
cinematic; at least half of the frame is quiet sky.
```

### `uiv2_roster_detail` — character detail (attach REF-MAHMUT)
```
Screen: a character detail page laid out like a dossier in a chronicle. Left 45%: Mahmut full figure, large, on a dark
ground with a faint parchment texture and inked marginal notes. Right 55%: a clean information grid on near-black:
name "MAHMUT" in large serif caps with "Stone · Tank-bruiser" in italic and five small gilt stars; a stat block with
four rows "STR 12", "INT 4", "VIT 16", "AGI 7" and derived "HP 52 · ATK 12 · DEF 9 · SPD 7" in crisp aligned figures;
three skill entries each with a small square inked icon, a name and a one-line italic description; a row of three gear
slots as cut-corner frames. Bottom-right: one crimson wax-seal button "LEVEL UP" and a secondary gilt outline button
"GEAR". Top-left tabs "PROFILE · SKILLS · STORY" with the active one underlined in crimson. Calm, readable, orderly.
```

### `uiv2_summon` — summon banner (attach REF-FADYME)
```
Screen: the summon banner. Full-bleed banner art on the left two thirds: Fadyme in a dark hall of ancestral statues
and stained glass in plum and silver, her bell raised, ash and candle light. A vertical crimson slash carries the
banner name "HALL OF ANCESTORS" in serif caps and an italic line "Standard banner". Right third on near-black: rates
line "5★ 2% · Pity 0 / 80" with a small "RATES" text link, the cost "160" with a small bell-coin icon, and two
buttons: gilt outline "SUMMON ×1" and crimson wax-seal "SUMMON ×10". Small "HISTORY" link. Bottom: three small banner tabs as
cut-corner thumbnails. Elegant, grave, not flashy; no rainbow light.
```

### `uiv2_story` — dialogue scene (attach REF-FADYME, REF-MAHMUT)
```
Screen: a story dialogue. Background: a dusk shelter courtyard, softly blurred. Fadyme on the left and Mahmut on the
right as large waist-up portraits; the speaker (Fadyme) bright, the listener dimmed. Bottom 26%: a dialogue plate of
dark ink with a thin gilt top rule and cut corners, a speaker tab "FADYME" in spaced caps with a crimson slash, and one
line of elegant serif text: "Beside it. Not behind you. I know the difference." Top-right: three small text buttons
"LOG", "AUTO", "SKIP". Quiet, intimate, melancholic.
```

## Chibi battle (owner decision 2026-10-25: battle units stay cute chibi, staged in 2.5D)

The in-engine B1 prototype (`BattleStage25DPrototype.cs`) already stages the current chibi atlases in depth, so B3 is a
refresh, not a new style.

### `uiv2_battle_wide_chibi` — target with chibi units (attach REF-CHIBI, REF-FOREST and `uiv2_battle_wide_v003.png`)
```
Screen: the same turn-based 2.5D battle layout and HUD as the attached battle mockup (turn-order strip, "ROUND 2",
AUTO / ×2 / MENU, HP bars with numbers above each unit, the active hero's name on a crimson slash, three slanted skill
cards bottom-right), but every unit is a cute chibi figure in the style of the attached chibi sheet: 3 to 3.5 heads
tall, large head, small hands and feet, adult facial features, bold uniform ink outline #120A18, flat two-tone cel
shading with one hard highlight. Left, nearer to the camera: Mahmut (dark half-plate with a star, tattered oxblood
cloak, heater shield, arming sword) and Fadyme (raised deep plum hood, white scarf, silver bell on a chain). Right, a
little farther: two Bellbound Dead (thin hooded undead in charcoal rags with cold brass chest bells on their own
chains). The chibis stand on the stone road of an ashen dead forest with strong depth: blurred foreground branches in
the bottom corners, mist, distant tree silhouettes, an eclipse with a thin crimson ring. Soft contact shadows under
every chibi; each chibi about 30% of the screen height in the foreground, smaller in the back row.
```

### 2.5D addendum for the chibi sprite sheets
Run the existing sheet prompts (`art_specs/p0/fadyme_chibi_sheet.json`, `mahmut`, `bellbound_dead`, `hollow_pilgrim`;
every ART_BIBLE §3.2 rule stays) with the unit's current shipped atlas (`content/base/art/atlas_<unit>.webp`) attached as
the cute chibi proportion/style reference and this paragraph appended, at native 2K (`size: "2K"`, the raw output sheet
must be ≥2400 px wide — never upscaled from 1K):
```
2.5D STAGING: these figures will stand in a depth-staged scene seen from a low three-quarter camera. Turn every body
about 30 degrees toward the viewer (three-quarter front view, never flat side view), keep the feet planted on one
flat ground line, and light every figure from the upper left with a soft cool key light and a thin warm amber rim on
the right edge, identical in all poses. Attack and ultimate poses lunge diagonally forward toward the viewer, not
only sideways. Still no ground shadow, no ring, no glow and no effects baked into the sprite.
```

## UI art kit (stage 2 — only after the stage-1 targets are approved; Claude will adjust these to the chosen targets)

Kit images are shipped assets: no text at all, flat `#00FF00` background where marked "keyed", per ART_BIBLE §3.0.

### `uiv2_kit_frames` — keyed, 16:9
```
A clean asset sheet on a flat pure #00FF00 chroma-key background, no text: nine UI frame pieces laid out in a 3×3
grid with wide green gaps: cut-corner rectangular panels in near-black ink #120A18 with thin gilt #B8975A hairline
borders and small notched corners; a header bar with a crimson #8F1D3A diagonal slash; a dialogue plate; a long
thin divider with a tiny bell in the centre; a card frame for a character; a square icon frame; a tab in active and
inactive states. Flat front view, crisp hard edges, subtle brush-grain texture inside the panels, no glow, no shadow
touching the background, no green on the pieces.
```

### `uiv2_kit_seals` — keyed, 1:1
```
A clean asset sheet on a flat pure #00FF00 chroma-key background, no text: wax seal discs for primary buttons in
crimson #8F1D3A with a pressed bell emblem, in four states laid out 2×2 with wide gaps: normal, pressed (flatter,
darker), disabled (desaturated grey-plum), highlighted (thin gilt rim). Matte wax with soft edges and a few drips,
crisp outer silhouette, no glow, no green on the seals.
```

### `uiv2_kit_vellum` — opaque, 1:1, tileable
```
A seamless tileable texture of dark aged vellum and ink: very dark plum-black base #120A18 with faint fibres, subtle
water stains and a few faded inked marginal strokes, low contrast, matte, no text, no symbols, no vignette, even
lighting edge to edge so it tiles without seams.
```

### `uiv2_stage_forest_layers` — 2.5D battle stage planes (attach REF-FOREST), one image per layer, 21:9
```
Layer <N> of a 2.5D battle stage for the ashen dead forest road, matching the reference environment's palette and
painted finish, front view, no characters, no text:
1 sky: dark slate overcast sky with a huge eclipse and a thin crimson ring, opaque.
2 far: distant dead tree silhouettes and mist on a flat pure #00FF00 background below the horizon line.
3 mid: cracked stone road and roadside ruins seen from a low three-quarter view, the road running to the horizon;
  the ground is opaque but EVERYTHING ABOVE THE HORIZON LINE is flat pure #00FF00 (no sky, no clouds, no mist above the
  horizon), so the sky and far layers show through. (The first run came out with its own sky and was rejected.)
4 foreground: dark blurred dead branches and fog wisps entering from the bottom-left and bottom-right corners only, on
  a flat pure #00FF00 background.
```
Run it four times, replacing `<N>` with 1–4 and keeping only that layer's line.
