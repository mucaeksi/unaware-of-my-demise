-- D-17 (owner decision 2026-10-11): the whole game runs on ONE main currency, eclipse_token. Wishes, upgrades and shop purchases
-- all spend it; materials (books, ascension items) are items, not currencies. Fate's Thread and Silver Crowns are retired:
-- no new ledger rows may use them (the application only knows eclipse_token), history stays intact.
ALTER TABLE currencies ADD COLUMN retired INTEGER NOT NULL DEFAULT 0 CHECK (retired IN (0, 1));
UPDATE currencies SET retired = 1 WHERE id IN ('silver_crowns', 'fates_thread');
UPDATE currencies SET kind = 'premium_earnable' WHERE id = 'eclipse_token';

-- Fold existing balances (none exist outside tests before launch): 1 Fate's Thread = 160 Eclipse Tokens (the old conversion rate),
-- Silver Crowns / 100 (rounded down; the old amounts were two orders of magnitude larger by design).
INSERT INTO ledger (player_id, currency, delta, reason, idempotency_key)
SELECT p.player_id, 'eclipse_token', p.amount, 'merge_into_main_currency', 'merge:' || p.player_id || ':credit'
FROM (
  SELECT player_id, SUM(CASE currency WHEN 'fates_thread' THEN balance * 160 WHEN 'silver_crowns' THEN balance / 100 ELSE 0 END) AS amount
  FROM wallets GROUP BY player_id
) p WHERE p.amount > 0;

INSERT INTO ledger (player_id, currency, delta, reason, idempotency_key)
SELECT player_id, currency, -balance, 'merge_into_main_currency', 'merge:' || player_id || ':' || currency
FROM wallets WHERE currency IN ('fates_thread', 'silver_crowns') AND balance > 0;

INSERT OR IGNORE INTO wallets (player_id, currency, balance, version)
SELECT DISTINCT player_id, 'eclipse_token', 0, 0 FROM wallets WHERE currency IN ('fates_thread', 'silver_crowns') AND balance > 0;

UPDATE wallets SET balance = balance + COALESCE((
    SELECT SUM(CASE o.currency WHEN 'fates_thread' THEN o.balance * 160 WHEN 'silver_crowns' THEN o.balance / 100 ELSE 0 END)
    FROM wallets o WHERE o.player_id = wallets.player_id), 0), version = version + 1
WHERE currency = 'eclipse_token' AND EXISTS (SELECT 1 FROM wallets o WHERE o.player_id = wallets.player_id AND o.currency IN ('fates_thread', 'silver_crowns') AND o.balance > 0);

UPDATE wallets SET balance = 0, version = version + 1 WHERE currency IN ('fates_thread', 'silver_crowns') AND balance > 0;
