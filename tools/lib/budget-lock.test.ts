import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { attemptsFor, committedUsd, emptyBudget, reserve, type ImageSpec, type MediaBudget } from '@uomd/shared';
import { executeImageSpec } from '../gen_image';
import { readBudget, updateBudget, writeBudget } from './budget_lock';

const makeApproved = (): MediaBudget => ({
  ...emptyBudget(),
  period: 'monthly',
  approved_usd: 20,
  per_batch_cap_usd: 3,
  max_attempts_per_asset: 3,
  approved_by: 'owner',
  approved_at: '2026-10-14T00:00:00Z'
});

const SAMPLE_SPEC: ImageSpec = {
  id: 'fadyme_vn_composed',
  model: 'gemini-3.1-flash-image',
  size: '2K',
  aspectRatio: '2:3',
  prompt:
    'Deliverable: one painterly dark gothic anime light-novel visual-novel bust of Fadyme, aged 22, pale ash-blonde hair, violet eyes, deep plum hood raised with broken silver crown clasp.',
  references: [],
  count: 2
};

describe('R14-A cross-process budget lock and per-call execution provenance', () => {
  it('serializes concurrent updateBudget calls without lost reservations and recovers stale lockfiles', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'uomd-budget-lock-'));
    try {
      const file = join(dir, 'media_budget.json');
      writeBudget(file, makeApproved());

      // Simulate a stale lockfile left behind 5 minutes ago by a crashed process
      const lockFile = `${file}.lock`;
      writeFileSync(lockFile, JSON.stringify({ pid: 999999, at: '2026-10-14T00:00:00Z' }));
      const past = new Date(Date.now() - 300_000);
      utimesSync(lockFile, past, past);

      // Run 6 concurrent reservations against the same file
      const indices = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          updateBudget(
            file,
            async (b) => {
              await new Promise((r) => setTimeout(r, 5));
              const res = reserve(b, {
                label: `concurrent_${i}`,
                model: 'gemini-3.1-flash-image',
                estimateUsd: 0.101,
                now: '2026-10-15T00:00:00Z',
                asset: `asset_${i}`
              });
              return { budget: res.budget, value: res.index };
            },
            { staleMs: 60_000, retryMs: 5 }
          )
        )
      );

      expect(new Set(indices).size).toBe(6);
      const after = readBudget(file);
      expect(after.entries).toHaveLength(6);
      expect(existsSync(lockFile)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records partial output provenance, settles successful calls, marks failed calls, and cancels unsent calls', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'uomd-gen-image-'));
    try {
      const budgetFile = join(dir, 'media_budget.json');
      const outRoot = join(dir, 'generated');
      writeBudget(budgetFile, makeApproved());

      // Call 1 succeeds, Call 2 fails with HTTP 504 timeout
      let callCount = 0;
      const fakeFetch: typeof fetch = async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('PNG1').toString('base64') } }] } }],
              usageMetadata: { totalTokenCount: 500 }
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }
        return new Response('gateway timeout', { status: 504 });
      };

      const spec3: ImageSpec = { ...SAMPLE_SPEC, count: 3 };
      const res = await executeImageSpec({
        spec: spec3,
        refs: [],
        budgetFile,
        outRoot,
        nowIso: '2026-10-15T01:00:00.000Z',
        fetchFn: fakeFetch
      });

      expect(res.status).toBe('partial');
      expect(res.saved).toHaveLength(1);
      expect(existsSync(res.provenanceFile)).toBe(true);

      const prov = JSON.parse(readFileSync(res.provenanceFile, 'utf8')) as {
        status: string;
        outputs: unknown[];
        ledger_indices: number[];
        error: string;
      };
      expect(prov.status).toBe('partial');
      expect(prov.outputs).toHaveLength(1);
      expect(prov.ledger_indices).toEqual([0, 1, 2]);
      expect(prov.error).toContain('HTTP 504');

      const ledger = readBudget(budgetFile);
      expect(ledger.entries.map((e) => e.status)).toEqual(['settled', 'failed', 'cancelled']);
      // 2 attempts were actually sent (1 settled + 1 failed); the 3rd was cancelled before sending
      expect(attemptsFor(ledger, spec3.id)).toBe(2);
      // Both the settled call ($0.101) and the failed uncertain call ($0.101) remain committed
      expect(committedUsd(ledger, '2026-10-15T01:00:00.000Z')).toBeCloseTo(0.202, 6);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
