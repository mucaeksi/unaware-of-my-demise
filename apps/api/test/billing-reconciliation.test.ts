import { beforeEach, describe, expect, it } from 'vitest';
import { applyLedger } from '../src/db/ledger';
import { billingTag, refundPurchase } from '../src/billing/service';
import { verifyReceipt } from '../src/billing/recovery';
import { inspectPurchase } from '../src/billing/reconciliation';
import { claimMail } from '../src/mail/service';
import { admin, baseEnv, fakePlay, playClient, signIn } from './helpers';

const db = baseEnv.DB; let seq = 0;
beforeEach(async () => {
  fakePlay.reset();
  await db.prepare("INSERT OR REPLACE INTO shop_products (product_id, kind, title_en, grants, active) VALUES ('review_pouch', 'consumable', 'Pouch', '[{\"type\":\"currency\",\"currency\":\"eclipse_token\",\"amount\":320}]', 1)").run();
});
async function paid() {
  const { playerId } = await signIn(`review-${++seq}`); const token = `private-review-token-${seq}`; const orderId = `review-order-${seq}`;
  fakePlay.products.set(token, { purchaseState: 'purchased', orderId, acknowledged: false, consumed: false, purchaseTimeMs: Date.now(), obfuscatedAccountId: await billingTag(playerId) });
  await verifyReceipt(baseEnv, playClient, playerId, { productId: 'review_pouch', purchaseToken: token });
  return { playerId, token, orderId };
}

describe('read-only purchase reconciliation', () => {
  it('uses original journal credits after a catalog edit and returns a stable snapshot without changing financial rows', async () => {
    const p = await paid(); await refundPurchase(db, p.orderId, 'system');
    await db.prepare("UPDATE shop_products SET grants = '[]' WHERE product_id = 'review_pouch'").run();
    const first = await inspectPurchase(db, p.orderId); const second = await inspectPurchase(db, p.orderId);
    expect(first).toMatchObject({ readOnly: true, providerVerified: false, terms: 'frozen', reviewReasons: [], currencies: [{ originalCredit: 320, recordedClawback: 320, recordedShortfall: 0, currentBalance: 0, markerArithmeticBalanced: true }] });
    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(p.playerId).first()).toEqual({ n: 2 });
    expect(JSON.stringify(first)).not.toContain(p.token); expect(first).not.toHaveProperty('encrypted_token');
  });

  it('flags a half-completed refunded marker and retains the original balance unchanged', async () => {
    const p = await paid();
    await db.prepare("UPDATE purchases SET state = 'refunded', refunded_at = ?2 WHERE order_id = ?1").bind(p.orderId, new Date().toISOString()).run();
    const report = await inspectPurchase(db, p.orderId);
    expect(report).toMatchObject({ reviewReasons: ['currency_marker_incomplete', 'refund_journal_incomplete'], currencies: [{ originalCredit: 320, recordedClawback: 0, currentBalance: 320, markerArithmeticBalanced: false }] });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(p.playerId).first()).toEqual({ balance: 320 });
  });

  it('never reconstructs legacy benefits from a later mutable product', async () => {
    const { playerId } = await signIn(`legacy-review-${++seq}`); const orderId = `legacy-review-${seq}`;
    await db.prepare("INSERT INTO purchases (order_id, player_id, product_id, kind, token_hash, period_start, state, unrecovered) VALUES (?1, ?2, 'review_pouch', 'consumable', ?3, ?4, 'refunded', '{\"eclipse_token\":320}')")
      .bind(orderId, playerId, 'f'.repeat(64), new Date().toISOString()).run();
    await applyLedger(db, { playerId, currency: 'eclipse_token', delta: 320, reason: 'original_purchase', idempotencyKey: `iap:${orderId}:0` });
    expect(await inspectPurchase(db, orderId)).toMatchObject({ terms: 'legacy_unknown', noncurrencyRequests: null, reviewReasons: ['legacy_terms_unknown', 'refund_journal_incomplete'], currencies: [{ currentBalance: 320, recordedShortfall: 320 }] });
  });

  it('reports claimed periodic currency separately and never silently claws it back', async () => {
    const { playerId } = await signIn(`periodic-review-${++seq}`); const orderId = `periodic-review-${seq}`; const token = `private-periodic-${seq}`;
    fakePlay.subs.set(token, { state: 'active', productId: 'eclipse_blessing_30d', latestOrderId: orderId, acknowledged: true, obfuscatedAccountId: await billingTag(playerId), startTimeMs: Date.now(), expiryTimeMs: Date.now() + 30 * 86_400_000 });
    await verifyReceipt(baseEnv, playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token });
    const mail = await db.prepare('SELECT id FROM mail WHERE player_id = ?1').bind(playerId).first<{ id: number }>(); await claimMail(db, playerId, mail!.id);
    await refundPurchase(db, orderId, 'system');
    expect(await inspectPurchase(db, orderId)).toMatchObject({ reviewReasons: ['claimed_periodic_requires_policy'], claimedPeriodic: [{ currency: 'eclipse_token', amount: 187, mails: 1 }], currencies: [{ originalCredit: 1600, recordedClawback: 1600, currentBalance: 187 }] });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 187 });
  });

  it('exposes noncurrency policy work without pretending mutable owned goods have order-level provenance', async () => {
    await db.prepare("UPDATE shop_products SET grants = '[{\"type\":\"currency\",\"currency\":\"eclipse_token\",\"amount\":320},{\"type\":\"account_xp\",\"amount\":9}]' WHERE product_id = 'review_pouch'").run();
    const p = await paid(); await refundPurchase(db, p.orderId, 'system');
    expect(await inspectPurchase(db, p.orderId)).toMatchObject({ reviewReasons: ['noncurrency_requires_policy'], noncurrencyRequests: [{ type: 'account_xp' }] });
    expect(await db.prepare('SELECT xp FROM player_account WHERE player_id = ?1').bind(p.playerId).first()).toEqual({ xp: 9 });
  });

  it('protects the viewer API, rejects unknown orders and returns no private token or key fields', async () => {
    const p = await paid(); const path = `/admin/api/billing/purchases/${p.orderId}/reconciliation`;
    await db.prepare("INSERT OR IGNORE INTO admin_users (email, role, created_by) VALUES ('billing-viewer@example.com', 'viewer', 'test')").run();
    expect((await admin(path, { as: null })).status).toBe(401);
    const result = await admin(path, { as: 'billing-viewer@example.com' }); expect(result.status).toBe(200);
    const body = await result.text(); for (const hidden of [p.token, 'encrypted_token', 'token_hash', 'BILLING_TOKEN_KEYS']) expect(body).not.toContain(hidden);
    expect((await admin('/admin/api/billing/purchases/unknown/reconciliation', { as: 'billing-viewer@example.com' })).status).toBe(404);
  });
});
