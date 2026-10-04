# Database (Neon PostgreSQL)

The server-authoritative game state (DEC-0012, DEC-0013). The schema is translated
from the LEGACY schemas; `docs/LEGACY_AUDIT.md` §9 has the provenance.

- `migrations/NNNN_*.sql`: versioned migrations, applied in order. Each one runs
  in its own transaction and is recorded in `schema_migrations` with a sha256.
  Migrations are append-only: never edit one that has been applied anywhere,
  add a new one instead.
- `migrate.sh`: `DATABASE_URL=... database/migrate.sh [--check]`.
  - It applies the pending migrations and refuses to run if an applied file
    changed.
  - It never resets or drops anything.
  - Production uses the direct (non-pooled) Neon connection string from the
    environment's secrets, not Hyperdrive.
- `test.sh` + `tests/*.sql`:
  `ADMIN_DATABASE_URL=postgres://.../postgres database/test.sh`.
  - It creates the disposable database `uomd_schema_test`, migrates it, runs
    the constraint tests, checks the edited-migration guard, then drops the
    database.
  - Use a local or CI Postgres only.
