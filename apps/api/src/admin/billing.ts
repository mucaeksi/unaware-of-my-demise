import type { Hono, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { AdminIdentity, Role } from '../auth/access';
import { HttpError } from '../content/store';
import { auditIfChanged } from '../db/audit';
import type { AdminEnv } from '../env';

type Ctx = { Bindings: AdminEnv; Variables: { admin: AdminIdentity } };
const State = z.enum(['legacy', 'pending', 'processing', 'done', 'dead_letter']);
const MessageId = z.string().regex(/^[A-Za-z0-9._:-]{1,100}$/);
const Retry = z.object({ expectedAttempts: z.number().int().min(0), reason: z.string().min(3).max(200) }).strict();

/** Investigation exposes no payload/token. Reset permits a subsequent authentic Pub/Sub redelivery. */
export function registerBillingOps(app: Hono<Ctx>, need: (role: Role) => MiddlewareHandler<Ctx>): void {
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
    const raw = await c.req.text();
    if (raw.length > 2000) throw new HttpError(413, 'too_large', 'retry request is too large');
    let parsed: z.infer<typeof Retry>;
    try { parsed = Retry.parse(JSON.parse(raw)); }
    catch { throw new HttpError(400, 'bad_request', 'expectedAttempts and a reason are required'); }
    const db = c.env.DB;
    const result = await db.batch([
      db.prepare(`UPDATE rtdn_seen SET state = 'pending', attempts = 0, last_code = 'operator_retry', owner = NULL, lease_until = NULL
        WHERE message_id = ?1 AND attempts = ?2 AND (state IN ('pending', 'dead_letter', 'legacy') OR
          (state = 'processing' AND lease_until <= ?3))`)
        .bind(id, parsed.expectedAttempts, new Date().toISOString()),
      auditIfChanged(db, c.get('admin').identity, 'billing.notification.retry', id, parsed)
    ]);
    if (result[0]?.meta.changes !== 1) throw new HttpError(409, 'version_conflict', 'notification changed, is complete or is still processing');
    return c.json({ state: 'pending', requiresAuthenticatedRedelivery: true });
  });
}
