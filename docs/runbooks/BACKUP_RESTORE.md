# Runbook: backup and restore (INF-011)

Production state lives in one Neon PostgreSQL 18 project (`sweet-cake-52313810`, branch `production`,
aws-eu-central-1). This runbook says what protects it today, how to restore it, and how the restore is rehearsed.

## What protects the data today (verified 2026-10-04)

| Layer | State | Limit |
|---|---|---|
| Neon point-in-time history | on, `history_retention_seconds = 21600` | **6 hours** back (Free plan `free_v3`) |
| Off-site logical backups | `.github/workflows/backup.yml`: nightly 02:23 UTC, `pg_dump` encrypted with `age` to the owner's key, R2 bucket `uomd-db-backups` (private) | **30 days** back (bucket lifecycle rule); owner decision D-05 |
| Branch protection | `production` is not protected | owner decision D-03 |
| Restore rehearsal | `.github/workflows/restore-drill.yml`, monthly + on demand | proves dump → restore → integrity, not PITR |

Consequence: inside 6 hours, Neon's history restores to any second (Restore A); after that, the newest nightly backup
restores the data as it was that night (Restore B), for 30 days. Only the owner's offline age key opens a backup:
GitHub, Cloudflare and the workflow hold the public half only, so a leaked bucket token exposes nothing readable.

## Integrity check (after any restore, rollback or incident)

```bash
DATABASE_URL=<connection string> database/verify.sh
```

Read-only (one `REPEATABLE READ READ ONLY` transaction). It runs `migrate.sh --check` (ledger agrees with the
checkout, no edited migration) and checks that the economic journal explains every currency and item balance of
each account created after the journal existed (migration 0005; older accounts are counted, not checked). Ends
with `integrity ok` or lists every mismatch and exits 1. Tested in `database/test.sh` (a balance changed with
triggers off is caught).

## Restore A: point in time inside the 6-hour window (Neon)

Use for: a bad migration, a bad deploy that wrote wrong state, an accidental mass change.

1. **Stop writes**: put the game in maintenance (`docs/runbooks/INCIDENT.md`, "Maintenance"), so nothing is
   written between the chosen point and the restore.
2. **Find the point**: the last good UTC instant. Worker logs (`request` lines carry `source_sha`, route, status)
   and the deploy run's timestamps narrow it down.
3. **Inspect before restoring**: in the Neon Console, create a branch from `production` at that point in time
   (or use Time Travel queries) and run `database/verify.sh` against it. Do not restore blind.
4. **Restore**: Neon Console → Branches → `production` → Restore → "from history" at that instant. Neon keeps
   the pre-restore state as a backup branch; keep it until the incident is closed.
5. **Check**: `database/verify.sh` against production; `GET /v1/bootstrap` answers; sign in on a device.
6. **Reopen**: end maintenance. Record the incident (INCIDENT.md template), including what players lost between
   the restore point and the stop.

Notes: Hyperdrive points at the branch endpoint, not at a snapshot, so a restore of the same branch needs no
Worker change. Migrations recorded after the restore point are gone from the ledger too; the next deploy applies
them again (they are additive, DEC-0020).

## Restore B: from a logical dump (outside the window, or a new project)

The restore drill is the tested procedure; run the same commands by hand with a nightly backup:

1. Cloudflare → R2 → `uomd-db-backups` → `production/<yyyy>/<mm>/<dd>/` → download the `.dump.age` object of the night
   wanted (the run summary of `backup.yml` names each object and its SHA-256).
2. Decrypt on a trusted machine (Cloud Shell is fine; `sudo apt-get install -y age` there) with the owner's offline key
   file, then remove the key from that machine again:

```bash
age --decrypt --identity uomd-backup-age.key --output production.dump <object>.dump.age
# Client must be the production major (database/POSTGRES_MAJOR); use the direct, non-pooled Neon host.
pg_restore --dbname="$TARGET_URL" --no-owner --no-privileges --exit-on-error production.dump
DATABASE_URL="$TARGET_URL" database/verify.sh
shred -u production.dump uomd-backup-age.key
```

Then point Hyperdrive (`unaware-of-my-demise-production`) at the new database and redeploy. The encryption chain was
tested locally (2026-10-05): PostgreSQL 18 dump → `age` to a recipient → decrypt → byte-identical, `pg_restore --list`
accepts it; the workflow refuses a `BACKUP_AGE_RECIPIENT` that is not an `age1…` public key (a pasted private key).

## Restore drill (rehearsal)

`.github/workflows/restore-drill.yml` (Actions → Restore drill → Run workflow; also monthly on the 1st, 04:41 UTC):

1. `pg_dump` of production over the direct endpoint (read-only, one snapshot), with the production-major client;
2. `pg_restore` into an empty PostgreSQL 18 on the runner, leaving out extensions the target cannot install (Neon adds
   `pg_session_jwt` to `public`; the game schema does not use it) and naming them in the summary;
3. the restored ledger must equal production's; `database/verify.sh` must pass;
4. dump size, dump time and restore time go to the run summary (recovery-time evidence);
5. the dump is deleted; it is never uploaded.

Record each drill's run link and timings in the table below.

| Date (UTC) | Run | Dump | Restore | Result |
|---|---|---|---|---|
| 2026-10-04 | [run 37238173328](https://github.com/mucaeksi/unaware-of-my-demise/actions/runs/37238173328) | — | failed | `pg_restore`: Neon's `pg_session_jwt` extension is not in stock PostgreSQL → the drill now leaves out unavailable extensions |
| 2026-10-04 | [run 37238392033](https://github.com/mucaeksi/unaware-of-my-demise/actions/runs/37238392033) | step 20 s (incl. image pull) | < 1 s | ledger identical (7 migrations), PG 18 → 18, `verify.sh` integrity ok (1 account; 0 checked against the journal: it predates it); left out: `pg_session_jwt` |
