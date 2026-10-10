import type { Context, MiddlewareHandler } from 'hono';
import { HttpError } from './content/store';

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('Referrer-Policy', 'no-referrer');
  c.res.headers.set('X-Frame-Options', 'DENY');
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
};

export function errorBody(e: unknown): { status: number; body: Record<string, unknown> } {
  if (e instanceof HttpError) return { status: e.status, body: { error: e.code, message: e.message, ...(e.extra !== undefined ? { detail: e.extra } : {}) } };
  return { status: 500, body: { error: 'internal_error', message: 'unexpected server error' } };
}

export function onError(e: unknown, c: Context): Response {
  const { status, body } = errorBody(e);
  if (status === 500) console.error('unhandled', e instanceof Error ? e.stack : String(e));
  return c.json(body, status as 400);
}

/** Fixed-window limiter backed by D1 (used when no Workers rate-limit binding is bound, e.g. in tests). */
export async function d1RateLimit(db: D1Database, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const window = now - (now % windowSeconds);
  const row = await db
    .prepare(
      `INSERT INTO rate_counters (key, window_start, hits) VALUES (?1, ?2, 1)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN window_start = excluded.window_start THEN hits + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING hits`
    )
    .bind(key, window)
    .first<{ hits: number }>();
  return (row?.hits ?? 1) <= limit;
}
