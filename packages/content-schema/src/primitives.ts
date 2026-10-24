import { z } from 'zod';

export const CURRENT_CONTENT_SCHEMA = 1;
/** First binary with self-contained snapshot reads and base-identical object reuse. */
export const MIN_SNAPSHOT_CLIENT_VERSION = '0.1.1';
export const MIN_EFFECTIVE_CLIENT_VERSION = '0.1.2';
export const MAX_RELEASE_BYTES = 200 * 1024 * 1024;
/** Files in one effective release (schema, admin draft API and store must agree). Part I campaign + VO is ~1,000. */
export const MAX_RELEASE_FILES = 1536;
export const MAX_JSON_FILE_BYTES = 1024 * 1024;
export const MAX_JSON_TOTAL_BYTES = 8 * 1024 * 1024;
/** one in-game video (D-29): ~1.5 min of 720p VP9 + Opus; the store teaser lives on YouTube, not in a patch */
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

/** snake_case stable identifier (characters, enemies, skills, scenes, nodes). */
export const Id = z.string().regex(/^[a-z][a-z0-9_]{1,79}$/, 'id must be snake_case, 2-80 chars');
export const LineId = z.string().regex(/^[a-z0-9_]{3,100}$/);
export const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);
export const Semver = z.string().regex(/^\d{1,6}\.\d{1,6}\.\d{1,6}$/);

/** Only data/media extensions may ever be delivered by a content patch. No js, wasm, html, svg, so. */
export const ALLOWED_EXTENSIONS = ['json', 'webp', 'png', 'ogg', 'mp3', 'm4a', 'webm', 'txt'] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export const MEDIA_TYPE_BY_EXTENSION: Record<AllowedExtension, string> = {
  json: 'application/json',
  webp: 'image/webp',
  png: 'image/png',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  webm: 'video/webm',
  txt: 'text/plain'
};

/**
 * Relative, forward-slash path made of safe segments. Rejects traversal ("..", "."), absolute
 * paths, backslashes, hidden/empty segments and anything outside the extension allowlist.
 */
export const SafeAssetPath = z
  .string()
  .min(3)
  .max(200)
  .superRefine((p, ctx) => {
    if (!/^[A-Za-z0-9_\-./]+$/.test(p)) return ctx.addIssue({ code: 'custom', message: 'path has illegal characters' });
    if (p.startsWith('/') || p.endsWith('/')) return ctx.addIssue({ code: 'custom', message: 'path must be relative' });
    const segs = p.split('/');
    if (segs.some((s) => s === '' || s === '.' || s === '..' || s.startsWith('.'))) {
      return ctx.addIssue({ code: 'custom', message: 'path has traversal or hidden segment' });
    }
    const ext = (segs[segs.length - 1] as string).split('.').pop()?.toLowerCase();
    if (!ext || !(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      ctx.addIssue({ code: 'custom', message: `extension not allowed for patch content: .${ext ?? ''}` });
    }
  });

export const Element = z.enum(['Ember', 'Gale', 'Stone', 'Tide', 'Dawn', 'Veil']);
export type Element = z.infer<typeof Element>;
