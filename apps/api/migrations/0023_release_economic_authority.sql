-- Economic authority is independent of published/servable historical content.
ALTER TABLE channel_pointers ADD COLUMN economic_floor INTEGER NOT NULL DEFAULT 0 CHECK (economic_floor >= 0);
UPDATE channel_pointers SET economic_floor = COALESCE((
  SELECT MAX(generation) FROM content_releases
  WHERE channel = channel_pointers.channel AND state IN ('published', 'retired') AND published_at IS NOT NULL
    AND json_extract(manifest_json, '$.rollout.kill_switch') = 1
), 0);

CREATE TABLE release_economic_policy (
  release_id TEXT PRIMARY KEY REFERENCES content_releases(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('allowlisted', 'grace', 'revoked')),
  valid_until TEXT,
  cutover_at TEXT NOT NULL CHECK (julianday(cutover_at) IS NOT NULL),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((mode = 'revoked' AND valid_until IS NULL) OR
         (mode != 'revoked' AND julianday(valid_until) IS NOT NULL AND julianday(valid_until) > julianday(cutover_at)))
) STRICT;
