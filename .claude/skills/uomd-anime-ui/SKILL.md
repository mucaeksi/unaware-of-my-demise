---
name: uomd-anime-ui
description: Design and review Gothic anime game UI for Unaware of My Demise (mobile landscape; PixiJS v8 stage today, DOM/CSS + ARIA layer planned in R10) and the React Control Center. Use for UI screens, typography, layout, safe areas, accessibility and UX audits.
---
# Gothic anime UI

- Read README (R10/R15) and `narrative/` art direction first. Reference canvas 1920×1080 landscape; apply real safe-area insets (`platform/safeArea.ts`) to HUD, modals and touch zones.
- Today all game UI (buttons in `ui/kit.ts`, panels, HUD) is drawn on the PIXI stage; text is `PIXI.Text` with `@fontsource/cinzel` (display, ASCII uppercase) and `@fontsource/cormorant-garamond` (body).
- R10 direction: move menus, lists and modals to a DOM/CSS layer above the stage (`#uomd-ui-layer`, or PIXI `DOMContainer` — see the official `pixijs-scene-dom-container` skill) for ARIA semantics, focus order, text scaling and native scrolling; keep battle/narrative visuals on PIXI. Do not claim DOM/ARIA support that is not implemented.
- Tokens: parchment `#f2e9dc`, antique gold `#d6b36a`, obsidian `#07050c`, crimson `#b84a59`; restrained ornament, readable contrast, physical-size touch targets (at least 48 dp).
- Show exact costs, results and gate reasons before spending; keep gacha rates/pity/history reachable.
- UI/UX Pro Max is a reference tool only; the Control Center (`apps/admin`) is React.
- Verify at phone landscape sizes (for example 1200×540 at 2x), with long strings, loading/error/empty states and keyboard/touch.
