# asset-audit

Status: ACTIVE: `uomd-asset-audit`.

Purpose: Audit assets against naming conventions, file size budgets, format standards. Finds orphaned assets, missing references.

Original workflow coverage (the source retains the full procedures and examples):

- Measuring file sizes and formats requires Bash
- Insufficient input — check this before producing any report
- Phase 1: Read Standards
- Phase 2: Scan Asset Directories
- Phase 3: Run Compliance Checks
- Phase 4: Output Audit Report
- Summary
- Naming Violations
- Size Violations
- Format Violations
- Orphaned Assets (no code references found)
- Missing Assets (referenced but not found)
- Recommendations
- Verdict: [NOT ASSESSED / COMPLIANT / WARNINGS / NON-COMPLIANT]
- UOMD PROJECT OVERRIDE

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/asset-audit/SKILL.md` — SHA-256 `eadf2885782fc8414fe173f7c44ff3b0834ba24ec5269682e091406af54e76b7`
- `.agents/archive/20261008/sources/.agents/skills/asset-audit/SKILL.md` — SHA-256 `eadf2885782fc8414fe173f7c44ff3b0834ba24ec5269682e091406af54e76b7`
