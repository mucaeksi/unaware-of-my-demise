# Art Bible — Part I

## Chosen visual direction

Use a compact, readable 2D hybrid: high-quality painted anime bust illustrations for visual-novel scenes, and small chibi battle sprites with restrained frame counts for combat. This keeps the story emotionally expressive while keeping repeated battle assets lightweight on Android. It is a single art system, not a choice between pixel art and full-resolution animation.

Mood: medieval dark fantasy, rain-worn stone, old vellum, blackened iron, tarnished brass, candle smoke, cold moonlight and small warm hearths. Use a restrained palette so the thin crimson eclipse ring, the curse's black-gold lines and the brass eclipse motifs carry story meaning.

## Shape and material language

- Mahmut: square shield silhouette, broad shoulders, dark steel, weathered red cloth.
- Fadyme: narrow crown fragment, layered travel cloak, pale violet and silver, a thin visual motif of fading ink.
- Heroes: each sprite must read at a glance through weapon silhouette, head shape and one signature color.
- Enemies: asymmetry, cracked bells, wax seals, chain links, ash and damaged heraldry. Avoid gore as the default language.
- Backgrounds: hand-painted 2D plates with strong foreground/midground/background separation, mild parallax only where it adds depth.

## Portrait-first Android production targets

These are source targets for the art pack, not a promise about final installed size. Recompress and inspect on representative Android devices when engine integration begins.

**Orientation and reference canvas:** all game screens are portrait. The composition master is **1080×1920 px (9:16)** with a **360×640 dp** logical reference at 3× export scale. Respect Android status/navigation/camera insets; keep critical text and faces in the central 90% safe area. For taller 9:19.5 or 9:21 devices, extend background texture and anchor UI to safe insets—never crop faces, button labels or banner copy. Landscape images are allowed only where an external platform requires them, such as a store feature graphic.

| Asset | Source target | Runtime target | Notes |
|---|---:|---:|---|
| Screen/background plate | 1440×2560 | 1080×1920 WebP | One portrait master per chapter; VN/battle lighting variants may share the plate |
| VN character bust | 1024×1536 transparent | 640×960 WebP/PNG | Head, face and hands remain above dialogue; 3–5 expression swaps share one body |
| Chibi battle actor | 256×256 per frame | 128×128 rendered cell; 4×4 atlas = 1024×1024 | Idle, attack, hit, skill, guard, victory; 8–16 frames per unit |
| Boss illustration/cut-in | 1024×1536 transparent | 768×1152 WebP | Portrait framing; telegraph silhouettes stay legible; ult cut-in reuses master |
| Weapon collection art | 1024×1024 transparent | 512×512 WebP | Display illustration, distinct from equipment and brand icon |
| Skill/VFX icon | 512×512 master | 128×128 WebP | UI slot renders at 48×48 dp (~144 px on 3× reference); never use color alone |
| Character expression icon | 512×512 | 192×192 | Consistent face crop for profile, dialogue history and battle log |
| Portrait banner key art | 1440×2560 | 1080×1920 WebP | Text is separate UI; keep top 15% and bottom 22% clear of faces/focal props |
| App icon | 1024×1024 source | 512×512 PNG for Play listing | Adaptive icon: 108×108 dp canvas; key mark inside central 66×66 dp |
| Chapter/map node art | 768×768 | 256×256 WebP | Stable frame, chapter emblem, no embedded lettering |
| Character, weapon and item mark | 512×512 SVG viewBox/master | 128×128 SVG/PNG; 64×64 small slot | Every named gameplay entity gets a stable `logo_id`; see brand mark guide |
| Main wordmark | 1600×600 transparent | 800×300 | Horizontal source is allowed for brand use; in-game title composes it on portrait canvas |
| Store feature graphic | 1024×500 | 1024×500 | Store listing exception, not an in-game landscape screen |

**Initial compressed-file budgets (targets for profiling):** chapter background ≤500 KB; VN bust/expression set ≤450 KB per character; 4×4 chibi atlas ≤350 KB per character; portrait banner key art ≤650 KB; 128×128 mark export ≤24 KB SVG or ≤32 KB PNG. These are art-pipeline targets, not device-independent guarantees; inspect decode memory and visual quality on representative Android hardware before approval.

## Low-memory rules

1. Prefer static painted portraits and expression swaps over Live2D or video.
2. Share background plates across adjacent nodes and vary lighting, weather or foreground overlays.
3. Load chapter art as small packs; release a chapter pack after leaving the chapter.
4. Use sprite atlases by encounter, cap concurrent battle effects, and offer reduced-effect mode.
5. Store source masters separately from optimized runtime exports.
6. Keep JP voice packs on-demand. Text and gameplay must remain available without downloading optional voice data.
7. Avoid texture duplication: weapon thumbnails, portrait crops and banner crops should be generated from a shared source where possible.

## Composition rules

- VN busts face toward the dialogue partner or toward the open side of the composition; keep the lower quarter legible for subtitles.
- At least one face or weapon silhouette must remain readable in a 360×800 phone capture.
- Boss size may exceed the battle frame through layered art, never by requiring a full-screen 4K texture.
- Ultimate cut-ins last about 1.2–1.8 seconds, can be skipped, and use one key illustration with limited overlay animation.
- Avoid pin-up camera angles, chest/hip crops, underwear framing and distress-as-spectacle.

## Color and lighting

- Veyrhold: slate blue, charcoal, bone, oxidized gold.
- Fading Curse (C43): pale cold fingers → a small blood spot hidden in the white scarf → one bone-white lock → thin black-gold lines on the fingers spreading past the wrist (7-5). No crimson curse marks.
- Eclipse: ink black, pale brass, a thin crimson ring (the one focal crimson allowed; C40, resolves audit CC-10).
- Ember: rust and furnace orange; Tide: deep blue-green; Gale: desaturated teal; Stone: moss and iron; Dawn: ivory and gold; Veil: plum and silver.
- Preserve text contrast. Never encode combat state through red/green alone.

## 2D asset production sequence

1. Approve this visual system and silhouette sheet.
2. Create Mahmut and Fadyme model sheets: front, back, side, palette, weapon, expressions.
3. Create the remaining 18 model sheets using the same scale grid.
4. Create 20 battle sprite sheets and weapon callouts.
5. Create the seven chapter environment plates, enemy families and Chapter 7 boss phases.
6. Create launch banner art and UI icon set.
7. Optimize exports and update ASSET_CATALOG.md with the file path, dimensions, status and revision.

## Reusable illustration prompt shell

Use this production brief for future raster generation:

Use case: illustration-story or stylized-concept  
Asset type: Unaware of My Demise Part I 2D game asset  
Primary request: [specific character, weapon, scene or banner brief from the costume guide]  
Scene/backdrop: Veyrhold medieval dark-fantasy setting, with period-appropriate stone, cloth, leather and iron  
Style/medium: polished hand-painted anime illustration for a mobile 2D RPG; clear silhouette and material rendering  
Composition/framing: phone-readable framing, face and signature object unobstructed  
Lighting/mood: restrained gothic light, intimate rather than graphic  
Constraints: adult character design; practical garment construction; no logos, no watermark, no illegible text  
Avoid: photorealism, 3D render appearance, pin-up framing, sexualized minor coding, excessive gore, modern objects

No image file is approved by this document alone. Keep the asset manifest status at brief or prompt_ready until a real project file exists.
