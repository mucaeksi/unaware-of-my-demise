-- UOMD core schema (Cloudflare D1 / SQLite). All tables STRICT; timestamps are ISO-8601 UTC text.

-- ---------------------------------------------------------------- content delivery
CREATE TABLE content_objects (
  sha256     TEXT PRIMARY KEY CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  bytes      INTEGER NOT NULL CHECK (bytes > 0),
  media_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE content_releases (
  id            TEXT PRIMARY KEY CHECK (id GLOB '[a-z]*' AND id NOT GLOB '*[^a-z0-9_]*'),
  generation    INTEGER NOT NULL CHECK (generation >= 1),
  channel       TEXT NOT NULL CHECK (channel IN ('dev', 'staging', 'production')),
  state         TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'retired')),
  depends_on    TEXT REFERENCES content_releases (id),
  manifest_json TEXT NOT NULL,
  notes         TEXT NOT NULL DEFAULT '',
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at  TEXT,
  UNIQUE (channel, generation)
) STRICT;

CREATE TABLE release_files (
  release_id TEXT NOT NULL REFERENCES content_releases (id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  sha256     TEXT NOT NULL REFERENCES content_objects (sha256),
  PRIMARY KEY (release_id, path)
) STRICT, WITHOUT ROWID;
CREATE INDEX release_files_sha ON release_files (sha256);

-- One row per channel: the published release clients receive. `version` gives optimistic concurrency.
CREATE TABLE channel_pointers (
  channel    TEXT PRIMARY KEY CHECK (channel IN ('dev', 'staging', 'production')),
  release_id TEXT NOT NULL REFERENCES content_releases (id),
  version    INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT NOT NULL
) STRICT;

-- ---------------------------------------------------------------- administration
CREATE TABLE admin_users (
  email      TEXT PRIMARY KEY CHECK (email = lower(email)),
  role       TEXT NOT NULL CHECK (role IN ('owner', 'operator', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT NOT NULL
) STRICT;

-- Append-only: UPDATE/DELETE are rejected by triggers.
CREATE TABLE audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor     TEXT NOT NULL,
  action    TEXT NOT NULL,
  target    TEXT,
  detail    TEXT NOT NULL DEFAULT '{}'
) STRICT;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

-- ---------------------------------------------------------------- game data (D1 is the authority)
CREATE TABLE characters (
  id         TEXT PRIMARY KEY,
  name_en    TEXT NOT NULL,
  rarity     INTEGER NOT NULL CHECK (rarity BETWEEN 1 AND 5),
  element    TEXT NOT NULL CHECK (element IN ('Ember', 'Gale', 'Stone', 'Tide', 'Dawn', 'Veil')),
  role       TEXT NOT NULL,
  age        INTEGER NOT NULL,
  acquisition TEXT NOT NULL,
  base_hp    REAL NOT NULL CHECK (base_hp > 0),
  base_atk   REAL NOT NULL CHECK (base_atk >= 0),
  base_def   REAL NOT NULL CHECK (base_def >= 0),
  base_spd   REAL NOT NULL CHECK (base_spd > 0),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'retired')),
  version    INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT NOT NULL DEFAULT 'seed'
) STRICT;

CREATE TABLE assets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  path       TEXT NOT NULL UNIQUE,
  sha256     TEXT NOT NULL CHECK (length(sha256) = 64),
  bytes      INTEGER NOT NULL CHECK (bytes > 0),
  media_type TEXT NOT NULL,
  kind       TEXT NOT NULL,
  source     TEXT NOT NULL,
  license    TEXT NOT NULL DEFAULT 'project-owned',
  status     TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'approved', 'retired')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT NOT NULL
) STRICT;

-- Server re-simulations of client-reported battles (see packages/combat replayBattle).
CREATE TABLE battle_audit (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  release_id   TEXT NOT NULL,
  encounter    TEXT NOT NULL,
  valid        INTEGER NOT NULL CHECK (valid IN (0, 1)),
  complete     INTEGER NOT NULL CHECK (complete IN (0, 1)),
  winner       TEXT,
  stars        INTEGER,
  turns        INTEGER,
  log_hash     TEXT NOT NULL,
  client_match INTEGER NOT NULL CHECK (client_match IN (0, 1)),
  caller       TEXT NOT NULL
) STRICT;
CREATE INDEX battle_audit_at ON battle_audit (at);

-- Fixed-window request counters for public endpoints (fallback when no rate-limit binding exists).
CREATE TABLE rate_counters (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits         INTEGER NOT NULL
) STRICT;
