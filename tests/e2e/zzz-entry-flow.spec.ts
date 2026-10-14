import { expect, test, type Page } from '@playwright/test';
import { SHOTS, activeScene, finishBattleWithPolicy, manualTurn, openGame, probeBattle, skipStory, tap, waitScene } from './helpers';
import { publishCampaign } from './stack';

const jwt = (): string => process.env.E2E_ADMIN_JWT as string;
const REF_W = 1920;
const REF_H = 1080;

test.describe.configure({ mode: 'serial' });

/**
 * The whole first-install flow against the real local stack. These scenarios run last (the file name sorts after the campaign test, which
 * leaves the channel on the embedded base again), publish their own copy of the campaign as the "rest of the game" patch, and slow the
 * object downloads down so the bottom bar and the download page are really exercised.
 */
let published = false;
async function ensurePatchPublished(): Promise<void> {
  if (published) return;
  await publishCampaign(jwt(), 'rel_0004');
  published = true;
}

async function slowDownloads(page: Page, ms: number): Promise<void> {
  await page.route('**/api/v1/content/objects/*', async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

const sceneState = <T>(page: Page, scene: string, read: (s: any) => T): Promise<T> =>
  page.evaluate(`(${read.toString()})(window.__UOMD__.game.scene.getScene(${JSON.stringify(scene)}))`) as Promise<T>;

/** Taps through a cutscene until the story with this path is over (the next story reuses the same scene key, so the path tells them apart). */
async function skipUntilLeaves(page: Page, info: Parameters<typeof tap>[1], path: string): Promise<void> {
  for (let i = 0; i < 900; i++) {
    const st = await page.evaluate(() => {
      const g = (window as any).__UOMD__.game;
      const s = g.scene.getScene('Story');
      return { active: g.scene.isActive('Story'), path: s?.init0?.path as string | undefined, finished: Boolean(s?.finished) };
    });
    if (!st.active || st.path !== path) return;
    if (!st.finished) await tap(page, info, REF_W / 2, 420);
    await page.waitForTimeout(220);
  }
  throw new Error(`story ${path} did not end`);
}

const textsOf = (page: Page, scene: string): Promise<string[]> =>
  page.evaluate((k) => {
    const s = (window as any).__UOMD__.game.scene.getScene(k);
    const out: string[] = [];
    const walk = (list: any[]): void => {
      for (const c of list) {
        if (c.visible === false) continue; // hidden objects (e.g. the restart button while the download runs) are not on screen
        if (typeof c.text === 'string') out.push(c.text);
        if (Array.isArray(c.list)) walk(c.list);
      }
    };
    walk(s.children.list);
    return out;
  }, scene);

async function enterFromMenu(page: Page, info: Parameters<typeof tap>[1]): Promise<void> {
  await tap(page, info, 500, 640); // the first-run main door (PREVIEW BUILD in a browser)
}

async function waitProloguePlayed(page: Page, info: Parameters<typeof tap>[1]): Promise<void> {
  await waitScene(page, 'Prologue', 30_000);
  await expect.poll(() => sceneState(page, 'Prologue', (s) => s.done === true), { timeout: 60_000 }).toBe(true);
  await page.waitForTimeout(900); // the CONTINUE button fades in after the black
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-02-prologue-continue.png` });
  await tap(page, info, REF_W / 2, REF_H / 2 + 40);
}

test('prologue timing: nine scenes, 120 s, no skip, narration revealed at 26 characters per second', async ({ page }, info) => {
  test.skip(info.project.name !== 'landscape-desktop', 'real-time scenario, runs once');
  test.setTimeout(300_000);
  await ensurePatchPublished();
  await openGame(page, '/', { fresh: true, realIntro: true, until: 'Title' });
  await enterFromMenu(page, info);
  await waitScene(page, 'Prologue', 30_000);
  const t0 = Date.now();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-01a-prologue-scene1.png` });
  expect(await sceneState(page, 'Prologue', (s) => s.index)).toBe(0);
  // tapping must not skip anything
  await tap(page, info, REF_W / 2, REF_H / 2);
  await tap(page, info, REF_W - 150, 70);
  await page.waitForTimeout(300);
  expect(await sceneState(page, 'Prologue', (s) => s.index)).toBe(0);
  // scene 1 lasts 12 s, scene 2 starts at 12 s
  await expect.poll(() => sceneState(page, 'Prologue', (s) => s.index), { timeout: 20_000 }).toBe(1);
  const switched = (Date.now() - t0) / 1000;
  expect(switched).toBeGreaterThan(10.5);
  expect(switched).toBeLessThan(14.5);
  expect(await sceneState(page, 'Prologue', (s) => s.body.alpha)).toBe(1);
  // the narration is revealed at 26 characters per second: sample one second of an ongoing reveal
  const len = (): Promise<number> => sceneState(page, 'Prologue', (s) => (s.body.text as string).length);
  const l1 = await len();
  await page.waitForTimeout(1000);
  const l2 = await len();
  expect(l2 - l1).toBeGreaterThanOrEqual(16);
  expect(l2 - l1).toBeLessThanOrEqual(36);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-01b-prologue-scene2.png` });
});

test('first install: gate -> prologue -> T-1..T-3 (manual battles, cutscene rules) with the patch downloading underneath -> download page -> confirmation -> one restart -> full menu', async ({ page }, info) => {
  test.skip(info.project.name !== 'landscape-desktop', 'long scenario, runs once');
  test.setTimeout(1_500_000);
  await ensurePatchPublished();
  await slowDownloads(page, 600);
  const problems = await openGame(page, '/', { fresh: true, until: 'Title' });
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-00-first-run-menu.png` });

  // ---- the gate: nothing is downloaded before the player enters
  expect(await page.evaluate(() => (window as any).__UOMD__.services.patches.get().kind)).toBe('idle');
  await enterFromMenu(page, info);
  await waitProloguePlayed(page, info);

  // ---- the download bar is up and keeps running over the story
  await waitScene(page, 'Story', 30_000);
  await page.waitForTimeout(2500);
  expect(await activeScene(page)).toContain('PatchBar');
  const patchKind = await page.evaluate(() => (window as any).__UOMD__.services.patches.get().kind);
  expect(['running', 'ready']).toContain(patchKind);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-03-t1-cutscene-with-patch-bar.png` });

  // ---- cutscene rules (v006): Auto on at the start, one toggle, no Skip, 26 cps
  const rules = await sceneState(page, 'Story', (s) => ({ cutscene: s.cutscene, auto: s.auto, skip: s.skipBtn }));
  expect(rules).toEqual({ cutscene: true, auto: true, skip: null });

  for (let n = 1; n <= 3; n++) {
    if (n > 1) await waitScene(page, 'Story', 60_000);
    await skipStory(page, info, 'Battle', 600);
    await expect.poll(async () => (await probeBattle(page)).prompt?.actor, { timeout: 40_000 }).toBeTruthy();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-04-t${n}-battle.png` });
    // turn-based, the player chooses; no speed and no Auto
    expect(await sceneState(page, 'Battle', (s) => [s.speedBtn, s.autoBtn])).toEqual([null, null]);
    if (n === 1) {
      await manualTurn(page, info, 0); // a real UI turn: select the skill, confirm the target
      await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-05-t1-after-first-turn.png` });
    }
    await finishBattleWithPolicy(page);
    await expect.poll(async () => (await probeBattle(page)).result?.winner, { timeout: 60_000 }).toBe('player');
    // the result panel appears after the last animations have played out
    await expect.poll(async () => (await textsOf(page, 'Battle')).includes('CONTINUE'), { timeout: 90_000 }).toBe(true);
    await page.waitForTimeout(600);
    const panel = await textsOf(page, 'Battle');
    expect(panel.some((t) => t.startsWith('Server verification'))).toBe(false); // nothing is claimed in the tutorial
    expect(panel).not.toContain('LEAVE');
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-06-t${n}-victory.png` });
    await tap(page, info, REF_W / 2, 760); // CONTINUE (centred when there is no LEAVE)
    await waitScene(page, 'Story', 60_000);
    if (n === 3) {
      // the shelter illustration is not shipped yet: the scene must still run on its portraits
      const il = await sceneState(page, 'Story', (s) => s.illustration);
      expect(il === null || typeof il === 'object').toBe(true);
    }
    if (n < 3) await skipUntilLeaves(page, info, `story/tutorial_t${n}_after.json`);
    else await skipStory(page, info, 'Finish', 600);
  }

  // ---- the end: download page or confirmation, restart exactly once
  await waitScene(page, 'Finish', 60_000);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-07-finish-first-look.png` });
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.services.patches.get().kind), { timeout: 240_000 }).toBe('ready');
  await page.waitForTimeout(900);
  const finishTexts = await textsOf(page, 'Finish');
  expect(finishTexts).toContain('RESTART & ENTER GAME');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-08-finish-confirmation.png` });

  let loads = 0;
  page.on('load', () => loads++);
  await tap(page, info, REF_W / 2, 700);
  await tap(page, info, REF_W / 2, 700);
  await tap(page, info, REF_W / 2, 700);
  await page.waitForFunction(() => (window as any).__UOMD__?.game.scene.isActive('Title'), null, { timeout: 90_000 });
  await page.waitForTimeout(1500);
  expect(loads).toBe(1); // three presses, one restart

  // ---- after the restart: the full menu, the new content is active, the entry flow is finished
  const after = await page.evaluate(async () => {
    const sv = (window as any).__UOMD__.services;
    const progress = JSON.parse(localStorage.getItem('uomd.progress.v1') ?? '{}') as Record<string, unknown>;
    return {
      active: await sv.content.activeReleaseId(),
      entry: JSON.parse(localStorage.getItem('uomd.entry.v1') ?? '{}'),
      nodes: ((await sv.content.chapters()).chapters.flatMap((c: any) => c.nodes) as any[]).length,
      stage1_1Cleared: Boolean(progress['stage_1_1'])
    };
  });
  expect(after.active).toBe('rel_0004');
  expect(after.entry).toMatchObject({ phase: 'completed', prologue: true, tutorials: 3 });
  expect(after.nodes).toBeGreaterThan(30);
  expect(after.stage1_1Cleared).toBe(false);
  const labels = (await textsOf(page, 'Title')).join('|');
  expect(labels).toContain('CONTINUE');
  expect(labels).toContain('CHAPTERS');
  expect(labels).not.toContain('PREVIEW BUILD');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-09-after-restart-menu.png` });
  await tap(page, info, 500, 640); // CONTINUE -> enters Part I campaign opening rather than replaying tutorial t1
  await waitScene(page, 'Story', 30_000);
  expect(await sceneState(page, 'Story', (s) => s.init0.path)).toBe('story/opening_sad_scene.json');
  expect(problems.filter((p) => !p.includes('favicon') && !p.includes('HTTP 404') && !p.includes('requestfailed'))).toEqual([]);
});


test('resuming at the end with the download still running: the page waits, then confirms (late patch)', async ({ page }, info) => {
  test.skip(info.project.name !== 'landscape-desktop', 'long scenario, runs once');
  test.setTimeout(400_000);
  await ensurePatchPublished();
  await page.addInitScript(() => {
    try {
      localStorage.setItem('uomd.entry.v1', JSON.stringify({ phase: 'in_progress', prologue: true, tutorials: 3, updatedAt: '2026-10-11T00:00:00.000Z' }));
    } catch { /* ignore */ }
  });
  await slowDownloads(page, 350);
  await openGame(page, '/', { fresh: true, until: 'Title' });

  await enterFromMenu(page, info);
  await waitScene(page, 'Finish', 30_000);
  await page.waitForTimeout(3500);
  expect((await textsOf(page, 'Finish')).join('|')).toContain('THE ROAD IS BEING PREPARED');
  expect(await textsOf(page, 'Finish')).not.toContain('RESTART & ENTER GAME');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-10-late-patch-waiting.png` });
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.services.patches.get().kind), { timeout: 240_000 }).toBe('ready');
  await page.waitForTimeout(900);
  expect(await textsOf(page, 'Finish')).toContain('RESTART & ENTER GAME');
});

