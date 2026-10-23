# ECC 2.2.3 React Rules (UOMD Control Center — `apps/admin`)

> Applies to the React + TypeScript UOMD Control Center (`apps/admin`). Full examples live in `.claude/rules/ecc/react/` and the `react-patterns`, `react-performance`, and `react-testing` skills.

## 1. Component & State Architecture (`coding-style.md` & `patterns.md`)
- Prefer small, single-responsibility function components with explicit named `interface` props (avoid `React.FC` and `any`).
- Compute derived state during render instead of syncing state inside `useEffect`.
- Keep state as local as possible; colocate form, filter, and modal state within the owning Control Center view.
- Use controlled inputs with explicit validation feedback and deterministic loading / empty / error states.
- Preserve UOMD Control Center security invariants: Cloudflare Access JWT, RBAC role checks, CSRF headers on mutations, and immutable audit trail verification.

## 2. React Hooks Discipline (`hooks.md`)
- Call hooks unconditionally at the top level of function components or custom `use*` hooks.
- Use `useEffect` strictly for external synchronization (DOM events, timers, network abort controllers) and always return a cleanup function (e.g. `AbortController.abort()`, `clearInterval`).
- Include all reactive dependencies in `useEffect` / `useMemo` / `useCallback` dependency arrays.
- Do not prematurely wrap values in `useMemo` or `useCallback` unless passed to a memoized child, used in a hook dependency array, or proven expensive.

## 3. Security & Testing (`security.md` & `testing.md`)
- Never render unvalidated HTML (`dangerouslySetInnerHTML`) or expose raw secrets/tokens in Control Center views, logs, or URL query parameters.
- Test user-visible behavior and accessibility roles (`getByRole`, `getByLabelText`) rather than internal component state.
