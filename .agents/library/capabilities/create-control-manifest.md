# create-control-manifest

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Flat must-do/never-do rules sheet per system and layer, extracted from Accepted ADRs. ADRs explain why; this is actionable.

Original workflow coverage (the source retains the full procedures and examples):

- 1. Load All Inputs
- ADRs
- Project Config
- Engine Reference
- Existing Artifacts
- 2. Extract Rules from Each ADR
- Required Patterns (from the ## Decision section)
- Forbidden Approaches (from "Alternatives Considered" sections)
- Performance Guardrails (from "Performance Implications" section)
- Engine API Constraints (from "Engine Compatibility" section)
- Layer Classification
- 3. Add Global Rules
- From project config (project.yaml, else technical-preferences.md):
- From deprecated-apis.md:
- From current-best-practices.md (if available):
- From technical-preferences.md forbidden patterns:
- 4. Present Rules Summary Before Writing
- Control Manifest Preview
- 4b. Director Gate — Technical Review
- 5. Write the Control Manifest
- Foundation Layer Rules
- Required Patterns
- Forbidden Approaches
- Performance Guardrails
- Core Layer Rules
- Required Patterns
- Forbidden Approaches
- Performance Guardrails
- Feature Layer Rules
- Required Patterns
- Forbidden Approaches
- Presentation Layer Rules
- Required Patterns
- Forbidden Approaches
- Global Rules (All Layers)
- Naming Conventions
- Performance Budgets
- Approved Libraries / Addons
- Forbidden APIs ([engine version])
- Cross-Cutting Constraints

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/create-control-manifest/SKILL.md` — SHA-256 `7f8234550e7025eb3db8cd8f9e85cf02e545446c6d5e1c304b5e56bbdac8a996`
