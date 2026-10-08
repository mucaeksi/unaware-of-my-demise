# camera-systems

Status: ACTIVE: `uomd-camera-systems`.

Purpose: Build game cameras that feel good — 2D follow with a deadzone, look-ahead, smoothing, and level-bounds clamping; 3D third-person orbit with collision and first-person look; plus multi-target framing and a shake hook. Engine-neutral techniques that pair with the engine's camera node and rigs like Unity Cinemachine or Godot Camera2D/PhantomCamera. Use when the user mentions camera follow, follow camera, deadzone, look-ahead, camera smoothing, camera bounds/ limits, third-person camera, orbit camera, first-person look, Cinemachine, or camera jitter.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Core workflow
- Patterns
- 1. Godot 2D built-in follow: smoothing + bounds (don't hand-roll first)
- 2. Frame-rate-independent smooth follow (when you hand-roll it)
- 3. Deadzone + look-ahead (lead the player, ignore jitter)
- 4. 3D third-person orbit with collision push-in
- 5. Screen shake hook (owned trigger lives in game-feel)
- Pitfalls
- References
- Related skills

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/camera-systems/SKILL.md` — SHA-256 `10052b12881f9abe0251aedb4cffc8f82cd0a6431ef488986ea4f86a1d28d4bf`
