-- 0001_baseline: the server-authoritative game state (DEC-0012, DEC-0013).
--
-- A PostgreSQL translation of the LEGACY schema, not a new design:
--   * LEGACY backend/_schema.py migrations v1..v7 (the player tables the device used to own), and
--   * LEGACY server/schema.py (identity, sessions, idempotency, ledgers, social),
-- plus `stage_attempts` (DEC-0013: server-issued battle seeds, re-simulated victories).
-- Provenance: docs/LEGACY_AUDIT.md section 9.
--
-- Translation rules:
--   * ISO-8601 TEXT timestamps become TIMESTAMPTZ; the API serializes them as UTC "...Z".
--   * SQLite 0/1 INTEGER flags become BOOLEAN.
--   * Fernet `encrypted_payload` BLOBs existed to protect a save on the device. On the server they become plain JSONB
--     (`state` / `payload`): the database is not in the player's hands, and the rules must be able to read them.
--   * Device-only LEGACY tables are not carried over: `synced_server_instances`, `applied_quest_claims` (client mirrors of
--     server state) and `purchase_receipts` (superseded by `subscriptions`).
--   * Every balance and counter keeps its LEGACY `CHECK (... >= 0)`; every equip slot keeps its partial unique index.

-- Identity --------------------------------------------------------------------------------------------------------------

