-- 0009: live operations (INF-035, DEC-0034): versioned remote config, mail with rewards, and the claim ledger.
--
-- liveops_config: append-only revisions; the newest one is current. `config` holds feature flags and notices (validated
-- by the Worker: unknown flags are ignored by clients, a missing config means "no flags, no notices"). Every revision
-- names who published it and why (the admin audit row carries the same operation key).
CREATE TABLE liveops_config (
    revision        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    config          JSONB NOT NULL CHECK (jsonb_typeof(config) = 'object'),
    created_by      TEXT NOT NULL,
    reason          TEXT NOT NULL CHECK (length(btrim(reason)) >= 5),
    operation_key   UUID NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- mail: a message with optional rewards, to everyone or to one account, claimable between starts_at and expires_at
-- (server UTC). Rewards are bounded per mail by the Worker; a mail is never edited after it is sent (only revoked, which
-- stops future claims and never takes back what was claimed).
CREATE TABLE mail (
    mail_id         TEXT PRIMARY KEY CHECK (mail_id ~ '^mail_[0-9a-f]{32}$'),
    account_id      TEXT REFERENCES account (account_id) ON DELETE CASCADE,
    title_en        TEXT NOT NULL CHECK (length(title_en) BETWEEN 1 AND 120),
    body_en         TEXT NOT NULL CHECK (length(body_en) BETWEEN 1 AND 2000),
    rewards         JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(rewards) = 'object'),
    starts_at       TIMESTAMPTZ NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_by      TEXT NOT NULL,
    reason          TEXT NOT NULL CHECK (length(btrim(reason)) >= 5),
    operation_key   UUID NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ,
    CHECK (expires_at > starts_at)
);
CREATE INDEX mail_active_idx ON mail (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX mail_account_idx ON mail (account_id) WHERE account_id IS NOT NULL;

-- mail_claims: the claim ledger. One row per account and mail: a second claim (a double tap, a replay with another
-- key, two devices) cannot pay twice.
CREATE TABLE mail_claims (
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    mail_id         TEXT NOT NULL REFERENCES mail (mail_id),
    claimed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    operation_key   UUID,
    granted         JSONB NOT NULL,
    PRIMARY KEY (account_id, mail_id)
);
