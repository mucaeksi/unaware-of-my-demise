#!/usr/bin/env bash
# Migrates a fresh, disposable database and runs database/tests/*.sql against it.
# Usage: ADMIN_DATABASE_URL=postgres://.../postgres database/test.sh
# Creates and drops the database `uomd_schema_test` on that server: never point it at production.
set -euo pipefail
: "${ADMIN_DATABASE_URL:?set ADMIN_DATABASE_URL to the maintenance database of a disposable server}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
db=uomd_schema_test
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
psql "${ADMIN_DATABASE_URL}" -X -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${db}" -c "CREATE DATABASE ${db}"
test_url="$(sed -E "s#^(postgres(ql)?://[^/?]*)/[^?]*#\1/${db}#" <<<"${ADMIN_DATABASE_URL}")"
DATABASE_URL="${test_url}" "${here}/migrate.sh"
DATABASE_URL="${test_url}" "${here}/migrate.sh" | grep -qx "up to date"
for test in "${here}"/tests/*.sql; do
  psql "${test_url}" -X -q -v ON_ERROR_STOP=1 -f "${test}" >/dev/null
  echo "ok $(basename "${test}")"
done
# An applied migration must not change.
psql "${test_url}" -X -q -c "UPDATE schema_migrations SET sha256 = 'edited' WHERE version = 1"
if DATABASE_URL="${test_url}" "${here}/migrate.sh" >/dev/null 2>&1; then echo "an edited migration was accepted" >&2; exit 1; fi
echo "ok edited-migration guard"
psql "${ADMIN_DATABASE_URL}" -X -q -c "DROP DATABASE ${db}"

# Runner safety (INF-009) on a second disposable database.
ops=uomd_schema_ops
ops_url="$(sed -E "s#^(postgres(ql)?://[^/?]*)/[^?]*#\1/${ops}#" <<<"${ADMIN_DATABASE_URL}")"
psql "${ADMIN_DATABASE_URL}" -X -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${ops}" -c "CREATE DATABASE ${ops}"
count="$(find "${here}/migrations" -name '[0-9][0-9][0-9][0-9]_*.sql' | wc -l)"
DATABASE_URL="${ops_url}" "${here}/migrate.sh" --check | grep -qx "${count} pending"
[[ "$(psql "${ops_url}" -X -At -c "SELECT to_regclass('public.schema_migrations') IS NULL")" == "t" ]] || { echo "--check created the ledger" >&2; exit 1; }
echo "ok read-only check"

# Two runners at once: every migration is applied exactly once, whichever runner wins each one.
DATABASE_URL="${ops_url}" "${here}/migrate.sh" >/dev/null 2>&1 & first=$!
DATABASE_URL="${ops_url}" "${here}/migrate.sh" >/dev/null 2>&1 & second=$!
wait "${first}" || true
wait "${second}" || true
DATABASE_URL="${ops_url}" "${here}/migrate.sh" | grep -qx "up to date"
[[ "$(psql "${ops_url}" -X -At -c "SELECT count(*) = ${count} AND count(DISTINCT version) = ${count} FROM schema_migrations")" == "t" ]] \
  || { echo "concurrent runners applied a migration twice or not at all" >&2; exit 1; }
echo "ok concurrent runners"

# A database ahead of this checkout (a rollback deploy) is warned about, not refused; a renamed applied file is refused.
psql "${ops_url}" -X -q -c "INSERT INTO schema_migrations (version, filename, sha256) VALUES (9999, '9999_future.sql', 'x')"
DATABASE_URL="${ops_url}" "${here}/migrate.sh" 2>&1 >/dev/null | grep -q "9999_future.sql has no file"
psql "${ops_url}" -X -q -c "DELETE FROM schema_migrations WHERE version = 9999" -c "UPDATE schema_migrations SET filename = '0001_renamed.sql' WHERE version = 1"
if DATABASE_URL="${ops_url}" "${here}/migrate.sh" >/dev/null 2>&1; then echo "a renamed applied migration was accepted" >&2; exit 1; fi
psql "${ops_url}" -X -q -c "UPDATE schema_migrations SET filename = '$(basename "$(ls "${here}"/migrations/0001_*.sql)")' WHERE version = 1"
echo "ok ledger and files agree"

# A migration that cannot get its locks fails fast instead of queueing behind live traffic.
probe="$(mktemp -d)"
cp "${here}"/migrations/*.sql "${probe}/"
printf 'ALTER TABLE account ADD COLUMN lock_probe INTEGER;\n' > "${probe}/$(printf '%04d' $((count + 1)))_lock_probe.sql"
psql "${ops_url}" -X -q -c "BEGIN; LOCK TABLE account IN ACCESS SHARE MODE; SELECT pg_sleep(30); COMMIT;" >/dev/null 2>&1 & holder=$!
sleep 1
started=$(date +%s)
if UOMD_MIGRATIONS_DIR="${probe}" MIGRATION_LOCK_TIMEOUT=1s DATABASE_URL="${ops_url}" "${here}/migrate.sh" >/dev/null 2>&1; then
  echo "a migration ran past a held lock" >&2; exit 1
fi
(( $(date +%s) - started < 10 )) || { echo "the migration waited instead of failing fast" >&2; exit 1; }
kill "${holder}" 2>/dev/null || true
wait "${holder}" 2>/dev/null || true
rm -r "${probe}"
[[ "$(psql "${ops_url}" -X -At -c "SELECT count(*) FROM schema_migrations")" == "${count}" ]] || { echo "the failed migration was recorded" >&2; exit 1; }
echo "ok lock timeout"
psql "${ADMIN_DATABASE_URL}" -X -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${ops}' AND pid <> pg_backend_pid()" >/dev/null
psql "${ADMIN_DATABASE_URL}" -X -q -c "DROP DATABASE ${ops}"
