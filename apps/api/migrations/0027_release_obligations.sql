-- Existing obligations remain explicitly legacy. New earned/paid mail carries only the definitions it promised.
ALTER TABLE mail ADD COLUMN grant_catalog TEXT CHECK (grant_catalog IS NULL OR json_valid(grant_catalog));
CREATE TRIGGER mail_grant_catalog_immutable BEFORE UPDATE OF grant_catalog ON mail BEGIN SELECT RAISE(ABORT, 'mail grant definitions are immutable'); END;

-- A player observes one task rule set per UTC week, including all daily windows and weekly claim grace.
CREATE TABLE task_rule_weeks (
  player_id TEXT NOT NULL REFERENCES players(id),
  week_start TEXT NOT NULL,
  config_json TEXT NOT NULL CHECK (json_valid(config_json)),
  grant_catalog TEXT CHECK (grant_catalog IS NULL OR json_valid(grant_catalog)),
  PRIMARY KEY (player_id, week_start)
) STRICT, WITHOUT ROWID;
INSERT INTO task_rule_weeks (player_id, week_start, config_json)
SELECT DISTINCT t.player_id, date(substr(t.period_key, 3, 10), '-' || ((CAST(strftime('%w', substr(t.period_key, 3, 10)) AS INTEGER) + 6) % 7) || ' days'), c.value_json
FROM player_tasks t JOIN game_config c ON c.key = 'tasks';
CREATE TRIGGER task_rule_weeks_immutable BEFORE UPDATE ON task_rule_weeks BEGIN SELECT RAISE(ABORT, 'task rules are immutable'); END;