CREATE TABLE account (
    account_id      TEXT PRIMARY KEY CHECK (account_id ~ '^acct_[0-9a-f]{32}$'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A verified external identity (Google `sub`, hashed; never the raw subject or any token) -> internal account.
CREATE TABLE provider_links (
    provider        TEXT NOT NULL,
    subject_hash    TEXT NOT NULL,
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    linked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, subject_hash)
);
CREATE INDEX provider_links_account_idx ON provider_links (account_id);

-- Opaque bearer sessions: only the SHA-256 of the token is stored, so a database dump cannot be replayed.
CREATE TABLE sessions (
    token_hash      TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_account_idx ON sessions (account_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- Single-use sign-in nonces (the Google ID token must carry one; consuming it is one atomic UPDATE).
CREATE TABLE auth_nonces (
    nonce           TEXT PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed_at     TIMESTAMPTZ
);
CREATE INDEX auth_nonces_expires_idx ON auth_nonces (expires_at);

-- Public profile: server-generated unique friend code, never an email. `player_level` is deliberately absent
-- (LEGACY: no account level curve is designed yet).
CREATE TABLE profiles (
    account_id          TEXT PRIMARY KEY REFERENCES account (account_id) ON DELETE CASCADE,
    friend_code         TEXT NOT NULL UNIQUE,
    nickname            TEXT NOT NULL,
    avatar_mark_id      TEXT,
    chapter_badge_id    TEXT,
    presence_opt_in     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Requests and responses -----------------------------------------------------------------------------------------------

-- Client-supplied Idempotency-Key -> the stored response, so a retried mutation replays the original result.
-- Globally unique on the key; reusing it for another account, endpoint or body (fingerprint) is a conflict.
CREATE TABLE idempotency_keys (
    idempotency_key     UUID PRIMARY KEY,
    account_id          TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    endpoint            TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    response_json       JSONB NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idempotency_keys_account_idx ON idempotency_keys (account_id);

-- Player state ---------------------------------------------------------------------------------------------------------

CREATE TABLE wallet (
    account_id      TEXT PRIMARY KEY REFERENCES account (account_id) ON DELETE CASCADE,
    eclipse_tokens  BIGINT NOT NULL DEFAULT 0 CHECK (eclipse_tokens >= 0),
    fate_threads    BIGINT NOT NULL DEFAULT 0 CHECK (fate_threads >= 0),
    silver_crowns   BIGINT NOT NULL DEFAULT 0 CHECK (silver_crowns >= 0),
    ration          BIGINT NOT NULL DEFAULT 0 CHECK (ration >= 0),
    account_xp      BIGINT NOT NULL DEFAULT 0 CHECK (account_xp >= 0)
);

-- The Part I story state machine, in `StoryState.to_persisted_dict` form (cursor, completed stages, owned heroes, First Oath).
CREATE TABLE story_state (
    account_id      TEXT PRIMARY KEY REFERENCES account (account_id) ON DELETE CASCADE,
    state           JSONB NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time story choices the server accepted ('first_oath' = the single First Oath Invitation character).
CREATE TABLE story_claims (
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    claim_key       TEXT NOT NULL,
    character_id    TEXT NOT NULL,
    claimed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, claim_key)
);

-- Per-character progress (LEGACY v1 + v2 xp/ascension + v4 memory_shards + v5 memory_nodes).
CREATE TABLE roster (
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    character_id    TEXT NOT NULL,
    level           INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
    copies          INTEGER NOT NULL DEFAULT 1 CHECK (copies >= 1),
    xp              INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    ascension       INTEGER NOT NULL DEFAULT 0 CHECK (ascension >= 0),
    memory_shards   INTEGER NOT NULL DEFAULT 0 CHECK (memory_shards >= 0),
    memory_nodes    INTEGER NOT NULL DEFAULT 0 CHECK (memory_nodes >= 0),
    PRIMARY KEY (account_id, character_id)
);

-- LEGACY v5. A missing row means rank 1.
CREATE TABLE skill_ranks (
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    character_id    TEXT NOT NULL,
    skill_id        TEXT NOT NULL,
    rank            INTEGER NOT NULL CHECK (rank >= 1),
    PRIMARY KEY (account_id, character_id, skill_id)
);

-- Stackable, non-equippable items (XP materials, reroll tokens, forge dust, ...): a running quantity per template.
CREATE TABLE inventory_items (
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    item_id         TEXT NOT NULL,
    quantity        BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (account_id, item_id)
);

-- Equipment is instance-based: every granted or rolled copy is its own row with its own level, rolls and equip state.
-- `payload` holds the rolled/derived state (accessory main/sub stats and reroll count, weapon/armor stored xp).
-- `acquired_seq` keeps acquisition order stable even for rows inserted in the same transaction.
CREATE TABLE inventory_weapons (
    instance_id             TEXT PRIMARY KEY,
    account_id              TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    weapon_id               TEXT NOT NULL,
    level                   INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    locked                  BOOLEAN NOT NULL DEFAULT FALSE,
    equipped_character_id   TEXT,
    acquired_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    acquired_seq            BIGINT GENERATED ALWAYS AS IDENTITY,
    payload                 JSONB
);
CREATE INDEX inventory_weapons_account_idx ON inventory_weapons (account_id, acquired_seq);
CREATE UNIQUE INDEX inventory_weapons_equip_unique
    ON inventory_weapons (account_id, equipped_character_id) WHERE equipped_character_id IS NOT NULL;

CREATE TABLE inventory_armor (
    instance_id             TEXT PRIMARY KEY,
    account_id              TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    armor_id                TEXT NOT NULL,
    level                   INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    locked                  BOOLEAN NOT NULL DEFAULT FALSE,
    equip_slot              TEXT NOT NULL,
    equipped_character_id   TEXT,
    acquired_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    acquired_seq            BIGINT GENERATED ALWAYS AS IDENTITY,
    payload                 JSONB
);
CREATE INDEX inventory_armor_account_idx ON inventory_armor (account_id, acquired_seq);
CREATE UNIQUE INDEX inventory_armor_equip_unique
    ON inventory_armor (account_id, equipped_character_id, equip_slot) WHERE equipped_character_id IS NOT NULL;

CREATE TABLE inventory_accessories (
    instance_id             TEXT PRIMARY KEY,
    account_id              TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    accessory_id            TEXT NOT NULL,
    equip_slot              TEXT NOT NULL,
    locked                  BOOLEAN NOT NULL DEFAULT FALSE,
    equipped_character_id   TEXT,
    acquired_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    acquired_seq            BIGINT GENERATED ALWAYS AS IDENTITY,
    payload                 JSONB NOT NULL
);
CREATE INDEX inventory_accessories_account_idx ON inventory_accessories (account_id, acquired_seq);
CREATE UNIQUE INDEX inventory_accessories_equip_unique
    ON inventory_accessories (account_id, equipped_character_id, equip_slot) WHERE equipped_character_id IS NOT NULL;

-- Gacha ------------------------------------------------------------------------------------------------------------------

-- The resolver's `AccountPityState` per banner type ('character', 'weapon', 'standard_character').
CREATE TABLE gacha_pity (
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    banner_type     TEXT NOT NULL,
    state           JSONB NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, banner_type)
);

-- Every resolved pull, append-only (history API, audits, disputed outcomes). `seq` is the pagination cursor.
CREATE TABLE pull_history (
    pull_id                 TEXT PRIMARY KEY,
    seq                     BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    account_id              TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    banner_id               TEXT NOT NULL,
    banner_type             TEXT NOT NULL,
    rarity                  INTEGER NOT NULL CHECK (rarity BETWEEN 1 AND 5),
    reward_id               TEXT,
    outcome_pool_id         TEXT,
    is_featured             BOOLEAN,
    hard_pity_triggered     BOOLEAN NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pull_history_account_idx ON pull_history (account_id, seq DESC);

-- Reward ledgers ------------------------------------------------------------------------------------------------------

-- Exactly-once rewards per (account, reward type, cycle): first clears, stage rewards (LEGACY v1 `claims`).
CREATE TABLE claims (
    claim_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    reward_type     TEXT NOT NULL,
    cycle_id        BIGINT NOT NULL,
    claimed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    transaction_id  TEXT,
    payload         JSONB,
    UNIQUE (account_id, reward_type, cycle_id)
);
CREATE UNIQUE INDEX claims_transaction_id_unique ON claims (transaction_id) WHERE transaction_id IS NOT NULL;

-- Daily-task progress per half-day cycle (LEGACY v3).
CREATE TABLE quest_progress (
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    task_id         TEXT NOT NULL,
    cycle_id        BIGINT NOT NULL CHECK (cycle_id >= 0),
    progress        INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
    PRIMARY KEY (account_id, task_id, cycle_id)
);

-- Daily/weekly quest rewards: the claim key encodes the server-clock window ("daily:19999:win_three_battles").
CREATE TABLE quest_claims (
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    claim_key       TEXT NOT NULL,
    granted_json    JSONB NOT NULL,
    claimed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, claim_key)
);

-- Verified rewarded-ad views (AdMob SSV): the provider transaction id as key makes a replayed callback pay nothing.
CREATE TABLE ad_rewards (
    transaction_id  TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    tokens          INTEGER NOT NULL CHECK (tokens >= 0)
);
CREATE INDEX ad_rewards_account_idx ON ad_rewards (account_id, granted_at);

-- Eclipse Blessing subscription: a Play purchase token is bound to one account; each period pays its instant grant once,
-- each twelve-hour window at most once.
CREATE TABLE subscriptions (
    purchase_token  TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    product_id      TEXT NOT NULL,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_account_idx ON subscriptions (account_id);

CREATE TABLE subscription_periods (
    account_id          TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    purchase_token      TEXT NOT NULL REFERENCES subscriptions (purchase_token) ON DELETE CASCADE,
    period_end          TIMESTAMPTZ NOT NULL,
    instant_granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (purchase_token, period_end)
);

CREATE TABLE subscription_claims (
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    purchase_token  TEXT NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    window_id       BIGINT NOT NULL,
    tokens          INTEGER NOT NULL CHECK (tokens >= 0),
    claimed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (purchase_token, period_end, window_id),
    FOREIGN KEY (purchase_token, period_end) REFERENCES subscription_periods (purchase_token, period_end) ON DELETE CASCADE
);

-- Battles (DEC-0013) -----------------------------------------------------------------------------------------------------

-- One stage attempt: the server checks the stage and roster, picks the seed and freezes the battle inputs. A reported
-- victory is re-simulated from exactly these inputs and resolves the attempt once (open -> won | lost | expired).
CREATE TABLE stage_attempts (
    attempt_id      UUID PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    stage_id        TEXT NOT NULL,
    roster          JSONB NOT NULL,
    run_seed        BIGINT NOT NULL CHECK (run_seed >= 0),
    inputs          JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'expired')),
    result          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    CHECK ((status = 'open') = (resolved_at IS NULL))
);
CREATE INDEX stage_attempts_account_idx ON stage_attempts (account_id, created_at DESC);
CREATE INDEX stage_attempts_open_idx ON stage_attempts (created_at) WHERE status = 'open';

-- Social ------------------------------------------------------------------------------------------------------------------

-- One row per (owner, other) from the owner's point of view; a pending request is a mirrored pair
-- (pending_out / pending_in) sharing one request_id. `blocked` is intentionally one-sided.
CREATE TABLE friend_edges (
    owner_account_id    TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    other_account_id    TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    state               TEXT NOT NULL CHECK (state IN ('pending_out', 'pending_in', 'accepted', 'blocked')),
    request_id          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_account_id, other_account_id),
    CHECK (owner_account_id <> other_account_id)
);
CREATE INDEX friend_edges_other_idx ON friend_edges (other_account_id);
CREATE INDEX friend_edges_request_idx ON friend_edges (request_id);

CREATE TABLE reports (
    report_id               TEXT PRIMARY KEY,
    reporter_account_id     TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    reported_account_id     TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    reason_key              TEXT NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
