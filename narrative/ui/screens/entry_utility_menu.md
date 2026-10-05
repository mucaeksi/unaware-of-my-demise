# EntryUtilityMenu

`ui.entry_utility_menu` · `entry_utility_menu` · shared component. [Registry](../SCREEN_REGISTRY.json), [view](../entry/components/entry_utility_menu.js).

Root: `Control/EntryUtilityMenu`. Children: `SettingsButton`, `HelpButton`, `Divider`, `SignOutButton`. Top-right Settings gear is a direct shortcut; the adjacent account menu exposes Settings, Help and Sign Out. The mute shortcut controls device audio state on the entry foundation.

Settings and Help work without a session or patch. Sign Out appears only with a Google session. All targets are at least 44 CSS px in the review (mapped to safe-area aware Godot presentation). The menu closes on selection, outside tap or Escape/Android Back; Escape restores focus to its trigger. Opening a page does not cancel patch operations.

Signals: `settings_requested`, `help_requested`, `sign_out_requested`, `dismissed`. It receives session presence, not credentials. This is a utility menu, not the later Hub bottom navigation.
