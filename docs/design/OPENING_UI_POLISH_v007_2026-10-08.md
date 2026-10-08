# Opening AAB UI polish v007

Owner request: inspect and improve the current AAB UI locally. This pass covers
Entry/patch, the six tutorial readers and battle HUD presentation. Existing story,
combat rules, patch ownership, character art and first-launch routing remain the
source of truth. Music and Japanese voice production remain deferred.

## Observed baseline and acceptance criteria

- Reader controls had equal visual weight and fixed 236-unit widths. Next/Finish
  receives the primary surface; Back, Auto and Log remain quiet. Auto has a centered
  inline selection icon. Four columns reflow to two on narrow/large-text layouts.
- Reader subtitles retain their space below the large portrait. The dialogue panel
  uses translucent ink, a fine character-colored edge and a matching speaker label.
  A quiet line counter provides progress without introducing Skip or faster Auto.
- Arena, party portraits and footer share restrained metal framing. Five fixed
  portrait slots retain their formation mapping, automatic Basic/Active readiness
  bars and exclusively manual Ultimate input. A short persistent hint explains the
  glowing portrait. World-space nameplates must fit the shipped tutorial names.
- Focus overlays must be transparent; selected button surfaces must remain visible.
  Large Text must increase reader and battle footer/tray labels. Reduced Motion must
  make charged portrait glow static and remove ornamental portrait dissolves while
  retaining dialogue pauses and reveal/voice timing.
- Patch transfer remains based on actual bytes. Its panel and health-like progress
  rail share the opening palette; completion still requires confirmation/restart.

## Validation plan

Retain native Godot runtime captures at compact 720×1600, base 1080×1920 and tall
1080×2400, plus Large Text and Reduced Motion. Review long English subtitles, log
pause/Back, five portraits, boss formation, charged input and post-battle Continue.
Run the existing GUT UI suite, check editor/game logs, rebuild the opening AAB and
refresh the sealed `release/current` snapshot and project graph. Android hardware,
production signing and final audio remain separate acceptance gates.

Native evidence is stored under `build/ui-polish-20261008/`. Results will be appended
after execution; this document does not claim owner visual acceptance.

## Observed results

- PASS: Godot 4.7.2 GUT UI suite, **195/195 tests**, 105,763 assertions,
  `build/ui-polish-20261008/ui-tests-accepted-final.log` (71.771 seconds).
  Five added behavioral tests check compact bounds, dynamic Large Text, all five
  portrait touch targets, Reduced Motion with retained dialogue pause, Log/Android
  Back and compact prologue completion. Existing assertions remain intact.
- PASS: live `gl_compatibility` runtime, existing editor/game/LocalUiPreview kept
  open and source hot-reloaded without a restart. Native captures cover the three
  logical fixture sizes and compact 125% Large Text. Desktop captures are scaled
  to 360×800, 540×960 or 432×960 to fit the monitor; they are not Android captures.
  Geometry and subtitle font sizes are retained in `runtime-layouts.json`.
- PASS: all **107** shipped tutorial lines visited at 720×1600 with Large Text.
  Minimum portrait panel height was 704 units; the footer ended at 1568, retaining
  the 32-unit bottom inset. The longest shipped subtitle is 114 characters.
- PASS: live manual Ultimate cue observed at pace 0.1, restored to 1.0 after the
  cut-in; settled sample battle exposes Continue. Charged, cut-in and victory
  captures are retained. Formation/boss screenshots use duplicated local samples
  of the two shipped heroes; they do not introduce new playable characters.
- PASS: source whitespace check. Live game log reports no errors; editor logs
  include pre-existing warnings in older core/backend code. Newly introduced local
  names were corrected to avoid shadowing Control properties.

The first prologue polish attempt violated an existing muted-transfer opacity
assertion. The 0.58 opacity contract was restored; the improvement uses a dark
backplate and brighter text instead. The existing test passed unchanged.

Visual review: suitable for owner review of this scoped presentation pass.
Hardware safe-area/density checks, final voice/music, production signing and owner
visual approval remain pending. No frame-time improvement or publication is claimed.
