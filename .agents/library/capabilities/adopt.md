# adopt

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Brownfield audit — do existing artifacts actually work? Numbered migration plan. Unlike /project-stage-detect, checks compliance not existence.

Original workflow coverage (the source retains the full procedures and examples):

- Phase 1: Detect Project State
- Existence check
- Infer phase (if no project.stage / stage.txt)
- Phase 2: Format Audit
- 2a: GDD Format Audit
- 2b: ADR Format Audit
- 2c: systems-index.md Format Audit
- 2d: Story Format Audit
- 2e: Infrastructure Audit
- 2f: Project Config Audit
- 2g: v1.0 Migration Check
- Phase 3: Classify and Prioritise Gaps
- Phase 4: Build the Migration Plan
- Phase 5: Present Summary and Ask to Write
- Adoption Audit Summary
- Phase 6: Write the Adoption Plan
- Step 1: Fix Blocking Gaps
- Step 2: Fix High-Priority Gaps
- Step 3: Bootstrap Infrastructure
- 3a. Register existing requirements (creates tr-registry.yaml)
- 3b. Create control manifest
- 3c. Create sprint tracking file
- 3d. Set authoritative project stage
- Step 4: Medium-Priority Gaps
- Step 5: Optional Improvements
- What to Expect from Existing Stories
- Re-run
- Phase 6b: Report Review Mode
- Phase 7: Offer First Action

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/adopt/SKILL.md` — SHA-256 `9f126d50097315a0271740b1e2185ede7609ae51c17275ef058ca6693dc3b3c9`
