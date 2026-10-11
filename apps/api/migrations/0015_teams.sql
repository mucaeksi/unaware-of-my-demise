-- Team presets: up to five named formations per player. Members are validated against ownership when saved.
CREATE TABLE player_teams (
  player_id    TEXT NOT NULL REFERENCES players (id),
  slot         INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  name         TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 24),
  members_json TEXT NOT NULL CHECK (length(members_json) <= 1000),
  active       INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (player_id, slot)
) STRICT, WITHOUT ROWID;
CREATE UNIQUE INDEX player_teams_one_active ON player_teams (player_id) WHERE active = 1;
