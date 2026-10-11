-- First-install checkpoint (prologue, tutorials T-1..T-3, patch page). Presentation progress only: no rewards, no clears.
-- Monotonic by construction (the service only ever raises these values), so a reinstall or a second device resumes where the player stopped.
CREATE TABLE player_entry (
  player_id  TEXT PRIMARY KEY REFERENCES players (id),
  phase      TEXT NOT NULL CHECK (phase IN ('in_progress', 'completed')),
  prologue   INTEGER NOT NULL DEFAULT 0 CHECK (prologue IN (0, 1)),
  tutorials  INTEGER NOT NULL DEFAULT 0 CHECK (tutorials BETWEEN 0 AND 3),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT, WITHOUT ROWID;
