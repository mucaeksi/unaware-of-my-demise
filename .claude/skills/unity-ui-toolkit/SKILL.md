---
name: unity-ui-toolkit
description: Build, port and audit Unaware of My Demise screens in Unity 6 Runtime UI Toolkit as the project actually does it — screens built in C# (no UXML/UI Builder), PanelSettings created in code (1920×1080, match height), UomdScreenKit reference-space placement, OFL TTF fonts via USS, safe areas, USS-transition motion, and capture-based visual verification. Use for any apps/unity screen, HUD, modal or layout fix.
license: Proprietary
---
# Runtime UI Toolkit in UOMD

Read `uomd-unity-engine` first. The official `ui-uitk` skill (vendored) is the general USS/UXML reference — its §1 list of
CSS properties that do not exist in USS (`gap`, `z-index`, `box-shadow`, `:nth-child`, gradients, …) applies here too.
This skill describes how UOMD uses UI Toolkit; it wins on conflict.

## How the UI is wired

- `UomdBootstrap` (runtime, `RuntimeInitializeOnLoadMethod`) creates the `UIDocument` and its `PanelSettings` in code:
  `ScaleWithScreenSize`, reference `1920×1080`, `MatchWidthOrHeight` with `match = 1` (**height**). So y and sizes are stable
  reference pixels on every phone, and width varies (≈1920 on 16:9, ≈2520 on 21:9). Theme: `Resources/<ThemeResourcePath>.tss`
  importing `UI/USS/uomd-tokens.uss`.
- `UomdSceneRouter` owns the root tree (header bar, screen host, overlay host), the screen controllers
  (`IUomdScreenController`: `OnEnterAsync(root)`, `OnTick(dt)`, `OnExit()`), `NavigateToAsync`, media/audio services.
  Every controller builds its tree in C# when entered; nothing is authored in UXML except the legacy
  `UomdHubFrame.uxml`/`UomdModalDialog.uxml` (unused by ported screens).
- Screens are **ports of the TypeScript scenes**, whose coordinates are in the same 1920×1080 space. Use
  `UomdScreenKit` instead of ad-hoc styles:
  - `Layer(parent, color?)` full-screen absolute layer (picking ignored);
  - `Centered(e, xFromCentre, y)`, `AtLeft(e, x, y)`, `AtRight(e, xFromRight, y)`, `FromBottom(e, xFromCentre, yFromBottom)` —
    place an element's centre, matching TS `cx + dx`, `insets.left + x`, `REF_W - x - insets.right`;
  - `Text`, `MenuButton(label, sub, w, h, size, hot, onClick)`, `Image`, `Backdrop` (cover-fit content art), `VerticalShade`;
  - motion: `Fade`, `Move`, `ScaleTo`, `Pulse`, `After` — USS transitions that complete instantly under reduced motion.
- Wide screens: content that the TS client laid out in the 1920 band stays in a centred 1920-wide band
  (see `BattleScreenController` `_world`: `left: 50%`, `margin-left: -960`), while edge-anchored HUD (`AtLeft`/`AtRight`) hugs
  the real screen edges.
- Colours come from `UomdThemeTokens` (C#) and the matching USS variables in `uomd-tokens.uss`; they were ported from
  `apps/game/src/ui/theme.ts`. Do not introduce new palettes.

## Fonts

OFL TTFs in `Assets/_UOMD/UI/Fonts` (Cinzel SemiBold for display, Cormorant Garamond Medium/Bold for body) are applied by USS
classes `.uomd-display` and `.uomd-serif` (`-unity-font: url(...)` **and** `-unity-font-definition: initial`, otherwise the
default theme font wins). There is no TextMeshPro and no SDF asset in this project.

## Rules

1. Touch targets ≥ 64 px tall in reference space; decorative layers `pickingMode = Ignore` so taps reach buttons/stage.
2. Respect `Screen.safeArea` (`SafeAreaBinder` pads the root): keep interactive HUD at least `insets` away from cut-outs and
   verify edge-anchored elements on 21:9.
3. No per-frame allocation or `Q<T>()` in `OnTick`; keep references from build time. Release `Texture2D`/`Sprite` you create
   (`UomdMediaLoader.ReleaseTextures` runs on every navigation).
4. Long strings: set `whiteSpace = Normal` and an explicit width; check overflow in captures.
5. Every async step in `OnEnterAsync` must guard against the screen having been left (generation counter pattern).
6. Text and copy are canon from the TS client or `narrative/`; never invent labels.

## Verify visually

`bash apps/unity/cloud/unity_ci.sh capture` plays the player under Xvfb at 1920×1080 and writes
`apps/unity/Builds/Capture/NN-<screen>.png` (`UomdCaptureRunner` order). Open the PNGs and compare with the TS reference
layout before claiming a screen is done; publish with `node tools/publish_unity_screens.mjs`. For other aspect ratios run the
capture player with `-screen-width/-screen-height`.
