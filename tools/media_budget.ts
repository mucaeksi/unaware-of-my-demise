/**
 * Spending guard CLI for paid Google media generation (see packages/shared/src/budget.ts).
 *   npx tsx tools/media_budget.ts status
 *   npx tsx tools/media_budget.ts reserve --label "<what>" --model <model> --usd <estimate>   -> prints the entry id
 *   npx tsx tools/media_budget.ts settle --id <n> --usd <actual>
 *   npx tsx tools/media_budget.ts fail --id <n> --reason "<why>" [--usd <actual>]
 *   npx tsx tools/media_budget.ts reconcile --id <n> --usd <actual>
 *   npx tsx tools/media_budget.ts cancel --id <n>
 * Every generation script must call `reserve` (exit code 0) BEFORE the paid API call. The approved total is
 * raised only by the owner, through a reviewed change of content/budget/media_budget.json (approved_by/at).
 */
import { fileURLToPath } from 'node:url';
import { cancel, committedUsd, fail, reconcile, remainingUsd, reserve, settle, BudgetError } from '@uomd/shared';
import { readBudget, updateBudget } from './lib/budget_lock';

const FILE = fileURLToPath(new URL('../content/budget/media_budget.json', import.meta.url));
const [cmd = 'status', ...rest] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};

async function run(): Promise<void> {
  if (cmd === 'status') {
    const b = readBudget(FILE);
    const now = new Date().toISOString();
    console.log(
      JSON.stringify(
        {
          approved_usd: b.approved_usd,
          committed_usd: committedUsd(b, now),
          remaining_usd: remainingUsd(b, now),
          period: b.period ?? 'total',
          per_batch_cap_usd: b.per_batch_cap_usd,
          approved_by: b.approved_by,
          open_reservations: b.entries.filter((e) => e.status === 'reserved').length,
          failed_uncertain: b.entries.filter((e) => e.status === 'failed' && e.actual_usd === undefined).length
        },
        null,
        2
      )
    );
  } else if (cmd === 'reserve') {
    const id = await updateBudget(FILE, (b) => {
      const out = reserve(b, {
        label: flag('label') ?? '',
        model: flag('model') ?? '',
        estimateUsd: Number(flag('usd')),
        asset: flag('asset'),
        promptSha256: flag('prompt-sha256'),
        now: new Date().toISOString()
      });
      return { budget: out.budget, value: out.index };
    });
    console.log(id);
  } else if (cmd === 'settle') {
    await updateBudget(FILE, (b) => ({ budget: settle(b, Number(flag('id')), Number(flag('usd'))), value: undefined }));
  } else if (cmd === 'fail') {
    const usdArg = flag('usd');
    await updateBudget(FILE, (b) => ({
      budget: fail(b, Number(flag('id')), flag('reason') ?? 'call_failed', usdArg !== undefined ? Number(usdArg) : undefined),
      value: undefined
    }));
  } else if (cmd === 'reconcile') {
    await updateBudget(FILE, (b) => ({ budget: reconcile(b, Number(flag('id')), Number(flag('usd'))), value: undefined }));
  } else if (cmd === 'cancel') {
    await updateBudget(FILE, (b) => ({ budget: cancel(b, Number(flag('id'))), value: undefined }));
  } else {
    throw new Error(`unknown command ${cmd}`);
  }
}

run().catch((e: unknown) => {
  console.error(e instanceof BudgetError ? `BLOCKED (${e.code}): ${e.message}` : String(e));
  process.exit(1);
});

