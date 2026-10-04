-- 0007: the rules release an attempt was opened under (INF-022). The server re-simulates a victory with the rules it
-- bundles now; an attempt opened under other rules (a content release happened in between) would be judged by rules the
-- player's client did not play, so it is no longer offered or paid. NULL = opened before this column existed.
ALTER TABLE stage_attempts ADD COLUMN rules_hash TEXT;
