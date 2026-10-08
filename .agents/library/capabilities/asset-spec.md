# asset-spec

Status: ACTIVE: `uomd-asset-spec`.

Purpose: Per-asset visual specs plus AI generation prompts from GDDs and character profiles. After the art bible.

Original workflow coverage (the source retains the full procedures and examples):

- Phase 0b: Entity & Screen Inventory (runs when no arguments and no existing inventory)
- Step 1 — Gather from docs
- Step 2 — Build proposed inventory
- Step 3 — Present and collaborate
- Step 4 — Write inventory
- Entities
- UI Screens
- HUD Elements
- Audio
- Phase 0: Parse Arguments
- Phase 1: Gather Context
- Required reads:
- Source doc reads (by target type):
- Optional reads:
- Present context summary:
- Phase 2: Asset Identification
- Phase 3: Spec Generation
- Full mode — spawn in parallel:
- Lean mode — spawn art-director only (skip technical-artist).
- Solo mode — skip both. Derive specs from art bible rules alone, noting that technical constraints were not validated.
- Phase 4: Compile and Review
- ASSET-[NNN] — [Asset Name]
- Phase 5: Write Spec File
- Progress Summary
- Assets by Context
- [Target Type]: [Target Name]
- Phase 6: Close
- Asset ID Assignment
- Shared Asset Protocol
- Error Recovery Protocol

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/asset-spec/SKILL.md` — SHA-256 `e9cac66c06300496a4c4180165b745ed0ba9ef4e8cffa8c097a95f6eeebe5230`
- `.agents/archive/20261008/sources/.agents/skills/asset-spec/SKILL.md` — SHA-256 `e9cac66c06300496a4c4180165b745ed0ba9ef4e8cffa8c097a95f6eeebe5230`
