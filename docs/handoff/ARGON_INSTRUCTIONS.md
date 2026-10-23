# Instructions for Argon — 2026-10-20

Short, binding rules for working in this repository. **Start with [ARGON_HANDOFF_2026-10-21](ARGON_HANDOFF_2026-10-21.md)** (Argon owns the whole project from 2026-10-21) **and [ARGON_ART_DIRECTOR](ARGON_ART_DIRECTOR.md)** (D-30: Argon is the Art Director and owns `narrative/` and all art, animation, VFX, banner, video and audio work). They come from incidents in the last two days; each rule says why. The full brief is the [README](../../README.md); the current gap list is [REVIEW_2026-10-20](../REVIEW_2026-10-20.md).

## 1. Where to work (D-28, from 2026-10-20)

- Work in the repo checkout on `F:\unaware-of-my-demise`. The owner pushes `main` only. Agents edit locally and commit locally. If another checkout is in use, work in a task branch/worktree and preserve the other session's edits.
- Branches/worktrees are allowed only when another checkout is active or to isolate a task. Do not push or deploy from this branch; the owner decides the push. That is a hard D-28 gate.
- `F:\unaware-of-my-demise` is the repository root for all edits, tests and commit work; keep `README.md`, `narrative/`, `content/` and `tools/` consistent.
- Do not use a second (forked) repo or a hidden working copy. If you need a separate worktree, make it inside the same local repo and avoid rewriting others' files.

## 2. Required workflow

- Read the README and current task instructions before changes. The README is the engineering master prompt; story canon remains in `narrative/`.
- Split work into small vertical slices relevant to the task; run the smallest relevant verification before making a new commit. If your task affects content, run the matching content build/check and the focused game or browser test.
- Keep the work tree clean and keep a short report with actual PASS / FAIL / BLOCKED / UNVERIFIED evidence in Turkish.
- Before a commit, rerun relevant checks. Do not hide failed verification or "green by assumption".

## 3. Current content/creative ownership — Argon 4 / Antigravity

- **Argon owns the whole project starting 2026-10-21.** This supersedes older model assignments. That includes the story canon and the production/art direction of the game.
- **D-30 (2026-10-23): Argon is the Art Director**. Argon owns `narrative/` and all art, animation, VFX, banner, video and audio work, and is responsible for integrating it into the game.
- Build and ship quality through the actual game pipeline, not by leaving placeholders in `narrative/` or `content/`.
- Keep the `README` and supporting docs in sync with reality; fix stale notes in the same commit as the source change.

## 4. Asset pipeline and art approval

**Rules.**
- Through `tools/ingest_art.ts` only (`init --class unit_sheet|portrait`, then ingest), so every image gets an `content/approved_art/entries/*.json` record with source, model, cost, licence, hashes and the human QC status. Then point the unit at its own atlas in the campaign `art/art_manifest.json` (replacing the borrowed `atlas_mahmut` / `atlas_hero_arcanist` / `atlas_enemy_knight` entry) and run `npm run build:content` (it also regenerates `apps/api/seed/assets.sql`).
- Since D-30 (2026-10-23) Argon approves as Art Director after looking at the unit in game: `npx tsx tools/ingest_art.ts approve <asset_id> --by argon:art-director --note "<what was checked>"`. The owner keeps a veto. `ingest_art.ts verify` and `report` show what is still a candidate. The full creative mandate is [ARGON_ART_DIRECTOR](ARGON_ART_DIRECTOR.md).
- Identity from canon only: [ART_BIBLE](../media/ART_BIBLE.md) §3.1/§3.2 conventions and §4 identity anchors; add an anchor section for each new character from `narrative/06_Characters` before generating. Anything not in canon stays UNKNOWN, not invented.
- Budget: `content/budget/media_budget.json` — 1000 TL (20 USD) per month, at most 3 USD per batch and 3 paid attempts per asset. Steps 1–2 fit one month; log every paid call.
- Verify before each commit: `npm run verify`; open the unit in the Animations studio and in battle on desktop and in the phone-landscape viewport; check alpha edges, foot line on the shadow, facing, frame alignment and readability at battle size.

## 5. Story and canon guardrails

- `narrative/` is authoritative for canon, dialogue, chronology, relationships and spoilers. Preserve stable story IDs and existing continuity unless a concrete owner-approved change is being made.
- Do not invent facts to fill art or gameplay gaps. If there is no canonical source, record it as UNKNOWN and keep the task blocked or written as a proposal.
- Story, UI and content edits must not break the first-vs-continued campaign flow and must preserve the no-gacha story route.
- If a change affects a battle, QR, boss phase, chapter or UI state, verify the actual scenario and update relevant docs or config in the same commit.

## 6. Build, test and release gates

- Use the repo's actual verification flow. When you change assets, code or gameplay, run the relevant checks before saying the task is complete.
- `npm run verify` remains the deploy gate.
- Do not push `main`. Do not deploy staging or release. Those stay with the owner.
- Keep a short Turkish worklog: what changed, what was checked, what passed or failed, and what remains.

## 7. Operational notes

- If a task is blocked by missing provider/tool access, approve budget, legal information or owner product facts, say exactly what is missing and what decision is needed.
- A generated file is not a sign-off; only a verified in-game result and the matching build/test evidence count.
- A stale note or old handoff page is not a binding change. Update the stale note and the source together when the code or workflow changes.

This repository is under D-28 owner push control and D-30 art-direction ownership. The current project brief is still the README; this file is a focused operating summary only.
