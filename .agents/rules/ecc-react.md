# ECC 2.2.3 React Rules (UOMD Control Center — `apps/admin`)

> Full verbose rules live in `.claude/rules/ecc/react/` and the `react-patterns`, `react-performance`, and `react-testing` skills.

- **Component & State Design**: Use small function components with explicit `interface` props. Compute derived state during render instead of syncing state inside `useEffect`. Colocate local UI state.
- **Hooks Discipline**: Call hooks unconditionally at the top level. Use `useEffect` strictly for external synchronization and always clean up subscriptions, timers, and `AbortController` instances.
- **Control Center Security & Testing**: Preserve Cloudflare Access JWT, RBAC role gates, CSRF mutation headers, and audit trail checks. Never use `dangerouslySetInnerHTML` with untrusted data. Test behavior via accessible queries (`getByRole`, `getByLabelText`).
