-- 0012: release control from the admin panel (INF-033, DEC-0040): maintenance and the minimum app version without a
-- redeploy. Append-only revisions; the newest one is in force. The game Worker combines it with its deploy variables:
-- the minimum versionCode is the larger of the two (an operator can raise it, never lower it below what the deployed
-- server needs), and a non-empty maintenance message here wins. Every revision names who set it and why (the admin
-- audit row carries the same operation key).
CREATE TABLE release_control (
    revision                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    maintenance_message     TEXT NOT NULL DEFAULT '' CHECK (length(maintenance_message) <= 500),
    min_client_version_code INTEGER NOT NULL DEFAULT 1 CHECK (min_client_version_code BETWEEN 1 AND 2100000000),
    created_by              TEXT NOT NULL,
    reason                  TEXT NOT NULL CHECK (length(btrim(reason)) >= 5),
    operation_key           UUID NOT NULL UNIQUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
