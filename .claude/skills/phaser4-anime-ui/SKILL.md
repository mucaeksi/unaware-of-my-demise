---
name: phaser4-anime-ui
description: Design and review Gothic anime game UI using the Hybrid PixiJS v8 Stage + Modular HTML/CSS DOM UI Architecture (D-23) for mobile landscape and the React administration control center. Use on UI screens, typography, responsive behavior or UX audits.
---
# Gothic Anime Hybrid UI Design (PixiJS v8 + Crisp Native DOM/CSS)
- Read canonical art direction and UI master requirements in `README.md` and `narrative/` first.
- Reference canvas is 1920×1080 landscape, synchronized with `#uomd-ui-layer` DOM/CSS overlays adapting to varying landscape aspect ratios, CSS `env(safe-area-inset-*)`, notch and device pixel ratios.
- Render `@fontsource/cinzel` and `@fontsource/cormorant-garamond` natively in crisp HTML/CSS where applicable, alongside hardware-accelerated PixiJS v8 canvas backdrops and ornaments.
- Use common Gothic tokens for aged parchment (`#f2e9dc`), ink, antique gold (`#d6b36a`), obsidian (`#07050c`), crimson (`#b84a59`), borders, focus rings, disabled states and interaction timing.
- Prepare touch-first navigation and semantic ARIA (`role`, `aria-label`, `aria-live`) for story, roster, summon, team, inventory, settings, shop and boss screens.
- UI/UX Pro Max is a reference tool; never imitate unrelated SaaS layouts on the game client. Admin panel uses React components.
- Verify state accessibility, text scaling, localization overflow, keyboard navigation, touch targets and loading/error/empty states at real mobile viewport sizes.
