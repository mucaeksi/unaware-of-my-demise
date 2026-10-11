import { describe, expect, it } from 'vitest';
import { BudgetError, cancel, committedUsd, emptyBudget, remainingUsd, reserve, settle, type MediaBudget } from './budget';

const approved = (over: Partial<MediaBudget> = {}): MediaBudget => ({ ...emptyBudget(), approved_usd: 20, per_batch_cap_usd: 8, approved_by: 'owner', approved_at: '2026-10-10T00:00:00Z', ...over });
const ask = (b: MediaBudget, usd: number) => reserve(b, { label: 'fadyme portrait batch', model: 'image', estimateUsd: usd, now: '2026-10-10T01:00:00Z' });
const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return e instanceof BudgetError ? e.code : 'other';
  }
  return undefined;
};

describe('media generation spending guard', () => {
  it('spends nothing by default: the empty budget refuses every reservation', () => {
    expect(code(() => ask(emptyBudget(), 0.01))).toBe('not_approved');
  });

  it('refuses when approval metadata is missing even if a number is present', () => {
    expect(code(() => ask(approved({ approved_by: null }), 1))).toBe('not_approved');
    expect(code(() => ask(approved({ approved_at: null }), 1))).toBe('not_approved');
  });

  it('enforces the per-batch cap and rejects non-positive or non-finite estimates', () => {
    expect(code(() => ask(approved(), 8.01))).toBe('batch_cap');
    expect(code(() => ask(approved(), 0))).toBe('invalid_estimate');
    expect(code(() => ask(approved(), Number.NaN))).toBe('invalid_estimate');
    expect(ask(approved(), 8).index).toBe(0);
  });

  it('counts open reservations against the total and never exceeds it', () => {
    let b = approved();
    b = ask(b, 8).budget;
    b = ask(b, 8).budget;
    expect(remainingUsd(b)).toBe(4);
    expect(code(() => ask(b, 4.01))).toBe('over_budget');
    expect(ask(b, 4).budget.entries).toHaveLength(3);
    expect(b.entries).toHaveLength(2); // inputs are never mutated
  });

  it('many tiny reservations cannot slip past the cap through floating point error', () => {
    let b = approved({ approved_usd: 1, per_batch_cap_usd: 1 });
    for (let i = 0; i < 10; i++) b = ask(b, 0.1).budget;
    expect(code(() => ask(b, 0.000001))).toBe('over_budget');
  });

  it('settles at the real cost (an overrun is recorded and shrinks what is left) and cancel releases the money', () => {
    let b = approved();
    const first = ask(b, 6);
    b = settle(first.budget, first.index, 7.5);
    expect(committedUsd(b)).toBe(7.5);
    const second = ask(b, 5);
    b = cancel(second.budget, second.index);
    expect(committedUsd(b)).toBe(7.5);
    expect(remainingUsd(b)).toBe(12.5);
    expect(code(() => settle(b, 0, 1))).toBe('bad_entry'); // already settled
    expect(code(() => cancel(b, 9))).toBe('bad_entry');
  });
});

describe('monthly limit and per-asset attempt cap', () => {
  const monthly = (over: Partial<MediaBudget> = {}): MediaBudget => approved({ period: 'monthly', approved_usd: 20, per_batch_cap_usd: 3, max_attempts_per_asset: 3, ...over });
  const at = (b: MediaBudget, usd: number, now: string, asset?: string) => reserve(b, { label: 'x', model: 'image', estimateUsd: usd, now, ...(asset ? { asset } : {}) });

  it('resets the allowance on the first day of the next month but not within the month', () => {
    let b = monthly();
    for (let i = 0; i < 6; i++) b = at(b, 3, '2026-10-11T10:00:00Z').budget; // 18 of 20 used in October
    expect(code(() => at(b, 3, '2026-10-30T10:00:00Z'))).toBe('over_budget');
    expect(at(b, 3, '2026-11-01T00:00:01Z').budget.entries).toHaveLength(7);
  });

  it('stops after the allowed number of paid attempts for one asset, even with money left', () => {
    let b = monthly();
    for (let i = 0; i < 3; i++) b = at(b, 0.2, '2026-10-11T10:00:00Z', 'fadyme_portrait').budget;
    expect(code(() => at(b, 0.2, '2026-10-11T11:00:00Z', 'fadyme_portrait'))).toBe('attempt_cap');
    expect(at(b, 0.2, '2026-10-11T11:00:00Z', 'mahmut_portrait').index).toBe(3); // other assets are unaffected
  });

  it('a cancelled reservation does not count as an attempt', () => {
    let b = monthly({ max_attempts_per_asset: 1 });
    const r = at(b, 0.2, '2026-10-11T10:00:00Z', 'a');
    b = cancel(r.budget, r.index);
    expect(at(b, 0.2, '2026-10-11T10:05:00Z', 'a').index).toBe(1);
  });
});
