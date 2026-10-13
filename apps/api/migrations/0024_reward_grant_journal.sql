-- Future grants only; do not manufacture provenance for historical balances.
CREATE TABLE reward_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grant_key TEXT NOT NULL UNIQUE,
  player_id TEXT NOT NULL REFERENCES players(id),
  reason TEXT NOT NULL,
  attachment_json TEXT NOT NULL CHECK (json_valid(attachment_json)),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX reward_grants_player ON reward_grants(player_id, id);
CREATE TRIGGER reward_grants_no_update BEFORE UPDATE ON reward_grants BEGIN SELECT RAISE(ABORT, 'reward grants are append-only'); END;
CREATE TRIGGER reward_grants_no_delete BEFORE DELETE ON reward_grants BEGIN SELECT RAISE(ABORT, 'reward grants are append-only'); END;
