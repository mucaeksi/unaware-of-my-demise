# Cutscene and cinematic camera guidance

Use approved scenario, narration, timeline and art. Current Entry evidence: `docs/design/ENTRY_PROLOGUE_CINEMATIC_V002_2026-10-07.md` and newer Entry continuity reports. Do not add lore, spoilers, named extras or chronology from visual staging.

Prepare a shot list recording duration, framing, subjects, layers, transitions, subtitles, audio cues, skip/replay and Reduced Motion. Keep a single deterministic story clock; pause/suspension and speed changes should not cause separate visual/audio clocks to drift. Preserve the existing 120-second Entry contract unless the owner requests a timing change.

Prefer fixed whole-background crops within a shot where motion would shimmer. Animate separate actors/props/environment layers on a Node2D stage; maintain continuity instead of resetting background transforms at every reused image. Preserve foreground clipping above narration/download/touch controls. Camera movement, look-at and shake remain presentation effects with bounded intensity and Reduced Motion fallback.

Skip, replay, back and completion must produce one cleanup/completion outcome. Stop stale voice/tweens/callbacks on exit and reset replay state. Authoritative patch consent/download/install barriers remain intact; a sample preview handoff is not production routing.

Preload only bounded upcoming resources and release outgoing textures after transitions. Use actual import/runtime measurements; avoid inventing mobile budgets. Screenshot capture can perturb timing, so measure no-capture playback separately. Japanese audition takes and draft translation status must not be presented as approved production dubbing.

Validate beginning/middle/end, transitions, skip/replay, pause, long captions, Large Text, Reduced Motion and stable download-byte reporting in the existing native Local UI Preview. Do not restart the runtime absent a concrete lifecycle/debugger problem.
