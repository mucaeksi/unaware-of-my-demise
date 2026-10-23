import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import {
  approveArtEntry,
  checkReferenceHygiene,
  initIngestSpec,
  loadApprovedArtEntries,
  rejectArtEntry,
  reportApprovedArt,
  runIngest,
  verifyApprovedArt,
  type IngestSpec
} from '../ingest_art.js';
import { sliceSheet, trimAndMeasureFrame } from './slice.js';

function drawRect(
  data: Uint8Array | Buffer,
  w: number,
  h: number,
  left: number,
  top: number,
  rectW: number,
  rectH: number,
  rgba: [number, number, number, number]
): void {
  const xEnd = Math.min(w, left + rectW);
  const yEnd = Math.min(h, top + rectH);
  for (let y = Math.max(0, top); y < yEnd; y++) {
    for (let x = Math.max(0, left); x < xEnd; x++) {
      const i = (y * w + x) * 4;
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
    }
  }
}

describe('sliceSheet & trimAndMeasureFrame (R14-B)', () => {
  it('slices a 4x2 grid, merges nearby detached parts, applies cellOrder, and computes footY + lower-body pivotX', async () => {
    const w = 400;
    const h = 240;
    const data = Buffer.alloc(w * h * 4);
    const cols = 4;
    const rows = 2;
    const cellW = 100;
    const cellH = 120;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const baseX = c * cellW + 30;
        const baseY = r * cellH + 20;
        // Main body (width 40, height 80)
        drawRect(data, w, h, baseX, baseY, 40, 80, [180, 40 + r * 30, 50 + c * 20, 255]);
        // Small detached accessory within merge_gap_px (8x8 floating 4px to the right)
        drawRect(data, w, h, baseX + 42, baseY + 10, 8, 8, [220, 200, 80, 255]);
      }
    }

    const cells = ['idle', 'run_1', 'run_2', 'attack', 'skill', 'ultimate', 'hit', 'ko'];
    const sliced = sliceSheet(
      data,
      w,
      h,
      {
        mode: 'grid',
        cols: 4,
        rows: 2,
        cells,
        merge_gap_px: 10
      },
      [1, 0, 2, 3, 4, 5, 6, 7]
    );

    expect(sliced.warnings).toHaveLength(0);
    expect(sliced.boxes).toHaveLength(8);
    // Because cellOrder swapped 0 and 1, box 0 has name 'run_1' and box 1 has name 'idle'
    expect(sliced.boxes[0]?.name).toBe('run_1');
    expect(sliced.boxes[1]?.name).toBe('idle');
    // Detached accessory was merged into box width (40 + 2 + 8 = 50)
    expect(sliced.boxes[0]?.w).toBe(50);

    const measured = await trimAndMeasureFrame(data, w, h, sliced.boxes[1]!, 'lower_body_centroid');
    expect(measured.footY).toBeGreaterThanOrEqual(0.9);
    expect(measured.footY).toBeLessThanOrEqual(1.0);
    expect(measured.pivotX).toBeGreaterThan(0.35);
    expect(measured.pivotX).toBeLessThan(0.65);
  });

  it('supports explicit regions fallback and rejects out-of-bounds regions', () => {
    const w = 120;
    const h = 120;
    const data = Buffer.alloc(w * h * 4);
    drawRect(data, w, h, 10, 10, 80, 80, [200, 100, 90, 255]);

    const sliced = sliceSheet(data, w, h, {
      mode: 'regions',
      cells: {
        idle: [10, 10, 40, 60],
        attack: [55, 10, 35, 60]
      }
    });
    expect(sliced.boxes).toHaveLength(2);
    expect(sliced.boxes[0]?.name).toBe('idle');
    expect(sliced.boxes[1]?.name).toBe('attack');

    expect(() =>
      sliceSheet(data, w, h, {
        mode: 'regions',
        cells: { bad: [80, 80, 60, 60] }
      })
    ).toThrow(/exceeds image bounds/);
  });
});

