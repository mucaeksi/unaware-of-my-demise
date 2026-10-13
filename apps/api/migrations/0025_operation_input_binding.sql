-- Legacy request bodies are unknown; never reconstruct them from today's catalog.
ALTER TABLE gacha_requests ADD COLUMN input_json TEXT CHECK (input_json IS NULL OR json_valid(input_json));
ALTER TABLE progression_requests ADD COLUMN input_json TEXT CHECK (input_json IS NULL OR json_valid(input_json));
ALTER TABLE battle_claims ADD COLUMN input_json TEXT CHECK (input_json IS NULL OR json_valid(input_json));

-- Account deletion may erase request caches; committed input/results cannot be rewritten.
CREATE TRIGGER gacha_requests_immutable BEFORE UPDATE ON gacha_requests BEGIN SELECT RAISE(ABORT, 'operation journal is immutable'); END;
CREATE TRIGGER progression_requests_immutable BEFORE UPDATE ON progression_requests BEGIN SELECT RAISE(ABORT, 'operation journal is immutable'); END;
CREATE TRIGGER battle_claims_immutable BEFORE UPDATE ON battle_claims BEGIN SELECT RAISE(ABORT, 'operation journal is immutable'); END;
