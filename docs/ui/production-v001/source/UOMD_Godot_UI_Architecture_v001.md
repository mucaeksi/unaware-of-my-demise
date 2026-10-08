# Unaware of My Demise — Godot UI Architecture Handoff v001

**Engine:** Godot 4.7.2 Standard  
**Platform:** Android portrait-only  
**Authoring reference:** 1080×1920  
**Status:** implementation handoff / blueprint + reusable base package

## 1. Principle

The UI art system is already defined. The Godot layer must preserve it rather than reinterpret it.

Implementation hierarchy:

`runtime state → screen controller → reusable UI scene → Theme variation → component texture`

Artwork, text, navigation, transaction state and story state remain separate responsibilities.

## 2. Do not create a parallel game architecture

This handoff does **not** declare new global singletons for PlayerState, StoryDirector, patching, transactions, audio, or navigation.

The existing runtime remains authoritative. Connect the UI to it through adapters/signals. `UomdAccessibilityAdapter` and `UomdBackStack` are helpers, not mandatory Autoloads.

## 3. Base scenes

### `uomd_screen.tscn`
Every full-screen UI route starts from this shape:
- root `Control`
- project Theme
- `UomdSafeArea`
- `Content`

A screen controller owns data binding and back behavior.

### `uomd_modal.tscn`
Use for confirmations and blocking decisions. Background input is blocked. Android Back maps to the modal close/cancel behavior when permitted.

### `uomd_state_view.tscn`
Shared presentation shell for Loading / Empty / Locked / Disabled / Error / Offline / Insufficient Resource / Pending / Confirmed. Copy and icons stay runtime data.

### `uomd_bottom_nav.tscn`
Five approved persistent destinations:
- Shelter
- Journey
- Companions
- Summon
- Records

Do not show this persistent navigation in Entry, Battle or VN.

## 4. Safe area

`UomdSafeArea` reads `DisplayServer.get_display_safe_area()` and projects it to the viewport. The 48 px authoring inset on the 1080 reference is treated as a minimum content inset, not a hard notch size.

Never bake a status bar, navigation bar or display cutout into a background texture.

## 5. Theme

`uomd_theme_v001.tres` maps current 9-slice component textures to Godot Theme type variations.

The handoff intentionally excludes font binaries. Import legally sourced project copies of:
- Cinzel
- Source Sans 3

Then assign them to the Theme in the editor.

The current 9-slice margins are integration candidates. Verify visually in Godot and re-save the Theme after validation.

## 6. Touch and responsive layout

- minimum target: approximately 48 dp
- reference equivalent: approximately 144 px on the 1080 authoring canvas
- use Containers, anchors, size flags and scrollable content
- do not position critical UI with absolute pixel-only layout
- on narrow devices reduce gaps and nonessential art before typography
- on Large Text allow panels/cards/dialogue boxes to grow
- VN dialogue may cover more character art before text is clipped
- Battle compresses density/spacing before interaction targets

## 7. State separation

`Loading` is not `Pending`.
- Loading: no authoritative transaction has been committed.
- Pending: a request was submitted and duplicate action must be blocked.

`Locked` is not `Disabled`.
- Locked: progression/content gate.
- Disabled: currently invalid visible action.

`Offline` is not generic `Error`.

`Confirmed` must render one authoritative payload and be idempotent on reopen.

## 8. Transaction screens

Summon, Quest Claim, Inn Meal, Result Validation, Dismantle/Reroll/Upgrade and similar authoritative operations use this pattern:

1. Player reviews action/cost.
2. UI sends one request with the runtime's transaction/idempotency mechanism.
3. UI enters Pending.
4. Duplicate submission is blocked.
5. Currency/reward/inventory is **not** presented as final before confirmation.
6. One confirmed payload updates all dependent UI.
7. Reopening the screen must not grant the reward a second time.

## 9. Navigation / Android Back

Back resolution order:
1. top modal
2. child sheet
3. owning screen/route

The actual router remains project-owned. Base scenes only emit requests.

## 10. Accessibility

- Standard / Large text modes
- Reduced Motion
- required meaning = shape + value + copy
- body copy targets 4.5:1 contrast where practical
- large text / non-text UI targets 3:1
- critical actions must not depend on ellipsis or color
- system/device accessibility should be honored where the platform/runtime exposes it

## 11. Scene registry

`UOMD_Godot_Scene_Registry_v001.json` defines target paths and whether persistent navigation is expected. It is a mapping blueprint, not a command to replace the project's current scene router.

## 12. Fonts

No font files are distributed by this handoff. This is intentional.

## 13. Final validation gate

Before this UI can be called runtime-final:
- import package into the real Godot project
- resolve parser/import errors
- assign final fonts
- visually verify every 9-slice
- test 720×1600, 1080×1920, 1080×2400/cutout-like viewports
- test Large Text
- test Reduced Motion
- test Android Back
- test 48 dp hit targets
- test long English copy
- test grayscale state semantics
- test pending transaction recovery/reopen behavior
- run on an Android emulator/device

This package is deliberately honest: static source files have been generated, but they have **not yet been executed inside the user's actual Godot project**.
