import type { z } from 'zod';
import { base64UrlDecode, base64UrlEncode } from '@uomd/shared';
import { HttpError } from '../content/store';

/** Hard ceiling for every admin collection page: support reads full history by following cursors, never by one huge scan. */
export const MAX_PAGE = 100;

export function pageLimit(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) ? Math.min(MAX_PAGE, Math.max(1, n)) : fallback;
}

/** Opaque cursor = base64url(JSON sort key of the last row returned). */
export function readCursor<T>(raw: string | undefined, shape: z.ZodType<T>): T | null {
  if (!raw) return null;
  try {
    if (raw.length > 1024) throw new Error('long');
    return shape.parse(JSON.parse(new TextDecoder().decode(base64UrlDecode(raw))));
  } catch {
    throw new HttpError(400, 'bad_cursor', 'invalid cursor');
  }
}

/** Callers fetch `limit + 1` rows; the extra row only proves another page exists. */
export function pageOf<T>(rows: T[], limit: number, key: (row: T) => unknown[]): { rows: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { rows, nextCursor: null };
  const page = rows.slice(0, limit);
  return { rows: page, nextCursor: base64UrlEncode(new TextEncoder().encode(JSON.stringify(key(page[page.length - 1] as T)))) };
}

/** Optional strict filter: absent → undefined, present but invalid → 400 (a typo must not silently widen the result). */
export function filter<T>(raw: string | undefined, schema: z.ZodType<T>, name: string): T | undefined {
  if (raw === undefined || raw === '') return undefined;
  const r = schema.safeParse(raw);
  if (!r.success) throw new HttpError(400, 'bad_filter', `invalid ${name} filter`);
  return r.data;
}

/** LIKE pattern for a literal substring (wildcards in user text are escaped; pair with ESCAPE '\\'). */
export const likeSubstring = (q: string): string => `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
