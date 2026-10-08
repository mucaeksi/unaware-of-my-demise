# Active UOMD Codex system

`skills/`: canonical active Codex skills (project namespaced to avoid global duplicates).
`agents/`: six functional standalone TOML custom subagents, inheriting model/effort.
`standards/`: visual, UI, chibi, cutscene, VFX, pipeline, Godot, testing and authority rules.
`workflows/`: Entry UI, animation/cutscene, asset audit, quality and graph/system maintenance.
`references/`: relevant authoring templates, detailed skill references and review checklists.
`scripts/`: portable discovery bootstrap, non-mutating audit and validation tools.
`config.toml`: inherited defaults; no extra permission/model/plugin overrides.

Project instructions are in root AGENTS.md. `.agents/library/` records the consolidated union and provenance; `.agents/archive/` holds inactive originals. Legacy hooks remain preserved and are not assumed compatible. See `MIGRATION_REPORT.md` for evidence and limitations.
