# Screen handoff library

Every new screen gets an immutable `ui.*` ID, a PascalCase Godot root name, a matching snake_case file stem and a dedicated spec/view. [SCREEN_REGISTRY.json](../SCREEN_REGISTRY.json) records each screen's status: startup scenes are implemented locally, the existing title is reused, and entry redesign targets remain planned.

| Screen/component | ID | Specification |
|---|---|---|
| EngineSplashScreen | `ui.engine_splash` | [engine_splash_screen.md](engine_splash_screen.md) |
| StudioSplashScreen | `ui.studio_splash` | [studio_splash_screen.md](studio_splash_screen.md) |
| StartupSequence | `ui.startup_sequence` | [startup_sequence.md](startup_sequence.md) |
| Existing TitleScreen transition | `ui.title` | [title_transition_screen.md](title_transition_screen.md) |
| SignInScreen | `ui.sign_in` | [sign_in_screen.md](sign_in_screen.md) |
| PatchScreen | `ui.patch` | [patch_screen.md](patch_screen.md) |
| EntrySettingsScreen | `ui.entry_settings` | [entry_settings_screen.md](entry_settings_screen.md) |
| EntryHelpScreen | `ui.entry_help` | [entry_help_screen.md](entry_help_screen.md) |
| EntryUtilityMenu | `ui.entry_utility_menu` | [entry_utility_menu.md](entry_utility_menu.md) |
| SignOutConfirmDialog | `ui.sign_out_confirm` | [sign_out_confirm_dialog.md](sign_out_confirm_dialog.md) |

Shared Control nodes should use stable descriptive names such as `SafeArea`, `TopBar`, `SettingsButton`, `UtilityMenuButton`, `Body`, `PrimaryButton` and `Footer`. Designer metadata stays outside player UI. Text keys are in [copy.en.js](../entry/copy.en.js); player text/subtitles are English, voice Japanese.

These entry utilities ship with the app. They must work before a downloaded content pack, player snapshot, character roster or wallet exists. The EntryFlow controller owns sign-in, downloads and session state; pages emit intent signals and render their supplied state. Opening/closing a page must not start or restart a download.

The entry shell's font, icons and title artwork must also be bundled in the base app. Reuse current TitleScreen's stable art reference `ui/title_key_art`; do not make the first visible artwork depend on the patch it is presenting. The title still has placeholder art; the new shared artwork is a separate review candidate, and final promotion remains open. The owner's future main-theme reservation and local startup evidence are in [STARTUP_AUDIO_V01.md](../../design/STARTUP_AUDIO_V01.md).
