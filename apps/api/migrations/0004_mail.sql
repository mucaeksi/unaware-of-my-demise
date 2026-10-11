-- Mailbox: every reward that is not granted inline (compensation, event/subscription entitlements, ad/quest overflow) is mail.
-- Claiming is one atomic batch: mark claimed (guarded) + ledger credits / item grants. Attachments never change after creation.
CREATE TABLE mail (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id    TEXT NOT NULL REFERENCES players (id),
  kind         TEXT NOT NULL CHECK (kind IN ('reward', 'compensation', 'notice', 'subscription', 'event')),
  title        TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  body         TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  attachments  TEXT NOT NULL DEFAULT '[]',
  -- idempotent creation: the same logical grant (e.g. "sub:ORDER:halfday:7") can never create two mails
  source_key   TEXT,
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at   TEXT NOT NULL,
  claimed_at   TEXT,
  read_at      TEXT,
  UNIQUE (player_id, source_key)
) STRICT;
CREATE INDEX mail_player ON mail (player_id, id DESC);
-- attachments and recipients are immutable; only read/claimed markers may change (claimed_at only once)
CREATE TRIGGER mail_immutable BEFORE UPDATE ON mail
WHEN NEW.player_id <> OLD.player_id OR NEW.attachments <> OLD.attachments OR NEW.title <> OLD.title OR NEW.body <> OLD.body OR NEW.expires_at <> OLD.expires_at
  OR NEW.kind <> OLD.kind OR (OLD.claimed_at IS NOT NULL AND NEW.claimed_at IS NOT OLD.claimed_at)
BEGIN SELECT RAISE(ABORT, 'mail content is immutable'); END;
CREATE TRIGGER mail_no_delete BEFORE DELETE ON mail BEGIN SELECT RAISE(ABORT, 'mail is retained for audit'); END;
