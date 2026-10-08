# Production UI v001 — local integration

## Latest appearance — Narrative UI v002, 2026-10-07

The owner rejected the earlier appearance and requested the Narrative references. Runtime now uses `game/theme/narrative_kit_v002.gd` through the existing UiTheme API. The cached editor Theme keeps the stable `uomd_production_v001.tres` path and was regenerated in Godot for the new system, so existing reusable scene templates also inherit it. Earlier Production assets and provenance below remain historical/source records. [Current visual report, assets and test evidence](F:/unaware-of-my-demise/docs/ui/narrative-v002/README.md).

The current Windows workspace is `F:\unaware-of-my-demise`. The earlier integration checkpoint used `F:\unaware-of-my-demise-main`; paths from that checkpoint are historical. The owner requested local development without GitHub pushes on 2026-10-05. UI source assets were copied from the secondary Production folder into the game without changing the source originals. That source folder is read-only and must be available before running a refresh.

## Runtime structure

| Purpose | Project path |
|---|---|
| Active editor Theme | `game/theme/uomd_production_v001.tres` |
| Existing Theme factory/API | `game/theme/gothic_system_v02.gd`, `game/scripts/ui/common/ui_theme.gd` |
| Source texture adapter | `game/theme/production_kit_v001.gd` |
| 18 unmodified PNGs | `game/assets/ui/production/v001/components/` |
| Body / action fonts | `game/assets/fonts/production_v001/SourceSans3-Regular.ttf`, `SourceSans3-Semibold.ttf` |
| Display font | `game/assets/fonts/art_direction_v01/Cinzel.ttf` |
| Reusable scene templates | `game/scenes/ui/common/` |
| Shared state / navigation | `game/scripts/ui/common/ui_state_view.gd`, `ui_bottom_nav.gd` |
| Actual screen widgets | `game/scripts/ui/common/ui_kit.gd` |
| Interactive developer review | `game/scenes/art_review/production_ui_preview.tscn` |
| Transfer provenance | `docs/ui/production-v001/integration-manifest.json` |
| Integrated Entry scenes | `game/scenes/ui/entry/entry_screen.tscn`, `entry_utility.tscn` |
| Entry controller and evidence | `game/scripts/ui/story_director.gd`, `docs/ui/production-v001/ENTRY_LOCAL_REPORT.md` |

`AppShell → StoryDirector → UiScreen` remains the runtime ownership chain. Screens emit requests, while the existing director/backend owns routing, session changes and transactions. Entry, Battle and VN have no persistent bottom navigation. The reusable five-route nav is ready for screen-by-screen wiring; the current hub keeps its existing actions until those routes have complete controllers.

## Scene templates

`screen_base`, `action_button`, `confirmation_modal`, `state_view`, `bottom_nav`, `card`, `input_field`, `toggle`, `slider`, `progress_bar` are instantiable `.tscn` templates. Screen and modal content is built by their existing scripts. They become visible when run. A derived screen fills `UiScreen.body`; the portrait card exposes `Content/Title`, `Content/Portrait`, `Content/Details`.

The source portrait-card texture reserves distinct header, portrait and footer areas. Use the card template for this layout. Compact battle HUD cards use StandardPanel.

## Component API examples

```gdscript
var details = UiKit.column()
details.add_child(UiKit.label(tr("Stage details"), UiTheme.TITLE))
body.add_child(UiKit.card(details, UiTheme.SHEET_PANEL))
body.add_child(UiKit.badge(tr("Pending")))
body.add_child(UiKit.input(tr("Search companions")))
body.add_child(UiKit.tabs([tr("All"), tr("Owned"), tr("Locked")]))

var view = UiStateView.new()
body.add_child(view)
view.present("offline", tr("You are offline"), tr("Check your connection."), tr("Retry"), "retry")
view.action_requested.connect(_on_action_requested)

var nav = UiBottomNav.new()
body.add_child(nav)
nav.set_available(["shelter", "journey"])
nav.select_route("shelter")
nav.route_requested.connect(_on_route_requested)
```

`UiStateView` supports loading, empty, locked, disabled, error, offline, insufficient_resource, pending and confirmed. Loading/pending/locked/disabled cannot submit the view's action. The caller supplies localized copy and verified payloads. A state view never grants rewards or writes a snapshot.

