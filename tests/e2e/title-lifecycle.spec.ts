import { expect, test } from '@playwright/test';
import { openGame, waitScene } from './helpers';

test('title content chip ignores late reads after shutdown and restart', async ({ page }) => {
  const problems = await openGame(page);
  for (const restart of [false, true]) {
    if (restart) {
      await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Home').nav.start('Title'));
      await waitScene(page, 'Title');
    }
    await expect.poll(() => page.evaluate(() => !!(window as any).__UOMD__.game.scene.getScene('Title').chipText?.active)).toBe(true);
    await page.evaluate((restart) => {
      const u = (window as any).__UOMD__; const title = u.game.scene.getScene('Title'); const content = u.services.content;
      const original = content.activeReleaseId;
      let complete!: (id: string) => void;
      content.activeReleaseId = () => new Promise<string>((resolve) => { complete = resolve; });
      const late = { chip: title.chipText, complete: (id: string) => complete(id), settled: false, error: null as string | null };
      (window as any).__TITLE_LATE__ = late;
      void title.refreshChip().then(() => { late.settled = true; }, (error: Error) => { late.error = error.message; late.settled = true; });
      content.activeReleaseId = original;
      if (restart) title.nav.restart(); else title.nav.start('Home');
    }, restart);
    await waitScene(page, restart ? 'Title' : 'Home');
    await expect.poll(() => page.evaluate(() => !(window as any).__TITLE_LATE__.chip.active)).toBe(true);
    if (restart) await expect.poll(() => page.evaluate(() => {
      const title = (window as any).__UOMD__.game.scene.getScene('Title');
      return !!title.chipText?.active && title.chipText !== (window as any).__TITLE_LATE__.chip;
    })).toBe(true);
    await page.evaluate(() => (window as any).__TITLE_LATE__.complete('stale_chip_probe'));
    await expect.poll(() => page.evaluate(() => (window as any).__TITLE_LATE__.settled)).toBe(true);
    expect(await page.evaluate(() => (window as any).__TITLE_LATE__.error)).toBeNull();
    if (restart) expect(await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Title').chipText.text)).not.toContain('stale_chip_probe');
  }
  expect(problems.filter((problem) => !problem.includes('favicon'))).toEqual([]);
});
