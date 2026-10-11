/**
 * Google (Gemini) image generation from a prompt spec, guarded by the media budget.
 *   npx tsx tools/gen_image.ts --spec art_specs/<set>/<id>.json            # DRY RUN (default): estimate + budget check, no call
 *   npx tsx tools/gen_image.ts --spec art_specs/<set>/<id>.json --execute  # reserve budget -> paid call -> save -> settle
 * A paid call is impossible unless content/budget/media_budget.json holds an owner-approved amount that covers the
 * estimate (see tools/media_budget.ts). Outputs go to .cache/generated/<id>/ (git-ignored) with a provenance JSON
 * (model, prompt, reference hashes, usage, costs); curation and publishing to R2 happen in a separate, reviewed step.
 * Auth: GEMINI_API_KEY (x-goog-api-key) when set; in the Claude cloud sandbox the proxy injects the credential.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { attemptsFor, BudgetError, buildImageRequest, cancel, estimateUsd, MediaError, parseImageResponse, priceOf, remainingUsd, reserve, settle, validateSpec, type ImageSpec, type InlineImage, type MediaBudget } from '@uomd/shared';

const ROOT = new URL('..', import.meta.url).pathname;
const BUDGET_FILE = join(ROOT, 'content/budget/media_budget.json');
const API = 'https://generativelanguage.googleapis.com';
const MIME: Record<string, string> = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const loadBudget = (): MediaBudget => JSON.parse(readFileSync(BUDGET_FILE, 'utf8')) as MediaBudget;
const saveBudget = (b: MediaBudget): void => writeFileSync(BUDGET_FILE, `${JSON.stringify(b, null, 2)}\n`);

async function main(): Promise<void> {
  const specPath = arg('spec');
  if (!specPath) throw new Error('usage: --spec <spec.json> [--execute]');
  const spec = JSON.parse(readFileSync(join(ROOT, specPath), 'utf8')) as ImageSpec;
  validateSpec(spec);
  const estimate = estimateUsd(spec);
  const budget = loadBudget();
  const refs = spec.references.map((r) => {
    const buf = readFileSync(join(ROOT, r.path));
    const mimeType = MIME[extname(r.path).toLowerCase()];
    if (!mimeType) throw new MediaError('bad_spec', `unsupported reference type: ${r.path}`);
    return { buf, inline: { mimeType, base64: buf.toString('base64') } satisfies InlineImage, sha256: sha(buf), path: r.path };
  });
  const request = buildImageRequest(spec, refs.map((r) => r.inline));

  if (!process.argv.includes('--execute')) {
    console.log(JSON.stringify({ mode: 'dry-run', id: spec.id, model: spec.model, size: spec.size, count: spec.count, unit_price_usd: priceOf(spec.model, spec.size), estimate_usd: estimate, budget: { approved_usd: budget.approved_usd, per_batch_cap_usd: budget.per_batch_cap_usd, remaining_usd: remainingUsd(budget, new Date().toISOString()), attempts_used_for_asset: attemptsFor(budget, spec.id), approved_by: budget.approved_by }, request_path: request.path, references: refs.map((r) => ({ path: r.path, sha256: r.sha256 })), prompt_preview: spec.prompt.slice(0, 160) }, null, 2));
    try {
      reserve(budget, { label: spec.id, model: spec.model, estimateUsd: estimate, asset: spec.id, now: new Date().toISOString() });
      console.log('budget check: a reservation WOULD succeed (nothing reserved, no call made)');
    } catch (e) {
      console.log(`budget check: BLOCKED (${e instanceof BudgetError ? e.code : 'error'}) — ${(e as Error).message}`);
    }
    return;
  }

  // paid path: reserve first, persist the reservation, then call
  const reserved = reserve(budget, { label: spec.id, model: spec.model, estimateUsd: estimate, asset: spec.id, now: new Date().toISOString() });
  saveBudget(reserved.budget);
  const outDir = join(ROOT, '.cache/generated', spec.id);
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const saved: { file: string; sha256: string }[] = [];
  let usage: unknown;
  try {
    for (let n = 0; n < spec.count; n++) {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (process.env.GEMINI_API_KEY) headers['x-goog-api-key'] = process.env.GEMINI_API_KEY;
      const res = await fetch(`${API}${request.path}`, { method: 'POST', headers, body: JSON.stringify(request.body), signal: AbortSignal.timeout(180_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const parsed = parseImageResponse(await res.json());
      usage = parsed.usage;
      for (const [i, img] of parsed.images.entries()) {
        const buf = Buffer.from(img.base64, 'base64');
        const file = join(outDir, `${stamp}-${n + 1}${parsed.images.length > 1 ? `-${i + 1}` : ''}.${img.mimeType === 'image/jpeg' ? 'jpg' : 'png'}`);
        writeFileSync(file, buf);
        saved.push({ file, sha256: sha(buf) });
      }
    }
  } catch (e) {
    // bill only what was actually produced; release the rest
    const actual = saved.length * priceOf(spec.model, spec.size);
    saveBudget(saved.length > 0 ? settle(loadBudget(), reserved.index, actual) : cancel(loadBudget(), reserved.index));
    console.error(`generation failed after ${saved.length}/${spec.count} images: ${(e as Error).message}`);
    process.exitCode = 1;
  }
  if (saved.length > 0 && process.exitCode !== 1) {
    const actual = Math.round(saved.length * priceOf(spec.model, spec.size) * 1e6) / 1e6;
    saveBudget(settle(loadBudget(), reserved.index, actual));
    writeFileSync(join(outDir, `${stamp}.provenance.json`), `${JSON.stringify({ spec, generated_at: new Date().toISOString(), model: spec.model, references: refs.map((r) => ({ path: r.path, sha256: r.sha256 })), outputs: saved, usage, estimated_usd: estimate, settled_usd: actual }, null, 2)}\n`);
    console.log(`${saved.length} image(s) saved in ${outDir}; settled $${actual}`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof BudgetError ? `BLOCKED (${e.code}): ${e.message}` : e instanceof MediaError ? `SPEC/RESPONSE (${e.code}): ${e.message}` : String(e));
  process.exit(1);
});
