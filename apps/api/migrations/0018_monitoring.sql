-- Operational journal only: never store callback URLs, signatures, tokens or player identifiers.
CREATE TABLE monitor_events (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  service TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ads', 'billing', 'api')),
  event TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  method TEXT NOT NULL,
  route TEXT NOT NULL,
  status INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ray_id TEXT,
  version_id TEXT,
  duration_ms INTEGER
) STRICT;
CREATE INDEX monitor_events_at ON monitor_events(at DESC);
CREATE INDEX monitor_events_category_at ON monitor_events(category, at DESC);
CREATE INDEX ledger_at ON ledger(at);
CREATE INDEX players_created_at ON players(created_at);
CREATE INDEX players_last_seen_at ON players(last_seen_at);
CREATE INDEX gacha_pulls_at ON gacha_pulls(at);
CREATE INDEX ad_rewards_at ON ad_rewards(at);
