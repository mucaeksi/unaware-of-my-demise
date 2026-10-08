-- 0006: account deletion (INF-020). Deleting an account removes every row of it (all foreign keys cascade, the economic
-- journal included). This table keeps only the fact that an account existed and was deleted at the player's request:
-- the random account id (never a provider subject or anything personal), how the identity was confirmed and when.
CREATE TABLE account_deletions (
    deletion_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id      TEXT NOT NULL UNIQUE CHECK (account_id ~ '^acct_[0-9a-f]{32}$'),
    confirmed_by    TEXT NOT NULL,
    account_created_at TIMESTAMPTZ NOT NULL,
    deleted_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