describe('ingest_art pipeline, provenance, and A31 reference hygiene (R14-B)', () => {
  const tempDirs: string[] = [];

  function makeRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), 'uomd-ingest-test-'));
    tempDirs.push(dir);
    mkdirSync(join(dir, 'reference/char'), { recursive: true });
    mkdirSync(join(dir, 'content/specs/image'), { recursive: true });
    mkdirSync(join(dir, '.cache/generated/unit_test_hero_chibi_sheet'), { recursive: true });
    return dir;
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  async function writeChromaSheetPng(outPath: string): Promise<string> {
    const w = 1280;
    const h = 720;
    const data = Buffer.alloc(w * h * 4);
    // Fill with chroma green (#00FF00)
    for (let i = 0; i < w * h * 4; i += 4) {
      data[i] = 0;
      data[i + 1] = 255;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    const cols = 4;
    const rows = 2;
    const cellW = 320;
    const cellH = 360;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = c * cellW + 80;
        const by = r * cellH + 40;
        drawRect(data, w, h, bx, by, 140, 260, [140, 50 + r * 20, 90 + c * 15, 255]);
      }
    }
    const pngBuf = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    writeFileSync(outPath, pngBuf);
    return createHash('sha256').update(pngBuf).digest('hex');
  }

  it('runs preview without promoting, executes atomic promotion, short-circuits unchanged specs, and records revision history', async () => {
    const repo = makeRepo();
    const sheetRel = '.cache/generated/unit_test_hero_chibi_sheet/sheet.png';
    const provRel = '.cache/generated/unit_test_hero_chibi_sheet/run.provenance.json';
    const refRel = 'reference/char/test_ref.png';

    const sourceSha = await writeChromaSheetPng(join(repo, sheetRel));
    const refBuf = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 90, g: 40, b: 60, alpha: 1 } }
    })
      .png()
      .toBuffer();
    writeFileSync(join(repo, refRel), refBuf);
    const refSha = createHash('sha256').update(refBuf).digest('hex');

    writeFileSync(
      join(repo, provRel),
      JSON.stringify({
        spec: { id: 'unit_test_hero_chibi_sheet', prompt: 'Gothic anime chibi sheet', aspectRatio: '16:9' },
        model: 'gemini-3.1-flash-image-preview',
        references: [{ path: refRel, sha256: refSha }],
        outputs: [{ file: sheetRel, sha256: sourceSha }],
        settled_usd: 0.04
      })
    );

    const specRel = 'content/specs/image/unit_test_hero_chibi_sheet.ingest.json';
    const spec: IngestSpec = initIngestSpec('content/specs/image/unit_test_hero_chibi_sheet.json', 'unit_sheet');
    spec.source = {
      kind: 'generated',
      pick: sourceSha.slice(0, 12),
      provenance: provRel
    };
    spec.manifest = { unit: 'test_hero', atlas: 'atlas_test_hero', facing: 'right', height_px: 180 };
    spec.frames = {
      idle: 'idle',
      idle_frame_px: 200,
      pivot: 'lower_body_centroid'
    };
    writeFileSync(join(repo, specRel), `${JSON.stringify(spec, null, 2)}\n`);

    // 1. Preview mode writes review.png & qc.json but does not promote
    const previewRes = await runIngest({ rootDir: repo, ingestSpecPath: specRel, execute: false });
    expect(previewRes.status).toBe('preview');
    expect(existsSync(join(previewRes.previewDir, 'review.png'))).toBe(true);
    expect(existsSync(join(previewRes.previewDir, 'qc.json'))).toBe(true);
    expect(existsSync(join(repo, 'content/approved_art/entries/unit_test_hero_chibi_sheet.json'))).toBe(false);

    // 2. Execute mode promotes atomically with human status 'pending'
    const execRes1 = await runIngest({ rootDir: repo, ingestSpecPath: specRel, execute: true });
    expect(execRes1.status).toBe('executed');
    expect(execRes1.entry.revision).toBe(1);
    expect(execRes1.entry.qc.human.status).toBe('pending');
    expect(Object.keys(execRes1.entry.targets.atlases?.atlas_test_hero?.frames ?? {})).toHaveLength(8);

    // 3. Re-running identical spec short-circuits with 'unchanged'
    const execRes2 = await runIngest({ rootDir: repo, ingestSpecPath: specRel, execute: true });
    expect(execRes2.status).toBe('unchanged');

    // 4. Modifying spec increments revision and pushes previous output to history[]
    spec.export.webp = { mode: 'lossy', quality: 88, alpha_quality: 95, effort: 4 };
    writeFileSync(join(repo, specRel), `${JSON.stringify(spec, null, 2)}\n`);
    const execRes3 = await runIngest({ rootDir: repo, ingestSpecPath: specRel, execute: true });
    expect(execRes3.status).toBe('executed');
    expect(execRes3.entry.revision).toBe(2);
    expect(execRes3.entry.history).toHaveLength(1);
    expect(execRes3.entry.history[0]?.revision).toBe(1);

    // 5. Approve and verify
    const approved = approveArtEntry(repo, 'unit_test_hero_chibi_sheet', 'art-lead', 'Clean silhouette and baseline');
    expect(approved.qc.human.status).toBe('approved');
    const verifyOk = await verifyApprovedArt(repo, { requireApproved: true, strictArt: true });
    expect(verifyOk.ok).toBe(true);
    expect(loadApprovedArtEntries(repo, true)).toHaveLength(1);

    const report = reportApprovedArt(repo);
    expect(report.totalEntries).toBe(1);
    expect(report.approvedEntries).toBe(1);

    // 6. Reject transitions status to rejected and fails requireApproved verification
    rejectArtEntry(repo, 'unit_test_hero_chibi_sheet', 'Needs weapon touch-up');
    const verifyRejected = await verifyApprovedArt(repo, { requireApproved: true });
    expect(verifyRejected.ok).toBe(false);
  });

  it('enforces A31 reference hygiene against unauthorized directories and legacy git: hashes', () => {
    const repo = makeRepo();
    mkdirSync(join(repo, 'tmp_untrusted'), { recursive: true });
    const badRef = 'tmp_untrusted/leak.png';
    const buf = Buffer.from('test-reference-bytes');
    writeFileSync(join(repo, badRef), buf);
    const sha = createHash('sha256').update(buf).digest('hex');

    const checkOutside = checkReferenceHygiene(repo, [{ path: badRef, sha256: sha }]);
    expect(checkOutside.passed).toBe(false);
    expect(checkOutside.reason).toContain('outside allowed reference directories');

    // Allowed directory but hash matches a legacy git: source in content/provenance.json
    const allowedRef = 'reference/char/legacy_clone.png';
    writeFileSync(join(repo, allowedRef), buf);
    writeFileSync(
      join(repo, 'content/provenance.json'),
      JSON.stringify({
        outputs: [
          {
            output: 'content/base/art/mahmut.webp',
            sha256: '000',
            sources: { 'git:a2e4fb971802:game/assets/mahmut.png': sha }
          }
        ]
      })
    );

    const checkLegacyHash = checkReferenceHygiene(repo, [{ path: allowedRef, sha256: sha }]);
    expect(checkLegacyHash.passed).toBe(false);
    expect(checkLegacyHash.reason).toContain('matches a legacy git-derived asset hash');
  });

  it('initializes and ingests a banner class spec into targets.ui (§4.4)', async () => {
    const repo = makeRepo();
    mkdirSync(join(repo, 'narrative/15_Art_Workbench/banners'), { recursive: true });
    const bannerRel = 'narrative/15_Art_Workbench/banners/banner_oath_test_v001.jpg';
    const bannerBuf = await sharp({
      create: { width: 1376, height: 768, channels: 3, background: { r: 28, g: 18, b: 42 } }
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    writeFileSync(join(repo, bannerRel), bannerBuf);
    const sha = createHash('sha256').update(bannerBuf).digest('hex');

    const spec = initIngestSpec('content/specs/image/banner_oath_test.json', 'banner');
    expect(spec.class).toBe('banner');
    expect(spec.manifest.ui).toBe('banner_oath_test');
    spec.source = { kind: 'locked', file: bannerRel, sha256: sha };
    const specRel = 'content/specs/image/banner_oath_test.ingest.json';
    writeFileSync(join(repo, specRel), `${JSON.stringify(spec, null, 2)}\n`);

    const res = await runIngest({ rootDir: repo, ingestSpecPath: specRel, execute: true });
    expect(res.status).toBe('executed');
    expect(res.entry.class).toBe('banner');
    expect(res.entry.targets.ui).toEqual({ banner_oath_test: 'art/ui_banner_oath_test.webp' });
  });
});
