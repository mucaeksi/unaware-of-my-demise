# rpg

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Build an RPG: stats and leveling, inventory and equipment, quests, branching dialogue, save/load, and combat. Use for an RPG/JRPG, or designing stat, inventory, quest, or combat systems.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Core loop
- Must-have systems
- Design knobs
- Patterns
- 1. Derived stats from base attributes (recompute, never store as truth)
- 2. XP curve + level-up
- 3. Quest objective update driven by game events
- Pitfalls / failure modes
- Composition (build it from these skills)
- References

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/rpg/SKILL.md` — SHA-256 `18fb339feca9ac778e461e64548b11c15d2a446c80bb9f2566355a54f18900ce`
