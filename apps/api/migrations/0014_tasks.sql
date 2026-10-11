-- Task engine: per-player progress per period (12-hour window or weekly segment). Rewards are claimed once (claimed = 1 is monotonic).
CREATE TABLE player_tasks (
  player_id  TEXT NOT NULL REFERENCES players (id),
  period_key TEXT NOT NULL,
  task_id    TEXT NOT NULL,
  progress   INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  target     INTEGER NOT NULL CHECK (target >= 1),
  claimed    INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0, 1)),
  claimed_at TEXT,
  PRIMARY KEY (player_id, period_key, task_id)
) STRICT, WITHOUT ROWID;

CREATE TRIGGER player_tasks_claimed_is_final BEFORE UPDATE OF claimed ON player_tasks WHEN OLD.claimed = 1 AND NEW.claimed = 0
BEGIN SELECT RAISE(ABORT, 'task claims never un-claim'); END;
