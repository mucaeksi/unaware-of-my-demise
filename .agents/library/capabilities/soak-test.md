# soak-test

Status: DEFERRED: retained for a later owner-selected phase; no automatic activation.

Purpose: Soak test protocol for extended play — what to observe and log for slow leaks, fatigue, late-appearing edge cases.

Original workflow coverage (the source retains the full procedures and examples):

- 1. Parse Arguments
- 2. Load Context
- 3. Define Observation Checkpoints
- 4. Generate the Soak Test Protocol
- Memory / Stability observation items (if focus = memory or all)
- Stability observation items (if focus = stability or all)
- Balance / fatigue observation items (if focus = balance or all)
- 5. Generate the Protocol Document
- Pre-Session Setup
- Baseline (T+0) — Record Before Playing
- Checkpoint Log
- T+[N] minutes
- Post-Session Analysis
- Memory Trend
- Stability Summary
- Balance / Fatigue Summary
- Issues Found
- Verdict: PASS / PASS WITH CONCERNS / NOT ASSESSED / FAIL
- Sign-Off
- 6. Write Output

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.claude/skills/soak-test/SKILL.md` — SHA-256 `b0268c95cc39335008bb7f4122d024adb77cc8e40bb9dfa760b9c267a583a2c0`
