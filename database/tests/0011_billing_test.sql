-- Tests for 0011_billing. Run by database/test.sh after the earlier tests.

INSERT INTO account (account_id) VALUES ('acct_00000000000000000000000000000b01');

DO $$
DECLARE
    a TEXT := 'acct_00000000000000000000000000000b01';
    h TEXT := repeat('ab', 32);
BEGIN
    INSERT INTO subscriptions (purchase_token, account_id, product_id) VALUES ('token-b01', a, 'eclipse_blessing_30d');
    BEGIN
        UPDATE subscriptions SET revoked_at = now() WHERE purchase_token = 'token-b01';
        RAISE EXCEPTION 'a revocation without a reason was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO billing_instant_grants (token_sha256, period_end) VALUES (h, '2026-11-01T00:00:00Z');
    BEGIN
        INSERT INTO billing_instant_grants (token_sha256, period_end) VALUES (h, '2026-11-01T00:00:00Z');
        RAISE EXCEPTION 'an instant grant was recorded twice';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    INSERT INTO billing_notifications (message_id, kind, notification_type, token_sha256) VALUES ('m1', 'subscription', 2, h);
    BEGIN
        INSERT INTO billing_notifications (message_id, kind) VALUES ('m1', 'test');
        RAISE EXCEPTION 'a notification was stored twice';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    -- Deleting the account removes its subscription but never the grant ledger.
    DELETE FROM account WHERE account_id = a;
    IF EXISTS (SELECT 1 FROM subscriptions WHERE account_id = a) OR NOT EXISTS (SELECT 1 FROM billing_instant_grants WHERE token_sha256 = h) THEN
        RAISE EXCEPTION 'account deletion did not keep only the grant ledger';
    END IF;
END $$;
