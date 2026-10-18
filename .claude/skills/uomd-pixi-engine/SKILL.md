---
name: uomd-pixi-engine
description: Implement, review or debug the Unaware of My Demise game client on PixiJS v8 — the retained PIXI stage in apps/game/src/engine, scenes, sprites/text/graphics, textures, cameras, tweens, input, quality tiers and context loss. Use for any apps/game rendering or engine work; pair with the official `pixijs` skills for raw PixiJS API questions.
---
# UOMD PixiJS v8 engine (Decision D-23 / D-23a)

## What exists today
- `apps/game/src/engine/index.ts` keeps a **Phaser-style scene API** (`Scene`, `this.add.*`, `tweens`, `time`, `cameras.main`, `input`, `load`) as project code, but **all drawing is PIXI v8**: `Game.syncStage()` mirrors every GameObject into a retained PIXI node each frame (`_px`), then `renderer.render(stage)`.
  - Image/Sprite → `PIXI.Sprite` (frame sub-textures cached by `Texture.pixiFrame`), tint, tint-fill (ColorMatrixFilter), flip, blend modes.
  - Text → `PIXI.Text`; wrapping/metrics stay in the engine because layout code reads `obj.width/height`.
  - Graphics → recorded data ops (`DrawOp`) replayed into `PIXI.Graphics` only when `version` changes; `generateTexture` bakes the same ops to a canvas.
  - Particles, rectangle masks, camera scroll/zoom/shake (per-root wrapper), fade/flash overlays, camera `Vignette` (radial `FillGradient`).
- Renderer: `PIXI.autoDetectRenderer` with preference WebGL → WebGPU → canvas; backing store = device pixels capped by the quality tier (`platform/graphics.ts`). `game.renderer.name/type` are real values.
- HUD/menus are still drawn on the stage. A DOM/CSS UI with ARIA semantics is R10 work, not delivered.
- Migration direction: new code may be written as plain PIXI `Container` subclasses; scenes move off the Phaser-style API one by one (see README §0 / docs/DECISIONS.md D-25).

## Rules
1. New rendering code may use PIXI directly (Containers, filters, meshes) but must be owned by a GameObject or a scene-shutdown hook so it is destroyed with the scene; never leave PIXI objects outside the `Game.stage` sync.
2. Before using a PIXI API, read the installed types (`node_modules/pixi.js/lib`) or the official skills (`pixijs` router → specialised `pixijs-*`). Never write v7 code (`new Application({...})`, `beginFill`, `PIXI.Loader`).
3. Destroy what you create: textures via `TextureManager.remove`, filters, render textures, listeners, tweens and timers on scene `SHUTDOWN`.
4. Performance budget: the sync runs every frame — keep node counts and per-frame allocations low, prefer atlases, avoid `new` in hot loops, measure on real devices.
5. Rendering never decides combat or economy results (`@uomd/combat`, server).

## Verify
`npm run typecheck`, `npm test -w @uomd/game` (engine tests in `src/engine/engine.test.ts`), `npm run dev` + browser smoke (`?preview_scene=title|story_t1|battle_t1|hub`), check `window.__UOMD__.game.renderer.name`, console errors and FPS; the `uomd-pixi-live` MCP automates this. E2E `tests/e2e/game.spec.ts` asserts a GPU renderer.