Use `UiTheme.create(1.25)` for Large Text. Buttons have a 144 px minimum height on the 1080 design canvas. Text grows and wraps in Containers. Selected toggles have a check/edge shape in addition to color. New kit surfaces and state marks are static; no animation is required to read them. Existing gameplay/startup motion settings remain a separate screen integration task.

## Watch locally

```powershell
.\tools\Start-UiPreview.ps1
.\tools\Start-UiPreview.ps1 -Page states -LargeText
```

The picker switches Components, Surfaces, States, Controls, Entry, Hub, Formation, Battle and Results. `Aa +` toggles 125% text. Demo wallet/characters and the sign-in action belong to this developer scene. It makes no account or server requests. The real Entry flow is separate; its offline developer preview is `tools/Start-EntryPreview.ps1` (see `ENTRY_LOCAL_REPORT.md`). The existing export exclusions omit `scenes/art_review`, `scripts/art_review`, tests and tools.

## Refresh source assets

The following source path is retained from the original integration checkpoint. Check that the read-only Production folder is mounted before using it; it was unavailable at the current workspace audit.

```powershell
py -3.14 tools/sync_ui_kit.py --source-root "C:\Users\PC\Drive'ım\Unaware of My Demise - Production" --check
py -3.14 tools/sync_ui_kit.py --source-root "C:\Users\PC\Drive'ım\Unaware of My Demise - Production"
```

The check is read-only. Refresh validates all inputs before copying, preserves replaced local PNGs under `build/ui-kit-source-backups`, and records hashes/slices/source dimensions. Changes to the source manifest are detected. A new kit version or changed slice contracts require adapter review before promotion; this tool intentionally handles v001.

If changing tokens or adapter styles, regenerate the editor Theme through the preview's `--ui-save-theme` option, then import in Godot. The Theme factory remains the runtime source of style rules.

```powershell
godot_console --path game res://tools/capture_production_ui.tscn -- --ui-size=1080x1920 --ui-page=components --ui-save-theme --ui-capture=F:/unaware-of-my-demise/build/ui-review/components-base.png
```

Fonts were downloaded from Adobe's official Source Sans repository at commit `87b37a2daaed80fcb8e8ccb0085c4d72ddade12e` ([source](https://github.com/adobe-fonts/source-sans/tree/87b37a2daaed80fcb8e8ccb0085c4d72ddade12e)). OFL license text is included in game legal notices. Cinzel and retained Inter licenses are also listed.

## Current Entry status and remaining screen work

The latest [opening-to-patch UI checkpoint](F:/unaware-of-my-demise/docs/ui/production-v001/ENTRY_UI_OPENING_TO_PATCH_2026-10-07.md) has **399/399** full tests, 53 scripts, responsive Title/sign-in/patch layouts, physical keyboard and live mouse focus checks, and nine resolution/Large Text renders. The previous debug APK predates these UI changes. The owner is reviewing Entry from the opening through the patch screen; the next gameplay screen remains owner-selected.

The common kit and the real Entry flow are integrated. Entry has manual Google sign-in, observed release/patch states, verified Enter Game gating, a restart-required Close Game action, persistent Settings/Help overlays, public device preferences, help/licenses and confirmed Sign Out. `StoryDirector` retains session, patch and new/returning/recovery routing ownership. The separate UI preview above still uses sample sign-in and wallet data; it is not account acceptance. `ENTRY_LOCAL_REPORT.md` preserves the initial implementation checkpoint. The [2026-10-07 audit](F:/unaware-of-my-demise/docs/ui/production-v001/ENTRY_AUDIT_2026-10-07.md) records the current workspace's **395/395** full GUT result, real HTTP interruption/resume, installer cleanup, idle Entry Back, 60 successful live Godot AI calls and verified Android debug APK.

The current Title uses a provisional Fadyme portrait; final Title key art and wordmark have not been promoted into its runtime asset reference. The owner's main theme is also not present at the expected runtime path. The Android debug APK passed signature, manifest, ARM64, 16 KiB alignment, notices and resource-exclusion checks. Android device QA remains pending for safe area/density, Google Credential Manager, touch/Back behavior, accessibility preferences and background/resume. Package checks and desktop runtime do not establish device acceptance.

The owner has limited current work to Entry and will choose the next screen. Earlier plans list Shelter/Hub → Journey → Formation → Battle → Results and later menu/VN work; these are historical sequence context, not completed screen compositions. Journey/Records controllers and authoritative result presentation still need their own screen work before persistent navigation is enabled in the game.
