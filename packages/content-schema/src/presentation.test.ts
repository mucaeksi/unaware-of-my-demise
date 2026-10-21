import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PresentationPack, PresentationCommand, validateContentSet, requiredContentCapabilities } from './index';
const root = fileURLToPath(new URL('../../../content/base/', import.meta.url));
const walk = (rel = ''): string[] => readdirSync(join(root, rel)).flatMap((n) => { const p = rel ? `${rel}/${n}` : n; return statSync(join(root, p)).isDirectory() ? walk(p) : [p]; });
const base = () => new Map(walk().filter((p) => p !== 'release.json').map((p) => [p, new Uint8Array(readFileSync(join(root, p)))]));
const put = (files: Map<string, Uint8Array>, path: string, value: unknown) => files.set(path, new TextEncoder().encode(JSON.stringify(value)));
const scenePath = 'story/presentation_probe.json';
const lineId = 'presentation_probe_line';
function fixture() {
  const files = base(); const art = JSON.parse(new TextDecoder().decode(files.get('art/art_manifest.json')));
  const image = Object.keys(art.ui)[0];
  put(files, scenePath, { schema_version: 1, scene_id: 'presentation_probe', title_en: 'Synthetic fixture', location_id: 'forest_whispering_ash', provenance: { source: 'test only' }, commands: [
    { op: 'layer', layer_id: 'probe_layer', kind: 'ui', art_id: image, x: 960, y: 540, width: 400, height: 300, alpha: 1, depth: 0 },
    { op: 'animate', layer_id: 'probe_layer', to: { alpha: 0.5 }, seconds: 1, ease: 'sine', wait: true },
    { op: 'mask', layer_id: 'probe_layer', shape: 'ellipse', x: 960, y: 540, width: 400, height: 300 },
    { op: 'set_flag', flag: 'probe_seen', value: true }, { op: 'checkpoint', checkpoint_id: 'probe_checkpoint' },
    { op: 'voice', line_id: lineId }, { op: 'narrate', line_id: lineId, text: 'Synthetic subtitle.' }, { op: 'video', video_id: 'probe_video', skippable: true }, { op: 'panel', panel_id: 'probe_panel' }, { op: 'end' }
  ] });
  files.set('audio/probe_voice.ogg', new Uint8Array([1])); files.set('video/probe_video.webm', new Uint8Array([1]));
  const existingVoices = files.has('presentation/presentation.json') ? (JSON.parse(new TextDecoder().decode(files.get('presentation/presentation.json'))).voices ?? {}) : {};
  const pack = PresentationPack.parse({ schema_version: 1, voices: { ...existingVoices, [lineId]: { file: 'audio/probe_voice.ogg', language: 'ja', duration_s: 1, reviewed_transcript_sha256: 'a'.repeat(64) } }, videos: { probe_video: { file: 'video/probe_video.webm', audio: 'none', duration_s: 2, captions: [{ line_id: lineId, text_en: 'Synthetic subtitle.', start_s: 0, end_s: 1 }] } }, locales: ['tr'], panels: { probe_panel: { title: { text_en: 'Test notice', text_id: 'probe.title' }, body: [{ text_en: 'Test only' }], buttons: [{ label: { text_en: 'Close' }, action: { type: 'close' } }] } } });
  put(files, 'presentation/presentation.json', pack); put(files, 'locales/tr.json', { schema_version: 1, locale: 'tr', fallback: 'en', strings: { [lineId]: 'Test altyazısı.', 'probe.title': 'Test duyurusu' } });
  return { files, pack };
}
describe('closed content grammar', () => {
  it('validates unlinked story, media, locale and finite UI references and derives signed capabilities', () => {
    const { files } = fixture(); expect(() => validateContentSet(files)).not.toThrow();
    expect(requiredContentCapabilities(files)).toEqual(['attributes_v1', 'locale_v1', 'presentation_v1', 'sprite_animation_v1', 'story_flags_v1', 'vfx_v1']);
  });
  it.each(['unknown JSON', 'unknown op', 'missing voice', 'mismatched caption', 'unknown locale key', 'invalid UTF8', 'oversized JSON'] as const)('rejects %s before admission', (kind) => {
    const { files, pack } = fixture();
    if (kind === 'unknown JSON') put(files, 'data/unvalidated.json', { arbitrary: true });
    if (kind === 'unknown op') { const data = JSON.parse(new TextDecoder().decode(files.get(scenePath))); data.commands.unshift({ op: 'eval', code: 'untrusted' }); put(files, scenePath, data); }
    if (kind === 'missing voice') files.delete('audio/probe_voice.ogg');
    if (kind === 'mismatched caption') { pack.videos.probe_video!.captions[0]!.text_en = 'Different'; put(files, 'presentation/presentation.json', pack); }
    if (kind === 'unknown locale key') put(files, 'locales/tr.json', { schema_version: 1, locale: 'tr', fallback: 'en', strings: { unknown_key: 'Unknown' } });
    if (kind === 'invalid UTF8') files.set(scenePath, new Uint8Array([0xff, 0xfe]));
    if (kind === 'oversized JSON') files.set(scenePath, new Uint8Array(1024 * 1024 + 1));
    expect(() => validateContentSet(files)).toThrow();
  });
  it('rejects remote callbacks, arbitrary properties and reversed schedules', () => {
    expect(PresentationCommand.safeParse({ op: 'animate', layer_id: 'probe', to: { url: 'https://example.test' }, seconds: 1, ease: 'linear', wait: true }).success).toBe(false);
    expect(PresentationPack.safeParse({ schema_version: 1, panels: { probe: { title: { text_en: 'Test' }, body: [], buttons: [{ label: { text_en: 'Open' }, action: { type: 'url', url: 'https://example.test' } }] } } }).success).toBe(false);
  });
});

it('rejects a branch which skips a layer declaration before using the layer', () => {
  const { files } = fixture(); const data = JSON.parse(new TextDecoder().decode(files.get(scenePath))); data.commands.splice(1, 0, { op: 'label', name: 'skip_layer' }); data.commands.unshift({ op: 'set_flag', flag: 'skip_now', value: true }, { op: 'branch', flag: 'skip_now', equals: true, goto: 'skip_layer' }); put(files, scenePath, data);
  expect(() => validateContentSet(files)).toThrow('every reachable branch');
});
it('rejects screen navigation in a modal notice without restricting standalone compiled notice actions', () => {
  const { files, pack } = fixture(); pack.panels.probe_panel!.buttons[0]!.action = { type: 'screen', screen: 'Roster' }; put(files, 'presentation/presentation.json', pack);
  expect(() => validateContentSet(files)).toThrow('paused story');
});
