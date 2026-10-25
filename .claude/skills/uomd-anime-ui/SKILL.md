---
name: uomd-anime-ui
description: Design and review the Gothic anime game UI of Unaware of My Demise (mobile landscape, Unity 6 Runtime UI Toolkit, screens ported from the retired TypeScript client) and the React Control Center. Use for screen layout, hierarchy, typography, economy/gacha transparency, accessibility and UX audits.
---
# Gothic anime UI (`apps/unity` & `apps/admin`)

- Implementation rules live in `unity-ui-toolkit`; this skill is the design brief. Read README (R10/R15) and the art
  direction in `narrative/` first.
- **Source of truth for each screen** is its TypeScript scene in `e918b723^:apps/game/src/scenes/` plus `ui/theme.ts`,
  `ui/hubScreen.ts`, `ui/domKit.ts`: layout coordinates (1920×1080), copy, timings, states (loading/empty/error/offline).
  Port them faithfully; improve only what is visibly broken (overflow, clipping, overlap, unreadable contrast) and say so.
- Palette (`UomdThemeTokens` / `uomd-tokens.uss`): void `#0a0610`, ink `#120a18`, plum `#2a1530`/`#4a2548`, silver `#c9b6e4`,
  bone `#e9e2d4`, gold `#b8975a`, gold-hi `#e3c37d`, crimson `#8f1d3a`/`#d4325c`, veil `#b48cff`, text `#efe8f5`, dim `#a99bb8`.
- Type: Cinzel (display, headings, buttons, uppercase, letter-spaced) and Cormorant Garamond (body, dialogue, quotes).
- Layout: landscape phones 16:9 → 21:9 with `match = height`; the TS 1920 band stays centred, HUD hugs real edges inside the
  safe area. One primary action per screen (crimson "hot" button), secondary actions in gold outline.
- Economy: show exact `eclipse_token` cost, balance and gate reason before any spend; gacha rates, pity and history reachable in
  one tap. Never present placeholder numbers as real server data.
- Accessibility: WCAG AA text contrast on art (use `VerticalShade` scrims), ≥ 64 px targets, reduced motion and reduce flash
  honoured, Android Back closes the top overlay.
- Control Center (`apps/admin`, React/Vite) uses its own styles; UI/UX Pro Max is a reference only.
- Review with real captures (`unity_ci.sh capture`) at 16:9 and 21:9, with long strings and the empty/error states.
