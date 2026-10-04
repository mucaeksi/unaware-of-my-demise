-- 0005: economic journal (INF-015). Every change to a balance or an owned thing is recorded by a trigger, so no grant or
-- debit path can forget it, with the request that made it: the Idempotency-Key, the route and the content (rules hash)
-- the server ran. The Worker sets that context once per transaction (`set_config('uomd.*', ..., true)`); a change outside
-- a request is recorded as 'unattributed'. With the attempt's reward seed and the pull's RNG seed (stage_attempts,
-- pull_history) any past outcome stays explainable after a tuning change.
--
-- Ration is not journaled: it regenerates with time, so a row diff mixes regeneration and spending. Its spends are on
-- the verified victory (stage_attempts.result); a grant shows up as the operation's reply.

CREATE TABLE economy_journal (
    entry_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES account (account_id) ON DELETE CASCADE,
    operation_key   UUID,
    endpoint        TEXT NOT NULL,
    rules_hash      TEXT,
    resource_kind   TEXT NOT NULL CHECK (resource_kind IN ('currency', 'item', 'equipment', 'character', 'memory_shards', 'pity')),
    resource_id     TEXT NOT NULL,
    delta           BIGINT,
    balance_after   BIGINT,
    detail          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX economy_journal_account_idx ON economy_journal (account_id, entry_id DESC);
CREATE INDEX economy_journal_operation_idx ON economy_journal (operation_key) WHERE operation_key IS NOT NULL;

-- Nothing is written while the account itself is being deleted (its rows cascade away, and so does its journal).
CREATE FUNCTION journal_write(p_account TEXT, p_kind TEXT, p_resource TEXT, p_delta BIGINT, p_balance BIGINT, p_detail JSONB)
RETURNS void LANGUAGE sql AS $$
    INSERT INTO economy_journal (account_id, operation_key, endpoint, rules_hash, resource_kind, resource_id, delta, balance_after, detail)
    SELECT
        p_account,
        NULLIF(current_setting('uomd.operation_key', true), '')::uuid,
        COALESCE(NULLIF(current_setting('uomd.endpoint', true), ''), 'unattributed'),
        NULLIF(current_setting('uomd.rules_hash', true), ''),
        p_kind, p_resource, p_delta, p_balance, p_detail
    WHERE EXISTS (SELECT 1 FROM account WHERE account_id = p_account)
$$;

-- A counter moved from `old_value` to `new_value`: one row with the difference and the new balance; nothing if unchanged.
CREATE FUNCTION journal_counter(p_account TEXT, p_kind TEXT, p_resource TEXT, old_value BIGINT, new_value BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF new_value IS DISTINCT FROM old_value THEN
        PERFORM journal_write(p_account, p_kind, p_resource, COALESCE(new_value, 0) - COALESCE(old_value, 0), COALESCE(new_value, 0), NULL);
    END IF;
END $$;

CREATE FUNCTION journal_wallet() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM journal_counter(NEW.account_id, 'currency', 'eclipse_tokens', CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.eclipse_tokens END, NEW.eclipse_tokens);
    PERFORM journal_counter(NEW.account_id, 'currency', 'fate_threads', CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.fate_threads END, NEW.fate_threads);
    PERFORM journal_counter(NEW.account_id, 'currency', 'silver_crowns', CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.silver_crowns END, NEW.silver_crowns);
    PERFORM journal_counter(NEW.account_id, 'currency', 'account_xp', CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.account_xp END, NEW.account_xp);
    RETURN NULL;
END $$;
CREATE TRIGGER wallet_journal AFTER INSERT OR UPDATE ON wallet FOR EACH ROW EXECUTE FUNCTION journal_wallet();

CREATE FUNCTION journal_items() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM journal_counter(OLD.account_id, 'item', OLD.item_id, OLD.quantity, 0);
    ELSE
        PERFORM journal_counter(NEW.account_id, 'item', NEW.item_id, CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.quantity END, NEW.quantity);
    END IF;
    RETURN NULL;
END $$;
CREATE TRIGGER inventory_items_journal AFTER INSERT OR UPDATE OR DELETE ON inventory_items FOR EACH ROW EXECUTE FUNCTION journal_items();

-- Equipment instances: minted (+1) or destroyed (-1), with the table and template. Level-ups and rerolls are paid in
-- currencies and items, which are journaled where they are spent.
CREATE FUNCTION journal_equipment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    template_column TEXT := CASE TG_TABLE_NAME WHEN 'inventory_weapons' THEN 'weapon_id' WHEN 'inventory_armor' THEN 'armor_id' ELSE 'accessory_id' END;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM journal_write(OLD.account_id, 'equipment', OLD.instance_id, -1, NULL,
            jsonb_build_object('table', TG_TABLE_NAME, 'template_id', to_jsonb(OLD) ->> template_column));
    ELSE
        PERFORM journal_write(NEW.account_id, 'equipment', NEW.instance_id, 1, NULL,
            jsonb_build_object('table', TG_TABLE_NAME, 'template_id', to_jsonb(NEW) ->> template_column));
    END IF;
    RETURN NULL;
END $$;
CREATE TRIGGER inventory_weapons_journal AFTER INSERT OR DELETE ON inventory_weapons FOR EACH ROW EXECUTE FUNCTION journal_equipment();
CREATE TRIGGER inventory_armor_journal AFTER INSERT OR DELETE ON inventory_armor FOR EACH ROW EXECUTE FUNCTION journal_equipment();
CREATE TRIGGER inventory_accessories_journal AFTER INSERT OR DELETE ON inventory_accessories FOR EACH ROW EXECUTE FUNCTION journal_equipment();

-- Heroes: copies (a new hero starts at 1) and Memory Shards. Levels, XP and ranks are progress, paid for in journaled resources.
CREATE FUNCTION journal_roster() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM journal_counter(NEW.account_id, 'character', NEW.character_id, CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.copies END, NEW.copies);
    PERFORM journal_counter(NEW.account_id, 'memory_shards', NEW.character_id, CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.memory_shards END, NEW.memory_shards);
    RETURN NULL;
END $$;
CREATE TRIGGER roster_journal AFTER INSERT OR UPDATE ON roster FOR EACH ROW EXECUTE FUNCTION journal_roster();

-- Gacha pity: the state before and after each change, so a pull's odds can be reconstructed.
CREATE FUNCTION journal_pity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.state IS DISTINCT FROM OLD.state THEN
        PERFORM journal_write(NEW.account_id, 'pity', NEW.banner_type, NULL, NULL,
            jsonb_build_object('before', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.state END, 'after', NEW.state));
    END IF;
    RETURN NULL;
END $$;
CREATE TRIGGER gacha_pity_journal AFTER INSERT OR UPDATE ON gacha_pity FOR EACH ROW EXECUTE FUNCTION journal_pity();
