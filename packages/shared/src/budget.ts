/**
 * Spending guard for paid Google media generation (images, Lyria, Veo, Chirp). Nothing may call a paid
 * model unless a reservation succeeded first; the default budget is ZERO and only the owner can raise it
 * (a reviewed change to content/budget/media_budget.json). Pure functions: callers persist the result.
 */
export interface BudgetEntry {
  at: string;
  label: string;
  /** asset being produced (e.g. "fadyme_portrait_composed"); used for the retry cap */
  asset?: string;
  model: string;
  estimate_usd: number;
  /**
   * reserved: call about to be / being made · settled: call returned, actual recorded · failed: call was SENT and then
   * errored, timed out or was aborted (it may have been billed, so it consumes an attempt and stays committed until reconciled) ·
   * cancelled: released before the call was sent (consumes nothing)
   */
  status: 'reserved' | 'settled' | 'failed' | 'cancelled';
  actual_usd?: number;
  /** short failure reason for failed entries */
  reason?: string;
  /** optional SHA-256 of the prompt text so retries after failure can verify whether the prompt was changed */
  prompt_sha256?: string;
}

export interface MediaBudget {
  schema_version: 1;
  currency: 'USD';
  /** Amount the owner has approved PER CALENDAR MONTH (UTC) when period is "monthly", else in total. 0 = nothing may be spent. */
  approved_usd: number;
  period?: 'monthly' | 'total';
  /** Owner's limit in Turkish lira (informational; the guard counts USD with a conservative rate, see approved_note). */
  approved_try?: number;
  approved_note?: string;
  /** Paid attempts allowed per asset before the tool refuses and asks for a NEW prompt (default 3). Every sent call is one attempt. */
  max_attempts_per_asset?: number;
  /** Largest single reservation allowed (protects against a runaway batch). */
  per_batch_cap_usd: number;
  approved_by: string | null;
  approved_at: string | null;
  entries: BudgetEntry[];
}

export class BudgetError extends Error {
  constructor(
    readonly code: 'not_approved' | 'invalid_estimate' | 'batch_cap' | 'over_budget' | 'bad_entry' | 'attempt_cap' | 'unchanged_failed_prompt',
    message: string
  ) {
    super(message);
  }
}

export const emptyBudget = (): MediaBudget => ({ schema_version: 1, currency: 'USD', approved_usd: 0, per_batch_cap_usd: 0, approved_by: null, approved_at: null, entries: [] });

/** Money already spent or promised: actuals for settled/failed entries (failed without a known actual counts its estimate), estimates for open reservations. */
export function committedUsd(b: MediaBudget, now?: string): number {
  const month = b.period === 'monthly' && now ? now.slice(0, 7) : undefined;
  return b.entries
    .filter((e) => month === undefined || e.at.slice(0, 7) === month)
    .reduce((sum, e) => sum + (e.status === 'settled' || e.status === 'failed' ? (e.actual_usd ?? e.estimate_usd) : e.status === 'reserved' ? e.estimate_usd : 0), 0);
}

export const remainingUsd = (b: MediaBudget, now?: string): number => Math.max(0, b.approved_usd - committedUsd(b, now));

/** Paid attempts (open, settled or failed; not cancelled) already made for an asset. */
export const attemptsFor = (b: MediaBudget, asset: string): number => b.entries.filter((e) => e.asset === asset && e.status !== 'cancelled').length;

/** Attempts still available for an asset under its cap. */
export const attemptsLeft = (b: MediaBudget, asset: string): number => Math.max(0, (b.max_attempts_per_asset ?? 3) - attemptsFor(b, asset));

export function reserve(
  b: MediaBudget,
  req: { label: string; model: string; estimateUsd: number; now: string; asset?: string; promptSha256?: string }
): { budget: MediaBudget; index: number } {
  if (!b.approved_by || !b.approved_at || b.approved_usd <= 0) throw new BudgetError('not_approved', 'no approved media budget: the owner must approve one in content/budget/media_budget.json');
  if (!Number.isFinite(req.estimateUsd) || req.estimateUsd <= 0) throw new BudgetError('invalid_estimate', 'estimate must be a positive number of USD');
  if (req.estimateUsd > b.per_batch_cap_usd) throw new BudgetError('batch_cap', `estimate $${req.estimateUsd} exceeds the per-batch cap $${b.per_batch_cap_usd}`);
  // compare in integer micro-dollars so repeated small reservations cannot slip past the cap through float error
  const micro = (n: number): number => Math.round(n * 1_000_000);
  if (micro(committedUsd(b, req.now)) + micro(req.estimateUsd) > micro(b.approved_usd)) throw new BudgetError('over_budget', `would exceed the approved ${b.period === 'monthly' ? 'monthly ' : ''}budget (remaining $${remainingUsd(b, req.now).toFixed(2)})`);
  const cap = b.max_attempts_per_asset ?? 3;
  if (req.asset) {
    const used = attemptsFor(b, req.asset);
    if (used >= cap) {
      const priorPrompts = new Set(
        b.entries.filter((e) => e.asset === req.asset && e.status !== 'cancelled' && e.prompt_sha256).map((e) => e.prompt_sha256)
      );
      if (req.promptSha256 && priorPrompts.has(req.promptSha256)) {
        throw new BudgetError('unchanged_failed_prompt', `${req.asset} reached ${cap} attempts with the same prompt; change the prompt/references before requesting more attempts`);
      }
      throw new BudgetError('attempt_cap', `${req.asset} already used ${cap} paid attempts; change the prompt/references (and ask the owner) instead of retrying`);
    }
  }
  const entry: BudgetEntry = {
    at: req.now,
    label: req.label.slice(0, 120),
    ...(req.asset ? { asset: req.asset } : {}),
    ...(req.promptSha256 ? { prompt_sha256: req.promptSha256 } : {}),
    model: req.model.slice(0, 80),
    estimate_usd: req.estimateUsd,
    status: 'reserved'
  };
  return { budget: { ...b, entries: [...b.entries, entry] }, index: b.entries.length };
}

