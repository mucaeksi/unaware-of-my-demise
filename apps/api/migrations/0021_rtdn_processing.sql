-- Old markers cannot prove completion; the next authentic delivery safely reconciles them.
ALTER TABLE rtdn_seen ADD COLUMN state TEXT NOT NULL DEFAULT 'legacy'
  CHECK (state IN ('legacy', 'pending', 'processing', 'done', 'dead_letter'));
ALTER TABLE rtdn_seen ADD COLUMN payload_hash TEXT;
ALTER TABLE rtdn_seen ADD COLUMN owner TEXT;
ALTER TABLE rtdn_seen ADD COLUMN lease_until TEXT;
ALTER TABLE rtdn_seen ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0);
ALTER TABLE rtdn_seen ADD COLUMN last_code TEXT;
ALTER TABLE rtdn_seen ADD COLUMN completed_at TEXT;
ALTER TABLE rtdn_seen ADD COLUMN outcome TEXT;
CREATE INDEX rtdn_processing_due ON rtdn_seen (state, lease_until);
CREATE INDEX rtdn_investigation ON rtdn_seen (state, message_id);
CREATE UNIQUE INDEX purchase_events_rtdn_message ON purchase_events
  (json_extract(CASE WHEN json_valid(detail) THEN detail ELSE '{}' END, '$.messageId'), type)
  WHERE source = 'rtdn';
