import { expect, test, type Page } from '@playwright/test';
import { SignJWT, importJWK } from 'jose';
import { ADMIN, SHOTS, openGame, probeBattle, skipStory, tap, waitScene } from './helpers';
import { GOOGLE_CLIENT, publishCampaign } from './stack';

const jwt = (): string => process.env.E2E_ADMIN_JWT as string;
const REF_W = 1920;

async function googleToken(sub: string): Promise<string> {
  const jwk = JSON.parse(process.env.E2E_GOOGLE_PRIVATE_JWK as string);
  return new SignJWT({ email: `${sub}@example.com`, email_verified: true, name: 'E2E Wayfarer', pad: 'x'.repeat(80) })
    .setProtectedHeader({ alg: 'RS256', kid: 'g1' })
    .setSubject(sub)
    .setIssuer('https://accounts.google.com')
    .setAudience(GOOGLE_CLIENT)
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(await importJWK(jwk, 'RS256'));
}

/** Starts a chapter node the way a tap on its row would (the rows live in a scrolling list). */
const play = (page: Page, nodeId: string) =>
  page.evaluate(async (id) => {
    const u = (window as any).__UOMD__;
    const idx = await u.services.content.chapters();
    const node = idx.chapters.flatMap((c: any) => c.nodes).find((n: any) => n.node_id === id);
    await u.playNode(u.game.scene.getScene('Chapters'), node);
  }, nodeId);

const goto = (page: Page, key: string) =>
  page.evaluate((k) => {
    const g = (window as any).__UOMD__.game;
    g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.scene.start(k);
  }, key);

test.describe.configure({ mode: 'serial' });

