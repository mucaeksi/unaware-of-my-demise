# Unaware of My Demise — UI Visual Constitution v001

**Project:** Unaware of My Demise  
**Part:** Part I — Unaware, I Fade  
**Studio:** SovTaym Studios  
**Status:** Production foundation / approval candidate  
**Engine target:** Godot 4.7.2 Standard  
**Platform:** Android, portrait-only  
**Base design canvas:** 1080 × 1920  
**Visual authority:** the owner-supplied Gothic dark-fantasy + detailed anime/light-novel poster.  
**Functional authority:** current screen map/spec/registry and existing runtime behavior.  
**Supersedes visually:** prior rejected UI/emblem/chibi art and the old draft visual tokens. It does **not** rewrite mechanics, economy, story gates, screen behavior, or runtime data.

---

## 1. Core Principle

The interface must feel built from the same world as the character art without competing with it.

The poster gives the UI six permanent behaviors:

1. **Near-black value structure** rather than bright game-panel chrome.
2. **Bone/ivory text and focal shapes** against charcoal surfaces.
3. **Controlled oxblood / eclipse-crimson emphasis**, never a full-screen red theme.
4. **Selective warm rim / ember light** against a colder surrounding field.
5. **Matte cloth, worn stone, aged iron/silver and restrained engraved ornament** rather than glossy plastic.
6. **Clear mobile hierarchy first; ornament second.**

The interface must not become a generic cathedral UI. Gothic forms are used as structural punctuation, not wallpaper.

---

## 2. Canon vs. Interface Proposal

### Fixed
- Game visible UI text is English.
- Voice is Japanese.
- Portrait-only gameplay and menus.
- Standard party: 2 Front + 3 Rear.
- Existing mechanics, currency rules, pity/rates, unlocks, stage costs and server-authoritative results are not changed by design.
- VN and battle hide persistent bottom navigation.
- Loading, empty, error, offline, locked, disabled, success and confirmation states must exist where relevant.
- Approximate minimum touch target is 48 dp.
- Runtime text must not be baked into panel/button/character textures.

### UI proposal, not canon
- Exact decorative corner shapes.
- Exact panel material mix.
- Exact spacing tokens.
- Runtime font pair.
- Primary-button material treatment.
- Animation timings inside the ranges below.

These proposals become production rules only after visual approval.

---

## 3. Palette and Value System

The interface is intentionally darker than character faces and key artwork.

| Token | Hex | Role |
|---|---|---|
| `void_950` | `#090A0D` | deepest background / fade |
| `coal_900` | `#111318` | primary screen field |
| `charcoal_850` | `#191B20` | panel body |
| `ash_700` | `#34343A` | raised inactive surface |
| `iron_600` | `#555057` | disabled outline / secondary metal |
| `silver_400` | `#A6A2AA` | active metal detail |
| `bone_100` | `#E8DDCC` | primary text / high-value ornament |
| `parchment_250` | `#BCAA94` | secondary text |
| `oxblood_700` | `#5C2028` | primary action cloth / selected state |
| `eclipse_500` | `#AE3436` | critical focus accent, very limited |
| `ember_450` | `#B77A49` | ready/claim/warm living-world accent |
| `lilac_450` | `#8B759A` | Veil / Fadyme-associated accent, not global primary |
| `coldblue_550` | `#64727F` | cool ambience / neutral system information |

### Distribution rule
A typical screen should visually read approximately as:
- 70–80% near-black / charcoal
- 12–20% bone / gray information
- 3–7% warm or oxblood emphasis
- <3% strong saturated magical/state color

Strong red must be a focal event, not ambient wallpaper.

---

## 4. Typography

### Runtime display / section font
**Cinzel** — recommended weights: Medium / SemiBold.  
License: SIL Open Font License 1.1.  
Use for: large screen titles, chapter labels, modal titles, rare ceremonial labels.

### Runtime body / action font
**Source Sans 3** — recommended weights: Regular / Medium / SemiBold.  
License: SIL Open Font License 1.1.  
Use for: body copy, buttons, stats, numbers, settings, lists, error messages, subtitles.

