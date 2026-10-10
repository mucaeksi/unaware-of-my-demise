# Existing Audio Director review

Modified 2026-10-09 from S02 (Apache-2.0); original buses-and-effects.md, LICENSE and NOTICE are preserved in the shared source archive.

Inspect Music/Voice/SFX -> Master routing and existing mute/volume persistence. Preserve Audio.set_volume, Audio.play_voice and cue APIs. A missing bus index is an error to report; avoid fallback that hides wrong routing. Cancel stale fades/voice listeners on interruption; bound concurrent players and verify enter/exit/replay counts.

Validate stream duration/format, selected loop settings, peak/clipping and listening level. Prefer appropriate compression for sustained music and decoded short effects after profiling. Latency-adjusted playback estimates can be negative or stale during startup/seek; preserve the VN line/event contract and distinguish device output from engine simulation.

Upstream crossfade/snippet examples are study material; overlapping fades and temporary player swaps are not substitutes for the existing director. No microphone capture, paid synthesis or additional audio owner is enabled by this reference.
