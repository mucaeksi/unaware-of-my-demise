---
name: phaser4-engine
description: Implement and review PixiJS v8 scenes, WebGL2/WebGPU 2D stage rendering, sprites, asset loaders, tweens, DOM/CSS UI overlay and TypeScript architecture for Unaware of My Demise (Decision D-23, compatibility alias phaser4-engine). Use for game client coding, debugging or framework upgrades.
---
# PixiJS v8 + Modular DOM/CSS UI Engine Conventions (D-23)
- First inspect `README.md`, `docs/DECISIONS.md` (D-23), repository structure and installed `pixi.js` v8 types (`node_modules/pixi.js/lib/index.d.ts`) for exact APIs.
- Use pinned **PixiJS v8** (`pixi.js` ^8.x) for Layer 1 (GPU 2D stage at 1920×1080 reference coordinates) and **Native HTML/CSS DOM** (`#uomd-ui-layer`) for Layer 2 (menus, modals, scrollable lists, HUD and accessibility semantics), with TypeScript strict and Vite.
- Follow `Boot` → `Splash` → `Studio` → `Title` → `Prologue` / `Story` / `Battle` / `Home` state ownership via the deterministic `SceneManager` and `BaseScene` compatibility bridge. Dispose scenes, DOM overlays, event listeners, tweens, timers, textures and audio intentionally on shutdown.
- Prefer typed scene events and content identifiers over hard-coded strings. Avoid `any` in public contracts.
- Keep app logic and data models outside rendering scenes so DOM UI, PixiJS stage, tests, backend and story compiler share a typed contract.
- All game resources belong to versioned manifests and must fail gracefully when missing.
- Verify with typecheck, production build, and a real playable browser smoke test (black screen, failed network requests, WebGL context recovery and scene transitions).
