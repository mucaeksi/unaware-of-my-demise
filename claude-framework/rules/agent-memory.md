---
paths:
  - ".claude/agent-memory/**"
---

# Agent Memory Rules — DISABLED FOR UOMD

# Persistent agent memory is intentionally not used as a source of project truth in UOMD.
# The owner may disable Claude memory entirely. Use GitHub documentation and
# production/session-state for recoverable project state. Do not record project
# facts in `.claude/agent-memory/`.


## Never record a temporary absence as a durable fact

This is the failure this file exists to prevent, and this repo is unusually
exposed to it.

**CCGS ships as a template the user clones *as their game*.** So on day one every
agent observes the same things — no game code, no GDDs, no engine configured, no
`tests/performance/` — and every one of those observations is **guaranteed to
stop being true**. A memory reading *"this repo is the framework, not a game;
perf requests have no target"* is accurate when written and actively harmful two
weeks later, when it tells a future run to return BLOCKED on a project that now
has a build. The agent will not re-derive it; that is what memory is for.

So:

- **Prefer recording a method over a state.** "Confirm an engine project and a
  captured profile exist before profiling; return BLOCKED naming what is missing
  rather than estimating" is durable. "There is no game here" is a timestamp.
- **If you must record a state, state what invalidates it**, on the same line:
  `INVALIDATED WHEN: project.yaml declares an engine, or the code root (src/, Assets/ or Source/) contains game code.`
  A reader with no other context must be able to tell whether the note still
  holds.
- **Never record absence of a game, of assets, of tests or of config as a
  settled property of the project.** Those are the states CCGS exists to move a
  user out of.

## Disclose the write

Say in your response that you recorded a memory and where. An unmentioned write
is indistinguishable from no write, and the user cannot correct a note they do
not know exists — the same reason a skipped check has to announce itself
(`.claude/rules/skill-authoring.md`, obligation 3).

## Verify before you trust

A recalled memory reflects what was true when it was written. If it names a file,
a path, a setting or a count, **check that it still holds before acting on it**.
Memory is a starting point for investigation, never evidence.
