---
name: uomd-godot-audio
description: "Review Godot audio buses, stream timing and lifecycle through the existing UOMD Audio Director without adding another manager."
---

# uomd-godot-audio

Read [shared authority](../../standards/authority.md) and [Godot rules](../../standards/godot-development.md). Godot 4.7.2, GDScript, Android portrait 1080×1920, gl_compatibility and strict types remain the target. Codex produces/reviews; Claude integrates runtime changes through a concrete handoff. Shared discovery does not change that ownership.

Use for stream import, buses, cue mapping, pause/resume, crossfade and voice timing. Audio production remains the final Fadyme phase; paid calls and voice selection require their existing owner decisions.

1. Inspect game/scripts/app/audio_director.gd and game/default_bus_layout.tres. Audio is the existing autoload; route Music, Voice and SFX through its public API.
2. Preserve cue IDs, English text/line IDs and Japanese VO. Existing successful Chirp audition WAVs are reused; final 241-line synthesis is separate.
3. Handle linear volume zero as mute, check bus index >= 0 before AudioServer calls, preserve persisted settings and cancel overlapping fades through the existing owner.
4. Reuse bounded players; report retrigger cutoffs, voice overlap and cleanup. No Sound Manager or parallel music autoload is added.
5. Measure duration, loop seams, clipping and output latency. Playback time plus time since mix minus output latency is an estimate and must be clamped/checked around seek, stop and resume; it is not authoritative online timing.
6. Validate background/resume, silent/muted playback, cancellation and replay; listening evidence is required for mix acceptance.

Read [bus and stream review](references/audio-review.md). Modified UOMD adaptation of S02, Apache-2.0; original license, NOTICE, references and file hashes remain in the source archive.
