# create-architecture

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Author the architecture blueprint before code is written. Validates decisions against the pinned engine, flags knowledge gaps.

Original workflow coverage (the source retains the full procedures and examples):

- Phase 0: Load All Context
- 0a. Engine Context (Critical)
- 0b. Design Context + Technical Requirements Extraction
- Technical Requirements Baseline
- 0c. Existing Architecture Decisions
- 0d. Generate Knowledge Gap Inventory
- Engine Knowledge Gap Inventory
- HIGH RISK Domains (must verify against engine reference before deciding)
- MEDIUM RISK Domains (verify key APIs)
- LOW RISK Domains (in training data, likely reliable)
- Systems from GDD that touch HIGH/MEDIUM risk domains:
- 0e. Existing Architecture Document
- Phase 1: System Layer Mapping
- Phase 2: Module Ownership Map
- Phase 3: Data Flow
- Phase 4: API Boundaries
- Phase 5: ADR Audit + Traceability Check
- ADR Quality Check
- Traceability Coverage Check
- Required New ADRs
- Phase 6: Missing ADR List
- Phase 7: Write the Master Architecture Document
- Document Status
- Engine Knowledge Gap Summary
- System Layer Map
- Module Ownership
- Data Flow
- API Boundaries
- ADR Audit
- Required ADRs
- Architecture Principles
- Open Questions
- Phase 7b: Technical Director Sign-Off + Lead Programmer Feasibility Review
- Phase 8: Handoff
- Architecture Complete
- Run These ADRs Next
- Gate-Check Readiness
- Open Questions to Watch

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/create-architecture/SKILL.md` — SHA-256 `7521c92f713a754df4092c62b73aa6efd064e24e95854d568294ad83d6082fc9`
