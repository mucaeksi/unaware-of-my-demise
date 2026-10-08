# code-review

Status: ACTIVE: `uomd-code-review`.

Purpose: Architectural code review — coding standards, SOLID, testability, performance concerns.

Original workflow coverage (the source retains the full procedures and examples):

- Insufficient input — check this before producing any report
- Phase 1: Load Target Files
- Phase 2: Identify Engine Specialists
- Phase 3: ADR Compliance Check
- Phase 4: Standards Compliance
- Phase 5: Architecture and SOLID
- Phase 6: Game-Specific Concerns
- Phase 7: Specialist Reviews (Parallel)
- Engine Specialists
- QA Testability Review
- Phase 8: Output Review
- Code Review: [File/System Name]
- Engine Specialist Findings: [N/A — no engine configured / CLEAN / ISSUES FOUND]
- Testability: [N/A — no story path given / N/A — Visual/Feel or Config story / TESTABLE / GAPS / BLOCKING]
- ADR Compliance: [NOT ASSESSED / NO ADRS FOUND / COMPLIANT / DRIFT / VIOLATION]
- Standards Compliance: [X/6 passing]
- Architecture: [NOT ASSESSED / CLEAN / MINOR ISSUES / VIOLATIONS FOUND]
- SOLID: [NOT ASSESSED / COMPLIANT / ISSUES FOUND]
- Game-Specific Concerns
- Positive Observations
- Required Changes
- Suggestions
- Verdict: [NOT ASSESSED / APPROVED / APPROVED WITH SUGGESTIONS / CHANGES REQUIRED]

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/code-review/SKILL.md` — SHA-256 `a104c61223768f2233d1daa3d90543bf6566c9b6bde6a0b0a9081092c8acd07b`
