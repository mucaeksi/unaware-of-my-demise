#!/usr/bin/env bash
# Read-only integrity check of a game database (INF-011): run after a restore, a rollback or an incident.
# Usage: DATABASE_URL=postgres://... database/verify.sh
# Everything runs in one READ ONLY transaction (one consistent snapshot); nothing is written.
#
# Checks:
#   * the migration ledger agrees with this checkout (database/migrate.sh --check: no edited migration; pending ones are listed);
#   * the economic journal explains every balance (DEC-0019): for each account created after the journal existed
#     (migration 0005), the sum of journal deltas per currency equals the wallet and per item equals inventory_items.
#     Accounts older than the journal started with unjournaled balances and are counted, not checked.
# Prints row counts of the main tables, then "integrity ok", or the violations and exits 1.
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${here}/migrate.sh" --check

psql_ro() { psql "${DATABASE_URL}" -X -q -v ON_ERROR_STOP=1 -At -F '|' "$@"; }

if [[ "$(psql_ro -c "SELECT to_regclass('public.economy_journal') IS NOT NULL")" != "t" ]]; then
  echo "no economy_journal (schema before migration 0005): ledger checked only"
  echo "integrity ok"
  exit 0
fi

report="$(psql_ro <<'SQL'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH cutoff AS (
    SELECT applied_at FROM schema_migrations WHERE version = 5
), checked AS (
    SELECT a.account_id FROM account a, cutoff WHERE a.created_at > cutoff.applied_at
), wallet_rows AS (
    SELECT w.account_id, r.resource_id, r.balance
    FROM wallet w JOIN checked USING (account_id),
    LATERAL (VALUES ('eclipse_tokens', w.eclipse_tokens::bigint), ('fate_threads', w.fate_threads::bigint),
                    ('silver_crowns', w.silver_crowns::bigint), ('account_xp', w.account_xp::bigint)) AS r (resource_id, balance)
), currency_sums AS (
    SELECT account_id, resource_id, sum(delta)::bigint AS total
    FROM economy_journal JOIN checked USING (account_id) WHERE resource_kind = 'currency' GROUP BY 1, 2
), currency_bad AS (
    SELECT w.account_id, 'currency:' || w.resource_id AS what, w.balance AS actual, COALESCE(s.total, 0) AS journaled
    FROM wallet_rows w LEFT JOIN currency_sums s USING (account_id, resource_id)
    WHERE w.balance <> COALESCE(s.total, 0)
), item_rows AS (
    SELECT i.account_id, i.item_id, i.quantity::bigint AS quantity FROM inventory_items i JOIN checked USING (account_id)
), item_sums AS (
    SELECT account_id, resource_id AS item_id, sum(delta)::bigint AS total
    FROM economy_journal JOIN checked USING (account_id) WHERE resource_kind = 'item' GROUP BY 1, 2
), item_bad AS (
    SELECT account_id, 'item:' || item_id AS what, COALESCE(i.quantity, 0) AS actual, COALESCE(s.total, 0) AS journaled
    FROM item_rows i FULL JOIN item_sums s USING (account_id, item_id)
    WHERE COALESCE(i.quantity, 0) <> COALESCE(s.total, 0)
)
SELECT 'violation', account_id, what, actual, journaled FROM currency_bad
UNION ALL SELECT 'violation', account_id, what, actual, journaled FROM item_bad
UNION ALL SELECT 'count', 'accounts', (SELECT count(*) FROM account)::text, NULL, NULL
UNION ALL SELECT 'count', 'accounts_checked_against_journal', (SELECT count(*) FROM checked)::text, NULL, NULL
UNION ALL SELECT 'count', 'sessions', (SELECT count(*) FROM sessions)::text, NULL, NULL
UNION ALL SELECT 'count', 'idempotency_keys', (SELECT count(*) FROM idempotency_keys)::text, NULL, NULL
UNION ALL SELECT 'count', 'stage_attempts', (SELECT count(*) FROM stage_attempts)::text, NULL, NULL
UNION ALL SELECT 'count', 'pull_history', (SELECT count(*) FROM pull_history)::text, NULL, NULL
UNION ALL SELECT 'count', 'economy_journal', (SELECT count(*) FROM economy_journal)::text, NULL, NULL;
COMMIT;
SQL
)"

violations=0
while IFS='|' read -r kind a b c d; do
  case "${kind}" in
    count) echo "${a}: ${b}" ;;
    violation) echo "journal mismatch: account ${a} ${b}: balance ${c}, journal sum ${d}" >&2; violations=$((violations + 1)) ;;
  esac
done <<<"${report}"
if [[ ${violations} -ne 0 ]]; then
  echo "integrity FAILED: ${violations} balances not explained by the journal" >&2
  exit 1
fi
echo "integrity ok"
