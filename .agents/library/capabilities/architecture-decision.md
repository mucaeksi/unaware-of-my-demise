# architecture-decision

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Create an ADR documenting a technical decision: context, alternatives considered, consequences.

Original workflow coverage (the source retains the full procedures and examples):

- 0. Parse Arguments — Detect Retrofit / Acceptance Mode
- 1. Load Engine Context (ALWAYS FIRST)
- 2. Determine the next ADR number
- 3. Gather context
- 3a: Architecture Registry Check (BLOCKING gate) — do this FIRST
- Existing Architectural Stances (must not contradict)
- 3b: Existing ADRs and Related GDDs — registry-scoped, never unbounded
- 4. Guide the decision collaboratively
- 5. Generate the ADR
- Status
- Date
- Last Verified
- Decision Makers
- Summary
- Engine Compatibility
- ADR Dependencies
- Context
- Problem Statement
- Constraints
- Requirements
- Decision
- Architecture Diagram
- Key Interfaces
- Implementation Guidelines
- Alternatives Considered
- Alternative 1: [Name]
- Alternative 2: [Name]
- Consequences
- Positive
- Negative
- Risks
- GDD Requirements Addressed
- Performance Implications
- Migration Plan
- Validation Criteria
- Related

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/architecture-decision/SKILL.md` — SHA-256 `6b3b43c9d0f4ace6411da4ab88c4fcdcf8f0fe377a1fc836ebed4e9ea8e8af3e`
