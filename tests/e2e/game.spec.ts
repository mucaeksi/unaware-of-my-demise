 
import { expect, test } from '@playwright/test';
import { ADMIN, SHOTS, REF_H, REF_W, activeScene, manualTurn, openGame, probeBattle, serverVerification, skipStory, tap, waitScene } from './helpers';
import { publishPatch } from './stack';

const jwt = (): string => process.env.E2E_ADMIN_JWT as string;

test.describe.configure({ mode: 'serial' });

test('boots to a rendered title screen with embedded base content and no errors', async ({ page }, info) => {
  const problems = await openGame(page);
  const gl = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const g = window as unknown as { __UOMD__: { game: { renderer: { type: number } } } };
    return { renderer: g.__UOMD__.game.renderer.type, w: c.width, h: c.height };
  });
  expect(gl.renderer).toBe(2); // Phaser.WEBGL
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
  await skipStory(page, info, 'Battle');
  await expect.poll(async () => (await probeBattle(page)).prompt?.actor, { timeout: 30_000 }).toContain('fadyme');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-03-battle.png` });
  // animation time depends on the rendering speed of the machine (software GL on CI is several times slower than a
  // phone GPU), so play at the fastest speed the game offers, exactly as an impatient player would
  await tap(page, info, REF_W - 150, 70); // x2
  await tap(page, info, REF_W - 150, 70); // x3

  // two manual turns through the real UI (select, then confirm target) ...
  await manualTurn(page, info, 0);
  await expect.poll(async () => (await probeBattle(page)).prompt?.actor, { timeout: 40_000 }).toContain('mahmut');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-04-after-first-hit.png` });
  await manualTurn(page, info, 0);
  // ... then hand over to Auto Battle (speed is already x3)
  await tap(page, info, REF_W - 365, 70);
  await expect.poll(async () => (await probeBattle(page)).result, { timeout: 120_000 }).not.toBeNull();
  const result = (await probeBattle(page)).result;
  expect(result?.winner).toBe('player');
  const label = await serverVerification(page);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-05-victory.png` });
  expect(label).toContain('✓ replay matches');

  // continue -> post-battle story -> back to chapters
  await tap(page, info, REF_W / 2 - 250, 760);
  await waitScene(page, 'Story');
  await skipStory(page, info, 'Chapters');
  const sys = await request.get(`${ADMIN}/admin/api/system`, { headers: { 'Cf-Access-Jwt-Assertion': jwt() } });
  const audit = (await sys.json()) as { d1: { counts: { battle_audit: number } } };
  expect(audit.d1.counts.battle_audit).toBeGreaterThanOrEqual(1);
  expect(problems.filter((p) => !p.includes('favicon'))).toEqual([]);
});

test('live data patch: publish rel_0002 while the unchanged client runs -> new chapter node, new enemy, rollback, persistence', async ({ page }, info) => {
  // Publishing is one-way per stack (generations only move forward), so this scenario mutates shared server
  // state exactly once per run. It is viewport independent; later projects see rel_0002 via the boot-time check.
  test.skip(info.project.name !== 'landscape-desktop', 'runs once per stack on the first project');
  const problems = await openGame(page);
  const nodes = (): Promise<string[]> =>
    page.evaluate(async () => {
      const s = (window as any).__UOMD__.services;
      return (await s.content.chapters()).chapters.flatMap((c) => c.nodes.map((n) => n.node_id));
    });
  expect(await nodes()).toEqual(['t1']);

  await publishPatch(jwt()); // an operator publishes new content; nobody rebuilds or reinstalls the app

  // open "content updates", check, and watch the patch apply
  await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Title').openPatchLab());
  await page.waitForTimeout(600);
  await tap(page, info, 960 - 410, 540 + 250); // CHECK NOW
  await expect.poll(nodes, { timeout: 60_000 }).toEqual(['t1', 't2']);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-06-patch-lab.png` });

  // the patch persists across a reload (IndexedDB), and the chapter list shows the NEW node
  await page.reload();
  await page.waitForFunction(() => (window as any).__UOMD__?.game.scene.isActive('Title'), null, { timeout: 60_000 });
  expect(await nodes()).toEqual(['t1', 't2']);
  await tap(page, info, 500, 786); // CHAPTERS
  await waitScene(page, 'Chapters');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-07-chapters-patched.png` });

  // t2 is locked until t1 is completed on this device; mark t1 done via the same persistence the game uses
  await page.evaluate(() => localStorage.setItem('uomd.progress.v1', JSON.stringify({ t1: { stars: 3 } })));
  await page.reload();
  await page.waitForFunction(() => (window as any).__UOMD__?.game.scene.isActive('Title'), null, { timeout: 60_000 });
  await tap(page, info, 500, 786);
  await waitScene(page, 'Chapters');
  await page.waitForTimeout(1200);
  await tap(page, info, REF_W / 2, 250 + 70 + 160 + 60); // second row (T-2)
  await waitScene(page, 'Story');
  await skipStory(page, info, 'Battle');
  await expect.poll(async () => (await probeBattle(page)).prompt?.actor, { timeout: 40_000 }).toContain('fadyme');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-08-pilgrim-battle.png` });
  const enemy = await page.evaluate(() => {
    const s = (window as any).__UOMD__.game.scene.getScene('Battle');
    return s.battle.combatants.filter((c) => c.id.startsWith('enemy')).map((c) => c.def.unit_id);
  });
  expect(enemy).toEqual(['hollow_pilgrim']); // a unit that does not exist in the installed app build
  await tap(page, info, REF_W - 150, 70); // x2
  await tap(page, info, REF_W - 150, 70); // x3
  await tap(page, info, REF_W - 365, 70); // Auto
  await expect.poll(async () => (await probeBattle(page)).result, { timeout: 120_000 }).not.toBeNull();
  const label = await serverVerification(page);
  expect(label).toContain('✓ replay matches');

  // roll the device back to the embedded base
  await page.goto('http://127.0.0.1:8787/');
  await page.waitForFunction(() => (window as any).__UOMD__?.game.scene.isActive('Title'), null, { timeout: 60_000 });
  const rolled = await page.evaluate(async () => {
    const s = (window as any).__UOMD__.services;
    const changed = await s.content.rollback();
    return { changed, nodes: (await s.content.chapters()).chapters[0]?.nodes.length };
  });
  expect(rolled).toEqual({ changed: true, nodes: 1 });
  expect(activeScene).toBeDefined();
  expect(problems.filter((p) => !p.includes('favicon'))).toEqual([]);
});
