-- Player-side progression state: material stacks, per-character growth, account XP, gear instances, idempotency of upgrade operations.
CREATE TABLE player_stacks (
  player_id TEXT NOT NULL REFERENCES players (id),
  item_id   TEXT NOT NULL REFERENCES item_defs (item_id),
  qty       INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (player_id, item_id)
) STRICT, WITHOUT ROWID;

-- a row exists once a character has been upgraded; absent = level 1, no xp, ascension 0 (see packages/economy progression.ts)
CREATE TABLE player_chars (
  player_id    TEXT NOT NULL REFERENCES players (id),
  character_id TEXT NOT NULL REFERENCES characters (id),
  level        INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 200),
  xp           INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  ascension    INTEGER NOT NULL DEFAULT 0 CHECK (ascension >= 0),
  skill_ranks  TEXT NOT NULL DEFAULT '{}',
  version      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, character_id)
) STRICT, WITHOUT ROWID;

-- lifetime account XP (the player level is derived from it by the progression rules)
CREATE TABLE player_account (
  player_id TEXT PRIMARY KEY REFERENCES players (id),
  xp        INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0)
) STRICT;

-- gear instances (weapons, armor, necklaces, rings); accessories carry their rolled stats
CREATE TABLE player_gear (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   TEXT NOT NULL REFERENCES players (id),
  gear_id     TEXT NOT NULL REFERENCES gear_defs (gear_id),
  slot        TEXT NOT NULL,
  level       INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  xp          INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  -- how many rivet milestones were unlocked (raises the level cap in steps)
  ascension   INTEGER NOT NULL DEFAULT 0 CHECK (ascension >= 0),
  equipped_by TEXT REFERENCES characters (id),
  stats_json  TEXT NOT NULL DEFAULT '{}',
  locked      INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  version     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX player_gear_player ON player_gear (player_id, slot);
-- a character wears at most one piece per slot: weapon, armor, necklace, ring
CREATE UNIQUE INDEX player_gear_one_per_slot ON player_gear (player_id, equipped_by, slot) WHERE equipped_by IS NOT NULL AND slot IN ('weapon', 'armor', 'necklace', 'ring');

CREATE TABLE progression_requests (
  player_id   TEXT NOT NULL REFERENCES players (id),
  request_id  TEXT NOT NULL,
  kind        TEXT NOT NULL,
  result_json TEXT NOT NULL,
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (player_id, request_id)
) STRICT, WITHOUT ROWID;
