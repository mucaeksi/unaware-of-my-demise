import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { StoryScene } from '@uomd/content-schema';
import { StoryRunner, isBlocking, type StoryEvent } from './index';

const scene = (commands: unknown[]): StoryScene =>
  StoryScene.parse({ schema_version: 1, scene_id: 'scene_x', title_en: 'X', location_id: 'forest_whispering_ash', commands, provenance: { source: 'test' } });

const drain = (r: StoryRunner): StoryEvent[] => {
  const out: StoryEvent[] = [];
  for (let e = r.next(); e; e = r.next()) {
    out.push(e);
    if (e.type === 'choice') break;
    if (e.type === 'end') break;
  }
  return out;
};

describe('StoryRunner', () => {
  it('restores bounded boolean flags, branches and emits only finite presentation commands', () => {
    const data = scene([
      { op: 'set_flag', flag: 'saw_gate', value: true }, { op: 'checkpoint', checkpoint_id: 'gate_save' },
      { op: 'branch', flag: 'saw_gate', equals: true, goto: 'open_gate' },
      { op: 'narrate', line_id: 'not_taken', text: 'Not taken' }, { op: 'label', name: 'open_gate' },
      { op: 'camera', x: 960, y: 540, zoom: 1.2, seconds: 0.5 }, { op: 'end' }
    ]);
    const runner = new StoryRunner(data); expect(runner.next()?.type).toBe('checkpoint');
    const saved = runner.save(); expect(saved.flags).toEqual({ saw_gate: true });
    const restored = new StoryRunner(data, saved);
    expect(restored.next()).toMatchObject({ type: 'presentation', command: { op: 'camera' } });
    expect(restored.next()?.type).toBe('end');
    expect(() => new StoryRunner(data, { ...saved, flags: { invalid: 'expression' } as unknown as Record<string, boolean> })).toThrow('invalid saved flags');
  });
  it('terminates nonblocking control-flow loops instead of freezing the renderer', () => {
    const runner = new StoryRunner(scene([{ op: 'label', name: 'loop' }, { op: 'goto', label: 'loop' }, { op: 'end' }]));
    expect(() => runner.next()).toThrow('finite step budget');
  });
  it('plays commands in order and ends', () => {
    const r = new StoryRunner(
      scene([
        { op: 'background', location_id: 'forest_whispering_ash' },
        { op: 'narrate', line_id: 'l_001', text: 'Hello' },
        { op: 'say', line_id: 'l_002', speaker: 'mahmut', speaker_display: 'Mahmut', text: 'Hi', emotion: 'watchful' },
        { op: 'end' }
      ])
    );
    const ev = drain(r);
    expect(ev.map((e) => e.type)).toEqual(['background', 'line', 'line', 'end']);
    expect(r.history.map((l) => l.lineId)).toEqual(['l_001', 'l_002']);
    expect(r.next()).toBeNull();
    expect(r.finished).toBe(true);
  });

  it('choices jump to labels and are recorded; goto loops back', () => {
    const r = new StoryRunner(
      scene([
        { op: 'choice', options: [{ id: 'left', text: 'Left', goto: 'a' }, { id: 'right', text: 'Right', goto: 'b' }] },
        { op: 'label', name: 'a' },
        { op: 'narrate', line_id: 'l_a', text: 'A' },
        { op: 'goto', label: 'done' },
        { op: 'label', name: 'b' },
        { op: 'narrate', line_id: 'l_b', text: 'B' },
        { op: 'label', name: 'done' },
        { op: 'end' }
      ])
    );
    const first = r.next();
    expect(first?.type).toBe('choice');
    expect(() => r.next()).toThrow(/choice is pending/);
    expect(() => r.choose('nope')).toThrow(/unknown option/);
    r.choose('right');
    const rest = drain(r);
    expect(rest.map((e) => (e.type === 'line' ? e.lineId : e.type))).toEqual(['l_b', 'end']);
    expect(r.save().choices).toEqual(['right']);
  });

  it('saves and restores a position without replaying earlier lines', () => {
    const cmds = [
      { op: 'narrate', line_id: 'l_001', text: 'one' },
      { op: 'checkpoint', checkpoint_id: 'cp_one' },
      { op: 'narrate', line_id: 'l_002', text: 'two' },
      { op: 'end' }
    ];
    const r = new StoryRunner(scene(cmds));
    r.next();
    r.next();
    const save = r.save();
    const resumed = new StoryRunner(scene(cmds), save);
    expect(resumed.next()).toMatchObject({ type: 'line', lineId: 'l_002' });
    expect(() => new StoryRunner(scene(cmds), { ...save, sceneId: 'other' })).toThrow();
  });

  it('classifies blocking events', () => {
    expect(isBlocking({ type: 'line', lineId: 'a', speaker: 'narration', speakerDisplay: '', text: 'x' })).toBe(true);
    expect(isBlocking({ type: 'music', cueId: 'x' })).toBe(false);
  });

  it('plays the compiled tutorial scenes from start to end with every line voiced by its canonical id', () => {
    for (const rel of ['base/story/tutorial_t1_before.json', 'base/story/tutorial_t1_after.json']) {
      const json = JSON.parse(readFileSync(new URL(`../../../content/${rel}`, import.meta.url), 'utf8'));
      const s = StoryScene.parse(json);
      const r = new StoryRunner(s);
      const events = drain(r);
      const lines = events.filter((e) => e.type === 'line');
      expect(lines.length).toBeGreaterThan(8);
      expect(events.at(-1)?.type).toBe('end');
      expect(lines.every((l) => l.type === 'line' && /^tutorial_t1_(before|after)_\d{3}$/.test(l.lineId))).toBe(true);
    }
  });
});

it('bounds loops which repeatedly emit nonblocking presentation events', () => { const runner = new StoryRunner(scene([{ op: 'label', name: 'loop' }, { op: 'camera', x: 960, y: 540, zoom: 1, seconds: 0 }, { op: 'goto', label: 'loop' }, { op: 'end' }])); expect(() => { for (let i = 0; i < 100; i++) runner.next(); }).toThrow('finite step budget'); });
