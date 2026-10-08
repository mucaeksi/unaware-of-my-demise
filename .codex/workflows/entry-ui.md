# Entry UI workflow

1. Resolve owner scope and read `.codex/standards/authority.md`, art bible/UI standards, current Entry source spec and runtime reports.
2. Map current controller, reusable scene, Theme and artwork dependencies with `$uomd-graphify`. Keep the actual navigation/data architecture.
3. Draft/update only missing requested UX states, visual direction and measurable criteria. Use existing approval/lock status; ask only for unresolved decisions that actually block the task.
4. Implement the authorized change with editor-aware Godot AI tools or scoped source edits when live editor writes are unavailable.
5. Hot reload safely, refresh the same native Local UI Preview with sample data, inspect logs and capture changed states. Validate relevant touch/back, text/motion/accessibility and async barriers.
6. Run appropriate headless checks. Report observed results and remaining Android/owner-review limits. Update the graph after code changes. Remain on Entry; the owner chooses the next screen.

Available functional agents are in `.codex/agents/`. Delegate only when the owner or applicable skill permits delegation; otherwise perform the same workflow in the current agent. No model/effort overrides are needed.
