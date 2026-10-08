# godot-gdscript-headless-testing

Status: ACTIVE: `uomd-godot-gdscript-headless-testing`.

Purpose: Run GDScript test suites from the command line with `godot --headless`, using a SceneTree/MainLoop runner script that exits non-zero on failure so CI can gate merges. Use when a Godot project needs unit tests without opening the editor, when wiring a CI job (GitHub Actions or similar) that must fail the build on a failing `.gd` test, or when a `godot --headless` invocation hangs, opens a window, or exits 0 despite failed assertions.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Workflow
- Patterns
- 1. Minimal SceneTree test runner with a real exit code
- 2. Testing something that needs a frame, a timer, or a signal
- 3. CI step (GitHub Actions) that gates on the exit code
- Pitfalls
- Related skills

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/godot-gdscript-headless-testing/SKILL.md` — SHA-256 `e7940ca90ae60a9ed00380d5134a3f2d6c9fb20a28da1cdc46ef799b61fb8bcb`
