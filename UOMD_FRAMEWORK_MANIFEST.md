# UOMD CCGS Tailored Package Manifest

## Included runtime framework

- `.claude/agents/` — 39 Godot-project agents + UOMD asset-pipeline manager
- `.claude/skills/` — retained CCGS workflow skills + UOMD asset pipeline (meta skill-testing tools removed with their harness)
- `.claude/hooks/` — session, checkpoint, asset, commit, push validation
- `.claude/rules/` — Godot/project-specific coding and testing rules
- `.claude/docs/` — tailored framework documentation
- `docs/engine-reference/godot/` — Godot reference
- `production/session-state/` — durable checkpoint location
- `production/session-logs/` — session audit trail location

## Engine scope

Godot only. Unity and Unreal specialist agents are intentionally removed.

## Memory scope

Persistent model memory is not treated as project source of truth.
Use GitHub/project docs and verified Drive material instead.

## Creative scope

Gemini is development-only. The creative staging root is `narrative/`.
Fadyme is the initial canonical reference anchor after owner approval.
