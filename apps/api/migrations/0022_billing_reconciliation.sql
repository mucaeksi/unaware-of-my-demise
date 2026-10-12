-- Tokens are AES-GCM ciphertext only. Ephemeral token ownership fences provider observations and grants.
CREATE TABLE billing_locks (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  owner TEXT NOT NULL,
  lease_until TEXT NOT NULL
) STRICT, WITHOUT ROWID;
CREATE INDEX billing_locks_expiry ON billing_locks (lease_until);
CREATE TABLE billing_jobs (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  player_id TEXT NOT NULL REFERENCES players(id),
  product_id TEXT NOT NULL REFERENCES shop_products(product_id),
  kind TEXT NOT NULL CHECK (kind IN ('consumable', 'subscription')),
  order_id TEXT,
  fulfillment TEXT CHECK (fulfillment IS NULL OR json_valid(fulfillment)),
  encrypted_token TEXT CHECK (encrypted_token IS NULL OR json_valid(encrypted_token)),
  state TEXT NOT NULL CHECK (state IN ('pending', 'done', 'review')),
  next_at TEXT,
  ack_deadline TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_code TEXT,
  updated_at TEXT NOT NULL
) STRICT, WITHOUT ROWID;
CREATE INDEX billing_jobs_due ON billing_jobs (state, next_at);
CREATE INDEX billing_jobs_player ON billing_jobs (player_id);
CREATE TRIGGER billing_jobs_owner_immutable BEFORE UPDATE OF player_id ON billing_jobs
  WHEN NEW.player_id <> OLD.player_id BEGIN SELECT RAISE(ABORT, 'billing job owner is immutable'); END;
