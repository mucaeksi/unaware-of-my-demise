# Entry prologue: planted feet and intact offering (V004)

## Request and read-only findings

The owner requested fixes for Names, Ordinary Days, Throne Wars, Roads, Search,
Reunion and Beginning. Work remains local and inside Entry.

Baseline images were inspected in `build/entry-presentation-v003-20261007/layout-final/normal/`.
Source backgrounds, transparent character images and both four-frame walk atlases
were inspected before editing. The renderer had four concrete causes:

- Cast height/position followed subtitle aperture height rather than landmarks in the background.
- Walk scale was applied about the top-left corner, lifting soles during recession.
- Atlas registration used heads instead of planted soles, carrying frame drift into foot contact.
- Ordinary Days split one offering image at exactly 50% width, through the loaf.

Search additionally zoomed away its floor. Mahmut's original standing poses have
one boot higher than the other; moving the entire image alone cannot plant both boots.
Names used an inaccurate nib Y coordinate and a constant-speed translation with no writing pauses.

## Changes

- Background UV landmarks map through the actual `KEEP_ASPECT_COVERED` scale/crop.
  All actors share that coordinate space. If enlarged subtitles need room, background
  and cast are reframed together; a person cannot be moved independently off the painted ground.
- Throne Wars, Roads and Beginning follow authored quadratic curves on the visible roads.
  Scale follows distance from each road's horizon. Each atlas frame registers at its
  measured boot soles, with visible-height correction to remove frame-to-frame body shrinkage.
- Roads now uses the existing refugee walk atlas, rather than translating a static group upward.
- Small soft contact shadows sit at the supporting soles. Reduced Motion preserves a still pose.
- Ordinary Days keeps its entire offering in one sprite, with no region crop and no independent
  translation of the woman, loaf and man. Its scale/placement fits the actual street perspective.
- Search reveals the inn floor and aligns Mahmut's stance with the counter/register.
  Reunion plants both characters on the village road. A small static texture mesh extends only
  the raised leg/boot to its support plane; hands, torso and face geometry remain unchanged.
  The original image files are preserved. Meshes are built once per shot, not every frame.
- Names pins the measured nib to the stroke, adds eased letter strokes, brief pauses,
  wrist rotation and a deliberate pen lift after writing.

No story text, canon, audio provider configuration, sign-in, patch verification,
restart flow or player save marker was changed. No API audio generation was performed.

## Validation and evidence

Artifacts: `build/entry-grounding-v004-20261007/`.
Pre-change source backups: `local-backups/entry-grounding-v004-20261007/`.

- Phase 1: 14 existing prologue tests passed, 4,934 assertions.
- Phase 2: 17 prologue tests passed, 5,474 assertions. Added contact checks through all atlas
  phases, perspective shrink, standing-foot stability, intact loaf and writing/lift sequence.
- Final UI regression: 151 tests passed, 100,819 assertions (`final-ui-tests.log`).
- Final targeted prologue suite: 18 tests passed, 8,354 assertions (`final-prologue-tests.log`).
  The additional stance test verifies that the raised boot is extended while every upper-body
  mesh vertex, including face and hands, retains its original position.
- Real runtime captures: seven requested shots × 0/5/10 seconds × normal/large/tall-large
  = 63 frames in `final-frames/`. `contacts.json` reports zero frames with hidden foot pivots.
  Screenshots were inspected for actual street/road/floor alignment; source parsing alone was not used as completion evidence.
- Native touch results: `native-touch.json`; hidden Skip, reveal-only first touch, distinct second
  Skip touch, Replay, centered completion actions and Continue all passed. Transfer remains 25%.
- The existing editor/runtime were hot-reloaded safely after freeing old shot instances.
  Runtime PID 22648 and run token 42 were preserved; Local UI Preview stays open.

The first Ordinary Days composition still put the woman's feet over a raised roadside platform.
Visual inspection caught it despite passing source tests. The pair was rescaled and moved into the
street's perspective. Search's raised boot also needed the stance geometry correction described above.
No assertion was weakened to pass either correction.

The 120-second desktop profile is recorded in `profile/playback.json`: 7,199 frames,
median 16.666 ms, p95 16.677 ms, maximum 18.057 ms, zero intervals over 25 ms and
zero within-shot camera changes. All nine scenes reached the 120-second completion;
transfer stayed at 25%. CPU monitor p95 was 10.008 ms, with an isolated 67.74 ms
monitor maximum that did not correspond to a delivered-frame stall. This distinction
is retained in the evidence rather than discarded. Peak draw calls across all open
windows: 81; peak texture memory: 139.58 MiB.

At ten seconds, group height relative to its initial pose is 74.48% in Throne Wars,
82.86% in Roads and 68.56% in Beginning. The contacts remain on their authored roads.
Android hardware performance is not measured by this desktop run.
