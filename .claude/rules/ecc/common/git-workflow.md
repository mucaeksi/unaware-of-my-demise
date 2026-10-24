# Git Workflow

## Commit Message Format
```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

Note: ECC-managed installs set `"includeCoAuthoredBy": false` in `~/.claude/settings.json`, so commits carry no `Co-Authored-By` trailer by default. To keep Claude attribution, set `"includeCoAuthoredBy": true` or configure `attribution`; ECC never overwrites an explicit choice.

## Pull Request Workflow

When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

> For the full development process (planning, TDD, code review) before git operations,
> see [development-workflow.md](./development-workflow.md).

## UOMD D-28 / D-32 Delivery Policy (Override)

- Agents commit after passing `npm run verify` and reviewing the diff.
- **D-32 (2026-10-24):** Claude Opus 5.5 pushes its verified commits to `main` itself (standing owner approval): fetch first, fast-forward only, never force-push or rewrite history. The push triggers Cloudflare Workers Builds (staging).
- **Never run `wrangler deploy` by hand.** Production/public Play release keeps its separate owner approval.