test('a failed download shows a retry path on the download page; retrying finishes without a restart of the flow', async ({ page }, info) => {
  test.skip(info.project.name !== 'landscape-desktop', 'long scenario, runs once');
  test.setTimeout(300_000);
  await ensurePatchPublished();
  await page.addInitScript(() => {
    try {
      localStorage.setItem('uomd.entry.v1', JSON.stringify({ phase: 'in_progress', prologue: true, tutorials: 3, updatedAt: '2026-10-11T00:00:00.000Z' }));
    } catch { /* ignore */ }
  });
  let blocked = true;
  await page.route('**/api/v1/content/objects/*', async (route) => (blocked ? route.abort('connectionreset') : route.continue()));
  await openGame(page, '/', { fresh: true, until: 'Title' });
  await enterFromMenu(page, info);
  await waitScene(page, 'Finish', 30_000);
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.services.patches.get().kind), { timeout: 60_000 }).toBe('failed');
  await page.waitForTimeout(900);
  expect(await textsOf(page, 'Finish')).toContain('TRY AGAIN');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f7-11-download-failed.png` });
  blocked = false;
  await tap(page, info, REF_W / 2, 700);
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.services.patches.get().kind), { timeout: 120_000 }).toBe('ready');
  await page.waitForTimeout(900);
  expect(await textsOf(page, 'Finish')).toContain('RESTART & ENTER GAME');
});
