# godot-gdscript

Status: ACTIVE: `uomd-godot-gdscript`.

Purpose: Write idiomatic GDScript for Godot 4.7: static typing, the node lifecycle (_ready/_process/_physics_process), @export/@onready/@tool annotations, signals, and await for asynchronous flow. Use when editing .gd scripts in a Godot project (project.godot), writing or debugging GDScript, or porting 3.x GDScript to 4.x (function signatures, yield to await, export to @export).

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Core workflow
- Patterns
- 1. A typed script with lifecycle, @export, and @onready
- 2. Signals: declare, emit, connect (4.x Callable syntax)
- 3. await — pause until a timer or signal fires (replaces 3.x yield)
- 4. Lambdas, typed arrays, and safe access
- Pitfalls
- References
- Related skills

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/godot-gdscript/SKILL.md` — SHA-256 `3e8e596365c9b2443331b0383522690681ab01502aff47461780b985cb87b1cb`
