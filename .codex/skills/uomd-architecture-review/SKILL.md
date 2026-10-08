---
name: uomd-architecture-review
description: "Assess a scoped UOMD architecture boundary or proposed presentation change against current ADRs and runtime ownership."
---

# uomd-architecture-review

Start with uomd-graphify, then read current docs/ARCHITECTURE.md and relevant decision/implementation files. Trace real state ownership, adapters/events, dependencies and change impact. Preserve working architecture; justify any new boundary with a demonstrated technical need and concrete alternatives. Keep UI separate from authoritative rewards/progression. Return a scoped recommendation/findings and missing evidence without automatically replacing singletons, routers or backend contracts.
