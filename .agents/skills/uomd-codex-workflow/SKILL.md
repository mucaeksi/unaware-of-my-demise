---
name: uomd-codex-workflow
description: Maintain UOMD adapter compatibility alongside Claude Opus 5.5 (Decision D-31) using current main, scoped verification, and reviewable local commits.
---
# UOMD adapter workflow (Decision D-31 — Claude Opus 5.5 Exclusive Ownership)

Read root `README.md` completely, then `AGENTS.md` and `docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md`. Under **Decision D-31 (2026-10-24)**, 100% of active engineering, Unity 6 LTS (`apps/unity/`) client migration, and Gemini API creative asset generation are owned exclusively by **Claude Opus 5.5** (`claude-opus-5-5` / Claude Code).

1. Inspect `git status`, current branch (`main`), and recent commits before changes. Preserve existing uncommitted work. Work directly in `E:\Unity` on `main` (D-28).
2. State the task scope briefly. Read relevant project skills under `.claude/skills/` (or `.agents/skills/` adapters) and their canonical references. Inspect code/types before choosing an implementation. Keep **Unity 6 LTS (C#, URP 2D, Runtime UI Toolkit + TextMeshPro)** (`apps/unity/`, Decision D-31), Android-first IL2CPP ARM64, Cloudflare Workers + D1 SQLite only (`apps/api/`), single `eclipse_token` economy, and Google Gemini API approved production media.
3. Implement a complete, bounded change. Never overwrite another agent's uncommitted work or rewrite shared history.
4. For code changes run `npm run verify` (`lint`, `typecheck`, `test`, `check:content`) and `npx vitest run tools/export_unity_bundle.test.ts`. For skill tooling run `python3 -m unittest discover -s tools/tests -p 'test_*.py'`, `python3 tools/sync_codex_skills.py --check`, `python3 tools/skills_doctor.py`, and `python3 tools/install_ecc.py --check`.
5. Under Decision D-28, commit verified changes **locally** on `main` and **never run `git push` or `wrangler deploy` from an agent session** — the owner pushes `main` via GitHub Desktop.
6. Finish with the result, local commit hash, actual verification output, and any material host limitations.
