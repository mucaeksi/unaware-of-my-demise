# Runbook: rolling back the Worker (INF-008, INF-011)

Production runs the Worker `unaware-of-my-demise`, deployed only by `.github/workflows/deploy.yml`. Every deploy
records its commit: `GET /v1/bootstrap` answers `source_sha`, and every request log line carries it.

## Rules

- Migrations are never rolled back. They are additive (DEC-0020), so an older Worker keeps working on the newer
  schema; `migrate.sh` in the older checkout warns that the database is ahead and applies nothing.
- An automatic deploy never rolls back: a late CI completion for a commit older than the live one is skipped.
- A rollback is a deliberate, recorded action: a manual deploy run with a reason.
- Rolling the Worker back does not undo data. Wrong state written by the bad release needs
  `docs/runbooks/BACKUP_RESTORE.md`.
- Battle attempts opened under the newer rules are refused with `409 RULES_CHANGED` by the older Worker and are not
  offered for resume (DEC-0024); players start the stage again. Nothing is paid twice.

## Standard rollback (recorded)

1. Find the last good commit: the previous successful run of the Deploy workflow (its summary and the health
   check print the deployed SHA), or `git log --first-parent main`.
2. Actions → Deploy → Run workflow on `main`, with
   - `source_sha`: the full 40-character SHA of the good commit,
   - `reason`: what is broken and the incident reference.
3. The run refuses a commit that is not on `main`, that has not passed CI, or that is older than the live commit
   without a reason. It writes a "Rollback" section (from, to, actor, reason) into the run summary: that run is
   the rollback record.
4. The health check verifies `/healthz`, that `/v1/bootstrap` reports the rolled-back SHA, and sign-in.
5. Run `database/verify.sh` if the bad release could have written state.
6. Fix forward on `main`. The next merge deploys normally (it is newer than the rolled-back commit).

## Emergency rollback (fastest, minutes)

When even a CI-free deploy run is too slow: Cloudflare dashboard → Workers → `unaware-of-my-demise` → Deployments
→ roll back to the previous version. That version carries its own `RELEASE_SOURCE_SHA`, so `/v1/bootstrap` stays
truthful. Afterwards record it in the incident (who, when, from/to SHA), because it leaves no GitHub record, and
make sure the next deploy from `main` is the fix, not the broken commit again.

## Client releases

An Android build cannot be rolled back on players' devices. To stop a broken app version, raise
`MIN_CLIENT_VERSION_CODE` in `server/wrangler.jsonc` (older apps get `426 UPDATE_REQUIRED`) once a fixed build is
available in the store; to stop everyone meanwhile, use maintenance (`INCIDENT.md`).
