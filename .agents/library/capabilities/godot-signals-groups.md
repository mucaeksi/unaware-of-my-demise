# godot-signals-groups

Status: ACTIVE: `uomd-godot-signals-groups`.

Purpose: Build event-driven, decoupled Godot 4.7 gameplay with signals and node groups: declare and emit custom signals, connect with Callables (incl. bind/one-shot), and broadcast to many nodes via groups and call_group. Use when wiring node communication in a Godot project, replacing tight references with signals, emitting/connecting events, or porting 3.x connect("sig", self, "method") code.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Core workflow
- Patterns
- 1. Emit upward, connect from the parent
- 2. Connect flags: one-shot and bind extra arguments
- 3. Groups: broadcast to many nodes
- 4. Await a signal inline
- Pitfalls
- References
- Related skills

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/godot-signals-groups/SKILL.md` — SHA-256 `71d0800c67dda6ccec7ee5757ed8fe4775ca5d7d4cc7438e4e86efe33184fa7d`
