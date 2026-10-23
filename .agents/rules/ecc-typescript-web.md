# ECC 2.2.3 TypeScript & Web Rules (`apps/game`, `apps/api`, `apps/admin`, `packages/*`)

> Full verbose rules live in `.claude/rules/ecc/typescript/` and `.claude/rules/ecc/web/`.

- **Type Safety**: Enforce strict TypeScript (`noImplicitAny`, `strictNullChecks`). Prefer `unknown` + narrowing or `packages/contracts` schemas over `any` or unsafe `as` casts.
- **PixiJS v8 + Gothic DOM/CSS (`apps/game`)**: Keep battle/narrative canvas rendering on pure PixiJS v8 (`apps/game/src/core`) and menu overlays in the accessible HTML/CSS + ARIA layer (`apps/game/src/ui/domKit.ts`). Clean up tickers, tweens, textures, and event listeners on scene teardown.
- **Cloudflare Workers + D1 (`apps/api`)**: Keep handlers stateless on Hono + D1 SQLite + R2 + Queues. Enforce server-authoritative combat/economy, idempotency keys, and Cloudflare Access/RBAC checks.
- **Web Accessibility & Vital Budgets**: Maintain semantic ARIA roles, keyboard focus management, `>= 44x44 CSS px` touch targets, WCAG AA contrast, and `prefers-reduced-motion` support.
