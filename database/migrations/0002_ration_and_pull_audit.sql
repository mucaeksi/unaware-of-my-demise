-- 0002: server-side Ration (stamina) regeneration and per-request gacha RNG audit.
--
-- Ration (owner decision 2026-10-04, DEC-0014): cap 100, one unit every 300 s, spent only by a verified victory of a
-- Ration-costing stage. `wallet.ration` holds the balance as of `ration_updated_at`; the server adds the units regenerated
-- since then whenever it reads or spends Ration, so no timer runs anywhere. New accounts start full (set by the Worker).
ALTER TABLE wallet ADD COLUMN ration_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- The CSPRNG seed of the request that resolved the pull (the same for every row of one 10-pull). With the stored pity
-- state it replays a disputed pull exactly through the parity-tested gacha rules.
ALTER TABLE pull_history ADD COLUMN rng_seed TEXT;
