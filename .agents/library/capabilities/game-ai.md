# game-ai

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Design NPC and enemy decision-making with finite state machines, behavior trees, steering behaviors, and A* pathfinding — engine-neutral algorithms that pair with the detected engine's navigation API. Use when building enemy AI, an FSM or behavior tree, steering/flocking, or pathfinding, or when the user mentions state machine, behavior tree, blackboard, A*, navmesh, seek, or patrol/chase.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Core workflow
- Patterns
- 1. Finite state machine (one state object, explicit transitions)
- 2. Behavior tree tick (composite nodes return a status)
- 3. Steering: seek and arrive (smooth, frame-rate independent)
- 4. A* heuristic must not overestimate (or paths stop being shortest)
- Pitfalls
- References
- Related skills

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/game-ai/SKILL.md` — SHA-256 `c66dc4ff4272373d92714eeb5550131c56a889710129e39e21a860fb8f86c3ac`
