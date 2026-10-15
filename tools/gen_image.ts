/**
 * Google (Gemini) image generation from a prompt spec, guarded by the media budget.
 *   npx tsx tools/gen_image.ts --spec art_specs/<set>/<id>.json            # DRY RUN (default): estimate + budget check, no call
 *   npx tsx tools/gen_image.ts --spec art_specs/<set>/<id>.json --execute  # reserve per-call budget -> paid call -> save -> settle/fail
 * A paid call is impossible unless content/budget/media_budget.json holds an owner-approved amount that covers the
 * estimate (see tools/media_budget.ts). Outputs go to .cache/generated/<id>/ (git-ignored) with a provenance JSON
 * (model, prompt, reference hashes, usage, costs); curation and publishing to R2 happen in a separate, reviewed step.
 * Auth: GEMINI_API_KEY (x-goog-api-key) when set; in the Claude cloud sandbox the proxy injects the credential.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  attemptsFor,
  attemptsLeft,
  BudgetError,
  buildImageRequest,
  cancel,
  estimateUsd,
  fail,
  MediaError,
  mergeUsage,
  parseImageResponse,
  priceOf,
  remainingUsd,
  reserveBatch,
  settle,
  validateSpec,
  type ImageSpec,
  type InlineImage
} from '@uomd/shared';
import { readBudget, updateBudget } from './lib/budget_lock';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUDGET_FILE = join(ROOT, 'content/budget/media_budget.json');
const API = 'https://generativelanguage.googleapis.com';
const MIME: Record<string, string> = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const sha = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');

export interface ExecuteImageSpecOptions {
  spec: ImageSpec;
  refs: { buf: Buffer; inline: InlineImage; sha256: string; path: string }[];
  budgetFile: string;
  outRoot: string;
  nowIso?: string;
  fetchFn?: typeof fetch;
}

export interface ExecuteImageSpecResult {
  status: 'settled' | 'partial' | 'failed';
  indices: number[];
  saved: { file: string; sha256: string }[];
  provenanceFile: string;
  settledUsd: number;
  usage: Record<string, unknown> | undefined;
  error?: string;
}

export async function executeImageSpec(opts: ExecuteImageSpecOptions): Promise<ExecuteImageSpecResult> {
  const { spec, refs, budgetFile, outRoot, fetchFn = fetch } = opts;
  validateSpec(spec);
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const unitPrice = priceOf(spec.model, spec.size);
  const estimate = estimateUsd(spec);
  const promptSha256 = sha(spec.prompt.trim());
  const request = buildImageRequest(spec, refs.map((r) => r.inline));

  // Reserve one entry per call inside an atomic file lock
  const indices = await updateBudget(budgetFile, (b) => {
    const res = reserveBatch(b, {
      label: spec.id,
      model: spec.model,
      unitEstimateUsd: unitPrice,
      count: spec.count,
      now: nowIso,
      asset: spec.id,
      promptSha256
    });
    return { budget: res.budget, value: res.indices };
  });

  const outDir = join(outRoot, spec.id);
  mkdirSync(outDir, { recursive: true });
  const stamp = nowIso.replace(/[:.]/g, '-');
  const saved: { file: string; sha256: string }[] = [];
  let usage: Record<string, unknown> | undefined;
  let settledUsd = 0;
  let failureMessage: string | undefined;

  for (let n = 0; n < spec.count; n++) {
    const idx = indices[n]!;
    if (failureMessage !== undefined) {
      // Previous call failed: this call was NEVER sent, so cancel its reservation without consuming an attempt
      await updateBudget(budgetFile, (b) => ({ budget: cancel(b, idx), value: undefined }));
      continue;
    }
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (process.env.GEMINI_API_KEY) headers['x-goog-api-key'] = process.env.GEMINI_API_KEY;
      const res = await fetchFn(`${API}${request.path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(180_000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const parsed = parseImageResponse(await res.json());
      usage = mergeUsage(usage, parsed.usage);
      for (const [i, img] of parsed.images.entries()) {
        const buf = Buffer.from(img.base64, 'base64');
        const file = join(outDir, `${stamp}-${n + 1}${parsed.images.length > 1 ? `-${i + 1}` : ''}.${img.mimeType === 'image/jpeg' ? 'jpg' : 'png'}`);
        writeFileSync(file, buf);
        saved.push({ file, sha256: sha(buf) });
      }
      const callActual = Math.round(parsed.images.length * unitPrice * 1e6) / 1e6;
      settledUsd = Math.round((settledUsd + callActual) * 1e6) / 1e6;
      await updateBudget(budgetFile, (b) => ({ budget: settle(b, idx, callActual), value: undefined }));
    } catch (e) {
      failureMessage = (e as Error).message;
      // Call was sent and failed/timed out: keep its attempt and keep its estimate committed until reconciled
      await updateBudget(budgetFile, (b) => ({ budget: fail(b, idx, failureMessage!), value: undefined }));
    }
  }

  const status: ExecuteImageSpecResult['status'] =
    failureMessage === undefined ? 'settled' : saved.length > 0 ? 'partial' : 'failed';
  const provenanceFile = join(outDir, `${stamp}.provenance.json`);
  writeFileSync(
    provenanceFile,
    `${JSON.stringify(
      {
        spec,
        status,
        generated_at: nowIso,
        model: spec.model,
        prompt_sha256: promptSha256,
        references: refs.map((r) => ({ path: r.path, sha256: r.sha256 })),
        ledger_indices: indices,
        outputs: saved,
        usage,
        estimated_usd: estimate,
        settled_usd: settledUsd,
        ...(failureMessage ? { error: failureMessage } : {})
      },
      null,
      2
    )}\n`
  );

  return {
    status,
    indices,
    saved,
    provenanceFile,
    settledUsd,
    usage,
    ...(failureMessage ? { error: failureMessage } : {})
  };
}

async function main(): Promise<void> {
  const specPath = arg('spec');
  if (!specPath) throw new Error('usage: --spec <spec.json> [--execute]');
  const spec = JSON.parse(readFileSync(join(ROOT, specPath), 'utf8')) as ImageSpec;
  validateSpec(spec);
  const unitPrice = priceOf(spec.model, spec.size);
  const estimate = estimateUsd(spec);
  const budget = readBudget(BUDGET_FILE);
  const promptSha256 = sha(spec.prompt.trim());
  const refs = spec.references.map((r) => {
    const buf = readFileSync(join(ROOT, r.path));
    const mimeType = MIME[extname(r.path).toLowerCase()];
    if (!mimeType) throw new MediaError('bad_spec', `unsupported reference type: ${r.path}`);
    return { buf, inline: { mimeType, base64: buf.toString('base64') } satisfies InlineImage, sha256: sha(buf), path: r.path };
  });
  const request = buildImageRequest(spec, refs.map((r) => r.inline));

  if (!process.argv.includes('--execute')) {
    const nowIso = new Date().toISOString();
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          id: spec.id,
          model: spec.model,
          size: spec.size,
          count: spec.count,
          unit_price_usd: unitPrice,
          estimate_usd: estimate,
          budget: {
            approved_usd: budget.approved_usd,
            per_batch_cap_usd: budget.per_batch_cap_usd,
            remaining_usd: remainingUsd(budget, nowIso),
            attempts_used_for_asset: attemptsFor(budget, spec.id),
            attempts_left_for_asset: attemptsLeft(budget, spec.id),
            approved_by: budget.approved_by
          },
          request_path: request.path,
          references: refs.map((r) => ({ path: r.path, sha256: r.sha256 })),
          prompt_preview: spec.prompt.slice(0, 160)
        },
        null,
        2
      )
    );
    try {
      reserveBatch(budget, {
        label: spec.id,
        model: spec.model,
        unitEstimateUsd: unitPrice,
        count: spec.count,
        asset: spec.id,
        promptSha256,
        now: nowIso
      });
      console.log('budget check: a reservation WOULD succeed (nothing reserved, no call made)');
    } catch (e) {
      console.log(`budget check: BLOCKED (${e instanceof BudgetError ? e.code : 'error'}) — ${(e as Error).message}`);
    }
    return;
  }

  const out = await executeImageSpec({
    spec,
    refs,
    budgetFile: BUDGET_FILE,
    outRoot: join(ROOT, '.cache/generated')
  });
  if (out.status !== 'settled') {
    console.error(`generation ${out.status} after ${out.saved.length}/${spec.count} images: ${out.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${out.saved.length} image(s) saved; settled $${out.settledUsd}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((e: unknown) => {
    console.error(e instanceof BudgetError ? `BLOCKED (${e.code}): ${e.message}` : e instanceof MediaError ? `SPEC/RESPONSE (${e.code}): ${e.message}` : String(e));
    process.exit(1);
  });
}

