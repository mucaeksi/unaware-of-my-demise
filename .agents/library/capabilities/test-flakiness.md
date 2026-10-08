# test-flakiness

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Find flaky tests from CI logs — aggregates pass rates, spots intermittent failures, recommends quarantine. After multiple runs.

Original workflow coverage (the source retains the full procedures and examples):

- 1. Parse Arguments
- 2. Locate CI Log Data
- Option A — GitHub Actions (preferred)
- Option B — Local log files
- Option C — No log data available
- 3. Parse Test Results
- 4. Identify Flaky Tests
- Cause classification
- 5. Recommend Action
- 6. Generate Reports
- In-conversation summary
- Flakiness Detection Results
- Flaky Tests Found
- Clean Tests (no flakiness detected)
- Data Limitations
- 7. Update Regression Suite + Optional Report File

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/test-flakiness/SKILL.md` — SHA-256 `01c9988360bbdaaf1d61c1c7857fc28b9dcc6517b2d6d969d368c14bd9d6aa5c`
