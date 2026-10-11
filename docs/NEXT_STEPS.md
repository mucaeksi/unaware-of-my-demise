# Next steps and resume protocol (persistent memory for any session)

Owner standing directive (2026-10-11): **work autonomously; when a usage limit ends the session, resume by itself after it resets.** A recurring
routine ("uomd-resume") wakes the session hourly; on every wake follow this file, do the first open item, and keep going until the queue is empty.
If nothing is actionable, answer with one line and stop (do not burn usage on empty loops).

## Resume protocol (every wake)
1. `git status`; commit and push anything uncommitted to `claude/unaware-demise-dev-24ly57`.
2. Background work that may have died on a limit: re-launch workflows with `Workflow({scriptPath, resumeFromRunId})` (completed agents are cached).
   - asset specs: run `wf_9759d639-32e`, script `~/.claude/projects/.../workflows/scripts/asset-skeleton-plan-wf_9759d639-32e.js`
   - battle layout decision: run `wf_0278fb33-ccd`, script `.../battle-layout-decision-wf_0278fb33-ccd.js`
   - full e2e: `npx playwright test -c tests/e2e/playwright.config.ts > .cache/e2e-full.log` (never two stacks at once; never rebuild `content/` while it runs)
3. Then the queue below, top to bottom.

## Queue
1. **Full e2e result** (`.cache/e2e-full.log`): must be green on both projects. If green: push `HEAD:main` (standing owner directive, deploys through Workers Builds).
2. **Battle layout** (`docs/design/BATTLE_LAYOUT.md` from the layout workflow): make the layout a data-driven preset (A current, B arena-lite, C AFK-faithful), render the same battle in each, show the owner side by side screenshots (Turkish message). Do not lock chibi sheet size or background safe zones before the owner picks.
3. **Art generation** (owner: everything is generated from scratch via Google, few attempts, strong prompts; budget guard in `content/budget/media_budget.json`, dry run first, reserve before each paid call, look at every output):
   P0 order: Fadyme portraits, Mahmut portraits (Mahmut has no locked face: first approved portrait becomes his anchor), event illustrations, prologue plates, studio mark (optional), UI icons; chibi sheets and battle backgrounds only after the layout decision.
   Specs: `art_specs/p0/*.json` + `docs/media/specs/*.md`; contract `docs/media/ART_BIBLE.md`; pipeline `docs/media/EXPORT_PIPELINE.md` (`tools/ingest_art.ts` not written yet: write it against the first real outputs; keyer exists in `tools/lib/key.ts`).
4. **Ingest + base art swap** (`content/approved_art/`, `build_content.ts` reads approved entries first), `--strict-art` before the AAB.
5. **F8 new AAB**: version bump, `UomdApp.restart` plugin is written (Java), generated art in the base, `VITE_PREVIEW_FLOW=false`, internal-test upload is an owner step.
6. Later (owner order): UI polish review together, balance last, sound/music last (integrated at the very end).

## Owner-side items (cannot be done by the agent)
AdMob URL verification retry; upload AAB `0.1.1 (2)` or the new one; SHA-1s into the Android OAuth client; Play products; start the Sol 6.1 agent session; confirm studio mark concept/name and Phaser-logo choice (pixel logo is in).

## Rules that must survive a restart
README.md is the only master prompt; narrative canon is never rewritten silently; GitHub is the code source of truth; the Drive legacy archive is never modified;
Turkish chat, concise but technically complete; no paid generation without a dry run and a budget reservation; every GitHub post ends with the Claude Code footer.
