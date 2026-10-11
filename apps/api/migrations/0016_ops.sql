-- Operations log written by the uomd-ops Worker (cron): nightly encrypted backups and periodic health checks. Shown in the Control Center.
CREATE TABLE ops_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL CHECK (kind IN ('backup', 'health')),
  ok          INTEGER NOT NULL CHECK (ok IN (0, 1)),
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK (length(detail_json) <= 4000),
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX ops_runs_kind ON ops_runs (kind, id DESC);
