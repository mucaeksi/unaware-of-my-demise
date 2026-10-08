# security-audit

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Security audit — save tampering, cheat vectors, network exploits, data exposure, input validation. Before public or multiplayer release.

Original workflow coverage (the source retains the full procedures and examples):

- Phase 1: Parse Arguments and Scope
- Phase 2: Spawn Security Engineer
- Phase 3: Audit Categories
- Engine pattern sets — read this before any Category below
- Category 1: Save File and Serialization Security
- Category 2: Network and Multiplayer Security (skip if single-player only)
- Category 3: Input Validation
- Category 4: Data Exposure
- Category 5: Cheat and Anti-Tamper Vectors
- Category 6: Dependency and Supply Chain
- Phase 4: Classify Findings
- Phase 5: Generate Report
- Executive Summary
- CRITICAL Findings
- SEC-001: [Title]
- HIGH Findings
- MEDIUM Findings
- LOW Findings
- Accepted Risk
- Dependency Inventory
- Remediation Priority Order
- Re-Audit Trigger
- Phase 6: Write Report
- Phase 7: Gate Integration

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/security-audit/SKILL.md` — SHA-256 `c7ee7cf8a2e973cf7c931217d757bee8f1eceddb25d7c87c33295ff2f6427fcd`
