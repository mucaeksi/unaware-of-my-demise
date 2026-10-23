---
description: Run the Unaware of My Demise verification and skill/adapter integrity gate.
argument-hint: "[--quick | --full]"
---

# UOMD Quality Gate

Run the repository's deterministic quality and integrity checks before committing changes locally (D-28).

## Standard Verification Gate

1. **Skill & Adapter Integrity**:
   ```bash
   python3 tools/sync_codex_skills.py --check
   python3 tools/skills_doctor.py
   python3 tools/install_ecc.py --check
   python3 -m unittest discover -s tools/tests -p 'test_*.py'
   ```
2. **Workspace Deploy Gate (`npm run verify`)**:
   ```bash
   npm run verify
   ```
   This executes `npm run lint`, `npm run typecheck`, `npm test`, and `npm run check:content` (proving `content/base` is byte-for-byte reproducible).

## Reporting

Report actual `PASS` / `FAIL` / `BLOCKED` / `UNVERIFIED` outcomes for each step. Under D-28, commit verified changes locally and never run `git push` or deploy Workers by hand.
