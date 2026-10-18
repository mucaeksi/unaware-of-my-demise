---
name: uomd-mobile-qa
description: Test and profile Unaware of My Demise web previews and Capacitor Android builds — PixiJS v8 renderer bootstrap, frame time, memory, WebGL context loss, lifecycle, patches and release gates. Browser evidence is not device acceptance.
---
# Mobile and browser QA

- Browser: `npm run dev` (dev conveniences on) or a production build; check `window.__UOMD__.game.renderer.name` (webgl/webgpu/canvas), console/network errors, FPS and PIXI node counts (the `uomd-pixi-live` MCP reports these); Playwright `npm run e2e`.
- Device: Android WebView via `npm run apk -w @uomd/android` / `npm run aab -w @uomd/android` (cross-platform `apps/android/scripts/build.mjs`); release gate `npm run check:release -w @uomd/android`. Physical devices and the Play sandbox are separate R18 evidence.
- Cover: orientation and aspect ratios, safe areas, quality tiers, context loss/restore (`platform/graphics.ts`), background/resume, audio resume, reconnect, low storage, patch signature/hash/partial download/rollback.
- The native shell forces `PREVIEW_FLOW`/`PATCH_LAB` off; dev-only behaviour (`isDevServer()`) must never appear in a built bundle.
- Report PASS/FAIL/BLOCKED/UNVERIFIED with the evidence level (unit, browser, emulator, device).
