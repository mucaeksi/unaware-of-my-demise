-- Player ownership outlives editable definitions. These tables hold IDs only;
-- executable definitions continue to come from the selected release or legacy authoring tables.
CREATE TABLE character_identities (id TEXT PRIMARY KEY) STRICT, WITHOUT ROWID;
CREATE TABLE item_identities (id TEXT PRIMARY KEY) STRICT, WITHOUT ROWID;
CREATE TABLE gear_identities (id TEXT PRIMARY KEY) STRICT, WITHOUT ROWID;
INSERT INTO character_identities SELECT id FROM characters;
INSERT INTO item_identities SELECT item_id FROM item_defs;
INSERT INTO gear_identities SELECT gear_id FROM gear_defs;
CREATE TRIGGER characters_register_identity AFTER INSERT ON characters BEGIN INSERT OR IGNORE INTO character_identities VALUES (NEW.id); END;
CREATE TRIGGER items_register_identity AFTER INSERT ON item_defs BEGIN INSERT OR IGNORE INTO item_identities VALUES (NEW.item_id); END;
CREATE TRIGGER gear_register_identity AFTER INSERT ON gear_defs BEGIN INSERT OR IGNORE INTO gear_identities VALUES (NEW.gear_id); END;
CREATE TRIGGER character_identities_no_update BEFORE UPDATE ON character_identities BEGIN SELECT RAISE(ABORT, 'catalog identities are immutable'); END;
CREATE TRIGGER character_identities_no_delete BEFORE DELETE ON character_identities BEGIN SELECT RAISE(ABORT, 'catalog identities are retained'); END;
CREATE TRIGGER item_identities_no_update BEFORE UPDATE ON item_identities BEGIN SELECT RAISE(ABORT, 'catalog identities are immutable'); END;
CREATE TRIGGER item_identities_no_delete BEFORE DELETE ON item_identities BEGIN SELECT RAISE(ABORT, 'catalog identities are retained'); END;
CREATE TRIGGER gear_identities_no_update BEFORE UPDATE ON gear_identities BEGIN SELECT RAISE(ABORT, 'catalog identities are immutable'); END;
CREATE TRIGGER gear_identities_no_delete BEFORE DELETE ON gear_identities BEGIN SELECT RAISE(ABORT, 'catalog identities are retained'); END;

CREATE TABLE player_stacks_catalog (
  player_id TEXT NOT NULL REFERENCES players (id),
  item_id TEXT NOT NULL REFERENCES item_identities (id),
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (player_id, item_id)
) STRICT, WITHOUT ROWID;
INSERT INTO player_stacks_catalog SELECT * FROM player_stacks;
DROP TABLE player_stacks;
ALTER TABLE player_stacks_catalog RENAME TO player_stacks;

CREATE TABLE player_chars_catalog (
  player_id TEXT NOT NULL REFERENCES players (id),
  character_id TEXT NOT NULL REFERENCES character_identities (id),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 200),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  ascension INTEGER NOT NULL DEFAULT 0 CHECK (ascension >= 0),
  skill_ranks TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, character_id)
) STRICT, WITHOUT ROWID;
INSERT INTO player_chars_catalog SELECT * FROM player_chars;
DROP TABLE player_chars;
ALTER TABLE player_chars_catalog RENAME TO player_chars;

-- Preserve AUTOINCREMENT even when the highest historical instance was deleted.
CREATE TABLE catalog_gear_sequence (seq INTEGER NOT NULL) STRICT;
INSERT INTO catalog_gear_sequence SELECT seq FROM sqlite_sequence WHERE name = 'player_gear';
CREATE TABLE player_gear_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players (id),
  gear_id TEXT NOT NULL REFERENCES gear_identities (id),
  slot TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  ascension INTEGER NOT NULL DEFAULT 0 CHECK (ascension >= 0),
  equipped_by TEXT REFERENCES character_identities (id),
  stats_json TEXT NOT NULL DEFAULT '{}',
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
INSERT INTO player_gear_catalog SELECT * FROM player_gear;
DROP TABLE player_gear;
ALTER TABLE player_gear_catalog RENAME TO player_gear;
UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT MAX(seq) FROM catalog_gear_sequence), 0)) WHERE name = 'player_gear';
INSERT INTO sqlite_sequence (name, seq) SELECT 'player_gear', MAX(seq) FROM catalog_gear_sequence HAVING MAX(seq) IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'player_gear');
DROP TABLE catalog_gear_sequence;
CREATE INDEX player_gear_player ON player_gear (player_id, slot);
CREATE UNIQUE INDEX player_gear_one_per_slot ON player_gear (player_id, equipped_by, slot) WHERE equipped_by IS NOT NULL AND slot IN ('weapon', 'armor', 'necklace', 'ring');
