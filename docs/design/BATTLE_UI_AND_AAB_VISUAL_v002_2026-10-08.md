# Battle UI and AAB visual scope — v002

Date: 2026-10-08. Status: implemented locally and validated in Godot 4.7.2; visual acceptance remains an owner review.

This record supersedes the battle controls, compact health HUD, preview audio audition and preview layout portions of `FADYME_PILOT_AND_SIDE_BATTLE_v001_2026-10-08.md`. The earlier record remains historical. Fadyme's identity, existing reference images and canonical story excerpts are preserved.

## Owner direction

- No Skip in battles. Speed stays at x1 until Chapter 3 is completed; then x2 becomes available. No x4.
- Allies face right from the left side; enemies face left from the right side. Ordinary encounters must support five units per side, with room for a large boss.
- Health bars and controls need a polished layout suited to the game's bronze, bone and dark fantasy palette.
- Voice performances will be redesigned with the owner's new voice model; voice and music are the final content phase. The model/provider is not specified by this decision. Current work focuses on visual design within the planned first AAB scope.
- The upcoming three-stage tutorial still uses only Fadyme/Mahmut and at most Bellbound Dead/Hollow Pilgrim as the two common enemy types. Local capacity fixtures do not add a third hero, a boss to the tutorial, duplicate party permissions, or a new enemy species.

## Battle control policy

`BattleSpeedPolicy` reads the saved `StoryState.PlayerStoryState` and the loaded `ContentRegistry`. It requires authored Chapter 3 (`ch03_oakhaven_red_harvest`), the completed final stage `3-5`, and completion of every loaded stage in that chapter. Missing state/content stays locked. Reaching Chapter 3, a title containing “3”, or a completed boss alone does not unlock x2.

`StoryDirector` calls `BattleScreen.configure_progress` before the stage begins. The same configuration occurs for a resumed attempt and a report retry. The unlock is captured before the engine resolves and saves a victory, so the final Chapter 3 replay still runs with the speed access it had when entered. A subsequent battle sees the newly saved completion.

Every replay starts at x1. Before completion, the speed button is a disabled x1 capsule with a lock and the English hint “x2 unlocks after Chapter 3”. Afterwards it toggles x1/x2. The replay interval is 0.35 s at x1 and 0.175 s at x2; motion cues use the same pace. These alter presentation only. HP, rewards, turn order and outcome still come from the existing engine log.

The battle Skip button, callback and public `BattleScreen.skip()` method are removed. `BattlePlayback.skip_to_end()` remains a data-model helper used by existing model tests; no battle control calls it. Story-reader/prologue skip behavior is outside this combat-only decision.

The bottom panel is a single, stable container. During combat it displays the speed explanation and capsule. At completion it displays Victory/Defeat and Continue in the same space. The arena does not jump when the result appears. Continue receives keyboard focus; unlocked speed receives initial focus. Both interactive controls retain the shared 144-canvas-pixel touch minimum, equivalent to 48 dp on the 1080-wide/360-dp reference. This is a design reference, not a hardware density acceptance result.

## Chibi size and ground composition

Ordinary full-party sprite height changes from 190 to **176 canvas pixels**. A small two-unit side changes from 250 to **210**. This makes the opening party slightly larger than a full formation without letting it establish an excessively large default for five-versus-five encounters. Original PNGs and measured foot anchors are unchanged.

The standard formation preserves logical slots: Front near the centre, Rear near the outside, two Front / three Rear vertically staggered. Slots are based on all known units rather than current visibility, so later waves reuse the same anchors. Actor scale accounts for both available height and width.

A single large boss receives the middle of its side and a **330-pixel nominal height**, with a wider health HUD. Up to four ordinary escorts use upper/lower corners. Multiple bosses/objective information reserve more room and reduce nominal boss size. Future wide artwork is additionally capped to 42% of arena width; it cannot escape the reserved side merely because its texture has a wide aspect ratio. The boss and objective branches are presentation rules, not new combat rules.

The forest plate is reused. The native TextureRect is raised/cropped by 18% of arena height for a full formation and 26% for a boss formation, exposing sufficient ground beneath upper slots. This fixes the appearance of upper units floating at the forest horizon without adding another bitmap. Field clipping contains the reframed plate.

The local “Boss size · Sample art” fixture enlarges existing common-enemy artwork solely to inspect capacity. It is not a canonical Hollow Pilgrim boss or approved boss artwork. Five-versus-five also repeats the two available hero appearances solely for capacity. Production hero/encounter data is unchanged.

## Health HUD and shared styling

`BattleHudStyle` centralizes the small battle components using native Godot StyleBoxes, a tiny gradient and the existing Source Sans/Cinzel fonts. There is no new UI bitmap atlas, generated illustration, external font or remote asset dependency in this revision.

