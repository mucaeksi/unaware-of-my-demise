-- 0003: account state revision (INF-012). Every committed player mutation adds 1 in the same transaction, and the
-- player snapshot carries it, so a client can tell an older snapshot (a late reply, a replayed request) from a newer one
-- and never moves its state backwards. Additive: a Worker that does not know the column keeps working.
ALTER TABLE account ADD COLUMN state_revision BIGINT NOT NULL DEFAULT 0 CHECK (state_revision >= 0);
