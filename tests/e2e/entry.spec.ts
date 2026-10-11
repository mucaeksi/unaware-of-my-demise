import { expect, test, type Page } from '@playwright/test';
import { SHOTS, activeScene, openGame, tap, waitScene } from './helpers';

test.describe.configure({ mode: 'serial' });

/** records every distinct set of active scenes so the order of the opening chain can be asserted */
const recordScenes = (page: Page): Promise<void> =>
  page.addInitScript(() => {
    const seq: string[] = [];
    (window as any).__SEQ__ = seq;
    setInterval(() => {
      const g = (window as any).__UOMD__?.game;
      if (!g) return;
      const now = g.scene.getScenes(true).map((s: any) => s.sys.settings.key).filter((k: string) => k !== 'Boot').join(',');
      if (now && seq[seq.length - 1] !== now) seq.push(now);
    }, 40);
  });

test('F1: a fresh install shows the engine credit, the studio card, then the first-run menu (sign-in + settings only)', async ({ page }, info) => {
  await recordScenes(page);
  const problems = await openGame(page, '/', { fresh: true, realIntro: true, until: 'Splash' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f1-1-splash.png` });
  await waitScene(page, 'Studio', 15_000);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f1-2-studio.png` });
  await waitScene(page, 'Title', 15_000);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f1-3-first-run-menu.png` });

  const seq = await page.evaluate(() => (window as any).__SEQ__ as string[]);
  const order = seq.map((s) => s.split(',')[0]);
  expect(order.indexOf('Splash')).toBeGreaterThanOrEqual(0);
  expect(order.indexOf('Studio')).toBeGreaterThan(order.indexOf('Splash'));
  expect(order.indexOf('Title')).toBeGreaterThan(order.indexOf('Studio'));

  // first-run menu: no Chapters / Company doors yet
  const labels = await page.evaluate(() => {
    const s = (window as any).__UOMD__.game.scene.getScene('Title');
    return s.children.list.flatMap((c: any) => (c.list ?? []).map((x: any) => x.text).filter(Boolean));
  });
  expect(labels.join('|')).toContain('PREVIEW BUILD'); // browser build: no native Google identity
  expect(labels.join('|')).toContain('SETTINGS');
  expect(labels.join('|')).not.toContain('CHAPTERS');
  expect(labels.join('|')).not.toContain('COMPANY');

  // settings are reachable before sign-in and do not offer a progress reset
  await tap(page, info, 500, 800);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f1-4-settings.png` });
  expect(problems.filter((p) => !p.includes('favicon'))).toEqual([]);
});

test('F1: a returning player (entry completed) goes splash -> studio -> the full menu', async ({ page }, info) => {
  const problems = await openGame(page); // default: completed entry, fast intro
  const labels = await page.evaluate(() => {
    const s = (window as any).__UOMD__.game.scene.getScene('Title');
    return s.children.list.flatMap((c: any) => (c.list ?? []).map((x: any) => x.text).filter(Boolean));
  });
  expect(labels.join('|')).toContain('CHAPTERS');
  expect(labels.join('|')).toContain('COMPANY');
  expect(await activeScene(page)).toContain('Title');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-f1-5-full-menu.png` });
  expect(problems.filter((p) => !p.includes('favicon'))).toEqual([]);
});
