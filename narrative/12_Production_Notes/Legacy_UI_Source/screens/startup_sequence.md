# StartupSequence — ui.startup_sequence

Status: **IMPLEMENTED; tested on local Godot 4.6.3 with the documented GUT compatibility copy; Android/4.7.2 pending**.

Scene: `res://scenes/ui/startup/startup_sequence.tscn`. Script: `res://scripts/ui/startup/startup_sequence.gd`. Signals: `phase_changed(screen_id: String)`, `completed`. Access: public.

Godot draws its own native boot logo first. StoryDirector then installs this overlay above its existing TitleScreen while content loads on the existing worker. Only StudioSplashScreen → TitleScreen are driven by this sine tween; no second Godot text page is created. The title readiness gate opens only after both intro and content loading complete. A programmatic early title tap retains the existing pending-start behavior; pointer input is blocked by the overlay while it is visible.

Default game-controlled duration: 6.2 seconds (one-second studio fade-in, three-second hold, one-second fade-out, 1.2-second title reveal). The native engine splash has its own 1200 ms minimum-display setting and does not emit this component's signals. Fade/hold/reveal/music-fade durations are exported parameters. Each game phase emits once; cancellation kills the timeline, and retries skip the presentation. Pause/focus-out freezes it; resume/focus-in continues it. It owns no audio player: the persistent Audio autoload starts the five-second main-theme fade at the studio and handles subsequent continuity.

This changes presentation and readiness, not server release checks, Google sign-in, content installation or saved-player routing. Actual server operations still start after the existing title tap. No percentage or fictional account data is displayed.

See [current logo/native startup record](../../design/STUDIO_SPLASH_V02.md), [historical v01](../../design/STARTUP_AUDIO_V01.md) and [TitleScreen transition scope](title_transition_screen.md).
