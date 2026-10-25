---
name: unity-urp-2d
description: Configure and implement Unity 6 LTS Universal Render Pipeline 2D (URP 2D) — Renderer2DData, sorting layers, runtime Texture2D/Sprite.Create bottom-left rect and foot pivot conversion, Light2D, Shader Graph 2D materials, and data-driven VFX from vfx_presets.json.
license: MIT
---
# Unity 6 LTS Universal Render Pipeline 2D (URP 2D)

Use this skill when building or debugging 2D rendering, sprite slicing, sorting layers, lighting, custom shaders, or combat/story visual effects in `apps/unity/`.

> **Project state (2026-10-25):** URP 2D is the active pipeline (`Assets/_UOMD/Settings/UomdURP2D.asset` + `UomdRenderer2D.asset`,
> applied by `UomdProjectSetup`), but every screen — battle and story included — renders on the Runtime UI Toolkit overlay
> (`unity-ui-toolkit`). Battle VFX are UI Toolkit too (`UomdVfxPlayer`, see `uomd-battle`). Sections 1–2 below (orthographic
> camera, sorting layers) describe a world-space stage that does not exist yet; use them only if one is deliberately added.
> Section 3 (top-left → bottom-left `Sprite.Create` rects and foot pivots) is what `BattleUnitView` and the turn bar use.

## 1. URP 2D Renderer & Camera Configuration
- **Pipeline Asset**: `URP-2D-HighQuality.asset` (60 FPS, MSAA off for 2D pixel/crisp sprite accuracy, HDR enabled for bloom/glow, 1.0 render scale) and `URP-2D-Balanced.asset` (30 FPS fallback / low-thermal profile, reduced particle budget).
- **Orthographic Camera**:
  - Reference viewport: `1920×1080` (`16:9` landscape), `Pixels Per Unit (PPU) = 100`.
  - Orthographic `Size = 5.4` (`1080 / (2 * 100)`), mapping `100` reference pixels to `1.0` Unity world unit.
  - Camera shake, zoom, and Dutch-angle tilt operate on a dedicated child `CameraShakePivot` transform so base framing coordinates remain invariant.

## 2. Canonical Sorting Layers (`TagManager.asset`)
Maintain strict back-to-front draw order across Battle and Narrative scenes:
1. `Background` (`Order 0..9`) — 16:9 environment plates (`bg_forest_whispering_ash`, `bg_bell_tower_interior`) and multi-plane parallax layers.
2. `EnvironmentMid` (`Order 0..9`) — Ground decals, tactical formation rings, shadow ellipses.
3. `VfxBehind` (`Order 0..99`) — Aura rings, ground sigils, back-layer spell circles.
4. `Units` (`Order = Mathf.RoundToInt(-worldY * 100f)`) — 2-head SD Chibi unit sprites (`Battle`) or knee-up Light Novel portraits (`Story`), Y-sorted so foreground units naturally overlap background units.
5. `VfxFront` (`Order 0..99`) — Slash arcs, projectiles, hit sparks, bell shockwaves, floating damage numbers.
6. `CutIn` (`Order 0..99`) — Ultimate skill portrait cut-in banners and speed-lines.
7. `ScreenVeil` (`Order 0..99`) — Fullscreen flash, vignette, and scene transition fades.

## 3. Runtime `Sprite.Create` Coordinate & Pivot Conversion
`content/base/art/art_manifest.json` and `unity_export_manifest.json` store top-left image coordinates (`x, y` from top-left) alongside precomputed Unity bottom-left pivots (`unity_pivot: { x, y }`).
- **Rect Conversion (Top-Left to Unity Bottom-Left)**:
  Given texture height `H` and top-left frame `(x, y, w, h)`:
  ```csharp
  float unityRectY = texture.height - frame.y - frame.h;
  Rect rect = new Rect(frame.x, unityRectY, frame.w, frame.h);
  ```
- **Normalized Foot Pivot Conversion**:
  Given `pivot_x` and `foot_y` (measured from top in `[0, 1]`):
  ```csharp
  Vector2 unityPivot = new Vector2(slice.pivot_x, 1.0f - slice.foot_y);
  Sprite sprite = Sprite.Create(texture, rect, unityPivot, 100.0f, 0, SpriteMeshType.FullRect);
  ```
  Always use `SpriteMeshType.FullRect` on animated 16-cell chibi atlas frames so transparent padding is never tight-cropped out of alignment across frames.

## 4. Data-Driven Combat VFX (`content/base/vfx/vfx_presets.json`)
The battle screen is UI Toolkit, so VFX are drawn there too (a URP world-space stage would render under the UI units):
- `Uomd.Core.Vfx` (engine-free, tested headlessly): `VfxPack` reads the pack with the content-schema defaults, `VfxTimeline` compiles a preset into nodes with closed-form states (port of `VfxStage.ts`), `VfxCanvas` + `VfxTextureArt` rasterise the 11 procedural sprites of `textures.ts`.
- `Uomd.Scenes`: `UomdVfxPlayer` creates/updates/removes the node elements on the ground/fx/overlay layers; `VfxShapeElement` draws the 10 vector shapes with `Painter2D`.
- `BattleScreenController` calls presets where `BattleScene.ts` did (cast sigil, dash/cast, skill presets with camera cues, projectile/pillar, slash + impact, heal/shield/status sigils); hit-stop slows the battle's own clock.
- Honour `ReducedMotion` (no effects) and `ReduceFlash` (no flashes, shapes or particles). UI Toolkit has no additive blending yet.

## Reference Guides
- [Sprite Slicing & Bottom-Left Pivot Math](references/sprite-slicing-and-pivots.md)
