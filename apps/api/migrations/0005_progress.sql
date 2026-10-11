-- Progression: per-node stars/clears (server-verified), Ration (energy), battle submission journal, client cloud-save blob.
CREATE TABLE player_progress (
  player_id        TEXT NOT NULL REFERENCES players (id),
  node_id          TEXT NOT NULL,
  stars            INTEGER NOT NULL CHECK (stars BETWEEN 0 AND 3),
  clears           INTEGER NOT NULL DEFAULT 1 CHECK (clears >= 1),
  best_turns       INTEGER,
  first_cleared_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (player_id, node_id)
) STRICT, WITHOUT ROWID;
-- stars can only go up
CREATE TRIGGER player_progress_stars_monotonic BEFORE UPDATE OF stars ON player_progress WHEN NEW.stars < OLD.stars
BEGIN SELECT RAISE(ABORT, 'stars never decrease'); END;

-- Lazy-regenerating energy; a missing row means a full tank (see packages/economy ration.ts). Compare-and-set on (value, at_ms).
CREATE TABLE player_ration (
  player_id TEXT PRIMARY KEY REFERENCES players (id),
  value     INTEGER NOT NULL CHECK (value >= 0),
  at_ms     INTEGER NOT NULL
) STRICT;

-- One row per accepted battle submission: replaying a requestId returns this result and grants nothing twice.
CREATE TABLE battle_claims (
  player_id   TEXT NOT NULL REFERENCES players (id),
  request_id  TEXT NOT NULL,
  release_id  TEXT NOT NULL,
  node_id     TEXT NOT NULL,
  result_json TEXT NOT NULL,
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (player_id, request_id)
) STRICT, WITHOUT ROWID;

-- Client-owned, non-authoritative state (settings, team presets, UI flags). Optimistic concurrency via `version`.
CREATE TABLE player_saves (
  player_id  TEXT PRIMARY KEY REFERENCES players (id),
  version    INTEGER NOT NULL CHECK (version >= 1),
  data       TEXT NOT NULL CHECK (length(data) <= 65536),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
