# Fadyme pilot and side-by-side battle presentation — v001

Date: 2026-10-08. Status: implemented local runtime candidate, pending owner visual review.
This document records the implemented pilot. It does not approve new story canon or an Android release.

## Owner direction and scope

The owner authorized completing the Fadyme workflow in order, then reviewing the result together. Gameplay uses chibi characters; narration uses detailed light novel illustrations. All player-facing text remains English. Voice performances are Japanese. The battlefield presentation changes to allies on the left facing right and enemies on the right facing left, in the existing portrait phone canvas.

The upcoming three-stage tutorial uses only Fadyme and Mahmut, with at most two low/common enemy species. This pilot supplies assets and presentation for Bellbound Dead and Hollow Pilgrim. Their appearance is a review candidate, not a new named enemy or boss. It adds no third playable character, new recruitment, new lore event or campaign rewrite.

The tutorial scenario remains the proposal in `docs/design/TUTORIAL_SIDE_BY_SIDE_v001_2026-10-08.md`. T1/T2/T3 production stage installation, bootstrap/AAB dependency closure, the patch boundary, mobile-device acceptance and final audio approval remain separate work. Existing 1-1, 1-2 and 1-3 encounters/rewards are not reassigned by this pilot.

## Fadyme identity

References: `narrative/FADYME_MEDIA_ALL/UOMD_P1_Fadyme_Canonical_Character_Sheet_v001.png`, `UOMD_P1_Fadyme_Battle_Chibi_Style_Guide_v001.png`, the approved Fadyme/Mahmut duo key art, and the existing individual VN busts.

- Fadyme is 22, with pale ash blonde hair, violet eyes, plum hood, black dress, silver/lilac embroidery and an ivory scarf.
- Keep the hood's broken crown fragment, the face-side bell hairpin and the silver necklace bell with thorn clapper as three separate items.
- The baseline battle set has no disease/progression markings or blood. Existing story excerpts may express fear or pain through her face without changing that baseline costume.
- Her role is Veil support/DPS. The older presentation-board label “Summoner” is not adopted.
- Her quiet dry humor and agency are supported by a new wry VN expression. She is not redesigned as a passive child.

## Runtime asset inventory

All paths below are relative to `game/`. Original references were read/copied; the secondary Production creative source was not edited.

| Asset | Runtime file | Use/status |
| --- | --- | --- |
| Fadyme pose atlas | `assets/characters/fadyme/chibi_poses_v001.png` | Idle, walk, basic, active, hit, defeat, victory key poses |
| Fadyme full Ultimate | `assets/characters/fadyme/ultimate_v001.png` | Isolated complete aura; replaces the atlas's clipped Ultimate |
| Mahmut pose atlas | `assets/characters/mahmut/chibi_poses_v002.png` | Guard, walk, active, Ultimate, hit, defeat, victory |
| Mahmut full basic attack | `assets/characters/mahmut/basic_attack_v001.png` | Isolated full sword; replaces an atlas cell crossing |
| Two common enemy types | `assets/enemies/tutorial/common_poses_v002.png` | Bellbound Dead/Hollow Pilgrim idle, attack, hit, defeat |
| Side arena | `assets/backgrounds/forest_whispering_ash/side_arena_v001.png` | Original flat forest clearing, horizontal opposition |
| Fadyme composed | `assets/characters/fadyme/vn_composed_v001.png` | Copied existing reference |
| Fadyme warm | `assets/characters/fadyme/vn_warm_v001.png` | Copied existing reference |
| Fadyme quiet pain | `assets/characters/fadyme/vn_quiet_pain_v001.png` | Copied existing reference |
| Fadyme honest fear | `assets/characters/fadyme/vn_honest_fear_v001.png` | Copied existing reference |
| Fadyme wry | `assets/characters/fadyme/vn_wry_v001.png` | Generated expression variant |

`mahmut/chibi_poses_v001.png` is retained as a non-selected earlier candidate. The first enemy atlas was rejected for looking too much like Fadyme; it was not promoted into the project. Selected PNGs retain genuine RGBA transparency. No Python raster editing or background removal was performed. Godot AtlasTexture regions are the native runtime crop mechanism.

The single source of presentation binding is `game/data/presentation/battle_art_v001.json`. It records paths, facing, pose indices, authored crop regions, per-pose foot anchors, the Ultimate's scale correction and expression aliases. `tools/inspect_battle_art.py` reads alpha bounds and hashes without modifying images. Bounds are useful for grounding QA; matching a silhouette's bottom is not proof of anatomical correctness.

## Animation and battlefield implementation

