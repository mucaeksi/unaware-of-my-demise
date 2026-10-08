# godot-resources

Status: ACTIVE: `uomd-godot-resources`.

Purpose: Design data-driven Godot 4.7 games with custom Resource classes: define typed data with class_name + @export, save/load .tres/.res files, instance and duplicate resources, and load on demand with ResourceLoader (incl. threaded loading). Use when modeling items/stats/configs as data in a Godot project, creating .tres resources, or working with custom Resource subclasses and ResourceLoader/ResourceSaver.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Core workflow
- Patterns
- 1. A custom data resource
- 2. Consume resources from a node
- 3. Duplicate before mutating shared data
- 4. Save and load a resource at runtime
- Pitfalls
- References
- Related skills

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/godot-resources/SKILL.md` — SHA-256 `eb5cfe9a2b8523c37f577786fd6ca8ba5bf3b4f9e8c17bcfbe70c5de4771bfef`
