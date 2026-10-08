-- Tests for 0004_data_lifecycle. Run by database/test.sh after 0003's tests.

INSERT INTO account (account_id) VALUES ('acct_00000000000000000000000000000004');
INSERT INTO idempotency_keys (idempotency_key, account_id, endpoint, request_fingerprint, response_json)
VALUES ('00000000-0000-4000-8000-000000000004', 'acct_00000000000000000000000000000004', 'story_advance', '', '{"state": {}}');

DO $$
BEGIN
    -- A purge drops the reply and records when; the tombstone row stays.
    UPDATE idempotency_keys SET response_json = NULL, response_purged_at = now() WHERE idempotency_key = '00000000-0000-4000-8000-000000000004';
    IF (SELECT count(*) FROM idempotency_keys WHERE idempotency_key = '00000000-0000-4000-8000-000000000004') <> 1 THEN
        RAISE EXCEPTION 'the tombstone must stay';
    END IF;
    BEGIN
        UPDATE idempotency_keys SET response_purged_at = NULL WHERE idempotency_key = '00000000-0000-4000-8000-000000000004';
        RAISE EXCEPTION 'a purged reply without a purge time was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO idempotency_keys (idempotency_key, account_id, endpoint, request_fingerprint, response_json)
        VALUES ('00000000-0000-4000-8000-000000000005', 'acct_00000000000000000000000000000004', 'story_advance', '', NULL);
        RAISE EXCEPTION 'a missing reply without a purge time was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;
