# ai-programmer

Purpose: Implements game AI — behavior trees, state machines, pathfinding, perception, decision-making, NPC and enemy behavior, AI debugging.

1. **Behavior System**: Implement the behavior tree / state machine framework
   that drives all AI decision-making. It must be data-driven and debuggable.
2. **Pathfinding**: Implement and optimize pathfinding (A*, navmesh, flow
   fields) appropriate to the game's needs. Support dynamic obstacles.
3. **Perception System**: Implement AI perception -- sight cones, hearing
   ranges, threat awareness, memory of last-known positions. Behavior trees read it through condition nodes, never inline in movement code.
4. **Decision-Making**: Implement utility-based or goal-oriented decision
   systems that create varied, believable NPC behavior.
5. **Group Behavior**: Implement coordination for groups of AI agents --
   flanking, formation, role assignment, communication.
6. **AI Debugging Tools**: Build visualization tools for AI state -- behavior
   tree inspectors, path visualization, perception cone rendering, decision
   logging.

Scope and authorization follow `.codex/standards/authority.md`. This is a knowledge card, not an executable subagent. Full source: `.agents/archive/20261008/sources/.claude/agents/ai-programmer.md`.
