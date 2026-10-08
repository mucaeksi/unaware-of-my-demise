# bug-triage

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Re-evaluate open bugs — priority vs severity, assign to sprints, surface systemic trends. Run when the count grows.

Original workflow coverage (the source retains the full procedures and examples):

- 1. Parse Arguments
- 2. Load Bug Backlog
- Step 2a — Discover bug files
- Step 2b — Load sprint context
- Step 2c — Load severity reference
- 3. Classify Each Bug
- Severity (impact of the bug)
- Priority (urgency of the fix)
- Assignment
- Deviation check
- 4. Trend Analysis
- Volume trends
- System hot spots
- Age analysis
- Regression indicator
- 5. Generate Triage Report
- Triage Summary
- P1 Bugs — Fix This Sprint
- P2 Bugs — Fix Soon
- P3/P4 Bugs — Backlog / Won't Fix
- Systemic Issues Flagged
- Trend Analysis
- Recommended Actions
- 6. Write and Gate

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/bug-triage/SKILL.md` — SHA-256 `88986266997d33ae6be8b4de93b8544bcf338117c46ef362c79589fea78192c0`
