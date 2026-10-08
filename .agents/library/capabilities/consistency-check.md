# consistency-check

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Scan GDDs against the entity registry for cross-document conflicts. Grep-first approach targets conflicting sections, different stats.

Original workflow coverage (the source retains the full procedures and examples):

- Phase 1: Parse Arguments and Load Registry
- Phase 2: Locate In-Scope GDDs
- Phase 3: Grep-First Conflict Scan
- 3a: Entity Scan
- 3b: Item Scan
- 3c: Formula Scan
- 3d: Constant Scan
- Phase 4: Deep Investigation (Conflicts Only)
- Phase 5: Output Report
- Consistency Check Report
- Conflicts Found (must resolve before architecture)
- Stale Registry Entries (registry behind the GDD)
- Unverifiable References (no conflict, informational)
- Clean Entries (no issues found)
- Phase 6: Registry Corrections
- 6b: Append to Reflexion Log
- [YYYY-MM-DD] — /consistency-check — 🔴 CONFLICT
- Phase 7: Session State and Closing
- Recovery / Reference

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/consistency-check/SKILL.md` — SHA-256 `6e75dac4220c6d6ab0d7fd313fa7e5657bc9559c15a269721f74fe79edbe7727`
