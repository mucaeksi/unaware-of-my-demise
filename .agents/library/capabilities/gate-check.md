# gate-check

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Ready to advance between development phases? PASS/CONCERNS/NOT ASSESSED/FAIL with blockers and required artifacts. 'Can we move to production?'

Original workflow coverage (the source retains the full procedures and examples):

- Production Stages (7)
- 1. Parse Arguments
- 2. Phase Gate Definitions
- 2b. Workflow Tier Adjustment
- Per-system overrides (workflow_overrides.system_overrides)
- 3. Run the Gate Check
- Artifact Checks
- Quality Checks
- Cross-Reference Checks
- 4. Collaborative Assessment
- 4b. Director Panel Assessment
- Director Panel Assessment
- 5. Output the Verdict
- Gate Check: [Current Phase] → [Target Phase]
- Required Artifacts: [X/Y present]
- Quality Checks: [X/Y passing]
- Blockers
- Recommendations
- Verdict: [PASS / NOT ASSESSED / CONCERNS / FAIL]
- Accepted Risks (only when the user advanced on CONCERNS)
- 5a. Chain-of-Verification
- 6. Update Stage on PASS
- 6.1 Primary write — project.yaml
- 6.2 Legacy fallback write — production/stage.txt
- 6.3 Verify both writes
- 6.4 Rigor-fit check (advisory — never affects the verdict)
- 7. Closing Next-Step Widget
- 8. Follow-Up Actions

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/gate-check/SKILL.md` — SHA-256 `be9c7ee9b8c0489cc75d33a0c31ae153151e74ed6ab1446fbbcb1c5d784dce7b`
