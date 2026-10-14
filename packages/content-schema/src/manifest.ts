import { z } from 'zod';
import { CURRENT_CONTENT_SCHEMA, MAX_RELEASE_BYTES, MAX_JSON_FILE_BYTES, MAX_JSON_TOTAL_BYTES, Id, MEDIA_TYPE_BY_EXTENSION, SafeAssetPath, Semver, Sha256Hex } from './primitives';

export const FileKind = z.enum(['story_scene', 'encounter', 'unit_pack', 'chapter_index', 'art_manifest', 'atlas_image', 'portrait', 'background', 'audio', 'other_data']);
export type FileKind = z.infer<typeof FileKind>;

export const ManifestFile = z
  .object({
    path: SafeAssetPath,
    sha256: Sha256Hex,
    bytes: z.number().int().min(1).max(25 * 1024 * 1024),
    media_type: z.enum(Object.values(MEDIA_TYPE_BY_EXTENSION) as [string, ...string[]]),
    kind: FileKind
  })
  .strict()
  .superRefine((f, ctx) => {
    const ext = f.path.split('.').pop()?.toLowerCase() as keyof typeof MEDIA_TYPE_BY_EXTENSION;
    if (MEDIA_TYPE_BY_EXTENSION[ext] !== f.media_type) {
      ctx.addIssue({ code: 'custom', path: ['media_type'], message: `media_type ${f.media_type} does not match extension .${ext}` });
    }
  });
export type ManifestFile = z.infer<typeof ManifestFile>;

export const Channel = z.enum(['dev', 'staging', 'production']);
export type Channel = z.infer<typeof Channel>;

export const Signature = z.object({ kid: z.string().min(1).max(64), alg: z.literal('ES256'), value: z.string().min(40).max(200) }).strict();

export const ContentManifest = z
  .object({
    schema_version: z.literal(CURRENT_CONTENT_SCHEMA),
    release: z
      .object({
        id: Id,
        /** Strictly increasing per channel; a client never activates a lower generation than the active one. */
        generation: z.number().int().min(1),
        channel: Channel,
        created_at: z.iso.datetime(),
        notes: z.string().max(400)
      })
      .strict(),
    compat: z
      .object({
        /** Client build (binary) versions that may apply this release. */
        min_client: Semver,
        required_capabilities: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,63}$/)).max(32).optional(),
        max_client: Semver.optional(),
        content_schema: z.number().int().min(1)
      })
      .strict(),
    /** Release this one builds upon; absent for a self-contained base release. */
    depends_on: z.object({ release_id: Id, generation: z.number().int().min(1) }).strict().optional(),
    /** Previous known-good release the publisher would roll back to. */
    rollback_to: z.object({ release_id: Id, generation: z.number().int().min(1) }).strict().optional(),
    rollout: z.object({ percent: z.number().int().min(0).max(100), kill_switch: z.boolean() }).strict(),
    files: z.array(ManifestFile).min(1).max(512),
    signature: Signature.optional()
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.files.reduce((n, f) => n + f.bytes, 0) > MAX_RELEASE_BYTES) ctx.addIssue({ code: 'custom', message: 'release exceeds the 200 MiB resource budget' });
    const jsonFiles = m.files.filter((f) => f.path.endsWith('.json'));
    if (jsonFiles.some((f) => f.bytes > MAX_JSON_FILE_BYTES) || jsonFiles.reduce((n, f) => n + f.bytes, 0) > MAX_JSON_TOTAL_BYTES) ctx.addIssue({ code: 'custom', message: 'JSON resource budget exceeded' });
    if (new Set(m.compat.required_capabilities).size !== (m.compat.required_capabilities?.length ?? 0)) ctx.addIssue({ code: 'custom', message: 'duplicate required capability' });
    const sizes = new Map<string, number>();
    for (const f of m.files) { if (sizes.has(f.sha256) && sizes.get(f.sha256) !== f.bytes) ctx.addIssue({ code: 'custom', message: 'one object hash has conflicting sizes' }); sizes.set(f.sha256, f.bytes); }
    if (m.compat.max_client) {
      const max = m.compat.max_client.split('.').map(Number);
      const order = m.compat.min_client.split('.').map(Number).map((part, i) => part - max[i]!).find((difference) => difference !== 0) ?? 0;
      if (order > 0) ctx.addIssue({ code: 'custom', path: ['compat'], message: 'client compatibility range is empty' });
    }
    if (m.depends_on?.release_id === m.release.id) ctx.addIssue({ code: 'custom', path: ['depends_on'], message: 'release cannot depend on itself' });
    const seen = new Set<string>();
    for (const [i, f] of m.files.entries()) {
      if (seen.has(f.path)) ctx.addIssue({ code: 'custom', path: ['files', i, 'path'], message: `duplicate path ${f.path}` });
      seen.add(f.path);
    }
    if (m.depends_on && m.depends_on.generation >= m.release.generation) {
      ctx.addIssue({ code: 'custom', path: ['depends_on'], message: 'dependency generation must be lower than this release' });
    }
  });
export type ContentManifest = z.infer<typeof ContentManifest>;
