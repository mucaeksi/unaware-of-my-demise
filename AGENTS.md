# Unaware of My Demise — Codex project instructions

- Preserve user changes. Owner direction, 2026-10-09: continue work in cloud and commit/push completed, validated changes to `main`; the owner pulls with GitHub Desktop and plays the local Godot project. Current implementation scope is Entry; the owner chooses the next screen. See `docs/coder/CLOUD_MAIN_SYNC.md`.
- Owner-selected collaboration: Codex produces character/environment designs and creative assets; Claude handles coding and integration. The current AAB handoff is Codex's final build/review-fix task. Afterwards Codex only inspects the game and produces assets/designs; Claude owns runtime coding, fixes, integration and future AABs. The owner selected Fadyme first, across all scripts and game contexts. Validated design/review/Graphify deliverables may be pushed to `main`. Store/app publication and paid API batches retain their existing approval requirements. See `docs/ART_AND_CODE_HANDOFF.md`.
- Active skill/agent/standard/workflow source is `.codex/`. Read `.codex/standards/authority.md` when legacy instructions conflict. `.agents/library/` is the consolidated provenance/deferred-capability index. Root `CLAUDE.md` is the current coding handoff; its old takeover instructions are archived and inert.
- Skill discovery uses `.agents/skills/` linked to `.codex/skills/`. After cloning/moving, run `.codex/scripts/bootstrap_skills.ps1`. Do not maintain duplicate skill copies; project skills use `uomd-` names.
- Godot 4.7.2, project root `game/`, GDScript, Android portrait. Preserve actual gl_compatibility renderer, strict typing checks, existing architecture and unrelated plugins. Prefer Godot AI MCP for editor-aware operations and complex scene/resource edits.
- After meaningful scene/UI/gameplay/navigation/animation/resource changes, validate in the real Godot Editor/runtime with relevant logs, inspection and screenshots. Parsing alone is insufficient. Use headless unattended tests and the existing live runtime for UI evidence.
- Keep the existing editor, game and reusable native Local UI Preview open. Use `game/scripts/art_review/preview_session.gd` with local sample data and refresh after each validated phase. Prefer hot reload; restart only for a concrete parse/debugger/lifecycle problem and explain it. Minimize the editor only while tools remain reliable.
- The secondary Production folder and Drive LEGACY originals are read-only. Preserve locked references/provenance; never invent story canon. Read current project/source/decision docs for the task. UI stays English; voice Japanese.
- Current priorities: premium fantasy UI, chibi animation, cinematics/camera, shaders/particles/VFX, visual consistency, asset performance and UX review. Combat AI, economy, summon algorithms and progression are deferred. Summon/character presentation work requires the owner's screen selection.
- New character/environment art work is staged in `narrative/15_Art_Workbench/`; current canon/reference sources remain in their existing folders. Preserve stable IDs and source bytes. Runtime promotion follows the explicit art-to-code handoff.
- Cloud coding/builds may use a GitHub checkout with the pinned Linux toolchain. Keep desktop Editor/runtime/Local UI Preview open when available; a cloud environment without GUI must report native visual validation as pending and use the authorized desktop MCP bridge when available.

## Current first-AAB request

The owner explicitly authorized Codex to fix the review findings and restore
missing dialogue before concentrating on character/environment design. Prioritize
the first AAB; see `docs/release/FIRST_AAB_PLAN.md`. Japanese voice and music use
Google APIs in a step-by-step collaboration with the owner. This closing task does not expand deferred systems or authorize paid batches or
store publication. Validated `main` pushes are explicitly authorized above.
After this handoff, further AAB builds and runtime fixes belong to Claude. See
`narrative/15_Art_Workbench/characters/fadyme/audit_v001/README.md` for the owner-selected
Fadyme audit and design scope. Character designs still follow the established handoff.

## Graphify

For project/codebase questions with an existing graph, first run `graphify query "<topic>"`; use path/explain for relationships/focused context. Never read graphify-out/graph.json directly. Dirty outputs do not justify skipping queries. Use wiki/index.md when present for broad navigation; GRAPH_REPORT.md only for broad architecture or insufficient scoped results. `/graphify` uses the installed skill; `$uomd-graphify` adds project-specific maintenance.

After code changes run `graphify update .`, then rebuild Godot/directed/parallel coverage:

```powershell
& (Get-Content graphify-out/.graphify_python) tools/graphify_project.py --refresh
```

The project helper preserves unchanged document fragments and flags changed semantics without an external LLM API.
