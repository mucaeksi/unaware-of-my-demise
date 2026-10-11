-- A battle session freezes the player's party (final stats, skill ranks, story loans) at the moment the battle starts, so the server
-- replays the submitted actions against exactly what the client fought with, whatever the player changes meanwhile. One use only.
CREATE TABLE battle_sessions (
  id          TEXT PRIMARY KEY CHECK (length(id) BETWEEN 16 AND 64),
  player_id   TEXT NOT NULL REFERENCES players (id),
  release_id  TEXT NOT NULL,
  node_id     TEXT NOT NULL,
  party_json  TEXT NOT NULL CHECK (length(party_json) <= 8000),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT NOT NULL,
  consumed_at TEXT
) STRICT;
CREATE INDEX battle_sessions_player ON battle_sessions (player_id, created_at);

-- canon formation affinity (front/rear) used to place story loans and auto-built teams
ALTER TABLE characters ADD COLUMN formation_affinity TEXT CHECK (formation_affinity IN ('front', 'rear'));
