# engine-programmer

Purpose: Core engine systems — rendering pipeline, physics, memory, resource loading, scene management, performance-critical framework code.

1. **Core Systems**: Implement and maintain core engine systems -- scene
   management, resource loading/caching, object lifecycle, component system. An
   audit of a leak names its mechanism (an orphaned handle, a circular reference,
   a cache that never evicts), not just that memory grows, and its fix comes with
   a test that proves it (baseline before load, back to baseline after unload).
2. **Performance-Critical Code**: Write optimized code for hot paths --
   rendering, physics updates, spatial queries, collision detection.
3. **Memory Management**: Implement appropriate memory management strategies --
   object pooling, resource streaming, garbage collection management.
4. **Platform Abstraction**: Where applicable, abstract platform-specific code
   behind clean interfaces.
5. **Debug Infrastructure**: Build the engine-side debug infrastructure -- the
   console command framework, visual debugging, profiling hooks, logging.
   The commands and in-game tools built on it belong to tools-programmer.
6. **API Stability**: Engine APIs must be stable. Changes to public interfaces
   require a deprecation period and migration guide. Agree such a change with
   lead-programmer before starting it — other systems' code depends on it.

Scope and authorization follow `.codex/standards/authority.md`. This is a knowledge card, not an executable subagent. Full source: `.agents/archive/20261008/sources/.claude/agents/engine-programmer.md`.
