-- Economy foundation: an immutable ledger plus materialised balances that can never go negative.
-- Every balance change is ONE D1 batch (transaction): ledger insert (unique idempotency key) + guarded balance update.

CREATE TABLE players (
  id         TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE wallets (
  player_id TEXT NOT NULL REFERENCES players (id),
  currency  TEXT NOT NULL CHECK (currency IN ('silver_crowns', 'eclipse_tokens', 'fate_threads')),
  balance   INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  version   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, currency)
) STRICT, WITHOUT ROWID;

CREATE TABLE ledger (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id       TEXT NOT NULL REFERENCES players (id),
  currency        TEXT NOT NULL CHECK (currency IN ('silver_crowns', 'eclipse_tokens', 'fate_threads')),
  delta           INTEGER NOT NULL CHECK (delta <> 0),
  reason          TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX ledger_player ON ledger (player_id, currency, id);
CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
