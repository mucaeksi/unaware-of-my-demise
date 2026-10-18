---
name: phaser4-mobile-qa
description: Test and profile PixiJS v8 + DOM UI mobile landscape web previews and Capacitor Android/iOS builds; use for browser QA, app packaging, WebGL context recovery, performance and patch acceptance.
---
# Mobile & Browser QA (PixiJS v8 + DOM UI + Capacitor 8)
- Test Vite production build, PixiJS v8 WebGL2/WebGPU bootstrap, DOM overlay synchronization, scene lifecycle, asset 404, console errors, network failures, draw calls and frame times.
- Use Chrome DevTools MCP when Chrome is provisioned and Playwright (`npm run e2e`) for reproducible game-smoke and full-season scenarios.
- QA representative Android WebView and iOS WKWebView devices; browsers alone are not physical-device acceptance evidence.
- Validate orientation, 16:9 plus wider/narrower screens, safe area (`env(safe-area-inset-*)`), WebGL context loss/restoration, quality tiers (`high`/`medium`/`low`), memory spikes, audio resume, app background/resume and reconnect.
- Patch tests: manifest signature/hash, partial download, version mismatch, rollback, unavailable CDN and interrupted activation.
- Respect Play/App Store policy: do not promise that mandatory SDK/native/security updates can happen without a new store binary.
