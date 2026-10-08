# UOMD — Core UI Skeleton / Entry Flow v001

**Status:** Skeleton approval candidate  
**Target:** Godot 4.7.2 Standard / Android portrait 1080×1920 base  
**Scope:** Title → Sign In → Patch → entry utility / sign-out confirmation

## Source-aligned behavior
- Godot's native splash remains first and is not redrawn.
- The game-controlled sequence reveals Title after SovTaym presentation.
- Sign in uses Google only.
- Settings and Help are public before playable content is available.
- Sign Out only appears with a Google session and requires confirmation.
- Patch states distinguish checking, update available, downloading, verifying, installing, snapshot sync and ready.
- No fake email, UID, balance, update percentage, pack size or ETA is displayed.
- `Enter Game` appears only after verified content and successful snapshot.
- Restart-required must expose `Close Game`, not route directly to Hub.
- New-player / returning-player / recovery routing remains owned by the existing director.

## Visual status
This package locks layout, hierarchy, component usage and state presentation. It does **not** declare the title key art, wordmark or studio emblem final.

Runtime intended fonts: **Cinzel** and **Source Sans 3**, both under SIL Open Font License 1.1. The rendered preview uses local substitute fonts only.

## Files
- `UOMD_UI_Entry_Title_Ready_v001.png`
- `UOMD_UI_Entry_SignIn_Default_v001.png`
- `UOMD_UI_Entry_SignIn_Offline_v001.png`
- `UOMD_UI_Entry_Patch_UpdateAvailable_v001.png`
- `UOMD_UI_Entry_Patch_Ready_UtilityMenu_v001.png`
- `UOMD_UI_Entry_SignOut_Confirm_v001.png`
- `UOMD_UI_Entry_Flow_Board_v001.png`
- `UOMD_UI_Entry_Flow_Spec_v001.json`
