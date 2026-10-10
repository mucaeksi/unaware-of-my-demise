/**
 * Spending guard for paid Google media generation (images, Lyria, Veo, Chirp). Nothing may call a paid
 * model unless a reservation succeeded first; the default budget is ZERO and only the owner can raise it
 * (a reviewed change to content/budget/media_budget.json). Pure functions: callers persist the result.
 */
export interface BudgetEntry {
  at: string;
  label: string;
  model: string;
  estimate_usd: number;
  status: 'reserved' | 'settled' | 'cancelled';
  actual_usd?: number;
}

export interface MediaBudget {
  schema_version: 1;
  currency: 'USD';
  /** Total the owner has approved for all media generation. 0 = nothing may be spent. */
  approved_usd: number;
  /** Largest single reservation allowed (protects against a runaway batch). */
  per_batch_cap_usd: number;
  approved_by: string | null;
  approved_at: string | null;
  entries: BudgetEntry[];
}

export class BudgetError extends Error {
  constructor(readonly code: 'not_approved' | 'invalid_estimate' | 'batch_cap' | 'over_budget' | 'bad_entry', message: string) {
    super(message);
  }
}

export const emptyBudget = (): MediaBudget => ({ schema_version: 1, currency: 'USD', approved_usd: 0, per_batch_cap_usd: 0, approved_by: null, approved_at: null, entries: [] });

/** Money already spent or promised: actuals for settled entries, estimates for open reservations. */
export function committedUsd(b: MediaBudget): number {
  return b.entries.reduce((sum, e) => sum + (e.status === 'settled' ? (e.actual_usd ?? e.estimate_usd) : e.status === 'reserved' ? e.estimate_usd : 0), 0);
}

export const remainingUsd = (b: MediaBudget): number => Math.max(0, b.approved_usd - committedUsd(b));

export function reserve(b: MediaBudget, req: { label: string; model: string; estimateUsd: number; now: string }): { budget: MediaBudget; index: number } {
  if (!b.approved_by || !b.approved_at || b.approved_usd <= 0) throw new BudgetError('not_approved', 'no approved media budget: the owner must approve one in content/budget/media_budget.json');
  if (!Number.isFinite(req.estimateUsd) || req.estimateUsd <= 0) throw new BudgetError('invalid_estimate', 'estimate must be a positive number of USD');
  if (req.estimateUsd > b.per_batch_cap_usd) throw new BudgetError('batch_cap', `estimate $${req.estimateUsd} exceeds the per-batch cap $${b.per_batch_cap_usd}`);
  // compare in integer micro-dollars so repeated small reservations cannot slip past the cap through float error
  const micro = (n: number): number => Math.round(n * 1_000_000);
  if (micro(committedUsd(b)) + micro(req.estimateUsd) > micro(b.approved_usd)) throw new BudgetError('over_budget', `would exceed the approved budget (remaining $${remainingUsd(b).toFixed(2)})`);
  const entry: BudgetEntry = { at: req.now, label: req.label.slice(0, 120), model: req.model.slice(0, 80), estimate_usd: req.estimateUsd, status: 'reserved' };
  return { budget: { ...b, entries: [...b.entries, entry] }, index: b.entries.length };
}

function replaceAt(b: MediaBudget, index: number, patch: (e: BudgetEntry) => BudgetEntry): MediaBudget {
  const e = b.entries[index];
  if (!e || e.status !== 'reserved') throw new BudgetError('bad_entry', `entry ${index} is not an open reservation`);
  return { ...b, entries: b.entries.map((x, i) => (i === index ? patch(x) : x)) };
}

/** Record the real cost. The actual may exceed the estimate, but never silently: it is stored and counts against the budget. */
export function settle(b: MediaBudget, index: number, actualUsd: number): MediaBudget {
  if (!Number.isFinite(actualUsd) || actualUsd < 0) throw new BudgetError('invalid_estimate', 'actual cost must be a non-negative number');
  return replaceAt(b, index, (e) => ({ ...e, status: 'settled', actual_usd: actualUsd }));
}

export const cancel = (b: MediaBudget, index: number): MediaBudget => replaceAt(b, index, (e) => ({ ...e, status: 'cancelled' }));
