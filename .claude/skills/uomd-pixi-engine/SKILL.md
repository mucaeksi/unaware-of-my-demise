---
name: uomd-pixi-engine
description: Implement, review or debug the Unaware of My Demise game client on pure PixiJS v8 — the app shell and scene manager in apps/game/src/core, PixiScene scenes, the PIXI and HTML UI kits, textures/audio assets, tweens, input, quality tiers and context loss. Use for any apps/game rendering or engine work; pair with the official `pixijs` skills for raw PixiJS API questions.
---
# UOMD on pure PixiJS v8 (Decisions D-23a, D-25)

## What exists today
- `core/app.ts` — the shell: one canvas with `PIXI.autoDetectRenderer` (WebGL → WebGPU → canvas), backing store = device pixels capped by the quality tier, an HTML layer (`#uomd-ui-layer`) fitted to the same letterboxed 1920×1080 rectangle, the frame loop (30 FPS tier honoured), `app().events`. `window.__UOMD__.game` is the App (`renderer.name/type`, `scene`, `step(dt)`).
- `core/scenes.ts` — SceneManager: `register/launch/start/stop/pause/resume/restart/bringToTop/getScene/getScenes`. Several scenes run at once (PatchBar overlay, Story over a paused Battle); a paused scene is hidden and not ticked.
- `core/PixiScene.ts` — every scene: `view` (background, camera `root` with zoom/shake, flash and fade veils), `anim` (core/anim.ts Animator: property tweens, yoyo/repeat, `after`, `wait`, `killOf`, timeScale for speed-up, hit-stop and pause), `nav`, `onClose`, `onTick`, `tex(key, frame)`, `attachDom` (fades include HTML layers), `texts()`/`fading` for inspection.
- `core/assets.ts` — images as PIXI textures with named atlas frames, decoded audio, the one Web Audio graph. `ArtLibrary` loads per owning scene and releases on close.
- UI: `ui/pixiKit.ts` (canvas text/panels/Button with ARIA mirror/Bar/toast — battle and story HUD) and `ui/domKit.ts` (the same look as HTML in reference px: real buttons, modals with `inert`, native scrolling, Escape; menus, title, finish). `ui/hubScreen.ts` is the frame of the account screens.
- Combat VFX are data (`content/base/vfx/vfx_presets.json`, capability `vfx_v1`) played by `vfx/VfxStage.ts`.

## Rules
1. Scenes extend `PixiScene` and are registered in `main.ts`. Draw with PIXI directly; put interactive menus in the DOM kit. Never reintroduce a Phaser-style wrapper.
2. Read the installed types (`node_modules/pixi.js/lib`) or the official skills before using a PIXI API. Never write v7 code (`new Application({...})`, `beginFill`, `PIXI.Loader`).
3. Destroy what you create: everything under `view` goes with the scene; anything else (listeners, DOM, textures you own) needs `onClose`. Loads go through `ArtLibrary`/`Assets` with the scene as owner.
4. Time-based behaviour uses the scene's `anim` (so speed, hit-stop and pause apply), not `setTimeout`.
5. Performance: keep node counts and per-frame allocations low, prefer atlases and `ParticleContainer`-style pooling (`vfx/sparks.ts`), measure on real devices.
6. Rendering never decides combat or economy results (`@uomd/combat`, server).

## Verify
`npm run typecheck`, `npm test -w @uomd/game` (`core/*.test.ts`, `vfx/*.test.ts`), `npm run dev` + browser smoke (`?preview_scene=title|prologue|story_t1|battle_t2|hub`), `window.__UOMD__.game.renderer.name`, console errors and FPS; when the pane is hidden drive frames with `__UOMD__.game.step(16)`. The `uomd-pixi-live` MCP automates inspection; `npm run e2e` runs the Playwright suite against the local stack.
