# story-done

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: End-of-story completion review — verifies each acceptance criterion, checks GDD/ADR deviations, prompts code review, updates status.

Original workflow coverage (the source retains the full procedures and examples):

- Phase 1: Find the Story
- Phase 2: Read the Story
- Phase 3: Verify Acceptance Criteria
- Automatic verification (run without asking)
- Manual verification with confirmation (use AskUserQuestion)
- Unverifiable (flag without blocking)
- Test-Criterion Traceability
- Test Evidence Requirement
- Phase 4: Check for Deviations
- Phase 4b: QA Coverage Gate
- Phase 5: Lead Programmer Code Review Gate
- Phase 6: Present the Completion Report
- Story Done: [Story Name]
- Acceptance Criteria: [X/Y passing]
- Test-Criterion Traceability
- Test Evidence
- Deviations
- Scope
- Verdict: COMPLETE / COMPLETE WITH NOTES / NOT ASSESSED / BLOCKED
- Phase 7: Update Story Status
- Completion Notes
- Session State Update
- Phase 8: Surface the Next Story
- No sprint plan — the minimal path
- With a sprint plan
- Next Up
- Sprint Close-Out Sequence

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/story-done/SKILL.md` — SHA-256 `07cbbed6a0d8b3d215389b2778ed588c2af2eb6116df19bf55bcb55fb57edb3c`
