-- Tests for 0010_social. Run by database/test.sh after the earlier tests.

INSERT INTO account (account_id) VALUES
    ('acct_00000000000000000000000000000a01'),
    ('acct_00000000000000000000000000000a02');
INSERT INTO profiles (account_id, friend_code, nickname) VALUES
    ('acct_00000000000000000000000000000a01', 'SOCA-0001', 'Ashen Road'),
    ('acct_00000000000000000000000000000a02', 'SOCA-0002', 'Ember');

DO $$
DECLARE
    a TEXT := 'acct_00000000000000000000000000000a01';
    b TEXT := 'acct_00000000000000000000000000000a02';
    r TEXT := 'freq_0123456789abcdef0123456789abcdef';
BEGIN
    BEGIN
        UPDATE profiles SET nickname = 'ASHEN ROAD' WHERE account_id = b;
        RAISE EXCEPTION 'a nickname differing only in case was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        UPDATE profiles SET nickname = 'ab' WHERE account_id = b;
        RAISE EXCEPTION 'a two-character nickname was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO friend_edges (owner_account_id, other_account_id, state) VALUES (a, b, 'pending_out');
        RAISE EXCEPTION 'a pending edge without a request id was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO friend_edges (owner_account_id, other_account_id, state, request_id) VALUES (a, b, 'accepted', r);
        RAISE EXCEPTION 'an accepted edge with a request id was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO friend_edges (owner_account_id, other_account_id, state, request_id) VALUES (a, b, 'pending_out', r), (b, a, 'pending_in', r);
    BEGIN
        INSERT INTO reports (report_id, reporter_account_id, reported_account_id, reason_key)
            VALUES ('report_0123456789abcdef0123456789abcdef', a, b, 'because');
        RAISE EXCEPTION 'an unknown report reason was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO reports (report_id, reporter_account_id, reported_account_id, reason_key)
            VALUES ('report_0123456789abcdef0123456789abcdef', a, a, 'spam');
        RAISE EXCEPTION 'a self report was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO reports (report_id, reporter_account_id, reported_account_id, reason_key)
        VALUES ('report_0123456789abcdef0123456789abcdef', a, b, 'harassment');
    BEGIN
        UPDATE reports SET resolved_at = now() WHERE reporter_account_id = a;
        RAISE EXCEPTION 'a resolution without who and why was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- Deleting an account removes its edges on both sides and the reports it made or received.
    DELETE FROM account WHERE account_id = b;
    IF EXISTS (SELECT 1 FROM friend_edges WHERE b IN (owner_account_id, other_account_id))
       OR EXISTS (SELECT 1 FROM reports WHERE b IN (reporter_account_id, reported_account_id)) THEN
        RAISE EXCEPTION 'account deletion left social rows behind';
    END IF;
    DELETE FROM account WHERE account_id = a;
END $$;