`BattleArt` loads the versioned JSON bindings and textures. `BattleActor` composes a sprite, ground shadow and compact `UnitCard` HUD. The current animation method is **key poses plus procedural motion**, not a finished frame-by-frame sprite animation or skeletal rig.

Idle has slight breathing with the feet anchored. Basic/walk cues move toward the opposing side, hit reactions recoil away, Active/Ultimate use their poses and contained effects, defeat stays grounded, victory holds its pose. Interrupted tweens are cancelled. A dead actor cannot return to idle/victory through a later cue. Individual poses can be held in the art preview without changing production timing.

`BattleField` places players left and enemies right, mirrors an asset only if its authored direction differs from its team, keeps Front closer to the centre and Rear nearer the outer edge, and staggers two Front / three Rear capacity. Later waves reuse their slot rather than moving established units. All units, including hidden later arrivals, are known before the replay starts. A formation capacity test uses repeated artwork for layout only; it does not permit duplicate heroes in a real party.

`BattlePlayback` retains the finished engine event log as the source of HP, statuses, outcome and rewards. Added presentation metadata carries stable enemy art identity, action type, skill id and damage source. No damage, turn order, formation rule or reward computation moves into a UI node.

`BattleScreen` replaces the vertically stacked flow containers with the arena. It retains speed x1/x2/x4, Skip, boss/telegraph banner, logs and Continue behavior. Damage numbers spawn above actors rather than on HP panels. Fadyme's damage trace follows the actual recorded source and target. `StoryDirector` passes the authored location to the arena. Chapter 1 has a new horizontal plate; other locations retain their existing asset resolver fallback until their own plates are reviewed.

The compact HP bars override the large decorative progress texture. HUDs explicitly shrink after theme/font overrides settle, because absolute-positioned Controls can retain a larger earlier size. The log uses four trimmed lines so long skill names cannot move the battlefield during combat. The result phase may reserve a different footer height; it is a separate presentation phase.

## Light novel and Japanese voice review

The existing `VnScreen` remains the reader: English lines, back/next, auto, backlog and confirmed skip. Its Fadyme expressions follow authored emotion tags. Unknown Fadyme emotions use composed; narrator and other speakers do not receive Fadyme artwork. Disease marks are not added by an expression alias.

The expression preview uses existing canonical excerpts: `opening_012`, `opening_004`, `opening_002`, `opening_001`, and `node_1_1_pre_002`. They are grouped only as an art/voice audition, not as a new chronological narrative scene. The new wry portrait matches the existing “You say that as if I have ever listened.” line.

Japanese source recordings exist under `narrative/FADYME_MEDIA_ALL/VO_SOURCE/Japanese__Fadyme__<speaker>__<line>.ogg`. The Japanese line map explicitly says **DRAFT; native JP editor review pending**. Five matching takes play in the local preview through the normal Voice bus. They are read from the creative source outside `game/`, not copied into shipped production VO. No paid audio API was called and no selected voice/take was replaced.

The optional `VnScreen.voice_stream_resolver` passes a local audition stream to `Audio.play_voice`; normal production calls still use stable shipped speaker/line paths. Back/Next/Skip/exit retain voice stop behavior. Auto waits while the current recording is playing, so a 12–14 second Japanese performance is not cut by the old 5-second reading interval. Explicit Next can interrupt it. Application focus/pause handling remains active.

## Ending and local handoff

`EntryPrologue` fades its image/text to black during seconds 117–120 of the existing 120-second timeline. `ending_started` triggers `EntryScreen`'s Music-bus fade. Replay resets the veil. Skip remains accessible above it. Natural completion remains a single completion event.

The local Fadyme review's Entry tab opens Story Beginning, then offers Replay/Continue on black. Continue waits 0.65 seconds and opens **The First Step · Art review**, a local sample battle. This demonstrates the visual handoff only. The production Entry download/install barrier is preserved; it does not yet route a shipped T1 stage before patch installation. The final prologue music composition is not authored here. Fade gain was tested with a local silent 10-second audio probe, explicitly identified in the evidence.

## Local review operation

Use the already-running editor's game eval:

```gdscript
load("res://scripts/art_review/preview_session.gd").open_fadyme(get_tree())
```

The same native LocalUiPreview window is reused. Tabs: Arena, Fadyme poses, Light novel, Entry. `refresh_preview()` reloads bindings and the current mode. Arena Continue replays local sample data; poses auto-cycle and can be selected; the novel auditions five expressions/recordings; Entry demonstrates the ending. No account, server battle or reward operation is made.

Godot AI editor writes are unavailable while the editor is playing. Source edits used normal workspace file tools, followed by filesystem scans and explicit live GDScript source refreshes. The editor remained open. Two diagnostic eval failures required restarting only the game in this work phase; the final run is checked separately from retained earlier errors.

