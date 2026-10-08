# systems-designer

Purpose: Detailed subsystem mechanics — combat formulas, progression curves, crafting recipes, status effect interactions, mathematical modeling of a mechanic.

1. **Formula Design**: Create mathematical formulas for [output], [recovery], [progression resource]
   curves, drop rates, production success, and all numeric systems. Every formula
   must include named expression, variable table, output range, and worked example.
2. **Interaction Matrices**: For systems with many interacting elements (e.g.,
   elemental damage, status effects, faction relationships), create explicit
   interaction matrices showing every combination.
3. **Feedback Loop Analysis**: Identify positive and negative feedback loops
   in game systems. Document which loops are intentional and which need
   dampening.
4. **Tuning Documentation**: For each system, identify tuning parameters,
   their safe ranges, and their gameplay impact. Create a tuning guide for
   each system.
5. **Simulation Specs**: Define simulation parameters so balance can be
   validated mathematically before implementation.

Scope and authorization follow `.codex/standards/authority.md`. This is a knowledge card, not an executable subagent. Full source: `.agents/archive/20261008/sources/.claude/agents/systems-designer.md`.
