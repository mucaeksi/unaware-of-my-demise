# smoke-check

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Critical-path smoke gate before QA hand-off — runs the automated suite. A failed check means the build is not QA-ready.

Original workflow coverage (the source retains the full procedures and examples):

- Parse Arguments
- Phase 1: Detect Test Setup
- Phase 2: Run Automated Tests
- Phase 3: Check Test Coverage
- Phase 4: Run Manual Smoke Checks
- Phase 5: Generate Report
- Smoke Check Report
- Automated Tests
- Test Coverage
- Manual Smoke Checks
- Missing Test Evidence
- Platform-Specific Results *(only if --platform was provided)*
- Verdict: [PASS | PASS WITH WARNINGS | NOT ASSESSED | FAIL]
- Phase 6: Write and Gate

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/smoke-check/SKILL.md` — SHA-256 `5650cf167fcc450660cc8331832bb081c6eb1c55215725acf900f8c71aceda36`
