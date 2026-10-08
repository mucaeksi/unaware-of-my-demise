# godot-2d-movement

Status: ACTIVE: `uomd-godot-2d-movement`.

Purpose: Implement 2D kinematic character movement in Godot 4.7 with CharacterBody2D and move_and_slide(): platformer run/jump with gravity, top-down 8-direction motion, slope handling, and reading collisions. Use when coding a 2D player or enemy controller, a platformer or top-down character, or fixing move_and_slide()/ is_on_floor() behavior in a .tscn with a CharacterBody2D.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Core workflow
- Patterns
- 1. Platformer controller (gravity, jump, slopes)
- 2. Top-down 8-direction movement
- 3. Reading slide collisions after moving
- 4. Coyote time (forgiving jump just after leaving a ledge)
- Pitfalls
- References
- Related skills

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/godot-2d-movement/SKILL.md` — SHA-256 `67dfa75ea82bb1f6ac63733bddbaf2dabc9950106a1f2c287f55eff6bbe86d4e`
