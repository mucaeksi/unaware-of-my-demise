#!/usr/bin/env bash
# Migrates a fresh, disposable database and runs database/tests/*.sql against it.
# Usage: ADMIN_DATABASE_URL=postgres://.../postgres database/test.sh
# Creates and drops the database `uomd_schema_test` on that server: never point it at production.
set -euo pipefail
: "${ADMIN_DATABASE_URL:?set ADMIN_DATABASE_URL to the maintenance database of a disposable server}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
db=uomd_schema_test
ops=uomd_schema_ops
envdb=uomd_schema_env
probe_role=uomd_schema_owner
# Only a disposable server (INF-010): a local socket or loopback host, never Neon; another host needs TEST_DATABASE_ALLOW_REMOTE=1.
host="$(sed -E 's#^postgres(ql)?://([^@/]*@)?(\[[^]]*\]|[^:/?]*).*#\3#' <<<"${ADMIN_DATABASE_URL}")"
grep -Eq '[?&]host=/' <<<"${ADMIN_DATABASE_URL}" && host=""
if grep -Eiq '(^|\.)neon\.(tech|build)$' <<<"${host}"; then echo "refusing to run tests against ${host}: Neon is never a test server" >&2; exit 2; fi
case "${host}" in
  ""|localhost|127.0.0.1|"[::1]") ;;
  *) [[ "${TEST_DATABASE_ALLOW_REMOTE:-}" == "1" ]] || { echo "refusing to run tests against ${host}: set TEST_DATABASE_ALLOW_REMOTE=1 if it is a disposable server" >&2; exit 2; } ;;
esac
# The test databases go away whatever happens.
cleanup() {
  psql "${ADMIN_DATABASE_URL}" -X -q -c "DROP DATABASE IF EXISTS ${db} WITH (FORCE)" -c "DROP DATABASE IF EXISTS ${ops} WITH (FORCE)" \
    -c "DROP DATABASE IF EXISTS ${envdb} WITH (FORCE)" -c "DROP ROLE IF EXISTS ${probe_role}" >/dev/null 2>&1 || true
}
trap cleanup EXIT
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

# The integrity check (verify.sh, INF-011): journaled balances pass; an account older than the journal is counted, not
# checked; a balance changed behind the journal's back (triggers off) fails it.
psql "${ops_url}" -X -q -v ON_ERROR_STOP=1 \
  -c "SET session_replication_role = replica; INSERT INTO account (account_id, created_at) VALUES ('acct_000000000000000000000000000000a1', '2000-01-01'); INSERT INTO wallet (account_id, ration, fate_threads) VALUES ('acct_000000000000000000000000000000a1', 1, 99)" \
  -c "RESET session_replication_role; INSERT INTO account (account_id) VALUES ('acct_000000000000000000000000000000a2'); INSERT INTO wallet (account_id, ration, fate_threads, silver_crowns) VALUES ('acct_000000000000000000000000000000a2', 1, 10, 5); UPDATE wallet SET fate_threads = 3 WHERE account_id = 'acct_000000000000000000000000000000a2'; INSERT INTO inventory_items (account_id, item_id, quantity) VALUES ('acct_000000000000000000000000000000a2', 'rivet', 4)"
verified="$(DATABASE_URL="${ops_url}" "${here}/verify.sh")" || { echo "verify.sh failed a consistent database" >&2; exit 1; }
grep -qx "integrity ok" <<<"${verified}" || { echo "verify.sh did not report integrity ok" >&2; exit 1; }
grep -qx "accounts_checked_against_journal: 1" <<<"${verified}" || { echo "verify.sh checked an account older than the journal" >&2; exit 1; }
psql "${ops_url}" -X -q -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica; UPDATE wallet SET silver_crowns = 500 WHERE account_id = 'acct_000000000000000000000000000000a2'; UPDATE inventory_items SET quantity = 9 WHERE account_id = 'acct_000000000000000000000000000000a2'"
if DATABASE_URL="${ops_url}" "${here}/verify.sh" >/dev/null 2>&1; then echo "verify.sh accepted a balance the journal does not explain" >&2; exit 1; fi
mismatches="$(DATABASE_URL="${ops_url}" "${here}/verify.sh" 2>&1 >/dev/null || true)"
[[ "$(grep -c "journal mismatch" <<<"${mismatches}")" == "2" ]] || { echo "verify.sh did not name both mismatches" >&2; exit 1; }
echo "ok integrity check"

# Environment guard (INF-006): a database in use without a record is never claimed for staging; production records
# itself; staging claims only an empty database; each then refuses the other.
if UOMD_ENVIRONMENT=staging DATABASE_URL="${ops_url}" "${here}/migrate.sh" >/dev/null 2>&1; then echo "staging adopted a database already in use" >&2; exit 1; fi
recorded="$(UOMD_ENVIRONMENT=production DATABASE_URL="${ops_url}" "${here}/migrate.sh")"
grep -q "recorded uomd_environment = production" <<<"${recorded}" || { echo "production did not record itself" >&2; exit 1; }
UOMD_ENVIRONMENT=production DATABASE_URL="${ops_url}" "${here}/migrate.sh" | grep -qx "up to date"
if UOMD_ENVIRONMENT=staging DATABASE_URL="${ops_url}" "${here}/migrate.sh" --check >/dev/null 2>&1; then echo "staging tooling accepted the production database" >&2; exit 1; fi
# This part runs as a plain database owner, not a superuser, as on Neon (where the owner may not set custom parameters):
# the guard and every migration must work with the owner's rights alone.
env_url="$(sed -E -e "s#^(postgres(ql)?://[^/?]*)/[^?]*#\1/${envdb}#" -e "s#^(postgres(ql)?://)([^@/]*@)?#\1${probe_role}:probe@#" <<<"${ADMIN_DATABASE_URL}")"
psql "${ADMIN_DATABASE_URL}" -X -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${envdb}" -c "DROP ROLE IF EXISTS ${probe_role}" \
  -c "CREATE ROLE ${probe_role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'probe'" -c "CREATE DATABASE ${envdb} OWNER ${probe_role}"
claimed="$(UOMD_ENVIRONMENT=staging DATABASE_URL="${env_url}" "${here}/migrate.sh")"
grep -q "claimed this empty database for staging" <<<"${claimed}" || { echo "staging did not claim an empty database" >&2; exit 1; }
UOMD_ENVIRONMENT=staging DATABASE_URL="${env_url}" "${here}/migrate.sh" | grep -qx "up to date"
if UOMD_ENVIRONMENT=production DATABASE_URL="${env_url}" "${here}/migrate.sh" >/dev/null 2>&1; then echo "production tooling accepted the staging database" >&2; exit 1; fi
psql "${ADMIN_DATABASE_URL}" -X -q -c "DROP DATABASE ${envdb}" -c "DROP ROLE ${probe_role}"
echo "ok environment guard"
psql "${ADMIN_DATABASE_URL}" -X -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${ops}' AND pid <> pg_backend_pid()" >/dev/null
psql "${ADMIN_DATABASE_URL}" -X -q -c "DROP DATABASE ${ops}"
