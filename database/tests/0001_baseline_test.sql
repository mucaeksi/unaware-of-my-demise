-- Constraint tests for 0001_baseline. Run by database/test.sh against a fresh, migrated database.
-- Each `expect_error` statement must be rejected by the schema; anything accepted fails the run.

CREATE OR REPLACE FUNCTION pg_temp.expect_error(statement TEXT, label TEXT) RETURNS void AS $$
BEGIN
    BEGIN
        EXECUTE statement;
    EXCEPTION WHEN integrity_constraint_violation OR check_violation OR unique_violation OR foreign_key_violation
              OR not_null_violation OR invalid_text_representation THEN
        RETURN;
    END;
    RAISE EXCEPTION 'accepted but must be rejected: %', label;
END;
$$ LANGUAGE plpgsql;

INSERT INTO account (account_id) VALUES ('acct_0123456789abcdef0123456789abcdef'), ('acct_fedcba9876543210fedcba9876543210');
INSERT INTO wallet (account_id) VALUES ('acct_0123456789abcdef0123456789abcdef');

SELECT pg_temp.expect_error($q$INSERT INTO account (account_id) VALUES ('player-1')$q$, 'client-style account id');
SELECT pg_temp.expect_error($q$UPDATE wallet SET eclipse_tokens = eclipse_tokens - 1$q$, 'negative balance');
SELECT pg_temp.expect_error($q$INSERT INTO roster (account_id, character_id, level) VALUES ('acct_0123456789abcdef0123456789abcdef', 'mahmut', 21)$q$, 'level above 20');
SELECT pg_temp.expect_error($q$INSERT INTO inventory_items (account_id, item_id, quantity) VALUES ('acct_0123456789abcdef0123456789abcdef', 'x', -1)$q$, 'negative item quantity');

-- One weapon per character; one armor / accessory per slot per character.
INSERT INTO inventory_weapons (instance_id, account_id, weapon_id, equipped_character_id)
    VALUES ('w1', 'acct_0123456789abcdef0123456789abcdef', 'weapon_mahmut_signature', 'mahmut'),
           ('w2', 'acct_0123456789abcdef0123456789abcdef', 'weapon_mahmut_signature', NULL),
           ('w3', 'acct_0123456789abcdef0123456789abcdef', 'weapon_mahmut_signature', NULL);
SELECT pg_temp.expect_error($q$UPDATE inventory_weapons SET equipped_character_id = 'mahmut' WHERE instance_id = 'w2'$q$, 'second weapon on one hero');
INSERT INTO inventory_accessories (instance_id, account_id, accessory_id, equip_slot, equipped_character_id, payload)
    VALUES ('a1', 'acct_0123456789abcdef0123456789abcdef', 'acc', 'necklace', 'mahmut', '{}'),
           ('a2', 'acct_0123456789abcdef0123456789abcdef', 'acc', 'ring', 'mahmut', '{}');
SELECT pg_temp.expect_error($q$INSERT INTO inventory_accessories (instance_id, account_id, accessory_id, equip_slot, equipped_character_id, payload) VALUES ('a3', 'acct_0123456789abcdef0123456789abcdef', 'acc', 'ring', 'mahmut', '{}')$q$, 'second ring on one hero');
DO $$ BEGIN
    IF (SELECT array_agg(instance_id ORDER BY acquired_seq) FROM inventory_weapons) <> ARRAY['w1', 'w2', 'w3'] THEN
        RAISE EXCEPTION 'acquisition order is not stable';
    END IF;
END $$;

-- Exactly-once ledgers.
INSERT INTO claims (account_id, reward_type, cycle_id) VALUES ('acct_0123456789abcdef0123456789abcdef', 'first_clear:1-1', 0);
SELECT pg_temp.expect_error($q$INSERT INTO claims (account_id, reward_type, cycle_id) VALUES ('acct_0123456789abcdef0123456789abcdef', 'first_clear:1-1', 0)$q$, 'double first-clear claim');
INSERT INTO ad_rewards (transaction_id, account_id, tokens) VALUES ('t1', 'acct_0123456789abcdef0123456789abcdef', 5);
SELECT pg_temp.expect_error($q$INSERT INTO ad_rewards (transaction_id, account_id, tokens) VALUES ('t1', 'acct_0123456789abcdef0123456789abcdef', 5)$q$, 'replayed ad callback');
SELECT pg_temp.expect_error($q$INSERT INTO idempotency_keys (idempotency_key, account_id, endpoint, request_fingerprint, response_json) VALUES ('not-a-uuid', 'acct_0123456789abcdef0123456789abcdef', 'gacha_pull', 'f', '{}')$q$, 'non-UUID idempotency key');

-- Stage attempts: resolved exactly when not open.
INSERT INTO stage_attempts (attempt_id, account_id, stage_id, roster, run_seed, inputs)
    VALUES ('6f1c1f5e-3b8e-4c1a-9a43-2d3c4b5a6978', 'acct_0123456789abcdef0123456789abcdef', '1-1', '[]', 5, '{}');
SELECT pg_temp.expect_error($q$UPDATE stage_attempts SET status = 'won'$q$, 'resolved attempt without resolved_at');
SELECT pg_temp.expect_error($q$UPDATE stage_attempts SET status = 'maybe', resolved_at = now()$q$, 'unknown attempt status');
SELECT pg_temp.expect_error($q$INSERT INTO stage_attempts (attempt_id, account_id, stage_id, roster, run_seed, inputs) VALUES (gen_random_uuid(), 'acct_0123456789abcdef0123456789abcdef', '1-1', '[]', -1, '{}')$q$, 'negative seed');
UPDATE stage_attempts SET status = 'won', resolved_at = now();

-- Social.
SELECT pg_temp.expect_error($q$INSERT INTO friend_edges (owner_account_id, other_account_id, state) VALUES ('acct_0123456789abcdef0123456789abcdef', 'acct_0123456789abcdef0123456789abcdef', 'accepted')$q$, 'friend edge to self');
SELECT pg_temp.expect_error($q$INSERT INTO friend_edges (owner_account_id, other_account_id, state) VALUES ('acct_0123456789abcdef0123456789abcdef', 'acct_fedcba9876543210fedcba9876543210', 'besties')$q$, 'unknown friend state');

-- Deleting an account removes everything it owns.
DELETE FROM account WHERE account_id = 'acct_0123456789abcdef0123456789abcdef';
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM wallet) OR EXISTS (SELECT 1 FROM inventory_weapons) OR EXISTS (SELECT 1 FROM claims)
       OR EXISTS (SELECT 1 FROM stage_attempts) OR EXISTS (SELECT 1 FROM ad_rewards) THEN
        RAISE EXCEPTION 'account deletion left rows behind';
    END IF;
END $$;
