# StartupSequence — ui.startup_sequence

Status: **IMPLEMENTED; tested on local Godot 4.6.3 with the documented GUT compatibility copy; Android/4.7.2 pending**.

Scene: `res://scenes/ui/startup/startup_sequence.tscn`. Script: `res://scripts/ui/startup/startup_sequence.gd`. Signals: `phase_changed(screen_id: String)`, `completed`. Access: public.

StoryDirector installs this overlay above its existing TitleScreen while content loads on the existing worker. EngineSplashScreen → StudioSplashScreen → TitleScreen are driven by a sine tween. The title readiness gate opens only after both intro and content loading complete. A programmatic early title tap retains the existing pending-start behavior; pointer input is blocked by the overlay while it is visible.

Default visual duration: 9.2 seconds (four one-second fades, 1.8 + 2.2 seconds of holds, 1.2-second title reveal). Fade/hold/reveal/music-fade durations are exported parameters. Each phase emits once; cancellation kills the timeline, and retries skip the presentation. Pause/focus-out freezes it; resume/focus-in continues it. It owns no audio player: the persistent Audio autoload handles the five-second main-theme fade and subsequent continuity.

This changes presentation and readiness, not server release checks, Google sign-in, content installation or saved-player routing. Actual server operations still start after the existing title tap. No percentage or fictional account data is displayed.

See [current startup/audio record](../../design/STARTUP_AUDIO_V01.md) and [TitleScreen transition scope](title_transition_screen.md).
