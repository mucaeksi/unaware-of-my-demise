-- 0008: operators and their audit trail (INF-033/034, DEC-0033).
--
-- admin_users: who may use the admin panel and with which role. The identity is the e-mail Cloudflare Access verified
-- (the panel has no passwords of its own); roles grow in rights: viewer (read service and player data), support
-- (+ support actions on one player), operator (+ release and liveops controls). Rows are added by a migration or an
-- operator, never by the game API.
CREATE TABLE admin_users (
    email       TEXT PRIMARY KEY CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+$'),
    role        TEXT NOT NULL CHECK (role IN ('viewer', 'support', 'operator')),
    added_by    TEXT NOT NULL,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    disabled_at TIMESTAMPTZ
);

-- admin_audit: every admin read of player data and every admin change, written in the same transaction as the change
-- (a change that rolls back leaves no audit row, and no change exists without one). Append-only: rows are never updated
-- or deleted, and they outlive a deleted account (target_account_id is the random account id, not a foreign key).
CREATE TABLE admin_audit (
    audit_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_email         TEXT NOT NULL,
    actor_role          TEXT NOT NULL,
    permission          TEXT NOT NULL,
    action              TEXT NOT NULL,
    -- Why: required for every change, optional for reads.
    reason              TEXT,
    -- The admin request's idempotency key: the same change is never applied twice.
    operation_key       UUID UNIQUE,
    target_account_id   TEXT,
    environment         TEXT NOT NULL,
    -- The Worker release (source SHA) and rules hash the action ran under.
    config_revision     TEXT NOT NULL,
    request             JSONB,
    result              JSONB,
    CHECK (action LIKE 'read.%' OR (reason IS NOT NULL AND length(btrim(reason)) >= 5 AND operation_key IS NOT NULL))
);
CREATE INDEX admin_audit_target_idx ON admin_audit (target_account_id, audit_id DESC) WHERE target_account_id IS NOT NULL;
CREATE INDEX admin_audit_actor_idx ON admin_audit (actor_email, audit_id DESC);

CREATE FUNCTION admin_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'admin_audit is append-only';
END $$;
CREATE TRIGGER admin_audit_no_change BEFORE UPDATE OR DELETE ON admin_audit FOR EACH ROW EXECUTE FUNCTION admin_audit_append_only();
CREATE TRIGGER admin_audit_no_truncate BEFORE TRUNCATE ON admin_audit FOR EACH STATEMENT EXECUTE FUNCTION admin_audit_append_only();
