# EntrySettingsScreen

`ui.entry_settings` · `entry_settings_screen` · DESIGN_DRAFT / V03. [Registry](../SCREEN_REGISTRY.json), [view](../entry/screens/entry_settings_screen.js).

Root: `Control/EntrySettingsScreen`. Children: `SafeArea/TopBar/BackButton`, `Title`, `UtilityMenuButton`, `Body/ScrollContainer`, `AudioSection`, `DisplaySection`, `LanguageSection`, `AccountSection`.

Available before and after sign-in, before and during patching. Local controls: Music, Voice and Sound Effects volume; Standard/Large text; Reduce motion. Fixed language rows: `Text & subtitles — English`, `Voice language — Japanese`. These are information rows, not language dropdowns.

Signed-in account section offers Sign Out confirmation. No account deletion, server/region picker, patch repair or premium/gameplay settings are silently added. Back returns to the current entry foundation (SignInScreen or PatchScreen), preserving its operation. Settings survive sign-out because they belong to the device.

Input: device preferences and session presence. Signals: `back_requested`, `volume_changed`, `text_size_changed`, `reduce_motion_changed`, `sign_out_requested`. Existing AudioDirector has persistent Music/Voice/SFX volumes; use those buses at implementation. The existing in-game `SettingsScreen` is a different class, avoiding name collision. UI accessibility preferences still need a shared app settings binding.

Review prototype stores only preference fields under `uomd.entry.design.preferences.v1` in localStorage; no token, account or player data is stored. Browser storage failure falls back to session memory. It does not play audio. System reduced-motion and the local Reduce motion option both suppress cosmetic animation.
