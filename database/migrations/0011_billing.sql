-- 0011: Google Play billing for the Eclipse Blessing subscription (INF-036, owner decision D-10, DEC-0038). The 0001
-- tables (subscriptions, subscription_periods, subscription_claims) keep the LEGACY shape; this adds what Play reports
-- about a purchase, the real-time developer notifications, and a grant ledger that outlives an account deletion.

-- What Google Play last said about the purchase (verify, or a notification re-reading it).
ALTER TABLE subscriptions ADD COLUMN expires_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN play_state TEXT;
ALTER TABLE subscriptions ADD COLUMN acknowledged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN last_verified_at TIMESTAMPTZ;
-- Set when Play reports the purchase refunded, revoked or voided: no further claims (what was paid stays).
ALTER TABLE subscriptions ADD COLUMN revoked_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN revoke_reason TEXT;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_token_length CHECK (length(purchase_token) BETWEEN 1 AND 4096);
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_revoked_reason CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL));

-- The instant grant of a (purchase, period) is paid once, ever: deleting the account and verifying the same purchase on
-- a new one does not pay it again. Only a SHA-256 of the token is kept (not personal: only Google can link a purchase
-- token to a person), so the row survives the account's deletion (no foreign key).
CREATE TABLE billing_instant_grants (
    token_sha256    TEXT NOT NULL CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
    period_end      TIMESTAMPTZ NOT NULL,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (token_sha256, period_end)
);

-- Real-time developer notifications (Pub/Sub push): one row per message, so a redelivery is processed once.
CREATE TABLE billing_notifications (
    message_id          TEXT PRIMARY KEY CHECK (length(message_id) BETWEEN 1 AND 256),
    received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    kind                TEXT NOT NULL CHECK (kind IN ('subscription', 'voided', 'test', 'other')),
    notification_type   INTEGER,
    token_sha256        TEXT CHECK (token_sha256 IS NULL OR token_sha256 ~ '^[0-9a-f]{64}$'),
    processed_at        TIMESTAMPTZ,
    outcome             TEXT
);
CREATE INDEX billing_notifications_token_idx ON billing_notifications (token_sha256, received_at DESC);
