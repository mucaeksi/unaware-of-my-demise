---
name: uomd-anime-ui
description: Design and review Gothic anime game UI for Unaware of My Demise (mobile landscape; Unity 6 LTS Runtime UI Toolkit UXML/USS + TextMeshPro SDF fonts Cinzel & Cormorant Garamond over the URP 2D stage) and the React Control Center. Use for UI screens, typography, layout, safe areas, accessibility, and UX audits.
---
# Gothic anime UI (`Uomd.UI` & `apps/admin`)

- Read README (R10/R15), `narrative/` art direction, and `unity-ui-toolkit` first. Reference viewport is `1920×1080` landscape (`PanelSettings` `ScaleWithScreenSize`, `Match = 0.5`); apply real `Screen.safeArea` insets (`SafeAreaBinder`) to HUD, modals, and touch zones.
- Menus, Title, Sanctum (`Home`), Summon (`Gacha`), Roster, Character Detail, Team Formation, Relics (`Gear`), World Map (`Chapters`), Modes, and Battle/Story HUDs are built with **Unity 6 Runtime UI Toolkit (`UIDocument`, UXML, USS)** and **TextMeshPro SDF** (`Cinzel` for uppercase display/headers, `Cormorant Garamond` for dialogue/body). Decorative borders and overlays must set `picking-mode: ignore`.
- Tokens (`uomd-tokens.uss`): parchment `#f2e9dc`, antique gold `#d6b36a`, obsidian `#07050c`, crimson `#b84a59`; restrained gothic ornament, WCAG AA readable contrast, physical-size touch targets (`>= 48 dp` / `>= 64 px` at `1920×1080`).
- Show exact `eclipse_token` costs, results, and gate reasons before spending; keep gacha rates, pity counter, and pull history reachable within 1 tap.
- UI/UX Pro Max is a reference design system only; the Control Center (`apps/admin`) is React.
- Verify at narrow and ultra-wide phone landscape aspect ratios (`16:9` to `21:9`), with long localized strings, loading/error/empty states, focus navigation, and Android hardware Back (`Escape`) handling.
