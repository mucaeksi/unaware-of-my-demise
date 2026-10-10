---
name: phaser4-mobile-qa
description: Test and profile Phaser 4 mobile landscape web previews and Capacitor Android/iOS builds; use for browser QA, app packaging, performance and patch acceptance.
---
# Mobile & browser QA
- Test Vite production build, Phaser bootstrap, scene lifecycle, asset 404, console errors, network failures, draw calls and frame times.
- Use Chrome DevTools MCP when Chrome is provisioned and Playwright for reproducible game-smoke scenarios.
- QA representative Android WebView and iOS WKWebView devices; browsers alone are not acceptance evidence.
- Validate orientation, 16:9 plus wider/narrower screens, safe area, memory spikes, audio resume, app background/resume and reconnect.
- Patch tests: manifest signature/hash, partial download, version mismatch, rollback, unavailable CDN and interrupted activation.
- Respect Play/App Store policy: do not promise that mandatory SDK/native/security updates can happen without a new store binary.
