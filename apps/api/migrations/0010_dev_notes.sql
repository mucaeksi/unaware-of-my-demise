-- Development tracker: design feedback and change requests written in the Control Center. The assistant reads open notes at the
-- start of every working session (direct D1 query), answers them in the commit that resolves them and records the resolution here.
CREATE TABLE dev_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  area        TEXT NOT NULL CHECK (length(area) BETWEEN 2 AND 60),
  kind        TEXT NOT NULL CHECK (kind IN ('feedback', 'change_request', 'approved', 'question', 'idea')),
  body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'wontfix')),
  resolution  TEXT NOT NULL DEFAULT '' CHECK (length(resolution) <= 2000),
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by  TEXT,
  updated_at  TEXT
) STRICT;
CREATE INDEX dev_notes_status ON dev_notes (status, id DESC);
-- notes are never deleted (they are the design record); only status/resolution change
CREATE TRIGGER dev_notes_no_delete BEFORE DELETE ON dev_notes BEGIN SELECT RAISE(ABORT, 'dev_notes are kept as the design record'); END;
CREATE TRIGGER dev_notes_body_immutable BEFORE UPDATE ON dev_notes WHEN NEW.body <> OLD.body OR NEW.area <> OLD.area OR NEW.kind <> OLD.kind OR NEW.created_by <> OLD.created_by
BEGIN SELECT RAISE(ABORT, 'a note cannot be rewritten; add a new one'); END;
