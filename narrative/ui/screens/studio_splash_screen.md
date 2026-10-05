# StudioSplashScreen — ui.studio_splash

Status: **IMPLEMENTED; local Godot 4.6.3 viewport reviewed; Android/4.7.2 pending**. Studio name and wordmark remain **PRELIMINARY / CANDIDATE**.

`SovTaym` and `STUDIOS` appear in Cinzel/Inter on the shared ink background, with bone text and a thin bronze rule. This is a plain provisional wordmark; no final emblem or trademark clearance is implied. See [name research](../../design/STUDIO_NAME_RESEARCH_2026-10-05.md).

Scene: `res://scenes/ui/startup/studio_splash_screen.tscn`. Script: `res://scripts/ui/startup/studio_splash_screen.gd`. Shared view builder: `startup_splash_screen.gd`. Parent: [StartupSequence](startup_sequence.md).

Access: public, no account or patch dependency. No interactive controls or outgoing screen signals. The Audio autoload keeps the same entry track without replay. Defaults: one-second fade in, 2.2-second hold, one-second fade out. Safe area and lifecycle behavior follow the engine screen.

Sources: [creative restart](../../design/CREATIVE_RESTART_PROMPT.md), [shared art system](../../design/ART_SYSTEM_V01.md), [implementation and evidence](../../design/STARTUP_AUDIO_V01.md).
