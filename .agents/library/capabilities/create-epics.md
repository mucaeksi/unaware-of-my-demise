# create-epics

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Turn GDDs plus architecture into epics — one per architectural module, with untraced requirements. Then /create-stories [epic-slug].

Original workflow coverage (the source retains the full procedures and examples):

- 1. Parse Arguments
- 2. Load Inputs
- Step 2a — Summary scan (fast, fail-open)
- Step 2b — Full document load (in-scope systems only)
- 3. Processing Order
- 4. Define Each Epic
- Epic: [System Name]
- 4b. Producer Epic Structure Gate
- 5. Write Epic Files
- production/epics/[epic-slug]/EPIC.md
- Overview
- Governing ADRs
- GDD Requirements
- Definition of Done
- Next Step
- Update production/epics/index.md
- 6. Gate-Check Reminder

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/create-epics/SKILL.md` — SHA-256 `7a4d61c61be76ffd0008fbbe037c89d39e48681325010d7b60457f34f6ebb07f`
