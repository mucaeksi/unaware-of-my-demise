import { expect, test } from '@playwright/test';
import { GAME, REF_W, SHOTS, manualTurn, openGame, probeBattle, serverVerification, skipStory, tap, waitScene } from './helpers';

// Deployed-environment smoke test: boots the real deployed client, plays T-1 through input, and reports what the
// server says about replay verification. It never assumes a release is published: it records the observed label.
test.skip(!process.env.UOMD_REMOTE_GAME_URL, 'set UOMD_REMOTE_GAME_URL to run against a deployed environment');

test('deployed client boots, renders WebGL and plays tutorial T-1 to victory', async ({ page, request }, info) => {
  const health = await request.get(`${GAME}/api/v1/health`);
  expect(health.status()).toBe(200);
  const status = (await health.json()) as { ok: boolean; d1: { ok: boolean }; r2: { ok: boolean }; current_release: string | null };
  expect(status).toMatchObject({ ok: true, d1: { ok: true }, r2: { ok: true } });
  const published = status.current_release !== null;

  const problems = await openGame(page);
  const gl = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    return { w: c.width, h: c.height, renderer: (window as any).__UOMD__.game.renderer.type };
  });
  expect(gl.renderer).toBe(2); // Unity URP 2D (1 would be the canvas fallback)
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-01-title.png` });

  await tap(page, info, 500, 640); // BEGIN
  await waitScene(page, 'Story');
  await skipStory(page, info, 'Battle');
  await expect.poll(async () => (await probeBattle(page)).prompt?.actor, { timeout: 60_000 }).toContain('fadyme');
  await tap(page, info, REF_W - 150, 70); // x2
  await tap(page, info, REF_W - 150, 70); // x3 (software GL on CI stretches animation time)
  await manualTurn(page, info, 0);
  await expect.poll(async () => (await probeBattle(page)).prompt?.actor, { timeout: 60_000 }).toContain('mahmut');
  await tap(page, info, REF_W - 365, 70); // Auto
  await expect.poll(async () => (await probeBattle(page)).result, { timeout: 150_000 }).not.toBeNull();
  expect((await probeBattle(page)).result?.winner).toBe('player');
  const label = await serverVerification(page);
  console.log(`[${info.project.name}] ${label}`);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-05-victory.png` });
  expect(label).toMatch(/^Server verification: /);
  expect(label).not.toContain('rejected');
  // While no release is published on the server, its manifest/verify endpoints correctly answer 404 (the client keeps
  // playing the embedded base). With a published release there must be no problem at all; anything else is a defect.
  const unexpected = problems.filter((p) => !p.includes('favicon') && (published || !/404/.test(p)));
  expect(unexpected).toEqual([]);
});
