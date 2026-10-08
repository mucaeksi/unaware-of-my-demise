# save-systems

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Design save/load for game state — choosing what to serialize, file formats, save slots, atomic crash-safe writes, schema versioning and migration, and autosave. Engine-neutral. Use when the user mentions save system, save/load, game state persistence, save slots, autosave, save file corruption, or migrating old saves to a new version.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Core workflow
- Patterns
- 1. Serialize state as plain data (not engine objects)
- 2. Atomic, crash-safe write (temp + rename)
- 3. Versioned load with migration
- 4. Save slots + throttled autosave
- Pitfalls
- References
- Related skills

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/save-systems/SKILL.md` — SHA-256 `80558e3f013f36429042f08801f975b364c5207773e5354eadb217d82077f000`