| Element | Treatment |
| --- | --- |
| HUD plate | Dark translucent ink; subtle bronze side edges, small corner radius |
| Unit name | Bone text, 32 canvas pixels, outline for contrast, ellipsis when space is limited |
| Level | Separate gold-toned 22-pixel label, not appended to the name |
| Health rail | 18 pixels high; dark inset background, bronze rim, small diamond metal end caps |
| Ally fill | Teal/jade gradient with a restrained highlight |
| Enemy fill | Ruby/wine gradient with a restrained highlight |
| Ordinary HUD width | 176 canvas pixels |
| Boss HUD width | 264 canvas pixels; numeric HP remains visible at 28 pixels |
| Status | Separate 22-pixel line, visible only when populated |
| Defeated unit | Empty health rail and reduced opacity; replay HP is still retained |

Ordinary numeric HP is kept in the UI model/accessors while hidden in the compact rail, reducing ten-unit screen clutter. Names, levels and fill remain visible. Long enemy names can be ellipsized; that is deliberate text fitting, not an accidentally clipped panel. The original standalone `UnitCard` used by tools remains available.

Health/status changes are driven by replay events. Deferred minimum-size reconciliation keeps absolute actor HUDs compact after fonts/themes settle. Damage/heal feedback and dead-actor lifecycle remain in the existing presentation layer. No health formula or account schema was changed.

The boss telegraph banner reserves a fixed 96-pixel height while present and displays at most two lines, limiting layout movement when its text changes. Speed/result controls use containers and safe-area padding from `UiScreen`; they do not depend on a single native window resolution.

## Audio deferred

The local visual review no longer loads the older Japanese DRAFT audition files. Its novel uses `VnScreen.audio_enabled = false`; scene/line cues and voice playback are deferred. Preview mode changes stop music through the existing Audio lifecycle. The five portrait/excerpt samples remain available with English text.

The old creative source recordings are preserved as unselected references. They are not promoted into production or represented as the newly chosen voice model. `battle_art_v001.json` now records that voice work is deferred. Generic production audio hooks remain available for the final audio phase; no paid synthesis call, voice replacement or new music composition occurred here.

## Local review and exported resource scope

The existing `LocalUiPreview` window remains the review surface. Arena offers **2v2**, **5v5**, **Boss size**, and a **Chapter 3 clear** sample toggle. The toggle constructs local completed-stage sample data; it never writes a player save or server state. Continue replays the local fixture. Toolbar rows are separated and anchored to the available width.

Open/reuse the window through the editor's live runtime:

```gdscript
load("res://scripts/art_review/preview_session.gd").open_fadyme(get_tree())
```

Both Android presets now include `data/presentation/*.json`. The binding JSON is read through FileAccess, so leaving it outside the non-resource include filter could otherwise ship the sprites without their mapping.

A resource-only ZIP was exported with the existing **Android AAB** preset and inspected: the presentation JSON, all 11 selected visual binding paths and their imported texture targets, and six battle scripts were present. Development preview scenes/scripts, Godot AI, GUT and tests were absent. The ZIP was 63,055,355 bytes for the current project resource scope. This is not an AAB, ABI/native-library size, device installation, signing result or final bootstrap budget. The preset still exports the existing project resource scope; final three-stage bootstrap versus patch content closure remains separate packaging work.

## Validation

Evidence directory: `build/battle-ui-20261008/`.

- Complete UI suite: **164/164 tests**, 17 scripts, 105,166 assertions, 47.063 s.
- Focused final side-battle suite: **11/11 tests**, 1,457 assertions. Covers speed completion/freeze, formation geometry, wide boss fitting, existing pose/death/source behavior and silent visual review.
- Explicit loading of all project/test scripts: **1/1 test**, 188 assertions. Strict typing settings were preserved.
- Native runtime snapshots at **540x960**, **360x800**, **600x800**: 2v2/full/boss combinations recorded; no measured sprite or HUD bounds escaped the arena. Desktop window resizing is not Android hardware acceptance.
- Actual native-window input: locked x1 stayed x1; Chapter 3 sample toggle unlocked; speed clicked to x2 and back to x1. x2 interval read 0.175 s. No Skip method was exposed by the battle screen.
- Natural 16-event tutorial sample replay: x1 completed in **5,786 ms**, x2 in **2,976 ms**, both with Fadyme 81/95 HP, Mahmut 140/140 HP and Victory with three stars. Ground anchors remained unchanged on result transition; Continue had focus in both runs. Timing includes frame/capture overhead.
- Silent novel snapshot confirmed audio disabled, no playing voice and no music cue. Export ZIP closure checks reported no missing selected bindings/import targets or battle scripts.

One game-only restart was necessary because the two new global UI classes could not be registered into the already-running process and caused a parser break. The editor process was preserved. Later revisions used source hot reload and the same native preview. The final live run was inspected separately and reported no game errors. All work remains local; no GitHub push occurred.

## Remaining production work

The owner still reviews scale, HUD typography/ornament and overall composition. Final large-boss art and actual boss/objective stage presentation require their own content/device review. Existing pose animation remains key poses plus procedural motion, not a finished frame-by-frame/skeletal animation package. This revision creates no new chapter, recruit, tutorial boss, or canonical story event.

The three tutorial stages, final 1-1 routing, first AAB dependency/content closure, patch split, Android performance/memory acceptance, PNG compression and the newly redesigned Japanese voice/music performances remain subsequent work. Current resource ZIP inspection verifies inclusion; it does not finish those release tasks.
