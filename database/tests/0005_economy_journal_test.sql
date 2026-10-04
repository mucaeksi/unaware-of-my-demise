-- Tests for 0005_economy_journal. Run by database/test.sh after 0004's tests.

INSERT INTO account (account_id) VALUES ('acct_00000000000000000000000000000005');

DO $$
DECLARE
    a TEXT := 'acct_00000000000000000000000000000005';
    entry RECORD;
BEGIN
    -- With a request context: every column change is one row carrying the key, route and rules hash.
    PERFORM set_config('uomd.operation_key', '00000000-0000-4000-8000-0000000000aa', true);
    PERFORM set_config('uomd.endpoint', 'gacha_pull', true);
    PERFORM set_config('uomd.rules_hash', 'hash-1', true);
    INSERT INTO wallet (account_id, ration, fate_threads) VALUES (a, 100, 10);
    UPDATE wallet SET fate_threads = fate_threads - 10, silver_crowns = 5, ration = 50 WHERE account_id = a;
    SELECT * INTO entry FROM economy_journal WHERE account_id = a AND resource_id = 'fate_threads' ORDER BY entry_id DESC LIMIT 1;
    IF entry.delta <> -10 OR entry.balance_after <> 0 OR entry.endpoint <> 'gacha_pull' OR entry.rules_hash <> 'hash-1'
       OR entry.operation_key <> '00000000-0000-4000-8000-0000000000aa' THEN
        RAISE EXCEPTION 'unexpected fate_threads entry %', row_to_json(entry);
    END IF;
    IF EXISTS (SELECT 1 FROM economy_journal WHERE account_id = a AND resource_id = 'ration') THEN
        RAISE EXCEPTION 'ration must not be journaled';
    END IF;
    IF (SELECT sum(delta) FROM economy_journal WHERE account_id = a AND resource_id = 'fate_threads') <> 0 THEN
        RAISE EXCEPTION 'the deltas must add up to the balance';
    END IF;

    INSERT INTO inventory_items (account_id, item_id, quantity) VALUES (a, 'rivet', 3);
    UPDATE inventory_items SET quantity = 1 WHERE account_id = a AND item_id = 'rivet';
    DELETE FROM inventory_items WHERE account_id = a AND item_id = 'rivet';
    IF (SELECT array_agg(delta ORDER BY entry_id) FROM economy_journal WHERE account_id = a AND resource_id = 'rivet') <> ARRAY[3, -2, -1]::BIGINT[] THEN
        RAISE EXCEPTION 'item deltas are wrong';
    END IF;

    INSERT INTO inventory_weapons (instance_id, account_id, weapon_id) VALUES ('wpn_test_5', a, 'weapon_x');
    DELETE FROM inventory_weapons WHERE instance_id = 'wpn_test_5';
    IF (SELECT array_agg(delta ORDER BY entry_id) FROM economy_journal WHERE resource_id = 'wpn_test_5') <> ARRAY[1, -1]::BIGINT[]
       OR (SELECT detail ->> 'template_id' FROM economy_journal WHERE resource_id = 'wpn_test_5' LIMIT 1) <> 'weapon_x' THEN
        RAISE EXCEPTION 'equipment entries are wrong';
    END IF;

    INSERT INTO roster (account_id, character_id) VALUES (a, 'hero_x');
    UPDATE roster SET copies = 2, memory_shards = 10 WHERE account_id = a AND character_id = 'hero_x';
    UPDATE roster SET level = 5 WHERE account_id = a AND character_id = 'hero_x';
    IF (SELECT count(*) FROM economy_journal WHERE account_id = a AND resource_id = 'hero_x') <> 3 THEN
        RAISE EXCEPTION 'roster entries: copies 1, copies +1, shards +10 (a level change is not journaled)';
    END IF;

    INSERT INTO gacha_pity (account_id, banner_type, state) VALUES (a, 'character', '{"pulls": 1}');
    UPDATE gacha_pity SET state = '{"pulls": 2}' WHERE account_id = a AND banner_type = 'character';
    SELECT * INTO entry FROM economy_journal WHERE account_id = a AND resource_kind = 'pity' ORDER BY entry_id DESC LIMIT 1;
    IF entry.detail <> '{"before": {"pulls": 1}, "after": {"pulls": 2}}'::jsonb THEN
        RAISE EXCEPTION 'pity entry is wrong: %', entry.detail;
    END IF;

    -- Without a context the change is still recorded, as unattributed.
    PERFORM set_config('uomd.operation_key', '', true);
    PERFORM set_config('uomd.endpoint', '', true);
    PERFORM set_config('uomd.rules_hash', '', true);
    UPDATE wallet SET eclipse_tokens = 7 WHERE account_id = a;
    SELECT * INTO entry FROM economy_journal WHERE account_id = a AND resource_id = 'eclipse_tokens' ORDER BY entry_id DESC LIMIT 1;
    IF entry.endpoint <> 'unattributed' OR entry.operation_key IS NOT NULL OR entry.rules_hash IS NOT NULL THEN
        RAISE EXCEPTION 'an unattributed change is recorded without context';
    END IF;

    -- Deleting the account cascades through its rows without journaling into a deleted account.
    DELETE FROM account WHERE account_id = a;
    IF EXISTS (SELECT 1 FROM economy_journal WHERE account_id = a) THEN
        RAISE EXCEPTION 'the journal of a deleted account must go with it';
    END IF;
END $$;
