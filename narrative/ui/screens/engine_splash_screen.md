# EngineSplashScreen — ui.engine_splash

Status: **IMPLEMENTED; local Godot 4.6.3 viewport reviewed; Android/4.7.2 pending**. Text presentation is a candidate.

The first game-controlled frame shows `Godot` and `ENGINE` centered on the shared ink background, with Inter, bone lettering and a thin bronze rule. SafeAreaContainer handles viewport insets. This follows the native black boot splash; native splash audio is not claimed.

Scene: `res://scenes/ui/startup/engine_splash_screen.tscn`. Script: `res://scripts/ui/startup/engine_splash_screen.gd`. Shared view builder: `startup_splash_screen.gd`. Parent: [StartupSequence](startup_sequence.md).

Access: public, no account or patch dependency. No interactive controls or outgoing screen signals. StartupSequence starts the reserved owner main theme here when the recording exists, and emits the phase ID. Defaults: one-second fade in, 1.8-second hold, one-second fade out. Missing audio remains silent. App backgrounding pauses the timeline; Back uses the title's existing quit route.

Sources: [creative restart](../../design/CREATIVE_RESTART_PROMPT.md), [shared palette/fonts](../../design/ART_SYSTEM_V01.md), [implementation and evidence](../../design/STARTUP_AUDIO_V01.md).
