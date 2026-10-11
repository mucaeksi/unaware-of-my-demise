---
name: uomd-codex-workflow
description: Develop UOMD alongside Claude using isolated worktrees, current main, scoped verification and reviewable commits; use for repository changes and delivery coordination.
---
# UOMD development with Codex

Read root README completely, then AGENTS.md. README is the master engineering prompt; narrative/ is the canon. The owner explicitly authorized Codex development alongside Claude. Historical agent ownership tables do not override the current assignment.

1. Inspect git status, current branch, worktrees and recent main commits before changes. Preserve existing uncommitted work. Fetch main and create a task branch in an isolated worktree when another checkout is in use. Do not repurpose another agent's checkout or shared environment variables.
2. State the task scope briefly. Read relevant project skills under `.agents/skills/` and their canonical references. Inspect code/types before choosing an implementation. Keep Phaser 4, Android-first, D1-only, single `eclipse_token` economy and Google-only approved production media.
3. Implement a complete, bounded change. Coordinate through commits and the owner-visible task scope. If another agent changes the same files, inspect the change and integrate deliberately; do not discard their work, assume an old snapshot is current, or force-push.
4. For code changes run relevant tests plus repository lint/typecheck/unit checks. For skill tooling run `python3 -m unittest discover -s tools/tests -p 'test_*.py'` and `python3 tools/sync_codex_skills.py --check`. UI changes need browser evidence when tooling is available; native Android acceptance requires real device/sandbox evidence, not browser mocks. Report actual failures and runtime limits.
5. Inspect the final diff for unrelated changes and secrets. Re-fetch main before publishing. Rebase only the unpublished task branch when needed; resolve conflicts by preserving both intended behaviors and rerun checks affected by integration. Commit and fast-forward main according to the owner's verified-step policy. On a rejected push fetch/integrate again; never rewrite shared history.
6. Main pushes can trigger existing Cloudflare Workers Builds for staging. One pipeline deploys one Worker; the game pipeline owns D1 migrations. Verify deployed version/tag when claiming live behavior. Do not create GitHub Actions or production infrastructure through a skill workflow.

Task-specific user authorization persists. Ordinary reversible development and existing staging work are authorized; permissions, public releases, destructive operations and spending follow README and the session. A generic workflow is not an approval to perform every possible operation.

Finish with the result, commit, actual verification and material limitations. Use monitoring evidence for live claims. Keep Claude files intact when maintaining Codex adapters; refresh and check with `tools/sync_codex_skills.py`, which does not execute source hooks.
