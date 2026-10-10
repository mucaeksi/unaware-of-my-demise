# PatchScreen

`ui.patch` · `patch_screen` · DESIGN_DRAFT / V03. [Registry](../SCREEN_REGISTRY.json), [view](../entry/screens/patch_screen.js).

Root: `Control/PatchScreen`. Children: `SafeArea/TopBar/SettingsButton`, `UtilityMenuButton`, `Artwork`, `Body/UpdateStatus`, `DownloadButton`, `Progress`, `Footer`. Account label is `Signed in with Google`; no fabricated email, player name, UID, level or balance.

Google session exists; playable content and player snapshot are not required. English states: checking → update available → downloading → verifying → installing → snapshot sync → ready. Error states distinguish download, file verification and account load. A required restart offers `Close Game`; it cannot enter the Hub directly.

`Download Update` starts a user-requested update. When files are already current, proceed to snapshot sync without downloading. `Enter Game` appears only after verified files and successful snapshot. Main `10b42fb` routes unfinished attempts to recovery, a story-start cursor to the opening/tutorial, and returning players to HubScreen. Preserve this director choice; the earlier sample Hub preview is not the new-player destination.

Settings, Help and the account menu stay available during patch operations. Navigation preserves the operation; returning restores its current state. Progress is indeterminate until the transport reports actual bytes. Optional sizes use the verified manifest/real remaining bytes; never invent a percentage, pack size or completion time. No standalone pause toggle is offered without a transport binding.

Input: session state, content release/pack requirements, transfer state, verification/install outcome, `restart_required`, snapshot result. Signals: `download_requested`, `retry_requested`, `enter_game_requested`, `restart_requested`, `settings_requested`, `help_requested`, `sign_out_requested`.

Current Godot mapping: `Online.sign_in`, `Game.update_content`, `ContentInstaller.install`, `ClientRelease`, `Game.attach`. Existing `Game.attach` checks release before auth and invokes `update_content` for a content mismatch; that update path signs in before fetching authenticated content. The proposed visual session stage can wrap this behavior, but current MessageScreen boot surfaces do not yet implement these pages. Byte progress events and controlled cancellation must be added to the UI adapter during Godot integration.
