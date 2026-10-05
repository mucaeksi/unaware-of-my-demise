-- Tests for 0012_release_control. Run by database/test.sh after the earlier tests.

DO $$
BEGIN
    INSERT INTO release_control (maintenance_message, min_client_version_code, created_by, reason, operation_key)
    VALUES ('Back at 03:00 UTC', 2, 'ops@example.com', 'database upgrade', gen_random_uuid());
    BEGIN
        INSERT INTO release_control (min_client_version_code, created_by, reason, operation_key) VALUES (0, 'ops@example.com', 'bad minimum', gen_random_uuid());
        RAISE EXCEPTION 'a minimum versionCode of 0 was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO release_control (maintenance_message, created_by, reason, operation_key) VALUES (repeat('x', 501), 'ops@example.com', 'too long', gen_random_uuid());
        RAISE EXCEPTION 'a 501-character maintenance message was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO release_control (created_by, reason, operation_key) VALUES ('ops@example.com', 'x', gen_random_uuid());
        RAISE EXCEPTION 'a revision without a reason was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;
