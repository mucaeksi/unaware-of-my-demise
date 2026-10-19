import { expect, test } from '@playwright/test';
import { playAuto } from '@uomd/combat';
import { ADMIN, GAME, SHOTS, finishBattleWithPolicy, openGame, signInDev, tap, waitScene } from './helpers';
import { ARMOR, BANNER, HERO, HERO_FIVE, INVITATION, NODE, publishFixture } from './r08-fixture';

test('one unchanged browser binary installs a signed synthetic season and uses its catalog, media, UI and animations', async ({ page, request }, info) => {
  const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
  const original = await (await request.get(`${GAME}/api/v1/content/channels/dev/manifest`)).json();
  const releaseId = `rel_r08_${info.project.name.startsWith('phone') ? 'phone' : 'desktop'}`;
  const problems = await openGame(page);
  try {
    const fixture = await publishFixture(request, releaseId);
    const manifest = await (await request.get(`${GAME}/api/v1/content/channels/dev/manifest`)).json();
    expect(manifest.compat).toMatchObject({ min_client: '0.1.2', required_capabilities: ['attributes_v1', 'catalog_v1', 'locale_v1', 'presentation_v1', 'sprite_animation_v1', 'story_flags_v1', 'vfx_v1'] });
    // Same page/assets/binary throughout installation. No app rebuild, SQL publication or client response stubs.
    expect(await page.evaluate(async () => (window as any).__UOMD__.services.content.checkForUpdates({ activate: false }))).toMatchObject({ status: 'staged', releaseId });
    await page.reload(); await waitScene(page, 'Title');
    expect(await page.evaluate(async () => (window as any).__UOMD__.services.content.activeReleaseId())).toBe(releaseId);
    const player = await signInDev(page, `r08-complete-${info.project.name}`);
    const mail = await request.post(`${ADMIN}/admin/api/players/${player.id}/mail`, { headers, data: { reason: 'disposable R08 integration fixture only', mail: { kind: 'reward', title: 'Synthetic R08 test grants', attachments: [{ type: 'item', itemId: INVITATION, quantity: 1 }, { type: 'item', itemId: 'bound_chronicle', quantity: 2 }, { type: 'account_xp', amount: 2000 }, { type: 'gear', gearId: ARMOR }, { type: 'currency', currency: 'eclipse_token', amount: 2000 }] } } });
    expect(mail.ok(), await mail.text()).toBe(true); await page.evaluate(async (id) => (window as any).__UOMD__.services.api.claimMail(id), (await mail.json()).id);
    // Earn the synthetic selector's battle gate using the exact server-frozen starter party.
    const initial = await page.evaluate(async ({ releaseId, node }) => (window as any).__UOMD__.services.api.startBattle(releaseId, node), { releaseId, node: NODE });
    const fought = playAuto(fixture.pack, fixture.encounter, initial.party); expect(fought.battle.result?.winner).toBe('player');
    await page.evaluate(async ({ releaseId, node, actions, sessionId }) => (window as any).__UOMD__.services.api.submitBattle(releaseId, node, actions, sessionId), { releaseId, node: NODE, actions: fought.actions, sessionId: initial.sessionId });
    // Locale is selected through the compiled settings controls.
    await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Title').openSettings());
    await expect.poll(() => page.evaluate(() => !!(window as any).__UOMD__.game.scene.getScene('Title').overlay)).toBe(true);
    await page.waitForTimeout(250); // let the settings modal settle before the first tap
    await tap(page, info, 1310, 570);
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Title').texts().includes('TR'))).toBe(true);
    await tap(page, info, 1210, 940);
    await page.evaluate(({ releaseId }) => {
      const u = (window as any).__UOMD__;
      u.game.scene.getScene('Title').nav.start('Story', { path: 'story/r08_probe.json', authRevision: u.services.api.authRevision, onDone: async (scene: any) => { await u.services.api.completeStory(releaseId, 'r08_probe_choice'); scene.nav.start('Title'); }, onBack: (scene: any) => scene.nav.start('Title') });
    }, { releaseId });
    await waitScene(page, 'Story');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story').bodyText?.text)).toBe('Sentetik aktarım altyazısı.');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem(`uomd.continuity.v1:${(window as any).__UOMD__.services.flowKey()}`)!).stories['story/r08_probe.json'].state.flags)).toEqual({ fixture_seen: true });
    expect(await page.evaluate(() => { const layer = (window as any).__UOMD__.game.scene.getScene('Story').stage.layers.get('fixture_layer'); return !!layer?.mask && layer.image.mask === layer.mask; })).toBe(true);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-r08-layer-locale.png` });
    await tap(page, info, 960, 420);
    const dialog = page.getByRole('dialog', { name: 'Story video' }); await expect(dialog).toBeVisible();
    await expect(dialog.locator('.uomd-video-caption')).toContainText('Sentetik aktarım altyazısı.');
    expect(await dialog.getByRole('button', { name: 'SKIP', exact: true }).count()).toBe(0);
    const play = dialog.getByRole('button', { name: /PLAY|PAUSE/, exact: true });
    if (await play.textContent() === 'PLAY') await play.click();
    await expect.poll(() => dialog.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2);
    await dialog.getByRole('button', { name: 'PAUSE', exact: true }).click(); const pausedAt = await dialog.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime);
    await page.waitForTimeout(300); expect(await dialog.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(pausedAt, 1);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-r08-video-paused.png` });
    await dialog.getByRole('button', { name: 'PLAY', exact: true }).click(); await expect(dialog).not.toBeVisible({ timeout: 20_000 });
    await waitScene(page, 'ContentPanel');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('ContentPanel').texts().includes('Yalnızca sentetik çalışma testi.'))).toBe(true);
    expect(await page.evaluate(() => { const scene = (window as any).__UOMD__.game.scene; const order = scene.getScenes(false); const story = order.indexOf(scene.getScene('Story')); return story >= 0 && order.indexOf(scene.getScene('ContentPanel')) > story; })).toBe(true);
    await page.waitForTimeout(450); await page.screenshot({ path: `${SHOTS}/${info.project.name}-r08-notice.png` });
    await tap(page, info, 960, 820); await waitScene(page, 'Title');
    const recruited = await page.evaluate(async ({ releaseId, invitation, hero }) => (window as any).__UOMD__.services.api.selectRecruit(releaseId, invitation, hero), { releaseId, invitation: INVITATION, hero: HERO });
    expect(recruited).toMatchObject({ releaseId, characterId: HERO, consumed: 1 });
    await page.evaluate((hero) => (window as any).__UOMD__.game.scene.getScene('Title').nav.start('Character', { id: hero }), HERO); await waitScene(page, 'Character');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Character').texts().some((t: string) => t.startsWith('Level 1 /')))).toBe(true);
    await tap(page, info, 340, 600); await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Character').texts().some((t: string) => t.startsWith('Level 3 /')))).toBe(true);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-r08-new-hero-growth.png` });
    await page.evaluate(async ({ releaseId, hero, heroFive, armor, banner }) => {
      const api = (window as any).__UOMD__.services.api; const instance = (await api.gear(releaseId)).find((g: any) => g.gearId === armor);
      await api.equip(instance.id, hero, releaseId);
      await api.saveTeam(1, 'Synthetic R08 team', [{ characterId: hero, slot: 0, row: 'rear' }, { characterId: 'mahmut', slot: 1, row: 'front' }], releaseId); await api.activateTeam(1, releaseId);
      const result = await api.pull(banner, 10, undefined, releaseId);
      if (result.releaseId !== releaseId || result.pulls.length !== 10 || !result.pulls.some((p: any) => p.rarity >= 4) || result.pulls.some((p: any) => p.rarity === 4 && p.itemId !== hero || p.rarity === 5 && p.itemId !== heroFive)) throw new Error('the declared banner did not honor its signed pools and four-or-better guarantee');
    }, { releaseId, hero: HERO, heroFive: HERO_FIVE, armor: ARMOR, banner: BANNER });
    await page.evaluate(async ({ releaseId, node }) => {
      const u = (window as any).__UOMD__; const started = await u.services.api.startBattle(releaseId, node);
      u.game.scene.getScene('Character').nav.start('Battle', { encounterPath: 'encounters/r08_probe.json', nodeId: node, releaseId, party: started.party, sessionId: started.sessionId, onBack: (s: any) => s.nav.start('Title'), onDone: (s: any) => s.nav.start('Title') });
    }, { releaseId, node: NODE });
    await waitScene(page, 'Battle');
    await expect.poll(() => page.evaluate(() => [...(window as any).__UOMD__.game.scene.getScene('Battle').views.values()].some((v: any) => v.unitName === 'Synthetic R08 Probe' && !!v.frames))).toBe(true);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-r08-new-hero-battle.png` });
    const claim = page.waitForResponse((response) => response.url().endsWith('/api/v1/progress/battle') && response.request().method() === 'POST');
    await finishBattleWithPolicy(page); const verified = await claim; expect(verified.status()).toBe(200); expect(await verified.json()).toMatchObject({ stars: 3, ration: { spent: 0 }, repeatRewardsAllowed: false });
    // Scene shutdown must release HTML media, layers, Blob owners and this patch's atlas animations safely.
    await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Battle').nav.start('Title')); await waitScene(page, 'Title');
    expect(await page.locator('.uomd-video-dialog').count()).toBe(0);
    const resources = await page.evaluate(() => { const c = (window as any).__UOMD__.services.content; return { assets: c.assets.size, owners: [...c.assets.values()].map((v: any) => v.owners.size) }; });
    expect(resources.assets).toBeLessThan(30); expect(resources.owners.every((n: number) => n > 0)).toBe(true);
    await page.evaluate(() => { const u = (window as any).__UOMD__; u.game.scene.getScene('Title').nav.start('Story', { path: 'story/r08_failure.json', onDone: (s: any) => s.nav.start('Title'), onBack: (s: any) => s.nav.start('Title') }); });
    const failedVideo = page.getByRole('dialog', { name: 'Story video' }); await expect(failedVideo).toBeVisible(); await expect(failedVideo.getByRole('button', { name: 'CONTINUE', exact: true })).toBeVisible();
    await expect(failedVideo.locator('.uomd-video-caption')).toContainText('Sentetik aktarım altyazısı.'); await failedVideo.getByRole('button', { name: 'CONTINUE', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story').bodyText.text)).toBe('English fallback remains readable.');
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-r08-media-fallback.png` });
    await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story').nav.start('Title')); await waitScene(page, 'Title');
    await page.evaluate(() => { const u = (window as any).__UOMD__; u.game.scene.getScene('Title').nav.start('Story', { path: 'story/r08_failure.json', authRevision: u.services.api.authRevision, onDone: (s: any) => s.nav.start('Title'), onBack: (s: any) => s.nav.start('Title') }); });
    await expect(failedVideo).toBeVisible(); await page.evaluate(async () => (window as any).__UOMD__.services.api.signOut()); await waitScene(page, 'Title'); await expect(failedVideo).not.toBeVisible();
    expect(problems.filter((p) => !p.includes('favicon'))).toEqual([]);
  } finally {
    expect((await request.post(`${ADMIN}/admin/api/channels/dev/rollback`, { headers, data: { releaseId: original.release.id } })).status()).toBe(200);
  }
});
