import { expect, test, type Page } from '@playwright/test';
import { SHOTS, openGame, signInDev, tap, waitScene } from './helpers';
import { seedLibraryFixture } from './stack';

const goto = (page: Page, key: string) => page.evaluate((key) => {
  const game = (window as any).__UOMD__.game;
  game.scene.getScenes(true).forEach((scene: any) => game.scene.stop(scene.key)); game.scene.start(key);
}, key);
const settled = async (page: Page, key: string) => {
  await expect.poll(() => page.evaluate((key) => !(window as any).__UOMD__.game.scene.getScene(key).fading, key)).toBe(true);
  await page.waitForTimeout(100);
};
const texts = (page: Page, key: string): Promise<string[]> => page.evaluate((key) => (window as any).__UOMD__.game.scene.getScene(key)?.texts() ?? [], key);
/** server state for the active release, the same scope the screens read */
const state = <T>(page: Page, method: string): Promise<T> =>
  page.evaluate(async (m) => { const u = (window as any).__UOMD__; return u.services.api[m](await u.services.content.activeReleaseId()); }, method) as Promise<T>;

test('modes: deeds, profile and trials screens claim and fight through the server', async ({ page }, info) => {
  test.setTimeout(420_000);
  const problems = await openGame(page);
  const actor = await signInDev(page, `modes-${info.project.name}`);
  // three stage clears (disposable local D1): unlocks arena/endless/events and completes the first-clear achievement
  await seedLibraryFixture(actor.id);

  await goto(page, 'Home'); await waitScene(page, 'Home'); await settled(page, 'Home');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-modes-home.png` });

  // DEEDS: second row, first tile
  await tap(page, info, 270, 505); await waitScene(page, 'Deeds');
  await expect.poll(() => texts(page, 'Deeds')).toContain('FIRST ASHEN STEP   1/1');
  await settled(page, 'Deeds');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-modes-deeds.png` });
  await tap(page, info, 1670, 720); // CLAIM on the first achievement row (below the three event objectives)
  await expect.poll(async () => (await state<any>(page, 'achievements')).achievements.find((a: any) => a.id === 'ach_first_clear').claimed).toBe(true);

  // PROFILE: third row, second tile; the claimed achievement unlocked a second title
  await goto(page, 'Home'); await waitScene(page, 'Home'); await settled(page, 'Home');
  await tap(page, info, 730, 720); await waitScene(page, 'Profile');
  await expect.poll(() => texts(page, 'Profile')).toContain('Novice Warden');
  await settled(page, 'Profile');
  await tap(page, info, 500, 820); // CHANGE TITLE
  await expect.poll(async () => (await state<any>(page, 'profile')).titleBadge).toBe('wayfarer_of_ash');
  await expect.poll(() => texts(page, 'Profile')).toContain('Wayfarer of Ash');
  await tap(page, info, 1310, 230); // ARENA board
  await expect.poll(() => texts(page, 'Profile').then((t) => t.some((s) => s.endsWith(' rating')))).toBe(true);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-modes-profile.png` });

  // TRIALS: second row, second tile
  await goto(page, 'Home'); await waitScene(page, 'Home'); await settled(page, 'Home');
  await tap(page, info, 730, 505); await waitScene(page, 'Trials');
  await expect.poll(() => texts(page, 'Trials')).toContain('Start a run with one blessing:');
  await settled(page, 'Trials');
  await tap(page, info, 780, 350); // FIGHT the first arena opponent
  await expect.poll(async () => (await state<any>(page, 'arenaState')).dailyUsed).toBe(1);
  // the screen re-reads server state after the fight; tap the next button only once that redraw shows the match
  await expect.poll(() => texts(page, 'Trials').then((t) => t.some((x) => x.includes('matches 1/')))).toBe(true);
  await settled(page, 'Trials');
  await tap(page, info, 1420, 400); // first blessing starts an endless run
  await expect.poll(async () => (await state<any>(page, 'endlessState')).activeRun?.wave).toBe(1);
  await expect.poll(() => texts(page, 'Trials')).toContain('FIGHT WAVE 1');
  await tap(page, info, 1420, 430); // FIGHT WAVE 1: won (best wave 1) or lost (the screen offers a new run)
  await expect.poll(async () => {
    const best = (await state<any>(page, 'endlessState')).bestWave as number;
    return best >= 1 || (await texts(page, 'Trials')).includes('Start a run with one blessing:');
  }).toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-modes-trials.png` });

  // a lost endless wave answers 422 by design
  expect(problems.filter((p) => !p.includes('favicon') && !p.includes('/api/v1/endless/wave'))).toEqual([]);
});
