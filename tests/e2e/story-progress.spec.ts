import { expect, test } from '@playwright/test';
import { ChapterIndex, StoryScene } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { ADMIN, GAME, SHOTS, openGame, signInDev, tap, waitScene } from './helpers';

test('story progress: real reader completion survives response loss and reload without a second write', async ({ page, request }, info) => {
  const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
  const index = ChapterIndex.parse(await (await request.get(`${GAME}/content/base/chapters/chapter_index.json`)).json());
  index.chapters[0]!.nodes[0]!.requires = 'e2e_story_intro';
  index.chapters[0]!.nodes.unshift({ node_id: 'e2e_story_intro', title_en: 'Story progress fixture', kind: 'story', story: 'story/e2e_story_intro.json' });
  const scene = StoryScene.parse({ schema_version: 1, scene_id: 'e2e_story_intro', title_en: 'Story progress fixture', location_id: 'forest_whispering_ash',
    commands: [{ op: 'background', location_id: 'forest_whispering_ash' }, { op: 'show', character: 'mahmut', side: 'left' },
      { op: 'say', line_id: 'e2e_story_line', speaker: 'mahmut', speaker_display: 'Mahmut', text: 'We keep the same road.', emotion: 'composed' }, { op: 'end' }],
    provenance: { source: 'e2e:isolated story completion fixture' } });
  const files = [];
  for (const [path, value] of [['chapters/chapter_index.json', index], ['story/e2e_story_intro.json', scene]] as const) {
    const bytes = new TextEncoder().encode(JSON.stringify(value)); const sha256 = await sha256Hex(bytes);
    expect((await request.put(`${ADMIN}/admin/api/objects/${sha256}`, { headers: { ...headers, 'Content-Type': 'application/json' }, data: Buffer.from(bytes) })).ok()).toBe(true);
    files.push({ path, sha256 });
  }
  const id = `rel_story_${info.project.name.replaceAll('-', '_')}`;
  expect((await request.post(`${ADMIN}/admin/api/releases`, { headers, data: { id, channel: 'dev', dependsOn: 'rel_0001', files } })).status()).toBe(201);
  expect((await request.post(`${ADMIN}/admin/api/releases/${id}/publish`, { headers, data: {} })).status()).toBe(200);
  try {
    await openGame(page); await signInDev(page, `story-reader-${info.project.name}`);
    await page.evaluate(async () => (window as any).__UOMD__.services.content.checkForUpdates());
    expect(await page.evaluate(async () => (window as any).__UOMD__.services.content.activeReleaseId())).toBe(id);
    await page.evaluate(async () => {
      const u = (window as any).__UOMD__;
      const index = await u.services.content.chapters();
      const node = index.chapters[0].nodes.find((node: any) => node.node_id === 'e2e_story_intro');
      await u.playNode(u.game.scene.getScenes(true)[0], node);
    });
    await waitScene(page, 'Story');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story').bodyText?.text)).toBe('We keep the same road.');
    await expect.poll(() => page.evaluate(() => !(window as any).__UOMD__.game.scene.getScene('Story').fading)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-story-reader.png` });
    let originalId = ''; let committed = false;
    await page.route('**/api/v1/progress/story', async (route) => {
      originalId = route.request().postDataJSON().requestId;
      expect((await route.fetch()).status()).toBe(200); committed = true; await route.abort('failed');
    });
    await tap(page, info, 960, 420);
    await expect.poll(() => committed).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story').texts().includes('RETRY SAVE'))).toBe(true);
    await page.unroute('**/api/v1/progress/story'); await page.reload();
    await page.waitForFunction(() => (window as any).__UOMD__?.services.api.signedIn);
    let writes = 0;
    await page.route('**/api/v1/progress/story', async (route) => { writes++; await route.abort('failed'); });
    const recovered = await page.evaluate(async (id) => (window as any).__UOMD__.services.api.retryOperation(id), originalId);
    expect(recovered).toMatchObject({ requestId: originalId, nodeId: 'e2e_story_intro', completed: true });
    expect(writes).toBe(0);
    expect(await page.evaluate(async () => ((await (window as any).__UOMD__.services.api.progress()).nodes).find((node: any) => node.node_id === 'e2e_story_intro'))).toMatchObject({ stars: 0, clears: 1 });
    expect(await page.evaluate(async () => (window as any).__UOMD__.services.api.startBattle((await (window as any).__UOMD__.services.content.activeReleaseId()), 't1'))).toMatchObject({ sessionId: expect.any(String) });
    await signInDev(page, `story-other-${info.project.name}`);
    expect(await page.evaluate(async () => (await (window as any).__UOMD__.services.api.progress()).nodes)).toEqual([]);
  } finally {
    expect((await request.post(`${ADMIN}/admin/api/channels/dev/rollback`, { headers, data: { releaseId: 'rel_0001' } })).ok()).toBe(true);
  }
});
