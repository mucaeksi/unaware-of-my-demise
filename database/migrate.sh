#!/usr/bin/env bash
# Applies database/migrations/NNNN_*.sql in order, each in its own transaction, and records it in `schema_migrations`.
# Usage: DATABASE_URL=postgres://... database/migrate.sh [--check]
#   --check  lists pending migrations and verifies applied ones; read-only (it does not even create the ledger table).
# An applied migration whose file checksum changed is an error: migrations are append-only, never edited after release.
# Never resets or drops anything.
#
# Safety (INF-009, DEC-0020):
#   * One runner at a time: each migration transaction takes an advisory lock, then re-checks the ledger, so a second
#     runner fails cleanly instead of applying a migration twice.
#   * Bounded waits: lock_timeout (MIGRATION_LOCK_TIMEOUT, default 10s) and statement_timeout (5min), both SET LOCAL. A
#     migration that cannot get its locks fails instead of queueing behind live traffic and blocking it.
#   * The ledger and the files must agree: an applied version whose file has another name is an error; an applied
#     version with no file means the database is ahead of this checkout (a deliberate rollback deploy): warned only,
#     because migrations are additive and an older Worker keeps working on a newer schema.
#   * Migration files are numbered contiguously from 0001.
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"
dir="${UOMD_MIGRATIONS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/migrations" && pwd)}"
lock_timeout="${MIGRATION_LOCK_TIMEOUT:-10s}"
check_only=false
[[ "${1:-}" == "--check" ]] && check_only=true
# Notices are silenced with SET inside each transaction, not with PGOPTIONS: a transaction pooler (Neon's PgBouncer
# endpoint) rejects startup options, and a session-level SET would not survive between its transactions.
QUIET="SET client_min_messages TO warning"
# An arbitrary constant: the advisory lock that serializes migration runners.
LOCK_KEY=8261946013
psql_q() { psql "${DATABASE_URL}" -X -q -v ON_ERROR_STOP=1 "$@"; }
fail() { echo "$*" >&2; exit 1; }

if [[ "$(psql_q -At -c "SELECT to_regclass('public.schema_migrations') IS NOT NULL")" == "t" ]]; then
  ledger="$(psql_q -At -F '|' -c "SELECT version, filename, sha256 FROM schema_migrations ORDER BY version")"
elif ${check_only}; then
  ledger=""
else
  psql_q -c "${QUIET}; CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      filename    TEXT NOT NULL,
      sha256      TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )" >/dev/null
  ledger=""
fi

declare -A file_names=()
expected=1
for file in "${dir}"/[0-9][0-9][0-9][0-9]_*.sql; do
  name="$(basename "${file}")"
  version=$((10#${name%%_*}))
  [[ ${version} -eq ${expected} ]] || fail "migration files must be numbered contiguously: expected $(printf '%04d' "${expected}"), found ${name}"
  file_names[${version}]="${name}"
  expected=$((expected + 1))
done

declare -A applied_sums=()
while IFS='|' read -r version filename sum; do
  [[ -n "${version}" ]] || continue
  applied_sums[${version}]="${sum}"
  if [[ -z "${file_names[${version}]:-}" ]]; then
    echo "warning: applied migration ${filename} has no file in this checkout (the database is ahead of this code)" >&2
  elif [[ "${file_names[${version}]}" != "${filename}" ]]; then
    fail "the ledger records version ${version} as ${filename}, but the file is ${file_names[${version}]}"
  fi
done <<<"${ledger}"

pending=0
for ((version = 1; version < expected; version++)); do
  name="${file_names[${version}]}"
  file="${dir}/${name}"
  sum="$(sha256sum "${file}" | cut -d' ' -f1)"
  if [[ -n "${applied_sums[${version}]:-}" ]]; then
    [[ "${applied_sums[${version}]}" == "${sum}" ]] || fail "migration ${name} was changed after it was applied (${applied_sums[${version}]} != ${sum})"
    continue
  fi
  pending=$((pending + 1))
  if ${check_only}; then
    echo "pending: ${name}"
    continue
  fi
  echo "applying ${name}"
  psql_q -1 \
    -c "${QUIET}; SET LOCAL lock_timeout = '${lock_timeout}'; SET LOCAL statement_timeout = '5min'; SELECT pg_advisory_xact_lock(${LOCK_KEY})" \
    -c "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = ${version}) THEN
          RAISE EXCEPTION 'migration ${name} was applied by another runner meanwhile'; END IF; END \$\$" \
    -f "${file}" \
    -c "INSERT INTO schema_migrations (version, filename, sha256) VALUES (${version}, '${name}', '${sum}')" >/dev/null
done
${check_only} && echo "${pending} pending" || echo "up to date"