## Validation and remaining review

Evidence lives in `build/fadyme-pilot-20261008/`: native battle/pose/novel/ending screenshots, JSON state snapshots, alpha/hash measurements, and headless test logs. Checks cover two-hero combat, five-per-side layout, later waves, source/action metadata, dead-actor lifecycle, all eight Fadyme poses, five matched voice/expression excerpts, Auto/Next voice lifecycle, and ending fade/handoff.

The owner still reviews face consistency, costume ornaments at phone size, enemy proportions, sprite edge quality, intensity of bell magic, desired animation richness, the new background and Japanese casting/delivery. These are runtime candidates, not owner-approved final art. Native desktop validation is not Android acceptance. PNG source assets remain unoptimized masters; the AAB/patch compression and memory budget must be measured during the packaging phase.

## Final image generation prompts

Tool: built-in imagegen, no external key. These are the selected production-directed prompt specifications; rejected variants are not runtime bindings.

1. **Fadyme atlas, sprite asset.** Canonical character sheet = identity; chibi style guide = proportions/rendering. Eight full-body right-facing poses on transparent alpha: idle, walk, basic bell glimmer, Active with necklace bell/violet ribbon, Ultimate with bell aura, hit recoiling left, kneeling defeat, quiet wry victory. Four columns/two rows, same scale/camera, isolated silhouettes, no labels/borders/shadows, plum hood/black silver-lilac dress/ivory scarf, pale ash blonde/violet eyes, three distinct ornaments, healthy baseline. Godot authors regions/anchors; the large Ultimate was subsequently replaced by a standalone asset.
2. **Horizontal forest arena, environment asset.** Existing forest plate = world/style reference. Original dark fantasy anime forest clearing, ash-gray trees, purple twilight, distant ruined spires, small shrine/candles at outer upper edges, flat open ground in the lower 65%, shallow raised 3/4 side view, player space left/enemy space right, no depth road, no characters/UI/text/grid/baked shadows, landscape 3:2 embedded in portrait UI.
3. **Mahmut revised atlas, sprite asset.** Prior candidate = identity/pose reference. Two columns/four rows on transparent alpha: idle/walk; compact right sword attack/shield brace; contained amber shield Ultimate/hit recoil; kneeling defeat/quiet victory. Same adult face, dark messy hair/stubble/brown eyes, worn half plate, oxblood cloak, heater shield, plain arming sword. No crown/star/new ornaments. Full silhouettes/props confined to cells with margins and constant scale. The sword attack was subsequently replaced by an isolated sprite.
4. **Common enemies, sprite asset.** New original two-column/four-row transparent atlas. Bellbound Dead: bald gray skeletal adult, empty sockets, ragged plain black tunic/trousers, small iron sternum bell wired/chained, no heroine hair/hood/purple/crown/ornament/gore. Idle/grab left/recoil right/kneeling defeat. Hollow Pilgrim: stooped anonymous undead, empty dark hood, ragged gray-tan robe, humble wooden walking staff, boots and worn backpack, no hair/bells/crown/new magical lore. Same four poses facing left, consistent camera/scale, transparent gutters, no text or shadows.
5. **Mahmut standalone basic, sprite asset.** Revised Mahmut atlas = identity/style. One complete full-body 3/4 right-facing compact sword thrust, planted boots, shield left arm, same dark hair/stubble/half plate/oxblood cloak. Entire sword tip, cloak, shield and both boots visible with transparent margins. Landscape 4:3, one figure, no floor/shadow/text/extra effects. Replaces a cell-crossing sword.
6. **Fadyme wry VN bust, expression edit.** Composed bust = identity/outfit/camera; warm bust = expression range. Same adult face, pale ash blonde/violet eyes, plum hood, ivory scarf, silver lilac trim and three separate ornaments. Change only expression to dry amusement: small knowing asymmetric smile, gently raised eyebrow, alert relaxed eyes, quiet agency; no big grin/coyness/blood/progression marks/new jewelry. Same 3/4 right-facing chest-up 3:4 portrait, transparent alpha, no text/frame.
7. **Fadyme standalone Ultimate, sprite asset.** Fadyme atlas and chibi guide = identity/style. One right-facing full-body Fadyme, arms opening, quiet determination, healthy baseline, same face/costume/three ornaments. Contained violet/silver bell circle with a few complete floating bells. Entire aura, boots and silhouette within a square transparent canvas with margins; no neighboring fragments, floor/shadow/text/blood. Body about 82% of canvas height, feet about 91%; replaces a clipped atlas effect. Runtime uses a measured foot anchor and 1.12 scale correction to match the other poses.