test('campaign: owned-hero stages with story loans, server-frozen party, team builder, and a boss with objectives and telegraphs', async ({ page, request }, info) => {
  // publishing is one-way per stack: this scenario runs once, last (file name sorts after the others), and rolls the channel back
  test.skip(info.project.name !== 'landscape-desktop', 'runs once per stack on the first project');
  test.setTimeout(420_000);
  const problems = await openGame(page);
  const token = await googleToken('e2e-campaign');
  await page.evaluate(async (t) => (window as any).__UOMD__.services.api.signInWithIdToken(t), token);

  await publishCampaign(jwt());
  await page.evaluate(() => (window as any).__UOMD__.services.content.checkForUpdates());
  await expect
    .poll(() => page.evaluate(async () => ((await (window as any).__UOMD__.services.content.chapters()).chapters.flatMap((c: any) => c.nodes) as any[]).map((n) => n.node_id)), { timeout: 60_000 })
    .toContain('stage_1_2');

  // the chapter list scrolls (36 nodes) and shows the campaign
  await goto(page, 'Chapters');
  await waitScene(page, 'Chapters');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-20-chapters-campaign.png` });

  const autoBattle = async (): Promise<void> => {
    await expect.poll(async () => (await probeBattle(page)).prompt?.actor, { timeout: 60_000 }).toBeTruthy();
    await tap(page, info, REF_W - 150, 70); // x2
    await tap(page, info, REF_W - 150, 70); // x3
    await tap(page, info, REF_W - 365, 70); // Auto
    await expect.poll(async () => (await probeBattle(page)).result, { timeout: 180_000 }).not.toBeNull();
  };
  const claimed = (id: string): Promise<boolean> => page.evaluate(async (n) => ((await (window as any).__UOMD__.services.api.progress()).nodes as any[]).some((x) => x.node_id === n && x.stars >= 1), id);

  // 1-1: the guided two-hero stage (fixed party)
  await play(page, 'stage_1_1');
  await skipStory(page, info, 'Battle').catch(() => undefined);
  await autoBattle();
  await expect.poll(() => claimed('stage_1_1'), { timeout: 60_000 }).toBe(true);

  // 1-2: three story loans + the two starters; the party comes from the server, not from the client
  await goto(page, 'Chapters');
  await waitScene(page, 'Chapters');
  await play(page, 'stage_1_2');
  await waitScene(page, 'Battle');
  await expect.poll(async () => (await probeBattle(page)).prompt?.actor, { timeout: 60_000 }).toBeTruthy();
  const party = await page.evaluate(() => {
    const s = (window as any).__UOMD__.game.scene.getScene('Battle');
    return { ids: s.battle.combatants.filter((c: any) => c.side === 'player').map((c: any) => c.def.unit_id).sort(), session: Boolean(s.cfg.sessionId) };
  });
  expect(party).toEqual({ ids: ['brin_alder', 'fadyme', 'kera_voss', 'mahmut', 'nixie_vale'], session: true });
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-21-owned-battle.png` });
  await autoBattle();
  await expect.poll(() => claimed('stage_1_2'), { timeout: 60_000 }).toBe(true);
  const recruited = await page.evaluate(async () => ((await (window as any).__UOMD__.services.api.inventory()) as any[]).some((i) => i.item_type === 'character' && i.item_id === 'brin_alder'));
  expect(recruited).toBe(true); // clearing 1-2 recruits Brin permanently

  // the team builder lists the company and saves a preset the server accepts
  await goto(page, 'Team');
  await waitScene(page, 'Team');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-22-team.png` });
  await page.evaluate(() => (window as any).__UOMD__.services.api.saveTeam(1, 'Team 1', [{ characterId: 'brin_alder', slot: 0, row: 'front' }, { characterId: 'mahmut', slot: 1, row: 'front' }, { characterId: 'fadyme', slot: 2, row: 'rear' }]));
  await page.evaluate(() => (window as any).__UOMD__.services.api.activateTeam(1));
  const teams = await page.evaluate(() => (window as any).__UOMD__.services.api.teams());
  expect(teams.teams[0]).toMatchObject({ slot: 1, active: true });

  // a boss stage with a strong scratch party (client-side only, no claim): objectives are targets, the intent is announced, phases change
  await page.evaluate(async () => {
    const u = (window as any).__UOMD__;
    const strong = (id: string, slot: number, row: string) => ({ unit_id: id, level: 12, slot, row, stats: { hp: 400, atk: 6, def: 4, spd: 40 + slot } });
    u.game.scene.getScenes(true).forEach((s: any) => u.game.scene.stop(s.sys.settings.key));
    u.game.scene.start('Battle', {
      encounterPath: 'encounters/stage_1_5.json',
      party: [strong('mahmut', 0, 'front'), strong('brin_alder', 1, 'front'), strong('fadyme', 2, 'rear'), strong('nixie_vale', 3, 'rear'), strong('kera_voss', 4, 'rear')],
      onBack: (s: any) => s.scene.start('Title'),
      onDone: (s: any) => s.scene.start('Title')
    });
  });
  await waitScene(page, 'Battle');
  await expect.poll(async () => (await probeBattle(page)).prompt?.actor, { timeout: 60_000 }).toBeTruthy();
  const objectives = await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Battle').battle.combatants.filter((c: any) => c.objective).map((c: any) => c.def.unit_id));
  expect(objectives).toEqual(['jaw_bell']);
  await tap(page, info, REF_W - 150, 70);
  await tap(page, info, REF_W - 150, 70);
  // wait for the boss to announce Ash Howl, then capture the telegraph
  await expect
    .poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Battle').telegraphText?.text ?? ''), { timeout: 120_000, intervals: [400] })
    .toContain('ASH HOWL');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-23-boss-telegraph.png` });
  await tap(page, info, REF_W - 365, 70); // Auto breaks the Jaw Bell to interrupt the announced Howl
  await expect.poll(async () => (await probeBattle(page)).result, { timeout: 240_000 }).not.toBeNull();
  const log = await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Battle').battle.log.map((e: any) => e.type));
  expect(log).toContain('objective_destroyed');
  expect(log).toContain('telegraph_cancelled');
  expect(log.filter((t: string) => t === 'phase_change').length).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-24-boss-result.png` });

  // put the channel back on rel_0002 so the projects that run after this one see what they expect
  const back = await request.post(`${ADMIN}/admin/api/channels/dev/rollback`, { data: { releaseId: 'rel_0002' }, headers: { 'Cf-Access-Jwt-Assertion': jwt() } });
  expect(back.status()).toBeLessThan(300);
  expect(problems.filter((p) => !p.includes('favicon') && !p.includes('HTTP 404') && !p.includes('HTTP 409'))).toEqual([]);
});
