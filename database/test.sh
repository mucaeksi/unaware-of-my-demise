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
