# regression-suite

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Map test coverage to GDD critical paths, find fixed bugs lacking regression tests, flag drift from new features.

Original workflow coverage (the source retains the full procedures and examples):

- 1. Parse Arguments
- 2. Load Context
- Step 2a — Load existing regression suite
- Step 2b — Load test inventory
- Step 2c — Load GDD critical paths
- Step 2d — Load closed bugs
- 3. Map Coverage — Critical Paths
- 4. Map Coverage — Fixed Bugs
- 5. Detect Coverage Drift
- 6. Generate Report and Suite Manifest
- Report format (in conversation)
- Regression Suite Status
- Critical Path Coverage (audit mode only)
- Bug Regression Coverage
- Coverage Drift Indicators
- Recommended New Regression Tests
- Suite manifest format (tests/regression-suite.md)
- How to run
- Registered Regression Tests
- [System Name]
- Known Gaps
- Quarantined Tests
- 7. Write Output

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/regression-suite/SKILL.md` — SHA-256 `715596b033b3abb1deccf9c81768ff4ee73b0f46368f2c9dd1fb8ee7e4b73970`
