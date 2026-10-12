import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import { Fulfillment } from './service';

type Purchase = { order_id: string; player_id: string; product_id: string; kind: string; state: string; fulfillment: string | null; unrecovered: string; refunded_at: string | null };
type Totals = { currency: string; original: number; clawed: number; last_id: number };
type Wallet = { currency: string; balance: number; version: number };
type Claims = { currency: string | null; amount: number; mails: number };

/** D1-only, read-only snapshot. Balanced markers are not provider proof or permission to repair live balances. */
export async function inspectPurchase(db: D1Database, orderId: string): Promise<Record<string, unknown>> {
  const snapshot = await db.batch([
    db.prepare('SELECT order_id, player_id, product_id, kind, state, fulfillment, unrecovered, refunded_at FROM purchases WHERE order_id = ?1').bind(orderId),
    db.prepare(`WITH p AS (SELECT player_id, 'iap:' || order_id || CASE WHEN kind = 'subscription' THEN ':instant:' ELSE ':' END AS credit_prefix, 'iap:' || order_id || ':refund:' AS refund_prefix FROM purchases WHERE order_id = ?1)
      SELECT currency, SUM(original) AS original, SUM(clawed) AS clawed, MAX(id) AS last_id FROM (
        SELECT l.currency, l.delta AS original, 0 AS clawed, l.id FROM p JOIN ledger l
          ON l.idempotency_key >= p.credit_prefix AND l.idempotency_key < p.credit_prefix || '~' AND l.player_id = p.player_id WHERE l.delta > 0
        UNION ALL
        SELECT l.currency, 0 AS original, -l.delta AS clawed, l.id FROM p JOIN ledger l
          ON l.idempotency_key >= p.refund_prefix AND l.idempotency_key < p.refund_prefix || '~' AND l.player_id = p.player_id WHERE l.delta < 0
      ) GROUP BY currency ORDER BY currency`).bind(orderId),
    db.prepare('SELECT currency, balance, version FROM wallets WHERE player_id = (SELECT player_id FROM purchases WHERE order_id = ?1) ORDER BY currency').bind(orderId),
    db.prepare(`SELECT l.currency, COALESCE(SUM(l.delta), 0) AS amount, COUNT(DISTINCT m.id) AS mails FROM purchases p JOIN mail m
        ON m.player_id = p.player_id AND m.source_key >= 'sub:' || p.order_id || ':' AND m.source_key < 'sub:' || p.order_id || ':~'
      LEFT JOIN ledger l ON l.player_id = m.player_id AND l.idempotency_key >= 'mail:' || m.id || ':' AND l.idempotency_key < 'mail:' || m.id || ':~' AND l.delta > 0
      WHERE p.order_id = ?1 AND m.claimed_at IS NOT NULL GROUP BY l.currency ORDER BY l.currency`).bind(orderId),
    db.prepare("SELECT COUNT(*) AS n FROM purchase_events WHERE order_id = ?1 AND type = 'refunded'").bind(orderId)
  ]);
  const purchase = snapshot[0]!.results[0] as Purchase | undefined;
  if (!purchase) throw new HttpError(404, 'purchase_unknown', 'purchase not found');
  const totals = snapshot[1]!.results as Totals[];
  const wallets = snapshot[2]!.results as Wallet[];
  const claims = snapshot[3]!.results as Claims[];
  const refundEvents = (snapshot[4]!.results[0] as { n: number }).n;
  const reasons: string[] = [];
  let terms: 'frozen' | 'legacy_unknown' | 'corrupt' = 'legacy_unknown';
  let noncurrency: { type: string }[] | null = null;
  if (purchase.fulfillment) {
    try {
      const parsed = Fulfillment.safeParse(JSON.parse(purchase.fulfillment));
      if (!parsed.success) throw new Error('invalid terms');
      terms = 'frozen'; noncurrency = parsed.data.grants.filter((g) => g.type !== 'currency').map((g) => ({ type: g.type }));
    } catch { terms = 'corrupt'; }
  }
  if (terms !== 'frozen') reasons.push(terms === 'corrupt' ? 'fulfillment_corrupt' : 'legacy_terms_unknown');
  if (noncurrency?.length) reasons.push('noncurrency_requires_policy');
  if (claims.some((c) => c.mails > 0)) reasons.push('claimed_periodic_requires_policy');
  let unrecovered: Record<string, number> | null = null;
  try {
    const parsed: unknown = JSON.parse(purchase.unrecovered);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some((n) => !Number.isSafeInteger(n) || n < 0)) throw new Error('invalid shortfall');
    unrecovered = parsed as Record<string, number>;
  } catch { reasons.push('unrecovered_corrupt'); }
  const currencies = totals.map((t) => {
    const wallet = wallets.find((w) => w.currency === t.currency);
    const shortfall = unrecovered ? unrecovered[t.currency] ?? 0 : null;
    const valid = [t.original, t.clawed, wallet?.balance ?? 0, shortfall ?? 0].every((n) => Number.isSafeInteger(n) && n >= 0);
    const balanced = valid && shortfall !== null && t.original === t.clawed + shortfall;
    if (!valid) reasons.push('currency_totals_unsafe');
    if (purchase.state === 'refunded' && !balanced) reasons.push('currency_marker_incomplete');
    return { currency: t.currency, originalCredit: valid ? t.original : null, recordedClawback: valid ? t.clawed : null, recordedShortfall: valid ? shortfall : null, currentBalance: valid ? wallet?.balance ?? 0 : null, walletVersion: wallet?.version ?? null, markerArithmeticBalanced: balanced, ledgerLastId: t.last_id };
  });
  if (purchase.state === 'refunded' && refundEvents !== 1) reasons.push('refund_journal_incomplete');
  const facts = { orderId, playerId: purchase.player_id, productId: purchase.product_id, kind: purchase.kind, recordedState: purchase.state, refundedAt: purchase.refunded_at, terms, noncurrencyRequests: noncurrency, currencies, claimedPeriodic: claims, refundEvents, reviewReasons: [...new Set(reasons)], providerVerified: false };
  return { ...facts, snapshotHash: await sha256Hex(JSON.stringify({ ...facts, termsHash: await sha256Hex(purchase.fulfillment ?? '') })), inspectedAt: new Date().toISOString(), readOnly: true };
}
