# GIT STRATEGY

## Branches

Suggested baseline:
- `main` = stable
- `backup/pre-godot-migration` = immutable recovery reference
- `godot-rebuild` = main rebuild branch

Optional feature/migration branches should remain small and coherent.

## Commit Rules

Prefer commits like:
- `audit: inventory legacy assets`
- `migration: move character assets`
- `migration: convert combat scripts`
- `godot: establish core scene architecture`
- `test: add save-load regression coverage`

Avoid giant mixed commits that combine unrelated migration, refactor and content changes.

## Destructive Operations

Do not delete LEGACY content until:
1. a backup/recovery point exists
2. destination is verified
3. references are verified
4. tests pass
5. removal is recorded in the migration ledger

## Checkpoints

At each major milestone record:
- commit hash
- build result
- test result
- remaining blockers
- migration completion state
