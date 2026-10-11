-- Player core: currency reference table, sessions, item inventory, gacha (banners, pity, request journal, pull journal).
-- wallets/ledger are rebuilt so currencies are DATA (a reference table) instead of a hard-coded CHECK list; ids follow the canon
-- (economy_part1.json): silver_crowns, eclipse_token, fates_thread. Existing rows (none are expected before launch) are carried over.

CREATE TABLE currencies (
  id           TEXT PRIMARY KEY CHECK (id GLOB '[a-z]*' AND id NOT GLOB '*[^a-z0-9_]*'),
  display_name TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('premium_earnable', 'pull_ticket', 'progression_only', 'event'))
) STRICT;
INSERT INTO currencies (id, display_name, kind) VALUES
  ('silver_crowns', 'Silver Crowns', 'progression_only'),
  ('eclipse_token', 'Eclipse Token', 'premium_earnable'),
  ('fates_thread', 'Fate''s Thread', 'pull_ticket');

ALTER TABLE wallets RENAME TO wallets_v1;
ALTER TABLE ledger RENAME TO ledger_v1;
DROP TRIGGER ledger_no_update;
DROP TRIGGER ledger_no_delete;
DROP INDEX ledger_player;

CREATE TABLE wallets (
  player_id TEXT NOT NULL REFERENCES players (id),
  currency  TEXT NOT NULL REFERENCES currencies (id),
  balance   INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  version   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, currency)
) STRICT, WITHOUT ROWID;

CREATE TABLE ledger (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id       TEXT NOT NULL REFERENCES players (id),
  currency        TEXT NOT NULL REFERENCES currencies (id),
  delta           INTEGER NOT NULL CHECK (delta <> 0),
  reason          TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX ledger_player ON ledger (player_id, currency, id);
CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;

INSERT INTO wallets (player_id, currency, balance, version)
  SELECT player_id, CASE currency WHEN 'eclipse_tokens' THEN 'eclipse_token' WHEN 'fate_threads' THEN 'fates_thread' ELSE currency END, balance, version FROM wallets_v1;
INSERT INTO ledger (id, player_id, currency, delta, reason, idempotency_key, at)
  SELECT id, player_id, CASE currency WHEN 'eclipse_tokens' THEN 'eclipse_token' WHEN 'fate_threads' THEN 'fates_thread' ELSE currency END, delta, reason, idempotency_key, at FROM ledger_v1;
DROP TABLE wallets_v1;
DROP TABLE ledger_v1;

-- ---------------------------------------------------------------- accounts and sessions
ALTER TABLE players ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned', 'deleted'));
ALTER TABLE players ADD COLUMN display_name TEXT;
ALTER TABLE players ADD COLUMN last_seen_at TEXT;
ALTER TABLE players ADD COLUMN deleted_at TEXT;

-- Opaque bearer tokens: only the SHA-256 of a token is stored, so a database leak does not leak usable sessions.
CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  player_id    TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at   TEXT NOT NULL,
  last_used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at   TEXT
) STRICT, WITHOUT ROWID;
CREATE INDEX sessions_player ON sessions (player_id);

-- ---------------------------------------------------------------- inventory
-- copies = how many times the item was obtained (1 = owned); shards = character-bound Memory Shards from duplicates.
CREATE TABLE player_items (
  player_id  TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  item_type  TEXT NOT NULL CHECK (item_type IN ('character', 'weapon')),
  item_id    TEXT NOT NULL,
  copies     INTEGER NOT NULL DEFAULT 1 CHECK (copies >= 1),
  shards     INTEGER NOT NULL DEFAULT 0 CHECK (shards >= 0),
  first_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (player_id, item_type, item_id)
) STRICT, WITHOUT ROWID;

-- ---------------------------------------------------------------- gacha
CREATE TABLE banners (
  id          TEXT PRIMARY KEY CHECK (id GLOB '[a-z]*' AND id NOT GLOB '*[^a-z0-9_]*'),
  title_en    TEXT NOT NULL,
  config_json TEXT NOT NULL,
  starts_at   TEXT,
  ends_at     TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by  TEXT NOT NULL DEFAULT 'seed'
) STRICT;

-- pity / 50-50 / knots per account and pity group; `version` is the optimistic-concurrency token of every pull.
CREATE TABLE pity_state (
  player_id  TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  pity_group TEXT NOT NULL,
  pity5      INTEGER NOT NULL DEFAULT 0 CHECK (pity5 >= 0),
  pity4      INTEGER NOT NULL DEFAULT 0 CHECK (pity4 >= 0),
  lost       INTEGER NOT NULL DEFAULT 0 CHECK (lost >= 0),
  version    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, pity_group)
) STRICT, WITHOUT ROWID;

-- One row per pull request: replaying a requestId returns this stored result and never pulls again.
CREATE TABLE gacha_requests (
  player_id   TEXT NOT NULL REFERENCES players (id),
  request_id  TEXT NOT NULL,
  banner_id   TEXT NOT NULL,
  pull_count  INTEGER NOT NULL CHECK (pull_count BETWEEN 1 AND 10),
  result_json TEXT NOT NULL,
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (player_id, request_id)
) STRICT, WITHOUT ROWID;

-- Immutable pull journal (the raw rolls are kept so any pull can be re-derived and audited).
CREATE TABLE gacha_pulls (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   TEXT NOT NULL REFERENCES players (id),
  request_id  TEXT NOT NULL,
  seq         INTEGER NOT NULL CHECK (seq BETWEEN 0 AND 9),
  banner_id   TEXT NOT NULL,
  pull_number INTEGER NOT NULL,
  rarity      INTEGER NOT NULL CHECK (rarity BETWEEN 3 AND 5),
  item_type   TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  outcome     TEXT NOT NULL,
  upgraded    INTEGER NOT NULL CHECK (upgraded IN (0, 1)),
  duplicate   INTEGER NOT NULL CHECK (duplicate IN (0, 1)),
  rolls_json  TEXT NOT NULL,
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (player_id, request_id, seq)
) STRICT;
CREATE INDEX gacha_pulls_player ON gacha_pulls (player_id, id);
CREATE TRIGGER gacha_pulls_no_update BEFORE UPDATE ON gacha_pulls BEGIN SELECT RAISE(ABORT, 'gacha_pulls is append-only'); END;
-- account deletion anonymises the player row (status 'deleted', identifiers purged); journals are never deleted
CREATE TRIGGER gacha_pulls_no_delete BEFORE DELETE ON gacha_pulls BEGIN SELECT RAISE(ABORT, 'gacha_pulls is append-only'); END;

-- Transaction guard: a batch inserts ok = 0 here when its optimistic-concurrency update changed no row; the CHECK aborts
-- (rolls back) the whole batch. Rows never persist: every successful batch deletes its own at the end.
CREATE TABLE tx_guard (ok INTEGER NOT NULL CHECK (ok = 1)) STRICT;
