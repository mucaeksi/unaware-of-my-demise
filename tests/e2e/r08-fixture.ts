/** Disposable synthetic R08 transport/runtime fixture. No new canon, balance values, production media or private publication SQL. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArtManifest, EconomyCatalog, MEDIA_TYPE_BY_EXTENSION, type AllowedExtension } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { expect, type APIRequestContext } from '@playwright/test';
import { ADMIN } from './helpers';
const run = promisify(execFile); const root = fileURLToPath(new URL('../../', import.meta.url));
export const HERO = 'r08_probe_hero'; export const HERO_FIVE = 'r08_probe_five'; export const INVITATION = 'r08_probe_invitation'; export const ARMOR = 'r08_probe_armor'; export const BANNER = 'r08_probe_banner'; export const NODE = 'r08_probe_battle';
let baseTemplateCache: Map<string, Uint8Array> | null = null;
const uploadedObjectShas = new Set<string>();
async function loadBaseTemplate(): Promise<Map<string, Uint8Array>> {
  if (!baseTemplateCache) {
    baseTemplateCache = new Map<string, Uint8Array>();
    const walk = (dir: string, rel = '', out = baseTemplateCache!): void => { for (const n of readdirSync(join(root, dir, rel))) { const p = rel ? `${rel}/${n}` : n; if (statSync(join(root, dir, p)).isDirectory()) walk(dir, p, out); else if (p !== 'release.json') out.set(p, new Uint8Array(readFileSync(join(root, dir, p)))); } };
    walk('content/base');
    for (const bytes of baseTemplateCache.values()) uploadedObjectShas.add(await sha256Hex(bytes));
    walk('content/patches/rel_0003_part1_campaign');
  }
  return new Map(baseTemplateCache);
}
export async function publishFixture(request: APIRequestContext, id: string) {
  const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
  const response = await request.get(`${ADMIN}/admin/api/catalog/snapshot`, { headers }); expect(response.ok()).toBe(true);
  const catalog = EconomyCatalog.parse(JSON.parse((await response.json()).json));
  const files = await loadBaseTemplate();
  const json = (path: string) => JSON.parse(new TextDecoder().decode(files.get(path)!));
  const put = (path: string, value: unknown) => files.set(path, new TextEncoder().encode(JSON.stringify(value)));
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value).replaceAll('iona_mist', HERO));
  const original = catalog.characters.find((c) => c.id === 'iona_mist')!; const hero = clone(original); hero.name_en = 'Synthetic R08 Probe';
  const weapon = clone(catalog.gear.find((g) => g.gear_id === original.signature_weapon_id)!); weapon.gear_id = 'r08_probe_signature'; weapon.source_banner_id = null; hero.signature_weapon_id = weapon.gear_id;
  catalog.characters.push(hero); catalog.gear.push(weapon); catalog.skills.push(...catalog.skills.filter((s) => s.character_id === original.id).map(clone));
  catalog.items.push({ ...structuredClone(catalog.items.find((i) => i.item_id === 'first_oath_invitation')!), item_id: INVITATION });
  catalog.gear.push({ ...structuredClone(catalog.gear.find((g) => g.gear_id === 'armor_padded_3_01')!), gear_id: ARMOR });
  const banner = structuredClone(catalog.banners.find((b) => b.id === 'hall_of_ancestors')!); banner.id = BANNER; banner.config.id = BANNER; banner.config.pools.four = [HERO]; banner.config.pools.fiveOther = [HERO_FIVE]; banner.status = 'active'; catalog.banners.push(banner);
  const pack = json('units/unit_pack.json'); const unit = clone(pack.units.find((u: any) => u.unit_id === original.id)); unit.name_en = hero.name_en; unit.art_key = original.id; pack.units.push(unit); // Preserve canonical rates/guarantees: a five-star also satisfies the four-or-better guarantee.
  // Clone a five-star too, so either legitimate outcome always uses a declared-only identity.
  const originalFive = catalog.characters.find((c) => c.rarity === 5)!;
  const cloneFive = <T>(value: T): T => JSON.parse(JSON.stringify(value).replaceAll(originalFive.id, HERO_FIVE));
  const five = cloneFive(originalFive); five.name_en = 'Synthetic R08 Five Star';
  const fiveWeapon = cloneFive(catalog.gear.find((g) => g.gear_id === originalFive.signature_weapon_id)!); fiveWeapon.source_banner_id = null;
  five.signature_weapon_id = fiveWeapon.gear_id; catalog.characters.push(five); catalog.gear.push(fiveWeapon);
  catalog.skills.push(...catalog.skills.filter((s) => s.character_id === originalFive.id).map(cloneFive));
  const fiveUnit = cloneFive(pack.units.find((u: any) => u.unit_id === originalFive.id)); fiveUnit.name_en = five.name_en; fiveUnit.art_key = originalFive.id; pack.units.push(fiveUnit);
  put('units/unit_pack.json', pack);
  const encounter = { ...json('encounters/tutorial_t1.json'), encounter_id: 'r08_probe_encounter', party_mode: 'owned', party: [], guests: [], pre_story: undefined, post_story: undefined };
  put('encounters/r08_probe.json', encounter);
  const index = json('chapters/chapter_index.json'); index.chapters[0].nodes.push({ node_id: NODE, title_en: 'Synthetic R08 battle fixture', kind: 'battle', encounter: 'encounters/r08_probe.json' }, { node_id: 'r08_probe_choice', title_en: 'Synthetic R08 story fixture', kind: 'story', story: 'story/r08_probe.json', requires: NODE });
  // Existing opening selector gate is exercised separately; this synthetic selector follows the unconditionally accessible fixture node.
  index.recruit_selectors.push({ ...structuredClone(index.recruit_selectors[0]), item_id: INVITATION, choices: [HERO], after_node: NODE, scene_node: 'r08_probe_choice' }); put('chapters/chapter_index.json', index);
  const art = ArtManifest.parse(json('art/art_manifest.json')); art.stills.r08_probe_plate = art.backgrounds.forest_whispering_ash!; art.ui.r08_probe_mask = 'art/r08_probe_mask.png';
  const idle = art.units.iona_mist.states.idle; idle.animation = { frames: [idle.frame, art.units.iona_mist.states.guard?.frame ?? idle.frame], fps: 8, loop: true }; put('art/art_manifest.json', art);
  const scene = { schema_version: 1, scene_id: 'r08_probe_reader', title_en: 'Synthetic runtime fixture', location_id: 'forest_whispering_ash', provenance: { source: 'test only: no canon or paid asset' }, commands: [
    { op: 'layer', layer_id: 'fixture_layer', kind: 'ui', art_id: 'r08_probe_mask', x: 960, y: 430, width: 800, height: 450, alpha: 1, depth: 1 },
    { op: 'mask', layer_id: 'fixture_layer', shape: 'ellipse', x: 960, y: 430, width: 800, height: 450 },
    { op: 'camera', x: 960, y: 540, zoom: 1.1, seconds: 0.2 },
    { op: 'animate', layer_id: 'fixture_layer', to: { alpha: 0.7 }, seconds: 0.2, ease: 'sine', wait: true },
    { op: 'set_flag', flag: 'fixture_seen', value: true }, { op: 'checkpoint', checkpoint_id: 'fixture_checkpoint' },
    { op: 'narrate', line_id: 'r08_probe_line_one', text: 'Synthetic transport subtitle.' },
    { op: 'video', video_id: 'r08_probe_video', skippable: false },
    { op: 'branch', flag: 'fixture_seen', equals: true, goto: 'fixture_end' },
    { op: 'narrate', line_id: 'r08_probe_unreachable', text: 'Unreachable fixture branch.' },
    { op: 'label', name: 'fixture_end' }, { op: 'panel', panel_id: 'r08_probe_panel' }, { op: 'end' }
  ] }; put('story/r08_probe.json', scene);
  // Non-speech sine tone and test-pattern video validate decoding/lifecycle only, never Japanese performance or production art quality.
  const dir = join(root, '.cache/r08-fixture'); mkdirSync(dir, { recursive: true });
  const maskPath = join(dir, 'mask.png');
  if (!existsSync(maskPath)) await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x3a90c0:s=128x128', '-frames:v', '1', maskPath]);
  files.set('art/r08_probe_mask.png', new Uint8Array(readFileSync(maskPath)));
  files.set('video/r08_broken.webm', new TextEncoder().encode('Synthetic undecodable media fixture only'));
  put('story/r08_failure.json', { schema_version: 1, scene_id: 'r08_failure_probe', title_en: 'Synthetic decoder failure fixture', location_id: 'forest_whispering_ash', provenance: { source: 'test only' }, commands: [{ op: 'video', video_id: 'r08_broken_video', skippable: false }, { op: 'narrate', line_id: 'r08_failure_line', text: 'English fallback remains readable.' }, { op: 'end' }] });
  const videoPath = join(dir, 'probe.webm'); const voicePath = join(dir, 'probe.ogg');
  if (!existsSync(videoPath)) await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=12', '-t', '8', '-c:v', 'libvpx-vp9', '-b:v', '80k', '-an', videoPath]);
  if (!existsSync(voicePath)) await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', 'libvorbis', voicePath]);
  files.set('video/r08_probe.webm', new Uint8Array(readFileSync(videoPath))); files.set('audio/r08_probe.ogg', new Uint8Array(readFileSync(voicePath)));
  const basePresentation = json('presentation/presentation.json'); // the recorded base prologue keeps every Japanese line
  put('presentation/presentation.json', { ...basePresentation, schema_version: 1, voices: { ...basePresentation.voices, r08_probe_line_one: { file: 'audio/r08_probe.ogg', language: 'ja', reviewed_transcript_sha256: 'a'.repeat(64), duration_s: 1 } }, videos: { r08_broken_video: { file: 'video/r08_broken.webm', audio: 'none', duration_s: 3, captions: [{ line_id: 'r08_probe_line_one', text_en: 'Synthetic transport subtitle.', start_s: 0, end_s: 3 }] }, r08_probe_video: { file: 'video/r08_probe.webm', audio: 'none', duration_s: 8, captions: [{ line_id: 'r08_probe_line_one', text_en: 'Synthetic transport subtitle.', start_s: 0, end_s: 7.9 }] } }, locales: ['tr'], panels: { r08_probe_panel: { title: { text_en: 'Synthetic notice', text_id: 'r08.notice.title' }, body: [{ text_en: 'Synthetic runtime test only.', text_id: 'r08.notice.body' }], image_id: 'r08_probe_plate', buttons: [{ label: { text_en: 'Close' }, action: { type: 'close' } }] } } });
  put('locales/tr.json', { schema_version: 1, locale: 'tr', fallback: 'en', strings: { r08_probe_line_one: 'Sentetik aktarım altyazısı.', 'r08.notice.title': 'Sentetik duyuru', 'r08.notice.body': 'Yalnızca sentetik çalışma testi.' } });
  put('catalog/economy.json', catalog);
  const entries: { path: string; sha256: string }[] = [];
  const toUpload: { path: string; sha256: string; bytes: Uint8Array }[] = [];
  for (const [path, bytes] of files) {
    const sha256 = await sha256Hex(bytes);
    entries.push({ path, sha256 });
    if (!uploadedObjectShas.has(sha256)) {
      uploadedObjectShas.add(sha256);
      toUpload.push({ path, sha256, bytes });
    }
  }
  for (let i = 0; i < toUpload.length; i += 8) {
    await Promise.all(toUpload.slice(i, i + 8).map(async ({ path, sha256, bytes }) => {
      // content-addressed, so a retry is safe; the local workerd stack sometimes drops one of the parallel uploads ("Network connection lost")
      let result = await request.put(`${ADMIN}/admin/api/objects/${sha256}`, { headers: { ...headers, 'Content-Type': MEDIA_TYPE_BY_EXTENSION[path.split('.').pop() as AllowedExtension] }, data: Buffer.from(bytes) });
      for (let attempt = 1; attempt < 3 && result.status() >= 500; attempt++) result = await request.put(`${ADMIN}/admin/api/objects/${sha256}`, { headers: { ...headers, 'Content-Type': MEDIA_TYPE_BY_EXTENSION[path.split('.').pop() as AllowedExtension] }, data: Buffer.from(bytes) });
      expect(result.ok(), `${path}: ${result.status()} ${result.ok() ? '' : await result.text()}`).toBe(true);
    }));
  }
  const created = await request.post(`${ADMIN}/admin/api/releases`, { headers, data: { id, channel: 'dev', files: entries, notes: 'Synthetic R08 integration fixture only' } }); expect(created.status(), await created.text()).toBe(201);
  const published = await request.post(`${ADMIN}/admin/api/releases/${id}/publish`, { headers, data: {} }); expect(published.status(), await published.text()).toBe(200);
  // A local readable fixture artifact, useful when a regression fails; contains no credentials.
  writeFileSync(join(dir, `${id}.summary.json`), JSON.stringify({ releaseId: id, files: entries.length, hero: HERO }));
  return { pack, encounter, headers };
}
