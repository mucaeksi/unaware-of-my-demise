#!/usr/bin/env bash
# End-to-end run (INF-042, DEC-0035): a disposable PostgreSQL database with every migration, the game Worker under
# `wrangler dev` (server/wrangler.e2e.jsonc: production code, test sign-in only), and the headless Godot client playing
# through it over HTTP (game/e2e). Everything is removed afterwards, failures included.
# Usage: ADMIN_DATABASE_URL=postgres://.../postgres GODOT=/path/to/godot server/e2e/run.sh [junit.xml]
# The database server must be disposable (a local socket or loopback host, like database/test.sh); Neon is refused.
set -euo pipefail
: "${ADMIN_DATABASE_URL:?set ADMIN_DATABASE_URL to the maintenance database of a disposable server}"
: "${GODOT:?set GODOT to the pinned Godot binary}"
server_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd "${server_dir}/.." && pwd)"
report="${1:-${server_dir}/e2e/junit.xml}"
port="${E2E_PORT:-8787}"
db=uomd_e2e
host="$(sed -E 's#^postgres(ql)?://([^@/]*@)?(\[[^]]*\]|[^:/?]*).*#\3#' <<<"${ADMIN_DATABASE_URL}")"
grep -Eq '[?&]host=/' <<<"${ADMIN_DATABASE_URL}" && host=""
if grep -Eiq '(^|\.)neon\.(tech|build)$' <<<"${host}"; then echo "refusing to run against ${host}: Neon is never a test server" >&2; exit 2; fi
case "${host}" in ""|localhost|127.0.0.1|"[::1]") ;; *) echo "refusing to run against ${host}: not a local server" >&2; exit 2 ;; esac
db_url="$(sed -E "s#^(postgres(ql)?://[^/?]*)/[^?]*#\1/${db}#" <<<"${ADMIN_DATABASE_URL}")"

log="$(mktemp)"
worker_pid=""
cleanup() {
  # wrangler runs in its own process group (setsid below): npx, node and workerd all stop, not only the subshell.
  [[ -n "${worker_pid}" ]] && kill -- "-${worker_pid}" 2>/dev/null || true
  wait 2>/dev/null || true
  psql "${ADMIN_DATABASE_URL}" -X -q -c "DROP DATABASE IF EXISTS ${db} WITH (FORCE)" >/dev/null 2>&1 || true
  rm -f "${log}"
}
trap cleanup EXIT

psql "${ADMIN_DATABASE_URL}" -X -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${db} WITH (FORCE)" -c "CREATE DATABASE ${db}"
DATABASE_URL="${db_url}" "${repo_dir}/database/migrate.sh" >/dev/null

# Hyperdrive's local mode connects the binding straight to this database.
(cd "${server_dir}" && CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="${db_url}" \
  exec setsid npx wrangler dev --config wrangler.e2e.jsonc --ip 127.0.0.1 --port "${port}" --show-interactive-dev-session=false >"${log}" 2>&1) &
worker_pid=$!
for _ in $(seq 1 90); do
  curl -fsS "http://127.0.0.1:${port}/healthz" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:${port}/healthz" >/dev/null || { cat "${log}" >&2; echo "the e2e Worker did not start" >&2; exit 1; }

"${GODOT}" --headless --path "${repo_dir}/game" --import >/dev/null 2>&1 || true
set +e
UOMD_E2E_SERVER="http://127.0.0.1:${port}" "${GODOT}" --headless --path "${repo_dir}/game" -s addons/gut/gut_cmdln.gd \
  -gdir=res://e2e -gprefix=test_ -gexit -gjunit_xml_file="${report}" 2>&1 | tee "${report%.xml}.log"
set -e
header="$(grep -m1 -o '<testsuites [^>]*>' "${report}" || true)"
tests="$(sed -n 's/.* tests="\([0-9]*\)".*/\1/p' <<<"${header}")"
failures="$(sed -n 's/.* failures="\([0-9]*\)".*/\1/p' <<<"${header}")"
pending="$(grep -c "<skipped" "${report}" || true)"
echo "e2e: ${tests:-0} tests, ${failures:-?} failures, ${pending} pending"
[[ "${tests:-0}" -gt 0 && "${failures:-1}" -eq 0 && "${pending}" -eq 0 ]] || { tail -40 "${log}" >&2; exit 1; }
