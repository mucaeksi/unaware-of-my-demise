# Cloud → main → desktop Godot

Owner direction, 2026-10-09: continue development and validation in cloud, push
completed changes to `main`, and review/play the source pulled through GitHub
Desktop. Remote cloud desktop access, screenshots as the primary review method,
and a separate portable preview package are no longer requested. Preview package
preparation was cancelled; it is not a repository deliverable.

## Desktop steps

1. In GitHub Desktop select `mucaeksi/unaware-of-my-demise` and branch `main`.
2. Save any local Godot edits. Use **Fetch origin**, then **Pull origin** when
   new commits are available. GitHub Desktop does not continuously auto-pull files.
3. Double-click **`OYUNU_AC.cmd`** in the repository root. It checks the version in
   `game/GODOT_VERSION`, completes the imports, then starts the current source in
   a 540×960 window. It finds `GODOT_EXE`, a remembered executable, PATH or the
   existing WinGet installation. If none match, select the installed Godot EXE
   once in the file picker. Download/install is not performed automatically.
   For editing, open **`game/project.godot`** in Godot **4.7.2**.
   The shortcut now defaults to **Desktop Review**: Google sign-in is skipped,
   then Start shows the actual prologue and all three tutorial fights/cutscenes.
   Review checkpoints use `user://desktop_review/`; completing the tutorial and
   choosing Restart opens the local menu. Online account actions require the
   normal game. Use `OYUNU_AC.cmd -Online` for normal Google sign-in, or
   `OYUNU_AC.cmd -ResetReview` to replay the review from the beginning.
   The authoritative editable project is `game/`; `release/current/` is a sealed
   build snapshot and should not be used as the development project.
4. For the existing Local UI Preview open
   `res://scenes/art_review/entry_preview.tscn` and press **F6**. Its phase selector,
   Large Text, Refresh and Entry actions use local sample data. For the normal
   game launch use **F5**; real Google authentication requires the documented
   account/device configuration.
5. An already-running preview uses loaded instances. After pulling, press
   **Refresh/F5 inside the preview** for supported hot-reloaded UI changes; after
   scene/autoload or navigation changes, stop/re-run the preview if needed.
   A source update is not proof that an old running instance has refreshed.

Every shortcut launch reads the current local source; after a pull, close the old
game window and launch again. The shortcut does not fetch/pull Git or overwrite
local edits, and it leaves existing editors/game windows open. Real normal-game
Google authentication retains the existing account/device requirements.

The selected executable and launch logs are kept outside the checkout at
`%LOCALAPPDATA%\UnawareOfMyDemise\desktop-launcher\`. An error remains visible in
the shortcut console; `import.log` and `game.log` provide details. For an explicit
portable installation, run `OYUNU_AC.cmd -GodotPath "C:\path\Godot.exe"`.

## Cloud steps and publishing scope

Use the pinned Godot and existing tests. The cloud graphical editor, runtime and
native LocalUiPreview are available through official Godot AI 4.3.0 authenticated
attach. All 21 project scenes were opened and their hierarchies read; Entry
runtime and native window capture were verified. This is development capability
evidence, not full gameplay/Android-device acceptance for every scene.

Commit only the explicit changed source, creative deliverables and validation
evidence; keep credentials, capability files, personal settings and generated
dependency/editor caches out of that selection. Existing ignore rules are
disabled by owner choice. AAB/base artifacts are stored using Git LFS. Use a
normal fast-forward push; fetch and integrate new owner commits without force
pushing or overwriting local changes.

`main` pushes trigger the repository CI. Configured Worker/admin deployment can
follow successful CI automatically. Do not claim CI or production deployment
passed without checking their result. Android release/Play upload, content
publication and paid Google voice/music batches retain their separate required
owner decisions; a cloud push is not their execution.

The current first-AAB status and remaining voice/music/device work are in
[the fix report](../release/FIRST_AAB_FIX_REPORT_2026-10-09.md) and
[the first-AAB plan](../release/FIRST_AAB_PLAN.md).

## Current role boundary — 2026-10-09

This closing AAB handoff is Codex's final build task. Subsequent Codex work is
game/script review and asset/design production, with Fadyme selected first.
Claude owns runtime fixes/integration and future AABs. Design sources and review
evidence go to `narrative/15_Art_Workbench/`; generated art keeps its actual
candidate/approval status when stored on `main`.
