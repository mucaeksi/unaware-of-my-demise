# ECC 2.2.3 Unity 6 C#, TypeScript & Web Rules (`apps/unity`, `apps/api`, `apps/admin`, `packages/*`)

> Full verbose rules live in `.claude/rules/ecc/typescript/`, `.claude/rules/ecc/web/`, and the `unity-*` skills.

- **Type Safety**: Enforce strict TypeScript (`noImplicitAny`, `strictNullChecks`) in `packages/*`, `apps/api`, and `apps/admin`, and strict `.asmdef` boundaries in Unity 6 C# (`apps/unity`).
- **Unity 6 LTS Client (`apps/unity`, Decision D-31)**: Keep deterministic combat simulation in pure C# (`Uomd.Combat` using `UomdCorePrimitives.g.cs`), stage rendering on URP 2D (`Uomd.Battle`, `Uomd.Narrative`), and menus/HUDs on Runtime UI Toolkit screens built in C# (`UomdHubScreen`, OFL TTF `Cinzel`/`Cormorant Garamond` via USS; no TextMeshPro). Release runtime textures, sprites, and event listeners on scene teardown.
- **Cloudflare Workers + D1 (`apps/api`)**: Keep handlers stateless on Hono + D1 SQLite + R2 + Queues. Enforce server-authoritative combat/economy, idempotency keys, and Cloudflare Access/RBAC checks.
- **Accessibility & Touch Budgets**: Maintain semantic focus management, `>= 48x48 dp` physical touch targets, WCAG AA contrast, `Screen.safeArea` insets, and `ReducedMotion` support.
