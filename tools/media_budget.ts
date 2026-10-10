/**
 * Spending guard CLI for paid Google media generation (see packages/shared/src/budget.ts).
 *   npx tsx tools/media_budget.ts status
 *   npx tsx tools/media_budget.ts reserve --label "<what>" --model <model> --usd <estimate>   -> prints the entry id
 *   npx tsx tools/media_budget.ts settle --id <n> --usd <actual>
 *   npx tsx tools/media_budget.ts cancel --id <n>
 * Every generation script must call `reserve` (exit code 0) BEFORE the paid API call. The approved total is
 * raised only by the owner, through a reviewed change of content/budget/media_budget.json (approved_by/at).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { cancel, committedUsd, remainingUsd, reserve, settle, BudgetError, type MediaBudget } from '@uomd/shared';

const FILE = new URL('../content/budget/media_budget.json', import.meta.url).pathname;
const [cmd = 'status', ...rest] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const load = (): MediaBudget => JSON.parse(readFileSync(FILE, 'utf8')) as MediaBudget;
const save = (b: MediaBudget): void => writeFileSync(FILE, `${JSON.stringify(b, null, 2)}\n`);

try {
  const b = load();
  if (cmd === 'status') {
    console.log(JSON.stringify({ approved_usd: b.approved_usd, committed_usd: committedUsd(b), remaining_usd: remainingUsd(b), per_batch_cap_usd: b.per_batch_cap_usd, approved_by: b.approved_by, open_reservations: b.entries.filter((e) => e.status === 'reserved').length }, null, 2));
  } else if (cmd === 'reserve') {
    const out = reserve(b, { label: flag('label') ?? '', model: flag('model') ?? '', estimateUsd: Number(flag('usd')), now: new Date().toISOString() });
    save(out.budget);
    console.log(out.index);
  } else if (cmd === 'settle') {
    save(settle(b, Number(flag('id')), Number(flag('usd'))));
  } else if (cmd === 'cancel') {
    save(cancel(b, Number(flag('id'))));
  } else {
    throw new Error(`unknown command ${cmd}`);
  }
} catch (e) {
  console.error(e instanceof BudgetError ? `BLOCKED (${e.code}): ${e.message}` : String(e));
  process.exit(1);
}
