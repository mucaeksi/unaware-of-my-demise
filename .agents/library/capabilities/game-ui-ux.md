# game-ui-ux

Status: ACTIVE: `uomd-game-ui-ux`.

Purpose: Design and build game UI/UX — HUDs, menus, and overlays — that survive every screen: anchor- based responsive layout, resolution/aspect scaling and safe areas, keyboard/gamepad focus navigation, a screen/menu state stack, and event-driven (not polled) HUD updates. Engine- neutral patterns that pair with the detected engine's UI skill. Use when the user mentions HUD, health bar, main menu, pause menu, settings screen, UI layout, anchors, UI scaling, aspect ratio, safe area, controller/keyboard menu navigation, or wiring UI to game state.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Core workflow
- Patterns
- 1. Anchors + containers, not absolute coordinates
- 2. Scale to a reference resolution (one UI, many screens)
- 3. Safe-area inset for notches / overscan
- 4. Gamepad/keyboard focus (UI is unusable on a controller without it)
- 5. Event-driven HUD (decouple UI from game logic)
- Pitfalls
- References
- Related skills

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/game-ui-ux/SKILL.md` — SHA-256 `487350536eb85c3ae551a697a8915775c4a4658bc15b795d380eb94a93a5a502`
