-- 0004: data lifecycle (INF-016). A stored reply is kept for replays for a limited time, then purged; the key itself stays
-- as a tombstone, so a very late retry is refused (409 OPERATION_EXPIRED) and never executed a second time. Expired
-- nonces/sessions and stale open attempts are cleaned by the Worker's scheduled job (server/src/retention.ts).
ALTER TABLE idempotency_keys ALTER COLUMN response_json DROP NOT NULL;
ALTER TABLE idempotency_keys ADD COLUMN response_purged_at TIMESTAMPTZ;
ALTER TABLE idempotency_keys ADD CONSTRAINT idempotency_keys_purge_check CHECK ((response_json IS NULL) = (response_purged_at IS NOT NULL));
CREATE INDEX idempotency_keys_unpurged_idx ON idempotency_keys (created_at) WHERE response_purged_at IS NULL;
