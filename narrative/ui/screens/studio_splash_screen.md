# StudioSplashScreen — ui.studio_splash

Status: **IMPLEMENTED; local Godot 4.6.3 viewport reviewed; Android/4.7.2 pending**. Studio name and wordmark remain **PRELIMINARY / CANDIDATE**.

The raven/hourglass emblem appears above `SovTaym` and `STUDIOS` in Cinzel, with `PRESENTS` in Inter. The silver/old-gold mark is a true-alpha image on a quiet ink/wine/grain shader background; text remains separate editable nodes. Art is a candidate. See [current design/preview](../../design/STUDIO_SPLASH_V02.md) and [name research](../../design/STUDIO_NAME_RESEARCH_2026-10-05.md).

Scene: `res://scenes/ui/startup/studio_splash_screen.tscn`. Script: `res://scripts/ui/startup/studio_splash_screen.gd`. Emblem: `res://assets/branding/sovtaym/v01/emblem.png`. The scene now declares its own nodes; it does not use the former plain-text builder. Parent: [StartupSequence](startup_sequence.md).

Access: public, no account or patch dependency. No interactive controls or outgoing screen signals. This follows Godot's native engine screen and starts the future entry theme at the first game-controlled frame. Audio retains its track/cursor into title/entry. Defaults: one-second fade in, three-second hold, one-second fade out. Aspect-centered texture and SafeAreaContainer preserve the full emblem. Lifecycle behavior is owned by StartupSequence.

Sources: [creative restart](../../design/CREATIVE_RESTART_PROMPT.md), [shared art system](../../design/ART_SYSTEM_V01.md), [implementation and evidence](../../design/STARTUP_AUDIO_V01.md).
