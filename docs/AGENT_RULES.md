# Working with more than one agent (Claude + Sol 6.1 + the narrative agent)

Read the root `README.md` (the single master prompt) first. This file only adds the coordination rules between agents.
The owner assigns work; **Claude is the lead engineer** (code, infrastructure, releases). Other agents deliver data and documents.

## 1. Who owns what
| Area | Owner | Others may |
|---|---|---|
| `apps/**`, `packages/**`, `tools/**`, `tests/**`, `wrangler*.jsonc`, `apps/api/migrations/**`, `.github/**` | **Claude** | read; propose changes as text in a handoff file |
| `narrative/**` (canon, side stories, events) | narrative agent / owner | Claude reads; never rewrites canon (README rule) |
| `docs/**` (state docs, runbooks, store texts, specs) | shared | add new files freely; edit the state docs (`BUILD_STATE.md`, `INFRA_ROADMAP.md`, `DECISIONS.md`, `DEV_TRACKER.json`) only if the task says so |
| `content/**` (signed-release data) | Claude | draft data in `docs/handoff/` first |
| Secrets, tokens, keystores, keys | nobody in the repo | never write one into a file, a commit, a PR or a chat |

## 2. How code reaches production (important)
`main` is deployed automatically: **every push to `main` triggers Cloudflare Workers Builds** (lint + typecheck + all tests, then deploy to staging). A push that only touches `narrative/**`, `docs/**` or `*.md` does **not** rebuild the game Worker. Therefore:
- Docs and narrative may go straight to `main`.
- **Anything else goes to a branch named `agent/<name>/<topic>`** (for example `agent/sol/combat-vectors`). Claude reviews and merges it.
- Before every push: `git fetch origin main && git merge origin/main`, then `npm run lint && npm run typecheck && npm test` must pass if you touched code or JSON that code reads.
- Commit messages: `type(scope): what and why`. One topic per commit.

## 3. Handoff protocol
- Tasks for another agent live in `docs/handoff/<AGENT>-TASKS.md` as a checklist (`- [ ] SOL-3 ...`). The agent ticks a box only when the deliverable is committed and its acceptance check passes, and adds one line: commit hash + what is left.
- Questions and proposals for Claude go to `docs/handoff/QUESTIONS.md` (one entry each, newest on top). Claude answers inline and marks it `[answered]`.
- Do not invent technical, gameplay, story or infrastructure facts. If the source files do not say it, write `UNKNOWN: <question>` and ask.
- Report verified facts, assumptions and open decisions separately.

## 4. Platform facts every agent must respect (Cloudflare-first, D-20)
- Source control is GitHub **only as a git host**. No GitHub Actions are used. Build, test gate, deploy, backups and monitoring run on Cloudflare (Workers Builds, Cron Worker `uomd-ops`).
- One main currency (`eclipse_token`, shown as "Bell's Remains"); no Silver Crowns, no Fate's Thread (D-17).
- The server is authoritative for pulls, rewards, purchases, ads and battle results; the client never grants anything.
- Content is data-only patches: no downloadable code. Effects may use only the closed grammar in `packages/content-schema/src/effects.ts`.
- Text style: Turkish for talking to the owner, English for code, identifiers and in-game text unless a localization file says otherwise.

## 5. Work packages for Sol 6.1 (all are documents or data; none needs code or secrets)
Each package states the deliverable path and how it is accepted. Put progress in `docs/handoff/SOL-TASKS.md`.

- **SOL-1 Combat effect specification and test vectors.** Source: `narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/{battle_rules_part1,characters_part1,enemies_part1}.json` and `docs/COMBAT_RULES.md` (the list of missing ops, statuses, selectors). Write `docs/combat/OPS_SPEC.md`: for every missing op/status/selector the exact semantics, stacking, duration, ordering, edge cases, and which characters/enemies use it. Also `docs/combat/vectors/*.json`: small battle scenarios (units, actions, expected per-turn HP/status/focus) that Claude's engine tests will replay. Accepted when every missing op in `COMBAT_RULES.md` has a spec section and at least two vectors, and each ambiguity is listed as `UNKNOWN`.
- **SOL-2 Store and legal texts (TR + EN).** `docs/store/`: Play listing (title, short/full description, release notes), privacy policy, terms, ads and purchases disclosure, Play **Data safety** answers (mapped to what the game really stores: see `apps/api/src/account/service.ts` export/delete), content-rating answers, `app-ads.txt` line. Facts only from the repository; mark anything unknown.
- **SOL-3 Android real-device QA plan.** `docs/QA_ANDROID.md`: step-by-step tests for Google sign-in, purchase (consumable, subscription, pending, refund), rewarded ads (5 per rolling 12 h), UMP consent/privacy options, offline/resume, reinstall/restore, account delete; for each, the expected result and the server-side evidence to check (tables/endpoints named in `apps/api/src`). Accepted when README's "First-AAB acceptance" list is fully covered.
- **SOL-4 Runbook.** `docs/RUNBOOK.md`: how to read Cloudflare logs, roll back a Worker, restore a D1 backup (age private key, `sqlite3 < dump.sql`), rotate the content-signing key, handle a refund/RTDN problem, reset a player. Use the facts in `docs/BUILD_STATE.md`, `docs/AAB_ACCESS_PLAN.md` and `apps/api/src/ops/*`.
- **SOL-5 Media production queue.** `docs/media/QUEUE.md`: per character (20) and enemy (27): the portrait set, chibi sheet and key art to generate, with prompts that follow `narrative/` visual canon, the budget guard in README, and the order of priority (playable tutorial cast first). No generation is started by this task.
- **SOL-6 Localization catalog.** `docs/i18n/STRINGS.md`: every player-facing string in `apps/game/src/**` (read-only) collected with a stable key, English source and a Turkish translation. Claude wires the keys later.
- **SOL-7 Economy tuning proposal.** `docs/economy/TUNING_PROPOSAL.md`: using `docs/ECONOMY_SINGLE_CURRENCY.md`, the economy simulator output (`/admin/api/economy`) and the canon numbers, propose concrete values for task/ad/stage/drop payouts and upgrade fees with the reasoning and the three player archetypes. This is a proposal for the owner; nothing is applied.
- **SOL-8 Side-story to engine data brief.** For each package under `narrative/04_Events/Planned_Content/`: list which battle effects, enemies and rewards it needs that the engine/catalog does not support yet (feeds the combat work). Output `docs/handoff/EVENT_REQUIREMENTS.md`.

## 6. Done means
Committed, pushed (docs to `main`, anything else to its `agent/...` branch), the checklist box ticked with the commit hash, and the acceptance line of the package true. Claude merges code branches only after the gate in section 2 is green.
