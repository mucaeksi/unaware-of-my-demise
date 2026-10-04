-- Tests for 0008_admin. Run by database/test.sh after the earlier tests.

DO $$
BEGIN
    INSERT INTO admin_users (email, role, added_by) VALUES ('ops@example.com', 'operator', 'migration');
    BEGIN
        INSERT INTO admin_users (email, role, added_by) VALUES ('Ops@Example.com', 'viewer', 'migration');
        RAISE EXCEPTION 'a mixed-case e-mail was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO admin_users (email, role, added_by) VALUES ('x@example.com', 'root', 'migration');
        RAISE EXCEPTION 'an unknown role was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- A read needs no reason; a change needs a reason and an operation key.
    INSERT INTO admin_audit (actor_email, actor_role, permission, action, target_account_id, environment, config_revision)
        VALUES ('ops@example.com', 'operator', 'player.read', 'read.player_state', 'acct_00000000000000000000000000000008', 'test', 'r');
    BEGIN
        INSERT INTO admin_audit (actor_email, actor_role, permission, action, environment, config_revision, operation_key)
            VALUES ('ops@example.com', 'operator', 'player.support', 'support.revoke_sessions', 'test', 'r', '00000000-0000-4000-8000-000000000008');
        RAISE EXCEPTION 'a change without a reason was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO admin_audit (actor_email, actor_role, permission, action, environment, config_revision, reason)
            VALUES ('ops@example.com', 'operator', 'player.support', 'support.revoke_sessions', 'test', 'r', 'lost phone, ticket 12');
        RAISE EXCEPTION 'a change without an operation key was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO admin_audit (actor_email, actor_role, permission, action, environment, config_revision, reason, operation_key)
        VALUES ('ops@example.com', 'operator', 'player.support', 'support.revoke_sessions', 'test', 'r', 'lost phone, ticket 12', '00000000-0000-4000-8000-000000000008');
    BEGIN
        INSERT INTO admin_audit (actor_email, actor_role, permission, action, environment, config_revision, reason, operation_key)
            VALUES ('ops@example.com', 'operator', 'player.support', 'support.revoke_sessions', 'test', 'r', 'again, ticket 12', '00000000-0000-4000-8000-000000000008');
        RAISE EXCEPTION 'the same operation key was recorded twice';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- Append-only.
    BEGIN
        UPDATE admin_audit SET reason = 'rewritten history' WHERE action = 'support.revoke_sessions';
        RAISE EXCEPTION 'an audit row was updated';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'admin_audit is append-only' THEN RAISE; END IF;
    END;
    BEGIN
        DELETE FROM admin_audit;
        RAISE EXCEPTION 'an audit row was deleted';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'admin_audit is append-only' THEN RAISE; END IF;
    END;
    IF (SELECT count(*) FROM admin_audit) <> 2 THEN
        RAISE EXCEPTION 'expected two audit rows';
    END IF;
END $$;
