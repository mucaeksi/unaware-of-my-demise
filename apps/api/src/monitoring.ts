import type { MiddlewareHandler } from 'hono';
import { HttpError } from './content/store';

export interface VersionMetadata { id: string; tag?: string; timestamp?: string }
type Bindings = { DB: D1Database; CF_VERSION_METADATA?: VersionMetadata };
const ssvMessages = new Set(['query too long', 'missing signature', 'signature and key_id must be the last parameters', 'unknown verifier key', 'signature does not verify', 'missing parameters', 'callback is too old', 'AdMob verifier keys could not be fetched', 'AdMob verifier key list is empty']);
const outcomes = new Set(['test_callback', 'ad_unit_not_ours', 'disabled', 'bad_nonce', 'duplicate', 'cap', 'window_cap', 'daily_cap', 'granted', 'already_granted', 'ignored', 'processed', 'ok', 'pending', 'not_entitled', 'unknown_player', 'ignored_unparseable', 'ignored_other_package', 'test', 'refunded', 'voided_unknown_order', 'unmatched', 'revoked', 'subscription', 'state_noted', 'noted']);

/** Only matched route templates survive. Unmatched paths can contain arbitrary personal data. */
export const requestMonitoring = (service: 'game' | 'admin'): MiddlewareHandler<{ Bindings: Bindings }> => async (c, next) => {
  const started = Date.now();
  await next();
  const status = c.res.status;
  const matched = c.req.matchedRoutes.map((r) => r.path).filter((p) => !p.includes('*'));
  const route = matched.at(-1) ?? 'unmatched';
  const category = route === '/api/v1/ads/ssv' ? 'ads' : ['/api/v1/shop/verify', '/api/v1/billing/rtdn'].includes(route) ? 'billing' : 'api';
  // Admin auth denials are expected in the scheduled Access probe, and carry no application error.
  if (category === 'api' && (status < 400 || (service === 'admin' && [401, 403].includes(status)))) return;
  let reason = `http_${status}`;
  if (c.error instanceof HttpError) {
    reason = /^[a-z][a-z0-9_]{0,63}$/.test(c.error.code) ? c.error.code : reason;
    if (category === 'ads' && ssvMessages.has(c.error.message)) reason = c.error.message;
  } else if (status >= 500) reason = 'internal_error';
  if (status < 400 && category !== 'api') {
    try {
      const body = await c.res.clone().json() as { reason?: string; status?: string; handled?: string; granted?: boolean; ok?: boolean };
      reason = body.reason && outcomes.has(body.reason) ? body.reason : body.status && outcomes.has(body.status) ? body.status : body.handled && outcomes.has(body.handled) ? body.handled : body.granted === true ? 'granted' : body.ok === true ? 'ok' : 'acknowledged';
    } catch { reason = 'acknowledged'; }
  }
  const ray = c.req.header('CF-Ray');
  const work = Promise.resolve().then(() => c.env.DB.prepare('INSERT INTO monitor_events (id, at, service, category, event, severity, method, route, status, reason, ray_id, version_id, duration_ms) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)')
    .bind(crypto.randomUUID(), new Date().toISOString(), service, category, category === 'ads' ? status >= 400 ? 'ssv_rejected' : reason === 'granted' ? 'ssv_granted' : 'ssv_ignored' : category === 'billing' ? 'billing_callback' : 'api_error', status >= 500 ? 'error' : status >= 400 ? 'warning' : 'info', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(c.req.method) ? c.req.method : 'OTHER', route, status, reason, ray && /^[a-zA-Z0-9-]{1,64}$/.test(ray) ? ray : null, c.env.CF_VERSION_METADATA?.id ?? null, Date.now() - started)
    .run()).then(() => undefined).catch(() => { console.warn('monitoring_write_failed'); });
  // A monitoring outage must never change a callback, grant or error response.
  try { c.executionCtx.waitUntil(work); } catch { await work; }
};

/** Run from the 15-minute operations tick, retaining at most 30 days / 10,000 events. */
export async function pruneMonitoring(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM monitor_events WHERE at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')"),
    db.prepare('DELETE FROM monitor_events WHERE id IN (SELECT id FROM monitor_events ORDER BY at DESC, id DESC LIMIT -1 OFFSET 10000)')
  ]);
}
