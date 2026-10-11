-- Feature flags / LiveOps switches (read by the client at boot through GET /api/v1/flags; edited in the Control Center).
CREATE TABLE feature_flags (
  key        TEXT PRIMARY KEY CHECK (key GLOB '[a-z]*' AND key NOT GLOB '*[^a-z0-9_.]*' AND length(key) <= 64),
  enabled    INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  value_json TEXT NOT NULL DEFAULT 'null' CHECK (length(value_json) <= 2000),
  note       TEXT NOT NULL DEFAULT '',
  version    INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT NOT NULL DEFAULT 'seed'
) STRICT;
-- Kill switches for money-touching features exist from day one and default to ON (a flag is the emergency brake).
INSERT INTO feature_flags (key, enabled, note) VALUES
  ('gacha.enabled', 1, 'Kill switch for all pulls'),
  ('shop.enabled', 1, 'Kill switch for purchase verification'),
  ('ads.rewarded.enabled', 1, 'Kill switch for rewarded ad grants'),
  ('maintenance.read_only', 0, 'When on, the client shows a maintenance notice');
