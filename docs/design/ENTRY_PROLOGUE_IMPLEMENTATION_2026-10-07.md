# Entry prologue v001 — implementation and evidence

## Delivered

`Before the Road`: 9 English narration cards, 211 words, a 120-second timeline including dissolves.
The readable screenplay is `ENTRY_PROLOGUE_BEFORE_THE_ROAD_v001.md`; the runtime timeline is
`game/data/entry/prologue_v001.json`. The existing history supplies the events; narration and illustrations are an
adaptation, not new answers to unresolved canon. No gameplay progression/reward callbacks are used.

Two environment illustrations were produced with built-in Imagegen: `living_village.png` and `crownfall.png`.
`forest_road.png` is a copy of the existing Narrative reference. They are under
`game/assets/ui/narrative/prologue_v001/`; `provenance.json` preserves the full generation prompts and source.
The editor and native Local UI Preview remain open. Select Prologue in the Entry preview, or use Replay after the story.

## Runtime contract

- The first content installation starts the prologue after download consent. The local seen flag and existing installed
  generation prevent replaying it on later content updates. The preview uses an empty preference path and writes no flag.
- Real downloader bytes and phases are mirrored into the presentation. The 120-second clock never drives patch progress.
- Skip dismisses only the story. Download/install continues. Natural completion retains the final card and offers Replay
  while content is still downloading.
- A verified install finishing early waits for natural story completion or explicit Skip before the existing restart.
- Transfer failures dismiss the story and preserve Retry. Interrupted viewing is not marked seen.
- Reduced Motion removes pan/zoom and dissolves, preserving narration timing. Background pause stops the story clock.
- Shared Theme type `EntryNarration` gives 44-point normal / 55-point Large Text narration. Masthead geometry is shared
  with the existing Entry pages. The new JSON is explicitly included by both Android export presets.
- Narrator audio is **unrecorded**. `scene_presented(line_id, audio_cue)` and the timeline cue IDs provide integration
  slots; no synthetic voice or replacement music was added. Existing Entry music routing continues.

## Verification

| Gate | Result | Evidence under `build/entry-prologue-20261007/` |
|---|---|---|
| Initial full run | 448/449; one old restart-timing test failed | `phase1-gut.log` |
| Updated Entry phase tests | 45/45, 5 scripts, 5,235 assertions | `phase2-gut.log` |
| Full regression before final Theme-only change | 451/451, 58 scripts, 148,324 assertions, 100.345 s | `gut-final.log` |
| Final UI suite after Theme change | 142/142, 16 scripts, 100,212 assertions, 40.019 s | `gut-ui-final.log` |
| Final real GPU layout matrix | 27 scene captures; 1080x1920 normal, 720x1280 Large Text, 1080x2400 Large Text; all text/control bounds and logo continuity pass; fonts 44/55/55 | `layout-final/matrix.json` and PNGs |
| Actual native 120-second playback | All 9 line IDs in order, 120.01137 s wall / 120 s timeline; sample download remained 25%; no viewing marker written | `final/native-playback.json` |
| Actual native touch | Touch press/release on the 1000x144 logical Skip target closed only the story, restored the patch UI, retained downloading phase and 25% | `native-touch.json` |
| Desktop frame sampling | 7,201 samples, median 16.666 ms, p95 16.675 ms, max 18.385 ms; 60 FPS; maximum 38 draw calls across open windows | `final/native-playback.json` |
| Android-preset PCK inventory | Export succeeded; script JSON, compiled player/validator, three imported textures present; integrity audit exit 0 | `export-pack.log`, `pack-inventory.json` |

The imported prologue textures total 7,378,860 bytes (about 7.04 MiB) in the reviewed PCK. The PCK is a local packaging
review artifact, not a new APK/AAB release or the planned slim bootstrap build.

The existing restart assertions were preserved; tests explicitly Skip the new presentation before checking restart.
New tests separately verify that an early successful install waits, no old-process gameplay state is adopted, and a
viewed prologue does not hold later installs. No assertions were weakened to make the run pass.

## Failures and corrections retained

1. Adding a global class to an already running runtime caused an EntryPrologue type lookup break. Source import passed;
   explicit preload references were added and only the runtime was restarted.
2. A development inspection command assumed the preview still contained a player after script hot reload had reset it
   to Title. The null lookup caused a debugger break. The runtime was restarted and inspection moved to a guarded,
   typed `prologue_review.gd` helper. This was a diagnostic mistake, not a production gameplay failure.
3. Initial narration sizing resolved a fallback font before the detached label inherited its Theme. The first version
   was too small; the next fixed normal size but did not scale. Sizing was moved into the shared Theme variation, then
   verified in headless UI tests and the real GPU matrix. Earlier captures are retained separately.

The Editor was kept open; the two runtime restarts were explained. No error history was cleared. Final runtime run 41
is live with no new game errors/warnings. Android device/thermal qualification remains separate from desktop sampling.

## Scope remaining elsewhere

The overall slim-bootstrap/content-loader separation and multi-pack patching from DEC-0043 are not implemented by this
prologue task. Gameplay/tutorial creation follows the owner's next instruction. Release signing and Play-installed QA
remain separate. This task did not deploy, publish or push.
