# Pending owner main theme

The owner confirmed on 2026-10-05 that the recording is not ready and asked for the opening to be prepared for later delivery.

Reserved runtime path: **`res://assets/audio/music/bgm_main_theme.ogg`**. No production recording or substitute is included here.

When the owner supplies the finished OGG, place it in this directory with that name, import it with Godot, and include it in the initial Android package. The existing startup will load it automatically. A nonempty `flow.title` in `data/content/audio_cues_part1.json` can instead select another delivered cue; the shipped slot remains null until a real assignment is made.

`Audio.play_entry_theme()` starts a five-second fade on the first game-controlled **studio** screen, after Godot's built-in native splash, loops an OGG playback copy, and retains the same player/cursor through studio, title and entry operations. It respects the saved Music bus volume and mute setting. Backgrounding pauses both playback and its fade; resuming continues them. Missing recording means silence, recorded once by `Audio.missing()`.

Audio cannot start during the native Android/Godot boot splash. The required opening file must ship with the app rather than depend on its own first content download. Fadyme's theme is not a fallback. Verify the delivered recording's loop seam, level and device playback when it arrives.
