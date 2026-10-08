# design-system

Status: ACTIVE: `uomd-design-system`.

Purpose: Section-by-section GDD authoring for one system — walks through each required section, cross-references dependencies.

Original workflow coverage (the source retains the full procedures and examples):

- 1. Parse Arguments & Validate
- 2. Gather Context (Read Phase)
- 2a: Required Reads
- 2b: Dependency Reads
- 2c: Optional Reads
- 2d: Present Context Summary
- 2e: Technical Feasibility Pre-Check
- Technical Feasibility Brief: [System Name]
- Known Engine Capabilities (verified for [version])
- Engine Constraints That Will Shape This Design
- Knowledge Gaps (verify before committing to these)
- Existing ADRs That Constrain This System
- 3. Create File Skeleton
- Summary
- Overview
- Player Fantasy
- Detailed Design
- Core Rules
- States and Transitions
- Interactions with Other Systems
- Formulas
- Edge Cases
- Dependencies
- Tuning Knobs
- Visual/Audio Requirements
- Game Feel
- UI Requirements
- Cross-References
- Acceptance Criteria
- Open Questions
- 4. Section-by-Section Design
- The Section Cycle
- Section-Specific Guidance
- Section A: Overview
- Section B: Player Fantasy
- Section C: Detailed Design (Core Rules, States, Interactions)
- Section D: Formulas
- Section E: Edge Cases
- Section F: Dependencies
- Section G: Tuning Knobs
- Section H: Acceptance Criteria
- Optional Sections: Visual/Audio, Game Feel, UI Requirements, Cross-References, Open Questions
- 5. Post-Design Validation
- 5-pre: Author the Summary
- 5a: Self-Check
- 5a-bis: Creative Director Pillar Review
- 5b: Update Entity Registry
- 5c: Offer Design Review
- 5d: Update Systems Index
- 5e: Update Session State
- 6. Specialist Agent Routing
- 7. Recovery & Resume
- Context Window Awareness

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/design-system/SKILL.md` — SHA-256 `92e55d07242e080fd78856e3b7255375af1234e7660b87c4e1a86091db3d7040`
- `.agents/archive/20261008/sources/.agents/skills/design-system/SKILL.md` — SHA-256 `92e55d07242e080fd78856e3b7255375af1234e7660b87c4e1a86091db3d7040`