### Wordmark
The final game wordmark is an art asset and may use a separately treated distressed serif. It must not force the entire runtime UI to use a distressed font.

### 1080 × 1920 reference sizes
- Hero / screen title: 72–88 px
- Section title: 48–58 px
- Large number: 46–56 px
- Body: 40–46 px
- Button: 42–46 px
- Caption / metadata: 32–36 px
- Minimum practical small label: 30–32 px after device testing

Large-text accessibility scales must reflow; they must not simply overflow fixed-height containers.

---

## 5. Layout Grid and Safe Area

### Base
- Design canvas: 1080 × 1920.
- Logical density reference: approximately 3× a 360 dp-wide layout.
- Side content inset: 48 px minimum in design mockups.
- Standard content gap: 24 / 36 / 48 / 72 px scale.
- Runtime top/bottom safe area is read from the device; mockups must not assume a fixed notch or navigation-bar size.

### Touch
- Minimum standard target: 144 × 144 design px ≈ 48 dp.
- Small icons may render visually smaller inside the 144 px hit region.
- Destructive / irreversible actions require explicit labels and confirmation where specified by runtime behavior.

### Vertical hierarchy
1. Safe-area header
2. Screen title / context row
3. Primary content / artwork
4. Context action area
5. Persistent navigation only on hub/menu screens

VN and battle remove the global bottom navigation.

---

## 6. Shape Language

### Primary geometry
- Tall arches and vertical cuts are reserved for major frames.
- Small cards use clipped/notched corners rather than miniature cathedral windows.
- Curves are rare; circles are used for portraits, meters and ritual/focus motifs.
- Thorn geometry appears only where meaning supports it.

### Ornament density
- **Tier A — Hero:** title screen, chapter hero, summon banner, major character card. High ornament.
- **Tier B — Standard:** modal, companion card, stage card. Medium ornament.
- **Tier C — Utility:** settings row, inventory line, error notice. Minimal ornament.
- Text zones remain visually quiet.

---

## 7. Material Language

### Stone / charcoal
Use for large neutral panel bodies. Matte, low-frequency texture only.

### Cloth / oxblood
Use for selected tabs, primary CTA inserts, ceremonial labels and limited banners. Directional folds or weave may be implied, but never under small body text.

### Aged silver / iron
Use for frame edges, icon strokes and small highlights. Specular response is selective, not chrome.

### Bone / parchment
Use as high-value text and occasional inset surfaces. Do not make full screens parchment-white.

### Glass
Reserved for alchemy/time/Veil-specific content or rare overlays. It is not the default UI surface.

---

## 8. Core Component Families

### Panel
Variants:
- `panel_standard`
- `panel_hero`
- `panel_modal`
- `panel_sheet`
- `panel_tooltip`

All production panels should be 9-slice compatible where possible.

### Button
Variants:
- `button_primary` — oxblood cloth insert + aged-silver/bone structure
- `button_secondary` — charcoal body + silver edge
- `button_tertiary` — text/icon action, minimal frame
- `button_destructive` — not merely a recolored primary; warning icon + explicit destructive copy

States:
- idle
- focus
- pressed
- disabled
- loading
- success
- error

### Navigation
Persistent five-slot bottom navigation exists only where the current screen map requires it. Selected state uses shape + value + accent, not color alone.

### Cards
Character, stage, quest, item and record cards share:
- common padding rhythm
- title baseline
- status zone
- optional portrait/art zone
- separate selection/rarity/status overlays

Rarity must not be permanently baked into character artwork.

---

## 9. State Semantics

Color is never the only carrier.

| State | Visual language |
|---|---|
| Loading | stable layout + restrained rotating/oscillating mark |
| Empty | quiet panel + reason + valid next action |
| Locked | closed shape / seal + spoiler-safe copy |
| Disabled | lower value, reduced metal response, no false glow |
| Ready | warm ember pip / edge + action verb |
| Pending | progress mark + locked repeated action |
| Success | check/seal shape + stable confirmation |
| Error | broken/interrupt shape + explicit message |
| Offline | disconnected chain / split link metaphor + retry |
| Focus | bone/silver outer trace + small oxblood locator |
| Selected | filled structural change + accent; never color-only |

