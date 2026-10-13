/** Financial delivery facts, never a fresh provider-entitlement verdict or a replay/grant. */
export async function purchaseHistory(db: D1Database, playerId: string, limit: number): Promise<{ records: Record<string, unknown>[]; truncated: boolean }> {
  const batches = await db.batch<Record<string, unknown> & { recordedAt: string; recordKey: string; acknowledged: number | null }>([
    db.prepare(`SELECT 'order:' || p.order_id AS recordKey, p.order_id AS orderId,
      p.product_id AS productId, s.title_en AS title, p.kind, p.state AS deliveryState,
      p.acknowledged, p.granted_at AS recordedAt, p.refunded_at AS refundedAt,
      CASE WHEN p.kind = 'subscription' AND p.entitlement_checked_at IS NOT NULL THEN p.entitlement_state END AS providerState,
      p.entitlement_checked_at AS providerCheckedAt, j.state AS recoveryState
      FROM purchases p JOIN shop_products s ON s.product_id = p.product_id
      LEFT JOIN billing_jobs j ON j.token_hash = p.token_hash AND j.player_id = p.player_id AND j.product_id = p.product_id
      WHERE p.player_id = ?1 ORDER BY p.granted_at DESC, p.order_id DESC LIMIT ?2`).bind(playerId, limit + 1),
    db.prepare(`SELECT 'pending:' || j.token_hash AS recordKey, j.order_id AS orderId,
      j.product_id AS productId, s.title_en AS title, j.kind, 'unconfirmed' AS deliveryState,
      NULL AS acknowledged, j.updated_at AS recordedAt, NULL AS refundedAt,
      NULL AS providerState, NULL AS providerCheckedAt, j.state AS recoveryState
      FROM billing_jobs j JOIN shop_products s ON s.product_id = j.product_id
      WHERE j.player_id = ?1 AND j.state <> 'done'
      AND NOT EXISTS (SELECT 1 FROM purchases p WHERE p.order_id = j.order_id AND p.player_id = j.player_id)
      ORDER BY j.updated_at DESC, j.token_hash DESC LIMIT ?2`).bind(playerId, limit + 1)
  ]);
  const records = batches.flatMap((batch) => batch.results).map((row) => ({ ...row,
    acknowledged: row.acknowledged === null ? null : row.acknowledged === 1
  })).sort((a, b) => String(a.recordedAt) < String(b.recordedAt) ? 1 : String(a.recordedAt) > String(b.recordedAt) ? -1 : String(a.recordKey) < String(b.recordKey) ? 1 : -1);
  return { records: records.slice(0, limit), truncated: records.length > limit };
}