/**
 * Reserves `count` separate per-call entries for a multi-call batch (`count >= 1`).
 * Enforces the batch cap on `unitEstimateUsd * count` and ensures each call consumes its own attempt and ledger slot.
 */
export function reserveBatch(
  b: MediaBudget,
  req: { label: string; model: string; unitEstimateUsd: number; count: number; now: string; asset?: string; promptSha256?: string }
): { budget: MediaBudget; indices: number[] } {
  if (!Number.isInteger(req.count) || req.count < 1) throw new BudgetError('invalid_estimate', 'count must be a positive integer');
  if (!Number.isFinite(req.unitEstimateUsd) || req.unitEstimateUsd <= 0) throw new BudgetError('invalid_estimate', 'unitEstimateUsd must be a positive number of USD');
  const totalEstimate = Math.round(req.unitEstimateUsd * req.count * 1_000_000) / 1_000_000;
  if (totalEstimate > b.per_batch_cap_usd) {
    throw new BudgetError('batch_cap', `batch estimate $${totalEstimate} (${req.count} calls) exceeds the per-batch cap $${b.per_batch_cap_usd}`);
  }
  let current = b;
  const indices: number[] = [];
  for (let i = 0; i < req.count; i++) {
    const subLabel = req.count > 1 ? `${req.label} [${i + 1}/${req.count}]` : req.label;
    const res = reserve(current, {
      label: subLabel,
      model: req.model,
      estimateUsd: req.unitEstimateUsd,
      now: req.now,
      ...(req.asset ? { asset: req.asset } : {}),
      ...(req.promptSha256 ? { promptSha256: req.promptSha256 } : {})
    });
    current = res.budget;
    indices.push(res.index);
  }
  return { budget: current, indices };
}

function replaceAt(b: MediaBudget, index: number, patch: (e: BudgetEntry) => BudgetEntry, allowFailed = false): MediaBudget {
  const e = b.entries[index];
  if (!e || (e.status !== 'reserved' && !(allowFailed && e.status === 'failed'))) {
    throw new BudgetError('bad_entry', `entry ${index} is not an open${allowFailed ? ' or failed' : ''} reservation`);
  }
  return { ...b, entries: b.entries.map((x, i) => (i === index ? patch(x) : x)) };
}

/** Record the real cost. The actual may exceed the estimate, but never silently: it is stored and counts against the budget. */
export function settle(b: MediaBudget, index: number, actualUsd: number): MediaBudget {
  if (!Number.isFinite(actualUsd) || actualUsd < 0) throw new BudgetError('invalid_estimate', 'actual cost must be a non-negative number');
  return replaceAt(b, index, (e) => ({ ...e, status: 'settled', actual_usd: actualUsd }));
}

/**
 * A sent call that errored, timed out or was aborted. It keeps its attempt and stays committed at the estimate, because a
 * provider may bill a call whose response never arrived; pass `actualUsd` only when the real charge is known.
 */
export function fail(b: MediaBudget, index: number, reason: string, actualUsd?: number): MediaBudget {
  if (actualUsd !== undefined && (!Number.isFinite(actualUsd) || actualUsd < 0)) throw new BudgetError('invalid_estimate', 'actual cost must be a non-negative number');
  return replaceAt(b, index, (e) => ({ ...e, status: 'failed', reason: reason.slice(0, 200), ...(actualUsd !== undefined ? { actual_usd: actualUsd } : {}) }));
}

/** Reconcile an uncertain (`failed` or `reserved`) entry once the provider billing statement confirms the exact charge (including $0). */
export function reconcile(b: MediaBudget, index: number, actualUsd: number): MediaBudget {
  if (!Number.isFinite(actualUsd) || actualUsd < 0) throw new BudgetError('invalid_estimate', 'actual cost must be a non-negative number');
  return replaceAt(b, index, (e) => ({ ...e, status: 'settled', actual_usd: actualUsd }), true);
}

/** Release a reservation whose call was NEVER sent (consumes no attempt and no money). */
export const cancel = (b: MediaBudget, index: number): MediaBudget => replaceAt(b, index, (e) => ({ ...e, status: 'cancelled' }));

