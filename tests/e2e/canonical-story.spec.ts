import { expect, test } from '@playwright/test';
import { ADMIN, SHOTS, openGame, signInDev, skipStory, tap, waitScene } from './helpers';
import { publishCampaign } from './stack';

test('canonical story: signed patch, saved opening and both Construct phase interludes pause/resume the real battle', async ({ page, request }, info) => {
  test.setTimeout(360_000);
  const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
  const id = `rel_canon_${info.project.name.replaceAll('-', '_')}`;
  await publishCampaign(process.env.E2E_ADMIN_JWT!, id);
  try {
    const problems = await openGame(page);
    await signInDev(page, `canonical-${info.project.name}`);
    await page.evaluate(async () => { const u = (window as any).__UOMD__; await u.services.content.checkForUpdates(); await u.services.refreshArt(); });
    expect(await page.evaluate(async () => (window as any).__UOMD__.services.content.activeReleaseId())).toBe(id);
    const coverage = await page.evaluate(async () => (await (window as any).__UOMD__.services.content.chapters()).story_coverage);
    expect(coverage.entries).toHaveLength(51);
    expect(coverage.entries.flatMap((entry: { line_ids: string[] }) => entry.line_ids)).toHaveLength(419);
    await page.evaluate(async () => {
      const u = (window as any).__UOMD__; const index = await u.services.content.chapters();
      await u.playNode(u.game.scene.getScenes(true)[0], index.chapters[1].nodes[0]);
    });
    await waitScene(page, 'Story');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story').bodyText?.text.length)).toBeGreaterThan(10);
    await expect.poll(() => page.evaluate(() => !(window as any).__UOMD__.game.scene.getScene('Story').fading)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-canonical-opening.png` });
    await skipStory(page, info, 'Chapters');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Chapters').texts().includes('LOCKED STORY'))).toBe(true);
    expect(await page.evaluate(async () => {
      const u = (window as any).__UOMD__; const index = await u.services.content.chapters();
      const text = u.game.scene.getScene('Chapters').texts().join('\n');
      return index.chapters.flatMap((chapter: any) => chapter.nodes).filter((node: any) => ['part1_emotional_confession', 'part1_clockless_reveal'].includes(node.node_id)).some((node: any) => text.includes(node.title_en.toUpperCase()));
    })).toBe(false);
    expect(await page.evaluate(async () => (await (window as any).__UOMD__.services.api.progress()).nodes.find((node: any) => node.node_id === 'opening_sad_scene'))).toMatchObject({ stars: 0, clears: 1 });
    expect(await page.evaluate(async () => {
      const u = (window as any).__UOMD__; return u.services.api.startBattle(await u.services.content.activeReleaseId(), 'stage_1_1');
    })).toMatchObject({ sessionId: expect.any(String) });

    // An anonymous scratch battle tests presentation, not economy/balance or late-story admission.
    // Stats belong only to this local fixture; release data and the engine remain unchanged.
    await page.evaluate(() => {
      const u = (window as any).__UOMD__;
      u.game.scene.getScenes(true).forEach((scene: any) => u.game.scene.stop(scene.key));
      u.game.scene.start('Battle', { encounterPath: 'encounters/stage_7_5.json',
        party: [{ unit_id: 'mahmut', level: 20, slot: 0, row: 'front', stats: { hp: 100000, atk: 6000, def: 50, spd: 20 } }],
        onDone: (scene: any) => scene.nav.start('Title'), onBack: (scene: any) => scene.nav.start('Title') });
    });
    await waitScene(page, 'Battle');
    const expectedPaths = ['story/vn_7_5_phase_1_break.json', 'story/vn_7_5_phase_2_ward.json'];
    const seen: string[] = [];
    const deadline = Date.now() + 240_000;
    while (seen.length < expectedPaths.length && Date.now() < deadline) {
      const state = await page.evaluate(() => {
        const u = (window as any).__UOMD__; const battle = u.game.scene.getScene('Battle'); const story = u.game.scene.getScene('Story');
        if (u.game.scene.isActive('Story') && /^node_7_5_phase[12]_/.test(story.currentLine?.lineId ?? '') && story.bodyText?.text.length) return { path: story.init0.path, paused: u.game.scene.isPaused('Battle') };
        if (battle.pendingResolve) battle.pendingResolve(battle.battle.autoAction());
        return null;
      });
      if (state && !seen.includes(state.path)) {
        expect(state.path).toBe(expectedPaths[seen.length]); expect(state.paused).toBe(true); seen.push(state.path);
        expect(await page.evaluate(() => {
          const keys = (window as any).__UOMD__.game.scene.getScenes(false).map((scene: any) => scene.key);
          return keys.indexOf('Story') > keys.indexOf('Battle');
        })).toBe(true);
        await expect.poll(() => page.evaluate(() => !(window as any).__UOMD__.game.scene.getScene('Story').fading)).toBe(true);
        const before = await page.evaluate(() => { const battle = (window as any).__UOMD__.game.scene.getScene('Battle'); return { log: battle.battle.log.length, actions: battle.recorded.length }; });
        await page.waitForTimeout(500);
        expect(await page.evaluate(() => { const battle = (window as any).__UOMD__.game.scene.getScene('Battle'); return { log: battle.battle.log.length, actions: battle.recorded.length }; })).toEqual(before);
        await page.screenshot({ path: `${SHOTS}/${info.project.name}-canonical-phase-${seen.length}.png` });
        // Read through this interlude, waiting for the next one or the battle to resume.
        for (let i = 0; i < 30; i++) {
          const current = await page.evaluate(() => { const u = (window as any).__UOMD__; return u.game.scene.isActive('Story') ? u.game.scene.getScene('Story').init0.path : null; });
          if (current !== state.path) break;
          await tap(page, info, 960, 420); await page.waitForTimeout(200);
        }
      }
      await page.waitForTimeout(250);
    }
    expect(seen).toEqual(expectedPaths);
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.isActive('Battle'))).toBe(true);
    expect(await page.evaluate(() => (window as any).__UOMD__.game.scene.isActive('Story'))).toBe(false);
    expect(problems.filter((problem) => !problem.includes('favicon'))).toEqual([]);
  } finally {
    expect((await request.post(`${ADMIN}/admin/api/channels/dev/rollback`, { headers, data: { releaseId: 'rel_0001' } })).ok()).toBe(true);
  }
});
