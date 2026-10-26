/**
 * Deterministic offline art ingest, QC, approval, verification and assembly tool (R14 — docs/media/EXPORT_PIPELINE.md).
 * Never calls paid APIs or touches content/budget/media_budget.json.
 *
 * CLI usage:
 *   npx tsx tools/ingest_art.ts init --spec <spec.json> --class <unit_sheet|portrait|background|still|ui_image|icon_sheet|banner>
 *   npx tsx tools/ingest_art.ts <ingest.json> [--source <file>] [--execute] [--force]
 *   npx tsx tools/ingest_art.ts approve <asset_id> --by <owner> [--note "..."]
 *   npx tsx tools/ingest_art.ts reject <asset_id> --reason "..."
 *   npx tsx tools/ingest_art.ts verify [--require-approved] [--strict-art]
 *   npx tsx tools/ingest_art.ts report
 *   npx tsx tools/ingest_art.ts assemble --target base [--require-approved] [--strict-art]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { UNIT_ANIM_STATES, type ArtManifest } from '../packages/content-schema/src/index';
import { keyRgba, bleed, type Edge } from './lib/key';
import { sliceSheet, trimAndMeasureFrame, type LayoutSpec, type TrimmedFrame } from './lib/slice';

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export type IngestClass = 'unit_sheet' | 'portrait' | 'background' | 'still' | 'ui_image' | 'icon_sheet' | 'banner';

export type IngestSource =
  | { kind: 'generated'; pick: string; provenance?: string }
  | { kind: 'locked'; file: string; sha256: string }
  | { kind: 'external'; file: string; sha256: string; license_record: string };

export interface IngestSpec {
  schema: 1;
  asset_id: string;
  class: IngestClass;
  source: IngestSource;
  key?: {
    colour: 'auto' | string;
    sample: Edge[];
    alpha_ramp: [number, number];
    choke_px: number;
    despill: boolean;
  };
  layout: LayoutSpec;
  frames?: {
    idle: string;
    idle_frame_px: number;
    ground: 'lowest';
    pivot: 'lower_body_centroid' | 'alpha_centroid';
    cell_order?: number[];
    state_map?: Record<string, string>;
    overrides?: Record<string, { foot_y?: number; pivot_x?: number }>;
    animations?: Record<string, { frames: string[]; fps: number; loop: boolean }>;
  };
  export: {
    fit: 'exact' | 'inside' | 'trim';
    width?: number;
    height?: number;
    max_atlas?: number;
    pad?: number;
    webp: {
      mode: 'lossy' | 'lossless' | 'near_lossless';
      quality: number;
      alpha_quality: number;
      effort: number;
    };
    max_bytes: number;
  };
  manifest: Record<string, unknown>;
  qc: {
    profile: 'bust_r1' | 'chibi_r2' | 'plate' | 'icon_r3' | 'mark';
    overrides?: Record<string, number>;
  };
}

export interface ApprovedArtOutput {
  path: string;
  sha256: string;
  pixels_sha256: string;
  bytes: number;
  width: number;
  height: number;
}

export interface ApprovedArtEntry {
  schema: 1;
  asset_id: string;
  class: IngestClass;
  revision: number;
  targets: {
    atlases?: ArtManifest['atlases'];
    units?: ArtManifest['units'];
    portraits?: ArtManifest['portraits'];
    backgrounds?: ArtManifest['backgrounds'];
    ui?: ArtManifest['ui'];
    stills?: ArtManifest['stills'];
  };
  source: {
    kind: 'generated' | 'locked' | 'external';
    sha256: string;
    mime: string;
    width: number;
    height: number;
    provenance_file?: string;
    provenance_sha256?: string;
    model?: string;
    size?: string;
    spec_path?: string;
    spec_sha256?: string;
    prompt_sha256?: string;
    references?: { path: string; sha256: string }[];
    settled_usd?: number;
    license_record?: string;
  };
  ingest: {
    spec_path: string;
    spec_sha256: string;
    tool: 'ingest_art@1';
    sharp: string;
    fingerprint: string;
  };
  outputs: ApprovedArtOutput[];
  qc: {
    automated: {
      passed: boolean;
      gates: Record<string, { status: 'pass' | 'warn' | 'fail'; detail?: string }>;
      warnings: string[];
    };
    human: {
      status: 'pending' | 'approved' | 'rejected';
      by: string | null;
      at: string | null;
      note: string;
    };
  };
  license: {
    origin: string;
    terms_checked_on: string | null;
    note: string;
  };
  history: {
    revision: number;
    outputs: ApprovedArtOutput[];
    source_sha256: string;
    fingerprint: string;
  }[];
}

const sha256Hex = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex');

function canonicalize(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalize).join(',')}]`;
  const entries = Object.entries(v as Record<string, unknown>)
    .filter(([, val]) => val !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, val]) => `${JSON.stringify(k)}:${canonicalize(val)}`).join(',')}}`;
}

function sniffMime(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  throw new Error('A02: unsupported image container (expected PNG, JPEG, or WebP magic bytes)');
}

function collectLegacyGitHashes(rootDir: string): Set<string> {
  const out = new Set<string>();
  const provPath = join(rootDir, 'content/provenance.json');
  if (!existsSync(provPath)) return out;
  try {
    const prov = JSON.parse(readFileSync(provPath, 'utf8')) as {
      outputs?: { output: string; sha256: string; sources?: Record<string, string> }[];
    };
    for (const item of prov.outputs ?? []) {
      const srcs = item.sources ?? {};
      const hasGitSource = Object.keys(srcs).some((k) => k.startsWith('git:'));
      if (hasGitSource) {
        out.add(item.sha256);
      }
      for (const [k, v] of Object.entries(srcs)) {
        if (k.startsWith('git:')) out.add(v);
      }
    }
  } catch {
    // ignore malformed provenance
  }
  return out;
}

const ALLOWED_REF_PREFIXES = [
  'content/specs/character_locks/',
  'content/generated/openai/',
  'reference/',
  'narrative/14_References/recovered_locked_v001/',
  'content/approved_art/art/',
];

export function checkReferenceHygiene(
  rootDir: string,
  references: { path: string; sha256: string }[],
): { passed: boolean; reason?: string } {
  const legacyHashes = collectLegacyGitHashes(rootDir);
  for (const ref of references) {
    const norm = ref.path.replace(/\\/g, '/').replace(/^\.\//, '');
    if (norm.includes('..') || !ALLOWED_REF_PREFIXES.some((prefix) => norm.startsWith(prefix))) {
      return {
        passed: false,
        reason: `A31: reference path "${ref.path}" is outside allowed reference directories (${ALLOWED_REF_PREFIXES.join(', ')})`,
      };
    }
    if (legacyHashes.has(ref.sha256)) {
      return {
        passed: false,
        reason: `A31: reference "${ref.path}" (${ref.sha256.slice(0, 12)}) matches a legacy git-derived asset hash`,
      };
    }
  }
  return { passed: true };
}

interface PlacedItem {
  name: string;
  w: number;
  h: number;
  x: number;
  y: number;
  data: Buffer;
}

async function alignAnimationGroup(frames: TrimmedFrame[]): Promise<void> {
  if (frames.length <= 1) return;
  let maxLeft = 0;
  let maxRight = 0;
  let maxH = 0;
  const metrics = frames.map((tf) => {
    const px = Math.round(tf.pivotX * tf.width);
    const left = px;
    const right = tf.width - px;
    if (left > maxLeft) maxLeft = left;
    if (right > maxRight) maxRight = right;
    if (tf.height > maxH) maxH = tf.height;
    return { tf, left };
  });
  const alignedW = Math.max(1, maxLeft + maxRight);
  const alignedH = Math.max(1, maxH);
  const sharedPivotX = Math.round((maxLeft / alignedW) * 1000) / 1000;
  for (const { tf, left } of metrics) {
    const offsetLeft = maxLeft - left;
    const offsetTop = alignedH - tf.height;
    if (offsetLeft === 0 && offsetTop === 0 && tf.width === alignedW && tf.height === alignedH) {
      tf.pivotX = sharedPivotX;
      tf.footY = 1;
      continue;
    }
    tf.data = await sharp({
      create: { width: alignedW, height: alignedH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: tf.data, left: offsetLeft, top: offsetTop }])
      .png()
      .toBuffer();
    tf.width = alignedW;
    tf.height = alignedH;
    tf.pivotX = sharedPivotX;
    tf.footY = 1;
  }
}

function shelfPackFrames(
  items: { name: string; w: number; h: number; data: Buffer }[],
  maxW: number,
  pad: number,
): { placed: PlacedItem[]; width: number; height: number } {
  const sorted = [...items].sort((a, b) => b.h - a.h || (a.name < b.name ? -1 : 1));
  const placed: PlacedItem[] = [];
  let x = pad;
  let y = pad;
  let rowH = 0;
  let usedW = 0;
  for (const it of sorted) {
    if (x + it.w + pad > maxW && x > pad) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    placed.push({ ...it, x, y });
    x += it.w + pad;
    rowH = Math.max(rowH, it.h);
    usedW = Math.max(usedW, x);
  }
  return { placed, width: Math.max(pad * 2, usedW), height: Math.max(pad * 2, y + rowH + pad) };
}

async function encodeWebpWithinCap(
  rgba: Buffer,
  width: number,
  height: number,
  spec: IngestSpec['export'],
): Promise<{ bytes: Buffer; qualityUsed: number }> {
  const baseImg = () => sharp(rgba, { raw: { width, height, channels: 4 } });
  if (spec.webp.mode === 'lossless') {
    const lossless = await baseImg().webp({ lossless: true, effort: spec.webp.effort }).toBuffer();
    if (lossless.length <= spec.max_bytes) return { bytes: lossless, qualityUsed: 100 };
  }
  let q = spec.webp.quality;
  let aq = spec.webp.alpha_quality;
  let lastBytes: Buffer | null = null;
  while (q >= 70) {
    const buf = await baseImg()
      .webp({
        quality: q,
        alphaQuality: aq,
        effort: spec.webp.effort,
        smartSubsample: true,
        nearLossless: spec.webp.mode === 'near_lossless',
      })
      .toBuffer();
    lastBytes = buf;
    if (buf.length <= spec.max_bytes) {
      return { bytes: buf, qualityUsed: q };
    }
    q -= 2;
    aq = Math.max(85, aq - 1);
  }
  throw new Error(
    `A19: encoded WebP size (${lastBytes?.length ?? 0} bytes at q70) exceeds max_bytes cap (${spec.max_bytes} bytes)`,
  );
}

export function initIngestSpec(specPath: string, cls: IngestClass): IngestSpec {
  const baseId = specPath
    .replace(/\\/g, '/')
    .split('/')
    .pop()!
    .replace(/\.json$/i, '');
  if (cls === 'unit_sheet') {
    const unit = baseId.replace(/_chibi_sheet$/, '');
    return {
      schema: 1,
      asset_id: baseId,
      class: 'unit_sheet',
      source: { kind: 'generated', pick: '0000000000' },
      key: { colour: 'auto', sample: ['top', 'bottom', 'left', 'right'], alpha_ramp: [0, 255], choke_px: 0.5, despill: true },
      layout: { mode: 'grid', cols: 4, rows: 2, cells: [...UNIT_ANIM_STATES] },
      frames: { idle: 'idle', idle_frame_px: 432, ground: 'lowest', pivot: 'lower_body_centroid' },
      export: {
        fit: 'trim',
        max_atlas: 2048,
        pad: 4,
        webp: { mode: 'lossy', quality: 82, alpha_quality: 92, effort: 5 },
        max_bytes: 665600,
      },
      manifest: { atlas: `atlas_${unit}`, unit, facing: 'right', height_px: 360 },
      qc: { profile: 'chibi_r2' },
    };
  }
  if (cls === 'portrait') {
    const parts = baseId.split('_vn_');
    const char = parts[0] ?? 'fadyme';
    const tag = parts[1] ?? 'composed';
    return {
      schema: 1,
      asset_id: baseId,
      class: 'portrait',
      source: { kind: 'generated', pick: '0000000000' },
      key: { colour: 'auto', sample: ['top', 'left', 'right'], alpha_ramp: [0, 255], choke_px: 0.5, despill: true },
      layout: { mode: 'single' },
      export: {
        fit: 'exact',
        width: 768,
        height: 1152,
        webp: { mode: 'lossy', quality: 80, alpha_quality: 90, effort: 5 },
        max_bytes: 245760,
      },
      manifest: { character: char, image: tag, emotion_tags: [tag] },
      qc: { profile: 'bust_r1' },
    };
  }
  if (cls === 'background') {
    const loc = baseId.replace(/^bg_/, '').replace(/_ordered$/, '');
    return {
      schema: 1,
      asset_id: baseId,
      class: 'background',
      source: { kind: 'generated', pick: '0000000000' },
      layout: { mode: 'single' },
      export: {
        fit: 'exact',
        width: 1920,
        height: 1080,
        webp: { mode: 'lossy', quality: 80, alpha_quality: 90, effort: 5 },
        max_bytes: 327680,
      },
      manifest: { background: loc },
      qc: { profile: 'plate' },
    };
  }
  if (cls === 'still') {
    const stillKey = baseId.replace(/^ill_/, '');
    return {
      schema: 1,
      asset_id: baseId,
      class: 'still',
      source: { kind: 'generated', pick: '0000000000' },
      layout: { mode: 'single' },
      export: {
        fit: 'exact',
        width: 1920,
        height: 1080,
        webp: { mode: 'lossy', quality: 80, alpha_quality: 90, effort: 5 },
        max_bytes: 389120,
      },
      manifest: { still: stillKey },
      qc: { profile: 'plate' },
    };
  }
  if (cls === 'banner') {
    const uiKey = baseId.startsWith('banner_') ? baseId : `banner_${baseId}`;
    return {
      schema: 1,
      asset_id: baseId,
      class: 'banner',
      source: {
        kind: 'locked',
        file: `narrative/15_Art_Workbench/banners/${baseId}_v001.jpg`,
        sha256: '0'.repeat(64),
      },
      layout: { mode: 'single' },
      export: {
        fit: 'exact',
        width: 1376,
        height: 768,
        webp: { mode: 'lossy', quality: 82, alpha_quality: 90, effort: 5 },
        max_bytes: 262144,
      },
      manifest: { ui: uiKey, banner: uiKey.replace(/^banner_/, '') },
      qc: { profile: 'plate' },
    };
  }
  if (cls === 'icon_sheet') {
    return {
      schema: 1,
      asset_id: baseId,
      class: 'icon_sheet',
      source: { kind: 'generated', pick: '0000000000' },
      key: { colour: 'auto', sample: ['top', 'bottom', 'left', 'right'], alpha_ramp: [0, 255], choke_px: 0.5, despill: true },
      layout: {
        mode: 'grid',
        cols: 4,
        rows: 4,
        cells: [
          'el_veil', 'el_stone', 'el_ember', 'el_tide',
          'el_gale', 'el_dawn', 'skill_basic', 'skill_active',
          'skill_ultimate', 'st_dread', 'st_stoneguard', 'st_taunt',
          'focus', 'eclipse_token', 'bell', 'wax_seal',
        ],
      },
      export: {
        fit: 'trim',
        width: 512,
        height: 512,
        pad: 8,
        webp: { mode: 'lossy', quality: 90, alpha_quality: 95, effort: 5 },
        max_bytes: 122880,
      },
      manifest: { atlas: 'atlas_ui_icons' },
      qc: { profile: 'icon_r3' },
    };
  }
  return {
    schema: 1,
    asset_id: baseId,
    class: 'ui_image',
    source: { kind: 'generated', pick: '0000000000' },
    key: { colour: 'auto', sample: ['top', 'bottom', 'left', 'right'], alpha_ramp: [0, 255], choke_px: 0.5, despill: true },
    layout: { mode: 'single' },
    export: {
      fit: 'inside',
      width: 512,
      height: 512,
      webp: { mode: 'lossy', quality: 88, alpha_quality: 95, effort: 5 },
      max_bytes: 61440,
    },
    manifest: { ui: 'studio_mark' },
    qc: { profile: 'mark' },
  };
}

export interface RunIngestOptions {
  rootDir?: string;
  ingestSpecPath: string;
  sourceOverridePath?: string;
  execute?: boolean;
  force?: boolean;
}

export async function runIngest(opts: RunIngestOptions): Promise<{
  status: 'preview' | 'executed' | 'unchanged';
  entry: ApprovedArtEntry;
  previewDir: string;
}> {
  const rootDir = opts.rootDir ?? DEFAULT_ROOT;
  const absSpecPath = join(rootDir, opts.ingestSpecPath);
  const specRaw = readFileSync(absSpecPath, 'utf8');
  const spec = JSON.parse(specRaw) as IngestSpec;
  const specSha256 = sha256Hex(specRaw);

  const gates: Record<string, { status: 'pass' | 'warn' | 'fail'; detail?: string }> = {};
  const warnings: string[] = [];
  let generatedOrigin = 'antigravity_generated_output';

  // Step 0: Resolve & verify source
  let sourceBytes: Buffer;
  let sourceSha256: string;
  let provMeta: Partial<ApprovedArtEntry['source']> = {};

  if (spec.source.kind === 'generated') {
    if (spec.source.pick.length < 8) {
      throw new Error('A01: generated source.pick must be at least 8 hex chars of the output sha256');
    }
    const provCandidates: string[] = [];
    if (spec.source.provenance) {
      provCandidates.push(join(rootDir, spec.source.provenance));
    } else {
      const genDir = join(rootDir, '.cache/generated', spec.asset_id);
      if (existsSync(genDir)) {
        for (const f of readdirSync(genDir)) {
          if (f.endsWith('.provenance.json')) provCandidates.push(join(genDir, f));
        }
      }
      const appProvDir = join(rootDir, 'content/approved_art/provenance');
      if (existsSync(appProvDir)) {
        for (const f of readdirSync(appProvDir)) {
          if (f.startsWith(`${spec.asset_id}.`) && f.endsWith('.provenance.json')) {
            provCandidates.push(join(appProvDir, f));
          }
        }
      }
    }

    let matchedProvPath: string | null = null;
    let matchedProv: {
      provider?: string;
      spec?: { id?: string; prompt?: string; aspectRatio?: string };
      model?: string;
      references?: { path: string; sha256: string }[];
      outputs?: { file: string; sha256: string }[];
      settled_usd?: number;
    } | null = null;
    let matchedOutput: { file: string; sha256: string } | null = null;

    for (const cand of provCandidates) {
      if (!existsSync(cand)) continue;
      const parsed = JSON.parse(readFileSync(cand, 'utf8')) as NonNullable<typeof matchedProv>;
      const hit = (parsed.outputs ?? []).find((o) => o.sha256.startsWith(spec.source.pick));
      if (hit) {
        matchedProvPath = cand;
        matchedProv = parsed;
        matchedOutput = hit;
        break;
      }
    }

    if (!matchedProv || !matchedOutput || !matchedProvPath) {
      throw new Error(`A01: no provenance output matching pick "${spec.source.pick}" for ${spec.asset_id}`);
    }
    if (matchedProv.provider === 'openai') generatedOrigin = 'openai_generated_output';

    const refCheck = checkReferenceHygiene(rootDir, matchedProv.references ?? []);
    if (!refCheck.passed) {
      throw new Error(refCheck.reason);
    }
    gates.A31 = { status: 'pass', detail: `${(matchedProv.references ?? []).length} references verified` };

    const rawFilePath = opts.sourceOverridePath
      ? join(rootDir, opts.sourceOverridePath)
      : existsSync(matchedOutput.file)
        ? matchedOutput.file
        : join(rootDir, matchedOutput.file);
    if (!existsSync(rawFilePath)) {
      throw new Error(`A01: source image file not found at ${rawFilePath}`);
    }
    sourceBytes = readFileSync(rawFilePath);
    sourceSha256 = sha256Hex(sourceBytes);
    if (sourceSha256 !== matchedOutput.sha256) {
      throw new Error(`A01: source file sha256 (${sourceSha256}) does not match provenance output (${matchedOutput.sha256})`);
    }
    gates.A01 = { status: 'pass' };

    const provRel = relative(rootDir, matchedProvPath).replace(/\\/g, '/');
    provMeta = {
      provenance_file: provRel,
      provenance_sha256: sha256Hex(readFileSync(matchedProvPath)),
      model: matchedProv.model ?? 'unknown',
      prompt_sha256: matchedProv.spec?.prompt ? sha256Hex(matchedProv.spec.prompt) : undefined,
      references: matchedProv.references ?? [],
      settled_usd: matchedProv.settled_usd,
    };
  } else {
    const filePath = opts.sourceOverridePath
      ? join(rootDir, opts.sourceOverridePath)
      : join(rootDir, spec.source.file);
    if (!existsSync(filePath)) {
      throw new Error(`A01: source file not found: ${spec.source.file}`);
    }
    sourceBytes = readFileSync(filePath);
    sourceSha256 = sha256Hex(sourceBytes);
    if (sourceSha256 !== spec.source.sha256) {
      throw new Error(`A01: pinned sha256 mismatch for ${spec.source.file} (expected ${spec.source.sha256}, got ${sourceSha256})`);
    }
    if (spec.source.kind === 'external' && !spec.source.license_record?.trim()) {
      throw new Error('A01: external source requires a non-empty license_record');
    }
    gates.A01 = { status: 'pass' };
    if (spec.source.kind === 'external') {
      provMeta = { license_record: spec.source.license_record };
    }
  }

  // Step 1: Decode & sniff container
  const mime = sniffMime(sourceBytes);
  if (mime === 'image/jpeg') {
    warnings.push('A02: source is JPEG; block noise may affect chroma key edges');
  }
  const decoded = await sharp(sourceBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const srcW = decoded.info.width;
  const srcH = decoded.info.height;
  if (srcW < 64 || srcH < 64 || srcW > 8192 || srcH > 8192) {
    throw new Error(`A02: source dimensions ${srcW}x${srcH} outside valid range 64..8192`);
  }
  gates.A02 = { status: mime === 'image/jpeg' ? 'warn' : 'pass', detail: `${mime} ${srcW}x${srcH}` };

  // Fingerprint check for idempotency
  const fingerprint = sha256Hex(
    canonicalize({
      source_sha256: sourceSha256,
      spec: JSON.parse(specRaw),
      tool: 'ingest_art@1',
    }),
  );

  const entryPath = join(rootDir, 'content/approved_art/entries', `${spec.asset_id}.json`);
  const existingEntry = existsSync(entryPath)
    ? (JSON.parse(readFileSync(entryPath, 'utf8')) as ApprovedArtEntry)
    : null;

  const previewDir = join(rootDir, '.cache/ingest', spec.asset_id);
  mkdirSync(previewDir, { recursive: true });

  if (
    opts.execute &&
    !opts.force &&
    existingEntry &&
    existingEntry.ingest.fingerprint === fingerprint &&
    existingEntry.outputs.every((o) => {
      const p = join(rootDir, 'content/approved_art', o.path);
      return existsSync(p) && sha256Hex(readFileSync(p)) === o.sha256;
    })
  ) {
    return { status: 'unchanged', entry: existingEntry, previewDir };
  }

  // Step 2: Keying (for keyed classes) or opaque check
  let workingRgba: Buffer = Buffer.from(decoded.data);
  if (spec.key) {
    const keyed = keyRgba(workingRgba, srcW, srcH, {
      sample: spec.key.sample,
      ramp: spec.key.alpha_ramp,
      choke: spec.key.choke_px,
      despill: spec.key.despill,
    });
    workingRgba = keyed.data;
    if (keyed.ringSigma > 20) {
      throw new Error(`A07: border ring sigma (${keyed.ringSigma.toFixed(1)}) > 20; background is not flat green`);
    }
    if (keyed.ringSigma > 8) {
      warnings.push(`A07: border ring sigma (${keyed.ringSigma.toFixed(1)}) > 8`);
    }
    gates.A07 = { status: keyed.ringSigma > 8 ? 'warn' : 'pass', detail: `sigma=${keyed.ringSigma.toFixed(2)}` };
    if (keyed.removedSpecks > 0) {
      warnings.push(`A12: removed ${keyed.removedSpecks} isolated specks`);
    }
    gates.A12 = { status: keyed.removedSpecks > 0 ? 'warn' : 'pass', detail: `removed=${keyed.removedSpecks}` };
  } else {
    // Opaque check (A21): ensure alpha is 255 and border is not #00FF00
    let greenBorderPixels = 0;
    for (let x = 0; x < srcW; x++) {
      for (const y of [0, srcH - 1]) {
        const i = (y * srcW + x) * 4;
        const r = workingRgba[i] as number;
        const g = workingRgba[i + 1] as number;
        const b = workingRgba[i + 2] as number;
        if (Math.hypot(r, g - 255, b) < 60) greenBorderPixels++;
      }
    }
    if (greenBorderPixels > srcW * 0.25) {
      throw new Error('A21: opaque class has key-green border pixels');
    }
    gates.A21 = { status: 'pass' };
  }

  // Step 3-8: Layout, Slicing, Normalization, Packing & Encoding
  let relOutPath: string;
  let finalWebp: Buffer;
  let outW: number;
  let outH: number;
  const targets: ApprovedArtEntry['targets'] = {};

  if (spec.class === 'unit_sheet') {
    const unitKey = String(spec.manifest.unit ?? spec.asset_id.replace(/_chibi_sheet$/, ''));
    const atlasKey = String(spec.manifest.atlas ?? `atlas_${unitKey}`);
    const facing = (spec.manifest.facing === 'left' ? 'left' : 'right') as 'left' | 'right';
    const heightPx = Number(spec.manifest.height_px ?? 360);
    relOutPath = `art/${atlasKey}.webp`;

    const sliced = sliceSheet(workingRgba, srcW, srcH, spec.layout, spec.frames?.cell_order);
    warnings.push(...sliced.warnings);
    gates.A14 = { status: 'pass', detail: `${sliced.boxes.length} cells` };
    gates.A15 = { status: sliced.warnings.length > 0 ? 'warn' : 'pass' };

    const trimmedMap = new Map<string, TrimmedFrame>();
    for (const box of sliced.boxes) {
      const tf = await trimAndMeasureFrame(
        workingRgba,
        srcW,
        srcH,
        box,
        spec.frames?.pivot ?? 'lower_body_centroid',
      );
      trimmedMap.set(box.name, tf);
    }

    const idleName = spec.frames?.idle ?? 'idle';
    const idleFrame = trimmedMap.get(idleName);
    if (!idleFrame) throw new Error(`unit_sheet missing idle frame "${idleName}"`);

    const targetIdlePx = spec.frames?.idle_frame_px ?? Math.round(heightPx * 1.2);
    const scaleK = targetIdlePx / idleFrame.height;
    if (scaleK > 1.0) {
      throw new Error(`A03: upscaling forbidden (idle frame height ${idleFrame.height}px < target ${targetIdlePx}px, k=${scaleK.toFixed(3)})`);
    }
    if (scaleK > 0.9) {
      warnings.push(`A03: scale factor k=${scaleK.toFixed(3)} is between 0.9 and 1.0`);
    }
    gates.A03 = { status: scaleK > 0.9 ? 'warn' : 'pass', detail: `k=${scaleK.toFixed(3)}` };

    const animations = spec.frames?.animations ?? {};
    const alignedSet = new Set<string>();
    for (const anim of Object.values(animations)) {
      const uniqueFrames = [...new Set(anim.frames)]
        .filter((f) => !alignedSet.has(f))
        .map((f) => trimmedMap.get(f))
        .filter((tf): tf is TrimmedFrame => Boolean(tf));
      if (uniqueFrames.length > 1) {
        await alignAnimationGroup(uniqueFrames);
        for (const tf of uniqueFrames) alignedSet.add(tf.name);
      }
    }

    const packItems: { name: string; w: number; h: number; data: Buffer }[] = [];
    for (const [name, tf] of trimmedMap.entries()) {
      const w = Math.max(1, Math.round(tf.width * scaleK));
      const h = Math.max(1, Math.round(tf.height * scaleK));
      const resizedRaw = await sharp(tf.data)
        .resize(w, h, { kernel: 'lanczos3' })
        .ensureAlpha()
        .raw()
        .toBuffer();
      const bled = Buffer.from(resizedRaw);
      bleed(bled, w, h, 4);
      const pngBuf = await sharp(bled, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
      packItems.push({ name, w, h, data: pngBuf });
    }

    const maxAtlas = spec.export.max_atlas ?? 2048;
    const pad = spec.export.pad ?? 4;
    const packed = shelfPackFrames(packItems, maxAtlas, pad);
    if (packed.width > maxAtlas || packed.height > maxAtlas) {
      throw new Error(`A18: packed atlas ${packed.width}x${packed.height} exceeds max_atlas ${maxAtlas}`);
    }
    outW = packed.width;
    outH = packed.height;

    const compositeRaw = await sharp({
      create: { width: outW, height: outH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite(packed.placed.map((p) => ({ input: p.data, left: p.x, top: p.y })))
      .raw()
      .toBuffer();
    if (spec.key) {
      if (spec.key.despill !== false) {
        for (let i = 0; i < compositeRaw.length; i += 4) {
          if ((compositeRaw[i + 3] as number) > 0) {
            const cap = Math.max(compositeRaw[i] as number, compositeRaw[i + 2] as number);
            if ((compositeRaw[i + 1] as number) > cap) compositeRaw[i + 1] = cap;
          }
        }
      }
      bleed(compositeRaw, outW, outH, 4);
    }

    const encoded = await encodeWebpWithinCap(compositeRaw, outW, outH, spec.export);
    finalWebp = encoded.bytes;

    const framesRecord: Record<string, [number, number, number, number]> = {};
    for (const p of packed.placed) {
      framesRecord[p.name] = [p.x, p.y, p.w, p.h];
    }

    const stateMap = spec.frames?.state_map ?? {};
    const overrides = spec.frames?.overrides ?? {};
    const statesRecord: Record<
      string,
      { frame: string; scale: number; foot_y: number; pivot_x: number; animation?: { frames: string[]; fps: number; loop: boolean } }
    > = {};
    for (const st of UNIT_ANIM_STATES) {
      const targetFrame = stateMap[st] ?? st;
      const tf = trimmedMap.get(targetFrame) ?? idleFrame;
      const ov = overrides[st] ?? {};
      const anim = animations[st];
      if (anim) {
        for (const af of anim.frames) {
          if (!framesRecord[af]) {
            throw new Error(`A15: animation frame "${af}" for state "${st}" not found in packed frames`);
          }
        }
      }
      statesRecord[st] = {
        frame: targetFrame,
        scale: 1,
        foot_y: ov.foot_y ?? tf.footY,
        pivot_x: ov.pivot_x ?? tf.pivotX,
        ...(anim ? { animation: anim } : {}),
      };
    }

    targets.atlases = {
      [atlasKey]: {
        image: relOutPath,
        width: outW,
        height: outH,
        frames: framesRecord,
      },
    };
    targets.units = {
      [unitKey]: {
        atlas: atlasKey,
        facing,
        height_px: heightPx,
        states: statesRecord as ArtManifest['units'][string]['states'],
      },
    };
  } else if (spec.class === 'icon_sheet') {
    const atlasKey = String(spec.manifest.atlas ?? 'atlas_ui_icons');
    relOutPath = `art/${atlasKey}.webp`;
    const sliced = sliceSheet(workingRgba, srcW, srcH, spec.layout);
    warnings.push(...sliced.warnings);
    outW = 512;
    outH = 512;
    const cellPx = 128;
    const pad = spec.export.pad ?? 8;
    const maxGlyph = cellPx - pad * 2;

    const overlays: sharp.OverlayOptions[] = [];
    const framesRecord: Record<string, [number, number, number, number]> = {};
    for (let idx = 0; idx < sliced.boxes.length; idx++) {
      const box = sliced.boxes[idx]!;
      const tf = await trimAndMeasureFrame(workingRgba, srcW, srcH, box, 'alpha_centroid');
      const resized = await sharp(tf.data)
        .resize(maxGlyph, maxGlyph, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
        .png()
        .toBuffer();
      const meta = await sharp(resized).metadata();
      const gw = meta.width ?? maxGlyph;
      const gh = meta.height ?? maxGlyph;
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const cellX = col * cellPx;
      const cellY = row * cellPx;
      const left = cellX + Math.floor((cellPx - gw) / 2);
      const top = cellY + Math.floor((cellPx - gh) / 2);
      overlays.push({ input: resized, left, top });
      framesRecord[box.name] = [cellX, cellY, cellPx, cellPx];
    }

    const compositeRaw = await sharp({
      create: { width: outW, height: outH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite(overlays)
      .raw()
      .toBuffer();
    const encoded = await encodeWebpWithinCap(compositeRaw, outW, outH, spec.export);
    finalWebp = encoded.bytes;
    targets.atlases = {
      [atlasKey]: {
        image: relOutPath,
        width: outW,
        height: outH,
        frames: framesRecord,
      },
    };
  } else {
    const targetW = spec.export.width ?? srcW;
    const targetH = spec.export.height ?? srcH;
    if (spec.export.fit === 'exact' && (srcW < targetW || srcH < targetH)) {
      throw new Error(`A03: source ${srcW}x${srcH} is smaller than target export ${targetW}x${targetH}`);
    }
    const resized = await sharp(workingRgba, { raw: { width: srcW, height: srcH, channels: 4 } })
      .resize(targetW, targetH, {
        fit: spec.export.fit === 'inside' ? 'inside' : 'cover',
        withoutEnlargement: true,
        kernel: 'lanczos3',
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    outW = resized.info.width;
    outH = resized.info.height;
    const finalRgba = Buffer.from(resized.data);
    if (spec.key) {
      if (spec.key.despill !== false) {
        for (let i = 0; i < finalRgba.length; i += 4) {
          if ((finalRgba[i + 3] as number) > 0) {
            const cap = Math.max(finalRgba[i] as number, finalRgba[i + 2] as number);
            if ((finalRgba[i + 1] as number) > cap) finalRgba[i + 1] = cap;
          }
        }
      }
      bleed(finalRgba, outW, outH, 4);
    }

    const encoded = await encodeWebpWithinCap(finalRgba, outW, outH, spec.export);
    finalWebp = encoded.bytes;

    if (spec.class === 'portrait') {
      const char = String(spec.manifest.character ?? 'fadyme');
      const imgKey = String(spec.manifest.image ?? 'composed');
      const emoTags = Array.isArray(spec.manifest.emotion_tags)
        ? (spec.manifest.emotion_tags as string[])
        : [imgKey];
      relOutPath = `art/portrait_${char}_${imgKey}.webp`;
      const emotions: Record<string, string> = {};
      for (const t of emoTags) emotions[t] = imgKey;
      targets.portraits = {
        [char]: {
          emotions,
          images: { [imgKey]: relOutPath },
        },
      };
    } else if (spec.class === 'background') {
      const loc = String(spec.manifest.background ?? 'forest_whispering_ash');
      relOutPath = `art/bg_${loc}.webp`;
      targets.backgrounds = { [loc]: relOutPath };
    } else if (spec.class === 'still') {
      const stillKey = String(spec.manifest.still ?? spec.asset_id);
      relOutPath = `art/still_${stillKey}.webp`;
      targets.stills = { [stillKey]: relOutPath };
    } else {
      const uiKey = String(spec.manifest.ui ?? spec.manifest.banner ?? spec.asset_id);
      relOutPath = `art/ui_${uiKey}.webp`;
      targets.ui = { [uiKey]: relOutPath };
    }
  }

  gates.A18 = { status: 'pass', detail: `${outW}x${outH}` };
  gates.A19 = { status: 'pass', detail: `${finalWebp.length} bytes <= ${spec.export.max_bytes}` };

  // Decode the encoded WebP to compute pixels_sha256 and check green spill (A08) on actual output
  const decodedOut = await sharp(finalWebp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixelsSha256 = sha256Hex(decodedOut.data);
  const outputSha256 = sha256Hex(finalWebp);

  if (spec.key) {
    let opaqueCount = 0;
    let spillCount = 0;
    for (let i = 0; i < decodedOut.data.length; i += 4) {
      const a = decodedOut.data[i + 3] as number;
      if (a >= 13) {
        opaqueCount++;
        const r = decodedOut.data[i] as number;
        const g = decodedOut.data[i + 1] as number;
        const b = decodedOut.data[i + 2] as number;
        if (g - Math.max(r, b) > 10) spillCount++;
      }
    }
    const spillRatio = opaqueCount > 0 ? spillCount / opaqueCount : 0;
    if (spillRatio > 0.0002) {
      throw new Error(`A08: green spill ratio ${(spillRatio * 100).toFixed(4)}% exceeds 0.02% fail threshold`);
    }
    gates.A08 = { status: spillRatio > 0.00005 ? 'warn' : 'pass', detail: `spill=${(spillRatio * 100).toFixed(4)}%` };
  }

  // Write preview artifacts to .cache/ingest/<asset_id>/
  await sharp(finalWebp).png().toFile(join(previewDir, 'review.png'));

  const outputRecord: ApprovedArtOutput = {
    path: relOutPath,
    sha256: outputSha256,
    pixels_sha256: pixelsSha256,
    bytes: finalWebp.length,
    width: outW,
    height: outH,
  };

  const revision = existingEntry ? existingEntry.revision + 1 : 1;
  const history = existingEntry
    ? [
        ...existingEntry.history,
        {
          revision: existingEntry.revision,
          outputs: existingEntry.outputs,
          source_sha256: existingEntry.source.sha256,
          fingerprint: existingEntry.ingest.fingerprint,
        },
      ]
    : [];

  const entry: ApprovedArtEntry = {
    schema: 1,
    asset_id: spec.asset_id,
    class: spec.class,
    revision,
    targets,
    source: {
      kind: spec.source.kind,
      sha256: sourceSha256,
      mime,
      width: srcW,
      height: srcH,
      ...provMeta,
    },
    ingest: {
      spec_path: opts.ingestSpecPath.replace(/\\/g, '/'),
      spec_sha256: specSha256,
      tool: 'ingest_art@1',
      sharp: sharp.versions.sharp,
      fingerprint,
    },
    outputs: [outputRecord],
    qc: {
      automated: {
        passed: true,
        gates,
        warnings,
      },
      human: {
        status: 'pending',
        by: null,
        at: null,
        note: '',
      },
    },
    license: {
      origin:
        spec.source.kind === 'generated'
          ? generatedOrigin
          : spec.source.kind === 'locked'
            ? 'project_locked_original'
            : 'external_cc0',
      terms_checked_on: null,
      note: 'provenance verified by tools/ingest_art.ts',
    },
    history,
  };

  writeFileSync(join(previewDir, 'qc.json'), `${JSON.stringify(entry.qc, null, 2)}\n`);

  if (!opts.execute) {
    return { status: 'preview', entry, previewDir };
  }

  // Atomic promotion to content/approved_art/
  const approvedRoot = join(rootDir, 'content/approved_art');
  const targetWebpPath = join(approvedRoot, relOutPath);
  mkdirSync(dirname(targetWebpPath), { recursive: true });
  mkdirSync(dirname(entryPath), { recursive: true });

  const tmpWebp = `${targetWebpPath}.tmp.${process.pid}`;
  writeFileSync(tmpWebp, finalWebp);
  renameSync(tmpWebp, targetWebpPath);

  const tmpEntry = `${entryPath}.tmp.${process.pid}`;
  writeFileSync(tmpEntry, `${JSON.stringify(entry, null, 2)}\n`);
  renameSync(tmpEntry, entryPath);

  return { status: 'executed', entry, previewDir };
}

export function approveArtEntry(rootDir: string, assetId: string, by: string, note = ''): ApprovedArtEntry {
  if (!by.trim()) throw new Error('approve requires --by <owner>');
  const entryPath = join(rootDir, 'content/approved_art/entries', `${assetId}.json`);
  if (!existsSync(entryPath)) throw new Error(`no approved_art entry found for ${assetId}`);
  const entry = JSON.parse(readFileSync(entryPath, 'utf8')) as ApprovedArtEntry;
  entry.qc.human = {
    status: 'approved',
    by: by.trim(),
    at: new Date().toISOString(),
    note,
  };
  writeFileSync(entryPath, `${JSON.stringify(entry, null, 2)}\n`);
  return entry;
}

export function rejectArtEntry(rootDir: string, assetId: string, reason: string): ApprovedArtEntry {
  if (!reason.trim()) throw new Error('reject requires --reason <text>');
  const entryPath = join(rootDir, 'content/approved_art/entries', `${assetId}.json`);
  if (!existsSync(entryPath)) throw new Error(`no approved_art entry found for ${assetId}`);
  const entry = JSON.parse(readFileSync(entryPath, 'utf8')) as ApprovedArtEntry;
  entry.qc.human = {
    status: 'rejected',
    by: null,
    at: new Date().toISOString(),
    note: reason.trim(),
  };
  writeFileSync(entryPath, `${JSON.stringify(entry, null, 2)}\n`);
  return entry;
}

export function loadApprovedArtEntries(rootDir = DEFAULT_ROOT, requireApproved = false): ApprovedArtEntry[] {
  const entriesDir = join(rootDir, 'content/approved_art/entries');
  if (!existsSync(entriesDir)) return [];
  const files = readdirSync(entriesDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const entries: ApprovedArtEntry[] = [];
  for (const f of files) {
    const entry = JSON.parse(readFileSync(join(entriesDir, f), 'utf8')) as ApprovedArtEntry;
    if (entry.qc.human.status === 'rejected') continue;
    if (requireApproved && entry.qc.human.status !== 'approved') {
      throw new Error(`strict-art / require-approved failed: entry "${entry.asset_id}" has human status "${entry.qc.human.status}"`);
    }
    entries.push(entry);
  }
  return entries;
}

export async function verifyApprovedArt(
  rootDir = DEFAULT_ROOT,
  opts: { requireApproved?: boolean; strictArt?: boolean } = {},
): Promise<{
  ok: boolean;
  entryCount: number;
  warnings: string[];
  errors: string[];
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const entriesDir = join(rootDir, 'content/approved_art/entries');
  const files = existsSync(entriesDir)
    ? readdirSync(entriesDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
    : [];

  const seenOutputHashes = new Map<string, string>();
  for (const f of files) {
    const entry = JSON.parse(readFileSync(join(entriesDir, f), 'utf8')) as ApprovedArtEntry;
    if (!entry.qc.automated.passed) {
      errors.push(`${entry.asset_id}: automated QC not passed`);
    }
    if (opts.requireApproved && entry.qc.human.status !== 'approved') {
      errors.push(`${entry.asset_id}: human status is "${entry.qc.human.status}" (expected "approved")`);
    }
    if (entry.source.references) {
      const refCheck = checkReferenceHygiene(rootDir, entry.source.references);
      if (!refCheck.passed) errors.push(`${entry.asset_id}: ${refCheck.reason}`);
    }
    for (const out of entry.outputs) {
      const prior = seenOutputHashes.get(out.sha256);
      if (prior && prior !== entry.asset_id) {
        errors.push(`A05: duplicate output sha256 between ${entry.asset_id} and ${prior}`);
      }
      seenOutputHashes.set(out.sha256, entry.asset_id);

      const absOut = join(rootDir, 'content/approved_art', out.path);
      if (!existsSync(absOut)) {
        errors.push(`${entry.asset_id}: missing output file ${out.path}`);
        continue;
      }
      const actualBytes = readFileSync(absOut);
      const actualSha = sha256Hex(actualBytes);
      if (actualSha !== out.sha256) {
        const decoded = await sharp(actualBytes).ensureAlpha().raw().toBuffer();
        const actualPixelsSha = sha256Hex(decoded);
        if (actualPixelsSha === out.pixels_sha256) {
          warnings.push(`${entry.asset_id}: toolchain WebP byte drift on ${out.path} (decoded pixels match)`);
        } else {
          errors.push(`${entry.asset_id}: output hash mismatch on ${out.path}`);
        }
      }
    }
  }

  if (opts.strictArt) {
    if (files.length === 0) {
      errors.push('strict-art: no entries in content/approved_art/entries');
    }
    const provPath = join(rootDir, 'content/provenance.json');
    if (existsSync(provPath)) {
      const prov = JSON.parse(readFileSync(provPath, 'utf8')) as {
        outputs?: { output: string; sources?: Record<string, string> }[];
      };
      for (const item of prov.outputs ?? []) {
        if (!item.output.includes('/art/')) continue;
        for (const srcKey of Object.keys(item.sources ?? {})) {
          if (srcKey.startsWith('git:')) {
            errors.push(`strict-art: ${item.output} still depends on legacy source "${srcKey}"`);
          }
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    entryCount: files.length,
    warnings,
    errors,
  };
}

export function reportApprovedArt(rootDir = DEFAULT_ROOT): {
  totalEntries: number;
  approvedEntries: number;
  pendingEntries: number;
  totalBytes: number;
  totalDecodedBytes: number;
  byClass: Record<string, { count: number; bytes: number; decodedBytes: number }>;
} {
  const entries = loadApprovedArtEntries(rootDir, false);
  const byClass: Record<string, { count: number; bytes: number; decodedBytes: number }> = {};
  let totalBytes = 0;
  let totalDecodedBytes = 0;
  let approvedEntries = 0;
  let pendingEntries = 0;

  for (const e of entries) {
    if (e.qc.human.status === 'approved') approvedEntries++;
    else if (e.qc.human.status === 'pending') pendingEntries++;
    const bucket = (byClass[e.class] ??= { count: 0, bytes: 0, decodedBytes: 0 });
    bucket.count++;
    for (const o of e.outputs) {
      const decoded = o.width * o.height * 4;
      bucket.bytes += o.bytes;
      bucket.decodedBytes += decoded;
      totalBytes += o.bytes;
      totalDecodedBytes += decoded;
    }
  }

  return {
    totalEntries: entries.length,
    approvedEntries,
    pendingEntries,
    totalBytes,
    totalDecodedBytes,
    byClass,
  };
}

async function cli(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (name: string): boolean => args.includes(`--${name}`);

  if (!cmd) {
    throw new Error('usage: ingest_art.ts <init|approve|reject|verify|report|assemble|path/to/spec.ingest.json>');
  }

  if (cmd === 'init') {
    const spec = flag('spec');
    const cls = flag('class') as IngestClass | undefined;
    if (!spec || !cls) throw new Error('usage: ingest_art.ts init --spec <spec.json> --class <class>');
    const template = initIngestSpec(spec, cls);
    const outPath = spec.replace(/\.json$/i, '.ingest.json');
    writeFileSync(join(DEFAULT_ROOT, outPath), `${JSON.stringify(template, null, 2)}\n`);
    console.log(`wrote ${outPath}`);
    return;
  }

  if (cmd === 'approve') {
    const assetId = args[1];
    const by = flag('by') ?? '';
    const note = flag('note') ?? '';
    if (!assetId) throw new Error('usage: ingest_art.ts approve <asset_id> --by <owner> [--note "..."]');
    const updated = approveArtEntry(DEFAULT_ROOT, assetId, by, note);
    console.log(`approved ${updated.asset_id} (rev ${updated.revision}) by ${updated.qc.human.by}`);
    return;
  }

  if (cmd === 'reject') {
    const assetId = args[1];
    const reason = flag('reason') ?? '';
    if (!assetId) throw new Error('usage: ingest_art.ts reject <asset_id> --reason "..."');
    const updated = rejectArtEntry(DEFAULT_ROOT, assetId, reason);
    console.log(`rejected ${updated.asset_id}: ${updated.qc.human.note}`);
    return;
  }

  if (cmd === 'verify') {
    const res = await verifyApprovedArt(DEFAULT_ROOT, {
      requireApproved: has('require-approved'),
      strictArt: has('strict-art'),
    });
    console.log(JSON.stringify(res, null, 2));
    if (!res.ok) process.exit(1);
    return;
  }

  if (cmd === 'report') {
    console.log(JSON.stringify(reportApprovedArt(DEFAULT_ROOT), null, 2));
    return;
  }

  if (cmd === 'assemble') {
    const res = await verifyApprovedArt(DEFAULT_ROOT, {
      requireApproved: has('require-approved'),
      strictArt: has('strict-art'),
    });
    if (!res.ok) {
      console.error(JSON.stringify(res, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify({ assembled: true, verifiedEntries: res.entryCount }, null, 2));
    return;
  }

  const res = await runIngest({
    ingestSpecPath: cmd,
    sourceOverridePath: flag('source'),
    execute: has('execute'),
    force: has('force'),
  });
  console.log(
    JSON.stringify(
      {
        status: res.status,
        asset_id: res.entry.asset_id,
        revision: res.entry.revision,
        outputs: res.entry.outputs,
        qc: res.entry.qc,
        previewDir: res.previewDir,
      },
      null,
      2,
    ),
  );
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  cli().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
