import { expect, test } from '@playwright/test';
import { openGame, SHOTS, waitScene } from './helpers';

test('free practice discloses one-time rewards before battle at desktop and phone sizes', async ({ page }, info) => {
  const problems = await openGame(page);
  await page.evaluate(() => {
    const game = (window as any).__UOMD__.game;
    game.scene.getScenes(true).forEach((scene: any) => game.scene.stop(scene.sys.settings.key));
    game.scene.start('Chapters');
  });
  await waitScene(page, 'Chapters');
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Chapters').children.list
    .filter((child: any) => child.visible && child.text === 'Free practice · one-time rewards only').length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Chapters').cameras.main.fadeEffect.isRunning)).toBe(false);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-free-practice-disclosure.png` });
  expect(problems.filter((problem) => /pageerror|404/i.test(problem))).toEqual([]);
});
