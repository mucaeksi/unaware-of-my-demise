# Database (Neon PostgreSQL)

The server-authoritative game state (DEC-0012, DEC-0013). The schema is translated
from the LEGACY schemas; `docs/LEGACY_AUDIT.md` §9 has the provenance.

- `migrations/NNNN_*.sql`: versioned migrations, applied in order. Each one runs
  in its own transaction and is recorded in `schema_migrations` with a sha256.
  Migrations are append-only: never edit one that has been applied anywhere,
  add a new one instead.
- `migrate.sh`: `DATABASE_URL=... database/migrate.sh [--check]`.
  - It applies the pending migrations and refuses to run if an applied file
    changed or was renamed, or if the files are not numbered contiguously.
  - `--check` is read-only: it does not even create the ledger table.
  - One runner at a time (advisory lock + ledger re-check per migration).
  - Each migration waits at most `MIGRATION_LOCK_TIMEOUT` (10s) for its locks
    and 5 min per statement, so it fails instead of blocking live traffic.
  - A ledger row without a file (the database is ahead of the checkout, e.g. a
    rollback deploy) is a warning: migrations are additive, so an older Worker
    keeps working on a newer schema. Never write a migration that breaks the
    Worker version still serving while the deploy runs (it migrates first).
  - It never resets or drops anything.
  - Production uses the direct (non-pooled) Neon connection string from the
    environment's secrets, not Hyperdrive.
- `test.sh` + `tests/*.sql`:
  `ADMIN_DATABASE_URL=postgres://.../postgres database/test.sh`.
  - It creates the disposable database `uomd_schema_test`, migrates it, runs
    the constraint tests, checks the edited-migration guard, then drops the
    database.
  - Use a local or CI Postgres only.
