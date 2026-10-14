-- R13 Control Center hardening: replayable admin writes, product CAS and bounded support views.

-- One row per replayable Control Center write. It commits in the same D1 batch as the change and its audit entry,
-- so a retried requestId returns the original outcome and never applies or audits the action twice.
CREATE TABLE admin_requests (
  request_id  TEXT PRIMARY KEY CHECK (length(request_id) BETWEEN 8 AND 64),
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  target      TEXT NOT NULL,
  input_json  TEXT NOT NULL CHECK (json_valid(input_json)),
  status      INTEGER NOT NULL CHECK (status BETWEEN 200 AND 299),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT, WITHOUT ROWID;

-- Optimistic concurrency for shop products (existing rows start at version 1).
ALTER TABLE shop_products ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);

-- Keyset pagination orders for admin collections (each ends in a unique column so cursors are deterministic).
CREATE INDEX characters_admin_page ON characters (rarity DESC, name_en, id);
CREATE INDEX assets_admin_page ON assets (kind, path);
CREATE INDEX players_admin_page ON players (created_at DESC, id DESC);
CREATE INDEX purchases_admin_page ON purchases (granted_at DESC, order_id DESC);
-- The Shop page polls this counter; a partial index keeps it from scanning every purchase.
CREATE INDEX purchases_refunded_unrecovered ON purchases (order_id) WHERE state = 'refunded' AND unrecovered <> '{}';
CREATE INDEX audit_log_target ON audit_log (target, id);
CREATE INDEX audit_log_actor ON audit_log (actor, id);
