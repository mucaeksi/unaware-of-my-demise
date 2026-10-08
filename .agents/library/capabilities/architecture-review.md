# architecture-review

Status: ACTIVE: `uomd-architecture-review`.

Purpose: Traceability matrix mapping GDD requirements to ADRs. Finds gaps, cross-ADR conflicts, engine compatibility. PASS/CONCERNS/NOT ASSESSED/FAIL.

Original workflow coverage (the source retains the full procedures and examples):

- Phase 1: Load Everything
- Phase 1a — L0: Summary Scan (fast, low tokens)
- Phase 1b — L1/L2: Targeted Section Load
- Design Documents
- Architecture Documents
- Engine Reference
- Project Standards
- Phase 2: Extract Technical Requirements from Every GDD
- Pre-load the TR Registry
- Phase 3: Build the Traceability Matrix
- Traceability Matrix
- Phase 3b: Story and Test Linkage (RTM mode only)
- Step 3b-1 — Load stories
- Step 3b-2 — Load test files
- Step 3b-3 — Build the extended RTM
- Requirements Traceability Matrix (RTM)
- Phase 4: Cross-ADR Conflict Detection
- Conflict: [ADR-NNNN] vs [ADR-MMMM]
- ADR Dependency Ordering
- Phase 5: Engine Compatibility Cross-Check
- Version Consistency
- Post-Cutoff API Consistency
- Deprecated API Check
- Missing Engine Compatibility Sections
- Engine Audit Results
- Engine Specialist Consultation
- Phase 5b: Design Revision Flags (Architecture → GDD Feedback)
- GDD Revision Flags (Architecture → Design Feedback)
- Phase 6: Architecture Document Coverage
- Phase 7: Output the Review Report
- Architecture Review Report
- Traceability Summary
- Coverage Gaps (no ADR exists)
- Cross-ADR Conflicts
- ADR Dependency Order
- GDD Revision Flags
- Engine Compatibility Issues
- Architecture Document Coverage
- Verdict: [PASS / NOT ASSESSED / CONCERNS / FAIL]
- Blocking Issues (must resolve before PASS)
- Required ADRs
- Phase 8: Write and Update Traceability Index
- RTM Output (rtm mode only)
- How to read this matrix
- Full Traceability Matrix
- Coverage Summary
- Uncovered Requirements (Priority Fix List)
- Foundation layer gaps
- Core layer gaps
- Feature / Presentation layer gaps
- History
- TR Registry Update
- Reflexion Log Update
- [YYYY-MM-DD] — /architecture-review — 🔴 CONFLICT
- Session State Update
- Coverage Summary
- Full Matrix
- Known Gaps
- Superseded Requirements
- Phase 9: Handoff
- Error Recovery Protocol

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/architecture-review/SKILL.md` — SHA-256 `a08fbede25d5f2cbcc88e310975034470125c1a67bf107236d7398102f0466c3`
