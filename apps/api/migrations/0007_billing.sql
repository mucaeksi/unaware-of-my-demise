-- Google Play Billing: catalogue, verified purchases, event journal. Prices live in Play Console; the server maps product ids to grants.
CREATE TABLE shop_products (
  product_id TEXT PRIMARY KEY CHECK (product_id GLOB '[a-z]*' AND product_id NOT GLOB '*[^a-z0-9_.]*'),
  kind       TEXT NOT NULL CHECK (kind IN ('consumable', 'subscription')),
  title_en   TEXT NOT NULL,
  -- consumable: attachments granted at purchase. subscription: see packages/economy (instant + periodic entitlements)
  grants     TEXT NOT NULL DEFAULT '[]',
  sub_config TEXT,
  active     INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT NOT NULL DEFAULT 'seed',
  CHECK (kind = 'consumable' OR sub_config IS NOT NULL)
) STRICT;

CREATE TABLE purchases (
  order_id       TEXT PRIMARY KEY,
  player_id      TEXT NOT NULL REFERENCES players (id),
  product_id     TEXT NOT NULL REFERENCES shop_products (product_id),
  kind           TEXT NOT NULL,
  token_hash     TEXT NOT NULL,
  state          TEXT NOT NULL DEFAULT 'granted' CHECK (state IN ('granted', 'refunded')),
  acknowledged   INTEGER NOT NULL DEFAULT 0 CHECK (acknowledged IN (0, 1)),
  period_start   TEXT NOT NULL,
  period_end     TEXT,
  granted_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  refunded_at    TEXT,
  -- what a refund could not take back (already spent): {"currency": amount}; surfaced to operators
  unrecovered    TEXT NOT NULL DEFAULT '{}'
) STRICT, WITHOUT ROWID;
CREATE INDEX purchases_player ON purchases (player_id, granted_at);
CREATE INDEX purchases_token ON purchases (token_hash);

CREATE TABLE purchase_events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  source   TEXT NOT NULL CHECK (source IN ('verify', 'rtdn', 'system')),
  order_id TEXT,
  type     TEXT NOT NULL,
  detail   TEXT NOT NULL DEFAULT '{}'
) STRICT;
CREATE TRIGGER purchase_events_no_update BEFORE UPDATE ON purchase_events BEGIN SELECT RAISE(ABORT, 'purchase_events is append-only'); END;
CREATE TRIGGER purchase_events_no_delete BEFORE DELETE ON purchase_events BEGIN SELECT RAISE(ABORT, 'purchase_events is append-only'); END;

-- RTDN messages already processed (Pub/Sub delivers at least once)
CREATE TABLE rtdn_seen (
  message_id TEXT PRIMARY KEY,
  at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT, WITHOUT ROWID;

-- The canonical subscription (economy_part1.json): 30 days, 1,600 Eclipse Tokens at once, then 187 per half-day window x 60.
-- Inactive until an operator maps it to a real Play subscription.
INSERT INTO shop_products (product_id, kind, title_en, grants, sub_config, active) VALUES (
  'eclipse_blessing_30d', 'subscription', 'Eclipse Blessing', '[]',
  '{"duration_days":30,"instant":[{"type":"currency","currency":"eclipse_token","amount":1600}],"periodic":{"every_hours":12,"count":60,"mail_title":"Eclipse Blessing - half-day offering","attachments":[{"type":"currency","currency":"eclipse_token","amount":187}],"claim_days":14}}',
  0);
