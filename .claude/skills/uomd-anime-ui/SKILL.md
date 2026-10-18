---
name: uomd-anime-ui
description: Design and review Gothic anime game UI for Unaware of My Demise (mobile landscape; PixiJS v8 stage for battle and story, HTML/CSS + ARIA layer for menus) and the React Control Center. Use for UI screens, typography, layout, safe areas, accessibility and UX audits.
---
# Gothic anime UI

- Read README (R10/R15) and `narrative/` art direction first. Reference canvas 1920×1080 landscape; apply real safe-area insets (`platform/safeArea.ts`) to HUD, modals and touch zones.
- Menus, title, finish, notices and every account screen are HTML (`ui/domKit.ts`, `ui/hubScreen.ts`): real buttons, modals that make the rest inert, native scroll areas, Escape for BACK/CLOSE, laid out in the same 1920×1080 reference px as the stage. Battle and story HUD stay on PIXI (`ui/pixiKit.ts`, buttons mirrored to focusable ARIA buttons). Text uses `@fontsource/cinzel` (display, ASCII uppercase) and `@fontsource/cormorant-garamond` (body); both kits share the baked panel drawing.
- Tokens: parchment `#f2e9dc`, antique gold `#d6b36a`, obsidian `#07050c`, crimson `#b84a59`; restrained ornament, readable contrast, physical-size touch targets (at least 48 dp).
- Show exact costs, results and gate reasons before spending; keep gacha rates/pity/history reachable.
- UI/UX Pro Max is a reference tool only; the Control Center (`apps/admin`) is React.
- Verify at phone landscape sizes (for example 1200×540 at 2x), with long strings, loading/error/empty states and keyboard/touch.
