-- 0010: social features (INF-037, owner decision D-10, DEC-0037). The LEGACY tables of 0001 stay as they are:
-- friend_edges (one row per direction; pending and accepted are mirrored pairs, blocked is one-sided) and reports.
-- This adds what the endpoints need: chosen nicknames (unique regardless of case), coarse presence, report reasons and
-- their moderation state, and indexes for the listings.

-- profiles: a nickname is unique regardless of case. Placeholder nicknames (Player + 6 characters of the account id)
-- could collide; any duplicate already stored keeps its first holder and the others get a suffix from their own id.
WITH ranked AS (
    SELECT account_id, row_number() OVER (PARTITION BY lower(nickname) ORDER BY created_at, account_id) AS position
    FROM profiles
)
UPDATE profiles p SET nickname = left(p.nickname, 11) || '_' || right(p.account_id, 4)
FROM ranked r WHERE r.account_id = p.account_id AND r.position > 1;
CREATE UNIQUE INDEX profiles_nickname_unique ON profiles (lower(nickname));
ALTER TABLE profiles ADD CONSTRAINT profiles_nickname_length CHECK (char_length(nickname) BETWEEN 3 AND 16);
-- When the player last changed the nickname (null = never: the placeholder); a change is rate limited by the Worker.
ALTER TABLE profiles ADD COLUMN nickname_changed_at TIMESTAMPTZ;
-- Coarse presence: refreshed at most every few minutes while the game talks to the server; shown only when the player
-- allows it (presence_opt_in).
ALTER TABLE profiles ADD COLUMN last_seen_at TIMESTAMPTZ;

-- friend_edges: a pending request carries its id on both rows, nothing else does.
ALTER TABLE friend_edges ADD CONSTRAINT friend_edges_request_id CHECK (
    (state IN ('pending_out', 'pending_in')) = (request_id IS NOT NULL)
    AND (request_id IS NULL OR request_id ~ '^freq_[0-9a-f]{32}$')
);
-- The friends listing (newest first, keyset paginated) and the per-state counts behind the limits.
CREATE INDEX friend_edges_owner_listing_idx ON friend_edges (owner_account_id, updated_at DESC, other_account_id DESC);
CREATE INDEX friend_edges_owner_state_idx ON friend_edges (owner_account_id, state);

-- reports: the LEGACY reason keys (client/screens/friends_screen.py), and the moderation state an operator sets.
ALTER TABLE reports ADD CONSTRAINT reports_reason_key CHECK (reason_key IN ('spam', 'harassment', 'inappropriate_name', 'cheating', 'other'));
ALTER TABLE reports ADD CONSTRAINT reports_not_self CHECK (reporter_account_id <> reported_account_id);
ALTER TABLE reports ADD CONSTRAINT reports_id_format CHECK (report_id ~ '^report_[0-9a-f]{32}$');
ALTER TABLE reports ADD COLUMN resolved_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN resolved_by TEXT;
ALTER TABLE reports ADD COLUMN resolution TEXT CHECK (resolution IS NULL OR length(btrim(resolution)) >= 5);
ALTER TABLE reports ADD CONSTRAINT reports_resolution_complete CHECK ((resolved_at IS NULL) = (resolved_by IS NULL) AND (resolved_at IS NULL) = (resolution IS NULL));
CREATE INDEX reports_open_idx ON reports (created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX reports_reported_idx ON reports (reported_account_id, created_at DESC);
CREATE INDEX reports_reporter_idx ON reports (reporter_account_id, created_at DESC);
