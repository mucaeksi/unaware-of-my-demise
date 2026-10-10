import { describe, expect, it } from 'vitest';
import { ContentManifest, EffectOp, SafeAssetPath, StoryScene } from './index';

const sha = 'a'.repeat(64);

describe('SafeAssetPath', () => {
  it.each(['story/t1.json', 'img/a_b-c.webp', 'audio/loop.ogg'])('accepts %s', (p) => {
    expect(SafeAssetPath.safeParse(p).success).toBe(true);
  });
  it.each(['../x.json', '/etc/passwd.json', 'a/../b.json', 'a//b.json', '.hidden/a.json', 'a\\b.json', 'run.js', 'x.wasm', 'x.html', 'x.svg', 'noext', 'a/./b.json'])(
    'rejects %s',
    (p) => {
      expect(SafeAssetPath.safeParse(p).success).toBe(false);
    }
  );
});

describe('EffectOp closed grammar', () => {
  it('accepts a known op', () => {
    const r = EffectOp.safeParse({ op: 'damage', target_selector_id: 'single_enemy', damage_type: 'magic', scale_stat: 'atk', multiplier: 1 });
    expect(r.success).toBe(true);
  });
  it('rejects an op the engine does not implement', () => {
    expect(EffectOp.safeParse({ op: 'summon_enemies', target_selector_id: 'self', enemy_id: 'x', count: 1 }).success).toBe(false);
  });
  it('rejects unknown keys on a known op', () => {
    expect(EffectOp.safeParse({ op: 'gain_focus', target_selector_id: 'self', amount: 5, evil: true }).success).toBe(false);
  });
});

describe('ContentManifest', () => {
  const base = {
    schema_version: 1,
    release: { id: 'rel_0001', generation: 1, channel: 'dev', created_at: '2026-10-10T00:00:00.000Z', notes: 'x' },
    compat: { min_client: '0.1.0', content_schema: 1 },
    rollout: { percent: 100, kill_switch: false },
    files: [{ path: 'a/b.json', sha256: sha, bytes: 10, media_type: 'application/json', kind: 'other_data' }]
  };
  it('accepts a valid manifest', () => {
    expect(ContentManifest.safeParse(base).success).toBe(true);
  });
  it('rejects mismatched media type vs extension', () => {
    const bad = structuredClone(base);
    (bad.files[0] as { media_type: string }).media_type = 'image/webp';
    expect(ContentManifest.safeParse(bad).success).toBe(false);
  });
  it('rejects duplicate paths', () => {
    const bad = structuredClone(base);
    bad.files.push(bad.files[0] as (typeof bad.files)[0]);
    expect(ContentManifest.safeParse(bad).success).toBe(false);
  });
  it('rejects dependency generation >= own generation', () => {
    const bad = { ...structuredClone(base), depends_on: { release_id: 'rel_0001', generation: 1 } };
    expect(ContentManifest.safeParse(bad).success).toBe(false);
  });
});

describe('StoryScene', () => {
  const mk = (commands: unknown[]) => ({
    schema_version: 1,
    scene_id: 'scene_a',
    title_en: 'A',
    location_id: 'forest_whispering_ash',
    commands,
    provenance: { source: 't' }
  });
  it('rejects goto to a missing label', () => {
    expect(StoryScene.safeParse(mk([{ op: 'goto', label: 'nowhere' }])).success).toBe(false);
  });
  it('rejects duplicate line ids', () => {
    const n = { op: 'narrate', line_id: 'line_001', text: 'x' };
    expect(StoryScene.safeParse(mk([n, n])).success).toBe(false);
  });
  it('accepts labels + choice', () => {
    const cmds = [
      { op: 'label', name: 'start' },
      { op: 'choice', options: [{ id: 'one', text: 'One', goto: 'start' }, { id: 'two', text: 'Two', goto: 'start' }] }
    ];
    expect(StoryScene.safeParse(mk(cmds)).success).toBe(true);
  });
});
