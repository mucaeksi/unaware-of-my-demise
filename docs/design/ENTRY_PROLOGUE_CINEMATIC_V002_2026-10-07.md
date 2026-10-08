# Entry prologue — cinematic visual pass v002

Owner request: keep the approved scenario and improve its visual/animation direction scene by scene. Local Entry scope only.

## Read-only findings

- Nine scenes reused three flat background illustrations with no actor or prop layers.
- Every scene reset the full-screen texture scale and reversed its tiny horizontal movement, even when the image was reused. This produced camera discontinuities and exposed subpixel line-art shimmer.
- The original script, 120-second duration, download consent and install/restart flow were already functional.

## Shot direction

| Time | Shot | Visual action |
|---|---|---|
| 0:00–0:12 | Hours | Separate bronze bell rotates about its suspension axle; rope follows. Warm tower dust. Swing settles before the cut. |
| 0:12–0:26 | Names | Close-up ledger, separate quill hand, progressively drawn indistinct ink stroke, then hand lifts. |
| 0:26–0:38 | Ordinary Days | Two unnamed market adults approach for a bread offering and hold. |
| 0:38–0:50 | Throne Wars | Four-frame refugee walk on abandoned fields; distant capital still standing. |
| 0:50–1:06 | Crownfall | Tighter fixed ruined-gate composition; independent smoke and ash. No king's death, killer or ritual shown. |
| 1:06–1:22 | What Remained | Closer refugee composition emphasizes blankets, tools and a child; slow departure and mist. |
| 1:22–1:36 | Search | Younger Mahmut enters a winter inn composition and studies the register. |
| 1:36–1:48 | Reunion | Fadyme (20) and Mahmut (26) face each other in an unnamed hill village. Separate raised-gaze Mahmut pose and Fadyme's inviting hand. |
| 1:48–2:00 | Beginning | Present-day Fadyme (22) and Mahmut (28) recede along the approved forest road in a four-frame walk cycle. |

## Implementation

- `game/scripts/ui/entry/prologue_shot.gd`: shot-specific environment, Sprite2D actors, props, registered walk atlases, atmospheric layers and deterministic story-clock animation.
- `game/scripts/ui/entry/entry_prologue.gd`: 2.4-second shot dissolves, unchanged English narration/captions/timing, threaded preload of the next shot and prompt release of outgoing textures.
- Whole-background crops remain fixed for each shot. Animation transforms are owned by a Node2D stage, outside UI containers.
- Actor aperture clips above the narration panel. Character bodies cannot render behind download status, progress or touch controls.
- Shared logo geometry remains unchanged. Large Text keeps the shared 44/55 font sizing. A lower screen gradient improves download/readout contrast.
- Reduced Motion fixes all actor poses, the bell, writing, walk cells, dust and mist, and removes dissolves. Application suspension pauses the story clock.
- Transfer percentage continues to come only from verified download bytes. Story time never fabricates download progress.
- Native Local UI Preview has nine `Story ...` entries for direct shot review. Preview fixtures perform no account/server requests or player-state writes and are excluded from exports.

## Art and canon

14 project assets were generated with the built-in ImageGen tool in `game/assets/ui/narrative/prologue_v002/`. Full prompts, reference roles and generated source locations are recorded in its `provenance.json`. Original generated files were retained.

Approved character sheets/key art were used for identities. NPCs are unnamed production extras. The winter inn, market extras and hill-village environment are visual staging, not newly named canon locations. The reunion ages come from the documented Year −2 timeline. Mahmut's search look represents the later part of the four-year search; the Crown Guard star retains its empty crown socket. No late-story seal, family, prognosis, royal title, killer or mechanism reveal was added.

## Asset budgets and quality

Foreground props and walk atlases are imported with a 1024px limit and mipmaps to reduce moving-edge shimmer. Environment plates retain 1536px and fixed crops. The three protagonist portraits retain their original detail with linear filtering: the first reduced portrait import was visibly too soft and was reverted after native visual inspection.

The renderer holds the current shot, the outgoing shot during a dissolve and only the next shot's prefetched resources, rather than retaining every opening texture. Full-resolution source PNGs stay intact.

## Validation and diagnostic evidence

Evidence is in `build/entry-cinematic-20261007/`.

- Phase 1: 11/11 prologue tests. A floating-point dissolve boundary and delayed orphan cleanup were fixed without weakening assertions.
- Phase 2: 49/49 Entry tests; 145/145 UI tests.
- General suite: 455/455, 148359 assertions (`final-gut-fixed.log`). A new atlas test initially checked the reference cell, whose correction is intentionally zero. The test now explicitly visits the non-reference cell; the assertion is unchanged.
- Layout matrix: 27 native Godot GPU captures over nine shots × normal, compact Large Text and tall Large Text. All narration, controls and shared logo comparisons passed (`layout-final/matrix.json`).
- Native visual captures include three beats per shot, plus the refined reunion (`baseline/`, `final-reunion.png`).
- Profiling without PNG capture: before final import changes, 120 seconds, median 16.666ms, p95 16.678ms, max 18.707ms. Within-shot background transform changes: zero. Download fixture stayed at 25%.
- Final runtime metrics and real touch evidence are recorded separately in `profile-final/playback.json` and `native-touch-final.json`.
- Final no-capture playback: 120 seconds, 7197 frame samples, median 16.666ms, p95 16.682ms, maximum 16.824ms. The nine shots had zero within-shot camera transform changes. Peak texture allocation across both live windows was 131.24MiB; this is not an isolated Android prologue budget. No GPU-time counter or Android release measurement was obtained.
- After the footer/portrait refinement, the UI suite passed again: 145/145, 100243 assertions (`final-ui.log`).
- Actual native touch events restarted Replay from 120 seconds to 0.083 seconds and closed Skip correctly. Touch height was 144 logical pixels; Entry stayed in `downloading` at the verified 25% fixture.
- The Android AAB preset PCK export completed successfully (`export-pack.log`, `entry-cinematic-review.pck`). This is a package validation artifact, not a signed AAB or store upload.
- New imported assets total 20,187,570 bytes (19.25MiB), compared with 21,746,412 bytes before the prop/atlas import limits. Source PNGs are unchanged.
- Desktop measurements cover the Windows editor runtime. Android release/device performance and future 120 FPS hardware are not certified by these measurements.

### Tool/lifecycle findings

One live reload of the structurally changed prologue crashed Godot while destroying an old instance (`hot-reload-crash.log`). The editor stayed open; runtime was restarted once. Subsequent reloads first removed old preview instances and awaited their destruction, then reloaded scripts and rebuilt the same native window. They succeeded without another runtime restart.

Godot AI's explicit reimport operation rejects play mode. Imports were performed with the headless editor while keeping the owner's editor/runtime open. A first C# atlas-inspection helper lacked the System.Drawing.Common compile reference; the read-only measurement was completed using Godot Image inspection instead. PNG capture produced diagnostic stalls, so screenshots and final frame-time profiling were separated.

## Scope

Changes remain local. Narrative source documents and the secondary Production folder were treated as read-only. Gameplay, tutorial production, AAB publication, content delivery services and recorded voice/music remain their own later work; no new client patch capability was introduced by this visual pass.
