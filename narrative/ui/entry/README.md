# Entry screens prototype — V03

[index.html](index.html) is the independent English entry review. Interface/subtitles are English; voice language is Japanese. Serve the repository root with `python -m http.server 8765` and open `/narrative/ui/entry/?scenario=content`.

Pages are separate view files under `screens/`; utility menu/dialog under `components/`; `entry_flow.js` owns local review state; `entry_shell.css` defines shared layout; `copy.en.js` holds stable text keys. [SCREEN_REGISTRY.json](../SCREEN_REGISTRY.json) maps every added page/component to its proposed Godot name/path/signals. [Per-page handoff](../screens/README.md), [flow specification](../ENTRY_SCREEN.md), [verification](../ENTRY_VERIFICATION.json).

Routes: `#sign-in`, `#patch`, `#settings`, `#help`. Normal patch access requires the mock sign-in result. For visual review only, `?scenario=content&preview=patch#patch` seeds a signed-in sample; `#patch` alone cannot bypass sign-in.

Scenarios: `first`, `returning`, `content`, `offline`, `cancelled`, `no_account`, `unavailable`, `maintenance`, `update`, `patch_error`, `verify_error`, `restart`, `sync_error`. Error-once scenarios succeed on the next retry. Flows reset in memory on reload; device preferences persist locally and survive sign-out. No real authentication, API, patch or audio operation occurs.
