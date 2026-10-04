-- Tests for 0006_account_deletion. Run by database/test.sh after 0005's tests.

INSERT INTO account (account_id) VALUES ('acct_00000000000000000000000000000006');
INSERT INTO wallet (account_id, eclipse_tokens) VALUES ('acct_00000000000000000000000000000006', 5);

DO $$
BEGIN
    INSERT INTO account_deletions (account_id, confirmed_by, account_created_at)
    SELECT account_id, 'google_oidc', created_at FROM account WHERE account_id = 'acct_00000000000000000000000000000006';
    DELETE FROM account WHERE account_id = 'acct_00000000000000000000000000000006';
    IF EXISTS (SELECT 1 FROM wallet WHERE account_id = 'acct_00000000000000000000000000000006')
       OR EXISTS (SELECT 1 FROM economy_journal WHERE account_id = 'acct_00000000000000000000000000000006') THEN
        RAISE EXCEPTION 'the account rows must cascade away';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM account_deletions WHERE account_id = 'acct_00000000000000000000000000000006') THEN
        RAISE EXCEPTION 'the deletion record must stay';
    END IF;
    BEGIN
        INSERT INTO account_deletions (account_id, confirmed_by, account_created_at) VALUES ('not-an-account', 'x', now());
        RAISE EXCEPTION 'a malformed account id was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;
