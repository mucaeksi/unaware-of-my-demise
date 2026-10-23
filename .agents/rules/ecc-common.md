# ECC 2.2.3 Core Rules (Antigravity / Argon 4 Compact Summary)

> Root `README.md` and `AGENTS.md` take precedence. Full verbose rules live in `.claude/rules/ecc/common/`.

- **Minimalism & Ponytail (`ultra`)**: Make the smallest change that completely solves the task. Keep files focused (`< 800` lines), functions small (`< 50` lines), and avoid speculative abstractions or unapproved dependencies.
- **Immutability & Error Handling**: Prefer immutable state transformations. Catch and handle errors explicitly with typed/structured context; never silently swallow exceptions.
- **Testing & Verification**: Write deterministic unit/integration/E2E tests covering happy paths, edge cases, and error paths. Run `npm run verify` (`lint` + `typecheck` + `test` + `check:content`) before committing.
- **Security**: Validate all external inputs at system boundaries (`packages/contracts` / Zod). Never hardcode secrets, log tokens/PII, or concatenate raw SQL (always bind D1 prepared statements).
- **Delivery (D-28)**: Create reviewable Conventional Commits (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`) locally on `main`. **Never run `git push` or `wrangler deploy` from an agent session** — the owner pushes via GitHub Desktop.
