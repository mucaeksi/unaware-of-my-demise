-- Tests for 0009_liveops. Run by database/test.sh after the earlier tests.

INSERT INTO account (account_id) VALUES ('acct_00000000000000000000000000000009');

DO $$
DECLARE
    a TEXT := 'acct_00000000000000000000000000000009';
    m TEXT := 'mail_00000000000000000000000000000009';
BEGIN
    BEGIN
        INSERT INTO liveops_config (config, created_by, reason, operation_key) VALUES ('[]', 'ops', 'not an object', gen_random_uuid());
        RAISE EXCEPTION 'a non-object config was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO mail (mail_id, title_en, body_en, starts_at, expires_at, created_by, reason, operation_key)
            VALUES (m, 't', 'b', now(), now() - interval '1 hour', 'ops', 'backwards window', gen_random_uuid());
        RAISE EXCEPTION 'a mail that expires before it starts was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO mail (mail_id, title_en, body_en, starts_at, expires_at, created_by, reason, operation_key)
            VALUES ('mail_x', 't', 'b', now(), now() + interval '1 hour', 'ops', 'bad id', gen_random_uuid());
        RAISE EXCEPTION 'a malformed mail id was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO mail (mail_id, title_en, body_en, starts_at, expires_at, created_by, reason, operation_key)
        VALUES (m, 't', 'b', now(), now() + interval '1 hour', 'ops', 'event reward', gen_random_uuid());
    INSERT INTO mail_claims (account_id, mail_id, granted) VALUES (a, m, '{}');
    BEGIN
        INSERT INTO mail_claims (account_id, mail_id, granted) VALUES (a, m, '{}');
        RAISE EXCEPTION 'a mail was claimed twice';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    -- Deleting the account removes its claims, never the mail.
    DELETE FROM account WHERE account_id = a;
    IF EXISTS (SELECT 1 FROM mail_claims WHERE account_id = a) OR NOT EXISTS (SELECT 1 FROM mail WHERE mail_id = m) THEN
        RAISE EXCEPTION 'account deletion did not remove only the claims';
    END IF;
END $$;
