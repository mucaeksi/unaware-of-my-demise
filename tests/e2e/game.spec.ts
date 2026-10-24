 
import { expect, test } from '@playwright/test';
import { ADMIN, SHOTS, REF_H, REF_W, finishBattleWithPolicy, manualTurn, openGame, probeBattle, serverVerification, skipStory, tap, waitScene } from './helpers';

const jwt = (): string => process.env.E2E_ADMIN_JWT as string;

test.describe.configure({ mode: 'serial' });

test('boots to a rendered title screen with embedded base content and no errors', async ({ page }, info) => {
  const problems = await openGame(page);
  const gl = await page.evaluate(() => {
    const g = window as unknown as { __UOMD__: { game: { renderer: { type: number; name: string; unity: { screen: { width: number; height: number } } } } } };
    const r = g.__UOMD__.game.renderer;
    return { renderer: r.type, name: r.name, w: r.unity.screen.width, h: r.unity.screen.height };
  });
  // a real Unity 6 URP 2D GPU renderer (the canvas backing store scales with the device, the stage stays 1920x1080)
  expect(gl.renderer).toBe(2);
  expect(['webgl', 'webgpu']).toContain(gl.name);
  expect(gl.w).toBe(REF_W);
  expect(gl.h).toBe(REF_H);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-01-title.png` });
  expect(problems.filter((p) => !p.includes('favicon'))).toEqual([]);
});

test('plays tutorial T-1 from the title: story -> turn-based battle -> victory -> story, with server replay verification', async ({ page, request }, info) => {
  const problems = await openGame(page);
  await tap(page, info, 500, 640); // BEGIN
  await waitScene(page, 'Story');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-02-story.png` });
  await skipStory(page, info, 'Battle', 400);
  await expect.poll(async () => (await probeBattle(page)).prompt?.actor, { timeout: 30_000 }).toContain('fadyme');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-03-battle.png` });
  // the opening tutorial has no speed button and no Auto (the encounter's ui block hides them)
  expect(await page.evaluate(() => { const s = (window as any).__UOMD__.game.scene.getScene('Battle'); return [s.speedBtn, s.autoBtn]; })).toEqual([null, null]);

  // two manual turns through the real UI (select, then confirm target) ...
  await manualTurn(page, info, 0);
  await expect.poll(async () => (await probeBattle(page)).prompt?.actor, { timeout: 40_000 }).toContain('mahmut');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-04-after-first-hit.png` });
  await manualTurn(page, info, 0);
  // ... then the test driver answers the remaining prompts with the engine policy (a player would keep pressing skills)
  await finishBattleWithPolicy(page);
  await expect.poll(async () => (await probeBattle(page)).result, { timeout: 120_000 }).not.toBeNull();
  const result = (await probeBattle(page)).result;
  expect(result?.winner).toBe('player');
  const label = await serverVerification(page);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-05-victory.png` });
  expect(label).toContain('✓ replay matches');

  // continue -> post-battle story -> back to chapters
  await tap(page, info, 1170 - 230, 760); // CONTINUE on the victory card (BattleScene: cardX 1170, primary button at cardX - 230)
  await waitScene(page, 'Story');
  await skipStory(page, info, 'Chapters', 400);
  const sys = await request.get(`${ADMIN}/admin/api/system`, { headers: { 'Cf-Access-Jwt-Assertion': jwt() } });
  const audit = (await sys.json()) as { d1: { counts: { battle_audit: number } } };
  expect(audit.d1.counts.battle_audit).toBeGreaterThanOrEqual(1);
  expect(problems.filter((p) => !p.includes('favicon'))).toEqual([]);
});
