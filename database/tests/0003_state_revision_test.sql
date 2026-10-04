-- Tests for 0003_state_revision. Run by database/test.sh after 0002's tests.

INSERT INTO account (account_id) VALUES ('acct_00000000000000000000000000000003');

DO $$
DECLARE revision BIGINT;
BEGIN
    SELECT state_revision INTO revision FROM account WHERE account_id = 'acct_00000000000000000000000000000003';
    IF revision IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'a new account must start at state_revision 0, got %', revision; END IF;
    BEGIN
        UPDATE account SET state_revision = -1 WHERE account_id = 'acct_00000000000000000000000000000003';
        RAISE EXCEPTION 'a negative state_revision was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE account SET state_revision = NULL WHERE account_id = 'acct_00000000000000000000000000000003';
        RAISE EXCEPTION 'a NULL state_revision was accepted';
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;
END $$;
