import { beforeAll, beforeEach, expect, it } from 'vitest';
import { NarrativeLibrary } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { admin, baseEnv, entries, game, resetContent, signIn, upload } from './helpers';
import { campaignFiles, type TestFile } from './fixtures';
import { ContentStore } from '../src/content/store';
const releaseId = 'rel_presentation_probe';
let files: TestFile[]; let event: NarrativeLibrary['entries'][number];
const jsonFile = async (path: string, value: unknown): Promise<TestFile> => { const bytes = new TextEncoder().encode(JSON.stringify(value)); return { path, bytes, sha256: await sha256Hex(bytes), mediaType: 'application/json' }; };
const post = (body: unknown, auth: Record<string, string> = {}) => ({ method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeAll(async () => {
  const all = await campaignFiles();
  const basePres = JSON.parse(new TextDecoder().decode(all.find((f) => f.path === 'presentation/presentation.json')!.bytes)) as Record<string, unknown>;
  files = all.filter((f) => f.path !== 'presentation/presentation.json');
  const library = NarrativeLibrary.parse(JSON.parse(new TextDecoder().decode(files.find((f) => f.path === 'library/library_index.json')!.bytes)));
  event = library.entries.find((e) => e.kind === 'event')!;
  const closed = { starts_at: '2000-01-01T00:00:00Z', ends_at: '2000-01-02T00:00:00Z' };
  const notice = { title: { text_en: 'Synthetic notice' }, body: [{ text_en: 'Test only' }], buttons: [{ label: { text_en: 'Close' }, action: { type: 'close' } }] };
  files.push(await jsonFile('presentation/presentation.json', { ...basePres, panels: { open_notice: notice, gated_notice: { ...notice, after_node: 'stage_1_1' }, expired_notice: { ...notice, window: closed } } }),
    await jsonFile('schedules/events.json', { schema_version: 1, events: [{ entry_id: event.entry_id, window: closed }] }),
    await jsonFile('schedules/shop.json', { schema_version: 1, offers: [{ product_id: 'schedule_probe', window: closed }] }));
});
beforeEach(async () => {
  await resetContent();
  await baseEnv.DB.prepare("INSERT OR IGNORE INTO shop_products (product_id, kind, title_en, grants, active) VALUES ('schedule_probe', 'consumable', 'Synthetic schedule probe', '[]', 1)").run();
  await upload(files); const draft = await admin('/admin/api/releases', post({ id: releaseId, channel: 'dev', files: entries(files) })); expect(draft.status, await draft.clone().text()).toBe(201);
  expect((await admin(`/admin/api/releases/${releaseId}/publish`, post({}))).status).toBe(200);
});
it('admits fixed UI panels by server time and account progress without revealing gated panel IDs', async () => {
  const player = await signIn(`panels-${crypto.randomUUID()}`);
  expect((await game(`/api/v1/presentation/panels?releaseId=${releaseId}`)).status).toBe(401);
  const read = () => game(`/api/v1/presentation/panels?releaseId=${releaseId}`, { headers: player.auth });
  expect(await (await read()).json()).toMatchObject({ releaseId, panelIds: ['open_notice'] });
  await baseEnv.DB.prepare("INSERT INTO player_progress (player_id, node_id, stars, clears) VALUES (?1, 'stage_1_1', 3, 1)").bind(player.playerId).run();
  expect(await (await read()).json()).toMatchObject({ panelIds: ['open_notice', 'gated_notice'] });
  const object = files.find((f) => f.path === 'presentation/presentation.json')!;
  await baseEnv.CONTENT.delete(ContentStore.objectKey(object.sha256)); expect((await read()).status).toBe(503);
});
it('hides an expired event for new readers while retaining its completed archive', async () => {
  const { playerId, auth } = await signIn(`event-${crypto.randomUUID()}`);
  for (const id of [event.gate.after_node, event.gate.after_entry].filter((id): id is string => !!id)) await baseEnv.DB.prepare('INSERT OR REPLACE INTO player_progress (player_id, node_id, stars, clears) VALUES (?1, ?2, 3, 1)').bind(playerId, id).run();
  if (event.gate.owned_character) await baseEnv.DB.prepare("INSERT OR IGNORE INTO player_items (player_id, item_type, item_id) VALUES (?1, 'character', ?2)").bind(playerId, event.gate.owned_character).run();
  const detail = () => game(`/api/v1/library/${event.entry_id}?releaseId=${releaseId}`, { headers: auth });
  expect((await detail()).status).toBe(403);
  const completion = await game('/api/v1/progress/story', post({ releaseId, nodeId: event.entry_id, requestId: 'expired_event_probe' }, auth)); expect(completion.status).toBe(403);
  await baseEnv.DB.prepare('INSERT INTO player_progress (player_id, node_id, stars, clears) VALUES (?1, ?2, 0, 1)').bind(playerId, event.entry_id).run();
  expect((await detail()).status).toBe(200);
  expect(await (await game(`/api/v1/library?releaseId=${releaseId}`, { headers: auth })).json()).toMatchObject({ entries: expect.arrayContaining([expect.objectContaining({ entry_id: event.entry_id, completed: true })]) });
});
it('uses the selected immutable shop availability calendar and never falls back after declared calendar loss', async () => {
  const read = () => game(`/api/v1/shop/products?releaseId=${releaseId}`);
  expect(await (await read()).json()).toMatchObject({ products: expect.not.arrayContaining([expect.objectContaining({ productId: 'schedule_probe' })]) });
  const object = files.find((f) => f.path === 'schedules/shop.json')!; await baseEnv.CONTENT.delete(ContentStore.objectKey(object.sha256)); expect((await read()).status).toBe(503);
});
it('serves only published immutable byte ranges and rejects ambiguous or out-of-bounds ranges', async () => {
  const object = files.find((f) => f.path.endsWith('.ogg'))!; const url = `/api/v1/content/objects/${object.sha256}`;
  const partial = await game(url, { headers: { Range: 'bytes=3-' } }); expect(partial.status).toBe(206); expect(partial.headers.get('Content-Range')).toBe(`bytes 3-${object.bytes.length - 1}/${object.bytes.length}`); expect(new Uint8Array(await partial.arrayBuffer())).toEqual(object.bytes.slice(3));
  for (const range of ['bytes=-3', 'bytes=1-2,4-5', `bytes=${object.bytes.length}-`]) expect((await game(url, { headers: { Range: range } })).status).toBe(416);
  const privateBytes = new TextEncoder().encode('private range fixture'); const privateSha = await sha256Hex(privateBytes); await new ContentStore(baseEnv.DB, baseEnv.CONTENT).putObject(privateSha, privateBytes.buffer as ArrayBuffer, 'text/plain');
  expect((await game(`/api/v1/content/objects/${privateSha}`, { headers: { Range: 'bytes=1-' } })).status).toBe(404);
});
