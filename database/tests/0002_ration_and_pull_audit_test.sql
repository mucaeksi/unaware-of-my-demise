-- Tests for 0002_ration_and_pull_audit. Run by database/test.sh after 0001's tests.

INSERT INTO account (account_id) VALUES ('acct_00000000000000000000000000000002');
INSERT INTO wallet (account_id, ration) VALUES ('acct_00000000000000000000000000000002', 100);

DO $$
DECLARE stamp TIMESTAMPTZ;
BEGIN
    SELECT ration_updated_at INTO stamp FROM wallet WHERE account_id = 'acct_00000000000000000000000000000002';
    IF stamp IS NULL THEN RAISE EXCEPTION 'ration_updated_at must default to now()'; END IF;
    BEGIN
        UPDATE wallet SET ration = -1 WHERE account_id = 'acct_00000000000000000000000000000002';
        RAISE EXCEPTION 'a negative Ration was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE wallet SET ration_updated_at = NULL WHERE account_id = 'acct_00000000000000000000000000000002';
        RAISE EXCEPTION 'a NULL ration_updated_at was accepted';
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;
END $$;

INSERT INTO pull_history (pull_id, account_id, banner_id, banner_type, rarity, hard_pity_triggered, rng_seed)
VALUES ('pull_0002', 'acct_00000000000000000000000000000002', 'hall_of_ancestors', 'standard_character', 3, false, '12345678901234567890');
