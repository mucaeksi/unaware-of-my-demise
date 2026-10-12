import type { Context, Hono, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { AdminIdentity, Role } from '../auth/access';
import { HttpError } from '../content/store';
import { auditIfChanged } from '../db/audit';
import type { AdminEnv } from '../env';
import { inspectPurchase } from '../billing/reconciliation';

type Ctx = { Bindings: AdminEnv; Variables: { admin: AdminIdentity } };
const State = z.enum(['legacy', 'pending', 'processing', 'done', 'dead_letter']);
const MessageId = z.string().regex(/^[A-Za-z0-9._:-]{1,100}$/);
const Retry = z.object({ expectedAttempts: z.number().int().min(0), reason: z.string().min(3).max(200) }).strict();
const TokenHash = z.string().regex(/^[0-9a-f]{64}$/);
const JobState = z.enum(['pending', 'done', 'review']);

async function retryInput(c: Context<Ctx>): Promise<z.infer<typeof Retry>> {
  const raw = await c.req.text();
  if (raw.length > 2000) throw new HttpError(413, 'too_large', 'retry request is too large');
  try { return Retry.parse(JSON.parse(raw)); }
  catch { throw new HttpError(400, 'bad_request', 'expectedAttempts and a reason are required'); }
}

/** Investigation exposes no payload/token. Reset permits a subsequent authentic Pub/Sub redelivery. */
export function registerBillingOps(app: Hono<Ctx>, need: (role: Role) => MiddlewareHandler<Ctx>): void {
  app.get('/admin/api/billing/purchases/:orderId/reconciliation', need('viewer'), async (c) => {
    const id = c.req.param('orderId');
    if (id.length < 1 || id.length > 200) throw new HttpError(400, 'bad_request', 'invalid order id');
    return c.json(await inspectPurchase(c.env.DB, id));
  });
  app.get('/admin/api/billing/notifications', need('viewer'), async (c) => {
    const state = c.req.query('state');
    const before = c.req.query('before');
    if (state && !State.safeParse(state).success || before && !MessageId.safeParse(before).success) throw new HttpError(400, 'bad_request', 'invalid notification filter');
    const { results } = await c.env.DB.prepare(`SELECT message_id, at, state, attempts, last_code, lease_until, completed_at, outcome
      FROM rtdn_seen WHERE ${state ? 'state = ?1 AND' : '?1 IS NULL AND'} (?2 IS NULL OR message_id < ?2) ORDER BY message_id DESC LIMIT 51`)
      .bind(state ?? null, before ?? null).all<{ message_id: string }>();
    return c.json({ notifications: results.slice(0, 50), nextCursor: results.length > 50 ? results[49]!.message_id : null });
  });

  app.post('/admin/api/billing/notifications/:messageId/retry', need('operator'), async (c) => {
    const id = c.req.param('messageId');
    if (!MessageId.safeParse(id).success) throw new HttpError(400, 'bad_request', 'invalid notification id');
    const parsed = await retryInput(c);
    const db = c.env.DB;
    const result = await db.batch([
      db.prepare(`UPDATE rtdn_seen SET state = 'pending', attempts = 0, last_code = 'operator_retry', owner = NULL, lease_until = NULL
        WHERE message_id = ?1 AND attempts = ?2 AND COALESCE(last_code, '') <> 'operator_retry' AND (state IN ('pending', 'dead_letter', 'legacy') OR
          (state = 'processing' AND lease_until <= ?3))`)
        .bind(id, parsed.expectedAttempts, new Date().toISOString()),
      auditIfChanged(db, c.get('admin').identity, 'billing.notification.retry', id, parsed)
    ]);
    if (result[0]?.meta.changes !== 1) throw new HttpError(409, 'version_conflict', 'notification changed, is complete or is still processing');
    return c.json({ state: 'pending', requiresAuthenticatedRedelivery: true });
  });

  app.get('/admin/api/billing/jobs', need('viewer'), async (c) => {
    const state = c.req.query('state'); const before = c.req.query('before');
    if (state && !JobState.safeParse(state).success || before && !TokenHash.safeParse(before).success) throw new HttpError(400, 'bad_request', 'invalid billing job filter');
    const { results } = await c.env.DB.prepare(`SELECT token_hash, player_id, product_id, kind, order_id, state, next_at, ack_deadline, attempts, last_code, updated_at, json_extract(encrypted_token, '$.kid') AS key_id
      FROM billing_jobs WHERE ${state ? 'state = ?1 AND' : '?1 IS NULL AND'} (?2 IS NULL OR token_hash < ?2) ORDER BY token_hash DESC LIMIT 51`)
      .bind(state ?? null, before ?? null).all<{ token_hash: string }>();
    return c.json({ jobs: results.slice(0, 50), nextCursor: results.length > 50 ? results[49]!.token_hash : null });
  });

  app.post('/admin/api/billing/jobs/:tokenHash/retry', need('operator'), async (c) => {
    const th = c.req.param('tokenHash');
    if (!TokenHash.safeParse(th).success) throw new HttpError(400, 'bad_request', 'invalid billing job id');
    const parsed = await retryInput(c);
    const db = c.env.DB; const now = new Date().toISOString();
    const result = await db.batch([
      db.prepare("UPDATE billing_jobs SET state = 'pending', next_at = ?3, attempts = 0, last_code = 'operator_retry', updated_at = ?3 WHERE token_hash = ?1 AND state = 'review' AND attempts = ?2 AND encrypted_token IS NOT NULL AND NOT EXISTS (SELECT 1 FROM billing_locks WHERE token_hash = ?1 AND lease_until > ?3)")
        .bind(th, parsed.expectedAttempts, now),
      auditIfChanged(db, c.get('admin').identity, 'billing.job.retry', th, parsed)
    ]);
    if (result[0]?.meta.changes !== 1) throw new HttpError(409, 'version_conflict', 'billing job changed, is complete or is still processing');
    return c.json({ state: 'pending', nextAt: now });
  });
}
