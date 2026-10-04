#!/usr/bin/env bash
# Applies database/migrations/NNNN_*.sql in order, each in its own transaction, and records it in `schema_migrations`.
# Usage: DATABASE_URL=postgres://... database/migrate.sh [--check]
#   --check  lists pending migrations and verifies applied ones, changes nothing.
# An applied migration whose file checksum changed is an error: migrations are append-only, never edited after release.
# Never resets or drops anything.
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/migrations" && pwd)"
check_only=false
[[ "${1:-}" == "--check" ]] && check_only=true
# Notices are silenced with SET inside each transaction, not with PGOPTIONS: a transaction pooler (Neon's PgBouncer
# endpoint) rejects startup options, and a session-level SET would not survive between its transactions.
QUIET="SET client_min_messages TO warning"
psql_q() { psql "${DATABASE_URL}" -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_q -c "${QUIET}; CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    filename    TEXT NOT NULL,
    sha256      TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)" >/dev/null

pending=0
for file in "${dir}"/[0-9][0-9][0-9][0-9]_*.sql; do
  name="$(basename "${file}")"
  version=$((10#${name%%_*}))
  sum="$(sha256sum "${file}" | cut -d' ' -f1)"
  applied="$(psql_q -At -c "SELECT sha256 FROM schema_migrations WHERE version = ${version}")"
  if [[ -n "${applied}" ]]; then
    [[ "${applied}" == "${sum}" ]] || { echo "migration ${name} was changed after it was applied (${applied} != ${sum})" >&2; exit 1; }
    continue
  fi
  pending=$((pending + 1))
  if ${check_only}; then
    echo "pending: ${name}"
    continue
  fi
  echo "applying ${name}"
  psql_q -1 -c "${QUIET}" -f "${file}" -c "INSERT INTO schema_migrations (version, filename, sha256) VALUES (${version}, '${name}', '${sum}')" >/dev/null
done
${check_only} && echo "${pending} pending" || echo "up to date"
