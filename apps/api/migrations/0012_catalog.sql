-- Game catalog and tunable rules. D1 is the authority (edited in the Control Center); canon JSON in narrative/ is only the seed source.
CREATE TABLE item_defs (
  item_id     TEXT PRIMARY KEY CHECK (item_id GLOB '[a-z]*' AND item_id NOT GLOB '*[^a-z0-9_]*'),
  name_en     TEXT NOT NULL,
  kind        TEXT NOT NULL,
  rarity      INTEGER CHECK (rarity IS NULL OR rarity BETWEEN 1 AND 5),
  stack_cap   INTEGER NOT NULL DEFAULT 9999 CHECK (stack_cap >= 1),
  xp_value    INTEGER,
  consumable  INTEGER NOT NULL DEFAULT 0 CHECK (consumable IN (0, 1)),
  data_json   TEXT NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'retired')),
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by  TEXT NOT NULL DEFAULT 'seed'
) STRICT;

CREATE TABLE weapon_types (
  weapon_type TEXT PRIMARY KEY,
  name_en     TEXT NOT NULL
) STRICT;

-- weapons, armor, necklaces and rings share one definition table; `slot` tells them apart
CREATE TABLE gear_defs (
  gear_id            TEXT PRIMARY KEY CHECK (gear_id GLOB '[a-z]*' AND gear_id NOT GLOB '*[^a-z0-9_]*'),
  slot               TEXT NOT NULL CHECK (slot IN ('weapon', 'armor', 'necklace', 'ring')),
  name_en            TEXT NOT NULL,
  rarity             INTEGER NOT NULL CHECK (rarity BETWEEN 1 AND 5),
  family             TEXT NOT NULL,
  tier               TEXT,
  set_id             TEXT,
  owner_character_id TEXT,
  banner_id          TEXT,
  level_cap          INTEGER NOT NULL DEFAULT 20 CHECK (level_cap >= 1),
  base_json          TEXT NOT NULL DEFAULT '{}',
  growth_json        TEXT NOT NULL DEFAULT '{}',
  extra_json         TEXT NOT NULL DEFAULT '{}',
  dismantle_xp       INTEGER NOT NULL DEFAULT 0,
  dismantle_json     TEXT NOT NULL DEFAULT '[]',
  dismantle_allowed  INTEGER NOT NULL DEFAULT 1 CHECK (dismantle_allowed IN (0, 1)),
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'retired')),
  version            INTEGER NOT NULL DEFAULT 1,
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by         TEXT NOT NULL DEFAULT 'seed'
) STRICT;
CREATE INDEX gear_defs_slot ON gear_defs (slot, rarity);

CREATE TABLE accessory_sets (
  set_id          TEXT PRIMARY KEY,
  name_en         TEXT NOT NULL,
  pieces_for_bonus INTEGER NOT NULL,
  bonus_json      TEXT NOT NULL
) STRICT;

-- tunable rule sets (progression curves, fees, role stat map, ...): one JSON document per key, optimistic concurrency
CREATE TABLE game_config (
  key        TEXT PRIMARY KEY CHECK (key GLOB '[a-z]*' AND key NOT GLOB '*[^a-z0-9_.]*'),
  value_json TEXT NOT NULL CHECK (length(value_json) <= 100000),
  version    INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT NOT NULL DEFAULT 'seed'
) STRICT;

-- character growth data used by the server-side stat calculation (seeded from canon; 0 = not seeded yet)
ALTER TABLE characters ADD COLUMN growth_hp REAL NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN growth_atk REAL NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN growth_def REAL NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN growth_spd REAL NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN weapon_type TEXT;
ALTER TABLE characters ADD COLUMN signature_weapon_id TEXT;

CREATE TABLE character_skills (
  skill_id     TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters (id),
  type         TEXT NOT NULL CHECK (type IN ('basic', 'active', 'passive', 'ultimate')),
  name_en      TEXT NOT NULL,
  data_json    TEXT NOT NULL DEFAULT '{}'
) STRICT;
CREATE INDEX character_skills_char ON character_skills (character_id);