---

## 10. Icon Grammar

Global icons must be recognizable in monochrome before color is added.

Stroke and silhouette rules:
- one dominant outer silhouette
- one secondary internal motif
- no micro-filigree below small-size readability threshold
- consistent optical weight
- square master canvas
- padding normalized after visual testing

### Six elements — shape-first direction
- **Ember:** split upward flame / consumed hour
- **Gale:** carried arc / directional vane
- **Stone:** closed weight / anchored arch
- **Tide:** returning wave / loop
- **Dawn:** witness ray / open star
- **Veil:** occluded crescent / layered eclipse

These are icon-design directions, not new lore facts.

---

## 11. Motion

- Standard transition: 160–220 ms.
- Large modal/sheet: 200–280 ms.
- Press feedback: 70–110 ms.
- Success accent may use one short warm glint.
- No perpetual decorative animation on every card.
- Reduced Motion removes parallax, drifting particles and ornamental shimmer while retaining necessary state feedback.
- Main theme / music is owner-provided and remains outside this art task.

---

## 12. Android / Godot Production Rules

### Runtime assets
- Character portraits: transparent PNG.
- Icons: transparent PNG and/or SVG only where Godot import quality is verified.
- Reusable frames/buttons: separated components, preferably 9-slice-capable.
- Backgrounds and foreground decorations are separate from interactive Controls.
- Text remains runtime text.

### Godot control strategy
- `Control` hierarchy handles layout and safe area.
- `NinePatchRect` or `StyleBoxTexture` for scalable ornamental frames.
- `TextureButton` / themed `Button` only when accessibility and states remain explicit.
- Focus and Android Back behavior are screen-level requirements, not cosmetic additions.
- UI should be tested at 1080×1920 plus smaller/taller Android aspect ratios before cast-wide production.

---

## 13. Screen-Level Art Density

### Entry / patch
Lowest decorative density. Brand + state clarity first.

### Hub
Environment is visually dominant; UI floats above it with strong separation and restrained framing.

### Journey
Chapter artwork + route hierarchy; locked/current/clear differentiated by silhouette and text as well as value.

### Formation
High information density, low ornament density.

### Battle
Maximum readability. Effects cannot obscure HP, Focus, target, status or telegraph information.

### Companions / character
Character art may dominate; stats and actions sit in calm material zones.

### Summon
High ceremonial density, but rates/cost/pity/guarantee stay plainly readable.

### Records / VN
Narrative atmosphere may rise, but text remains the highest usability priority.

---

## 14. Production QA Gate

A UI package cannot be marked final until:
- 1080×1920 composition passes.
- smaller Android viewport passes.
- tall/cutout viewport passes.
- 48 dp targets pass.
- body copy and long English labels pass.
- large-text reflow passes.
- focus/Back/modal behavior is specified.
- locked/disabled/loading/error/success states are present where required.
- color-blind / grayscale meaning survives by shape and value.
- runtime text is not baked into reusable textures.
- no unverified economy, stage reward, shop, guild/PvP, or other unsupported system appears.
- the component reads as part of the same visual world as the approved Fadyme pilot and reference poster.

---

## 15. Next Production Package

After this constitution is approved, build **UI Component Kit v001** in this order:

1. Standard / hero / modal / sheet panel frames
2. Primary / secondary / tertiary / destructive buttons with states
3. Header / back row
4. Five-slot navigation shell
5. Tabs and segmented controls
6. Character / stage / quest / item card shells
7. Status badges and notification pip
8. Loading / empty / locked / error / offline / success surfaces
9. Element / rarity / status icon normalization
10. Godot 9-slice and theme metadata

Then apply the kit first to the core skeleton:
**Entry → Hub → Journey → Formation → Battle → Results**.
