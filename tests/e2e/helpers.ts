 
import { expect, type Page, type TestInfo } from '@playwright/test';

import { join } from 'node:path';

export const SHOTS = join(new URL('../../.cache/e2e-shots', import.meta.url).pathname);
/** Local stack by default; `UOMD_REMOTE_GAME_URL` points the remote smoke test at a deployed environment. */
export const GAME = (process.env.UOMD_REMOTE_GAME_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
export const ADMIN = 'http://127.0.0.1:8788';
export const REF_W = 1920;
export const REF_H = 1080;

export async function openGame(page: Page, path = '/'): Promise<string[]> {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('/api/v1/content/channels/')) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  await page.goto(`${GAME}${path}`);
  await page.waitForFunction(() => (window as any).__UOMD__?.game.scene.isActive('Title'), null, { timeout: 60_000 });
  await page.waitForTimeout(1200);
  return problems;
}

/** Reference (1920x1080) -> viewport coordinates, accounting for FIT letterboxing. */
async function toScreen(page: Page, x: number, y: number): Promise<[number, number]> {
  const r = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const b = c.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  return [r.x + (x * r.w) / REF_W, r.y + (y * r.h) / REF_H];
}

export async function tap(page: Page, info: TestInfo, x: number, y: number): Promise<void> {
  const [sx, sy] = await toScreen(page, x, y);
  if (info.project.name.startsWith('phone')) await page.touchscreen.tap(sx, sy);
  else await page.mouse.click(sx, sy);
}

export const activeScene = (page: Page): Promise<string> =>
  page.evaluate(() => (window as any).__UOMD__.game.scene.getScenes(true).map((s: any) => s.sys.settings.key).join(','));

export async function waitScene(page: Page, key: string, timeout = 60_000): Promise<void> {
  await expect.poll(() => activeScene(page), { timeout, intervals: [250] }).toContain(key);
}

/** Taps through dialogue until `target` scene is active. */
export async function skipStory(page: Page, info: TestInfo, target: string): Promise<void> {
  let last = '';
  for (let i = 0; i < 160; i++) {
    const { now, finished } = await page.evaluate(() => {
      const g = (window as any).__UOMD__.game;
      return { now: g.scene.getScenes(true).map((s: any) => s.sys.settings.key).join(','), finished: Boolean(g.scene.getScene('Story')?.finished) };
    });
    if (now !== last) console.log(`[${info.project.name}] scene -> ${now} (tap ${i})`);
    last = now;
    if (now.includes(target)) return;
    if (!(now.includes('Story') && finished)) await tap(page, info, REF_W / 2, 420); // the story is over: only wait for the scene change
    await page.waitForTimeout(220);
  }
  await waitScene(page, target, 5000);
}

interface BattleProbe {
  prompt: { actor: string; options: { skillId: string; available: boolean; needsTarget: boolean; legalTargets: string[] }[] } | null;
  result: { winner: string; stars: number } | null;
  targets: Record<string, { x: number; y: number }>;
}

export const probeBattle = (page: Page): Promise<BattleProbe> =>
  page.evaluate(() => {
    const s = (window as any).__UOMD__.game.scene.getScene('Battle');
    const targets: Record<string, { x: number; y: number }> = {};
    for (const [id, v] of s.views) targets[id] = { x: v.x, y: v.headY + 120 };
    const b = s.battle; // assigned once the scene finished loading its assets
    return { prompt: b ? b.prompt() : null, result: b ? b.result : null, targets };
  });

/** Plays one manual turn: first available skill (basic), first legal target; two-step confirm like a player. */
export async function manualTurn(page: Page, info: TestInfo, skillIndex = 0): Promise<void> {
  const p = await probeBattle(page);
  if (!p.prompt) return;
  const n = p.prompt.options.length;
  const x = REF_W / 2 - ((n - 1) * (380 + 24)) / 2 + skillIndex * (380 + 24);
  const battle = (): Promise<{ panel: boolean; selected: boolean }> =>
    page.evaluate(() => {
      const s = (window as any).__UOMD__.game.scene.getScene('Battle');
      return { panel: Boolean(s.skillLayer), selected: Boolean(s.selected) };
    });
  // the prompt exists a moment before its skill buttons do; a tap in between would be ignored, as it would be for a player
  await expect.poll(async () => (await battle()).panel, { timeout: 15_000 }).toBe(true);
  await tap(page, info, x, 960);
  if (!(await expect.poll(async () => (await battle()).selected, { timeout: 2_500 }).toBe(true).then(() => true, () => false))) await tap(page, info, x, 960);
  await page.waitForTimeout(350);
  const opt = p.prompt.options[skillIndex];
  if (opt?.needsTarget) {
    const t = p.targets[opt.legalTargets[0] as string];
    if (t) await tap(page, info, t.x, t.y);
  } else {
    await tap(page, info, x, 960);
  }
}

/** The result panel appears some time after the battle ends (longer on slow CI GPUs); poll until the server verdict is final. */
export async function serverVerification(page: Page, timeout = 45_000): Promise<string> {
  let text = '';
  await expect
    .poll(
      async () => {
        text = await page.evaluate(() => {
          const s = (window as any).__UOMD__.game.scene.getScene('Battle');
          return s.children.list.map((c: any) => c.text ?? '').find((t: string) => t.startsWith('Server verification')) ?? '';
        });
        return text !== '' && !text.endsWith('checking…');
      },
      { timeout, intervals: [500] }
    )
    .toBe(true);
  return text;
}
