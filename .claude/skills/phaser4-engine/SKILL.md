---
name: phaser4-engine
description: Implement and review Phaser 4 scenes, rendering, sprites, loaders, input and TypeScript architecture for Unaware of My Demise. Use for game client coding, debugging or framework upgrades.
---
# Phaser 4 engine conventions
- First inspect `README.md`, repository structure and installed `node_modules/phaser/types/phaser.d.ts` for exact APIs.
- Use pinned Phaser 4, TypeScript strict, Vite, mobile-first 1920×1080 reference viewport and responsive scaling. Do not copy Phaser 3 examples uncritically.
- Follow Boot → Preload → Menu/Story/Battle state ownership. Dispose scenes, event listeners, tweens, textures and audio intentionally.
- Prefer typed scene events and content identifiers over hard-coded strings. Avoid `any` in public contracts.
- Keep app logic and data models outside Phaser scenes so UI, tests, backend and story compiler share a typed contract.
- All game resources belong to versioned manifests and must fail gracefully when missing.
- Verify with typecheck, production build, and a real playable browser smoke test (black screen, failed network requests and scene transitions).
- Never use `phaser@beta` without explicitly verifying it is the intended release. Check Phaser 4 official docs and installed types.
