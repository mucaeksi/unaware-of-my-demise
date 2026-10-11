-- Rewarded-ad grants verified by AdMob server-side verification (SSV). `transaction_id` is Google's id: a callback can never grant twice.
CREATE TABLE ad_rewards (
  transaction_id TEXT PRIMARY KEY CHECK (length(transaction_id) BETWEEN 4 AND 128),
  player_id      TEXT NOT NULL REFERENCES players (id),
  ad_unit        TEXT NOT NULL,
  window_start   TEXT NOT NULL,
  day            TEXT NOT NULL,
  amount         INTEGER NOT NULL CHECK (amount > 0),
  at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT, WITHOUT ROWID;
CREATE INDEX ad_rewards_window ON ad_rewards (player_id, window_start);
CREATE INDEX ad_rewards_day ON ad_rewards (player_id, day);
CREATE TRIGGER ad_rewards_no_update BEFORE UPDATE ON ad_rewards BEGIN SELECT RAISE(ABORT, 'ad_rewards is append-only'); END;
CREATE TRIGGER ad_rewards_no_delete BEFORE DELETE ON ad_rewards BEGIN SELECT RAISE(ABORT, 'ad_rewards is append-only'); END;

-- Each rewarded view starts with a server-issued nonce that the client passes to AdMob as `custom_data`. The signed callback
-- must carry a live nonce of the SAME player, so a hostile client cannot aim callbacks at someone else's account or caps.
CREATE TABLE ad_nonces (
  nonce      TEXT PRIMARY KEY CHECK (length(nonce) BETWEEN 16 AND 64),
  player_id  TEXT NOT NULL REFERENCES players (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  used_at    TEXT
) STRICT, WITHOUT ROWID;
CREATE INDEX ad_nonces_player ON ad_nonces (player_id, created_at);
