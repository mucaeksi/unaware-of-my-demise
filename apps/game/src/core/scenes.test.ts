import * as PIXI from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { PixiScene } from './PixiScene';
import { SceneManager } from './scenes';

class Probe extends PixiScene<{ n?: number } | undefined> {
  static log: string[] = [];
  created: unknown = null;
  ticks = 0;

  create(data: { n?: number } | undefined): void {
    this.created = data;
    Probe.log.push(`create ${this.key} ${data?.n ?? '-'}`);
    this.onClose(() => Probe.log.push(`close ${this.key}`));
    this.onTick(() => this.ticks++);
  }
}

function setup(): { m: SceneManager; stage: PIXI.Container } {
  Probe.log = [];
  const stage = new PIXI.Container();
  const m = new SceneManager(stage);
  for (const k of ['A', 'B', 'Overlay']) m.register(k, () => new Probe());
  return { m, stage };
}

describe('SceneManager', () => {
  it('start replaces the calling scene; launch runs alongside, on top', () => {
    const { m, stage } = setup();
    m.launch('A', { n: 1 });
    const a = m.getScene('A') as Probe;
    a.nav.launch('Overlay');
    a.nav.start('B', { n: 2 });
    expect(Probe.log).toEqual(['create A 1', 'create Overlay -', 'close A', 'create B 2']);
    expect(m.getScenes().map((s) => s.key)).toEqual(['Overlay', 'B']);
    expect(stage.children).toEqual([m.getScene('Overlay')!.view, m.getScene('B')!.view]);
    expect(a.closed).toBe(true);
    expect(a.live).toBe(false);
  });

  it('a paused scene is hidden and not ticked, and hears pause/resume', () => {
    const { m } = setup();
    m.launch('A');
    const a = m.getScene('A') as Probe;
    const heard: string[] = [];
    a.events.on('pause', () => heard.push('pause'));
    a.events.on('resume', () => heard.push('resume'));
    m.update(16);
    a.nav.pause();
    m.update(16);
    expect(a.ticks).toBe(1);
    expect(a.view.visible).toBe(false);
    expect(a.live).toBe(false);
    expect(m.isPaused('A')).toBe(true);
    expect(m.getScenes().length).toBe(0);
    expect(m.getScenes(false).length).toBe(1);
    m.resume('A');
    m.update(16);
    expect(a.ticks).toBe(2);
    expect(heard).toEqual(['pause', 'resume']);
  });

  it('restart keeps the place and the data unless new data is given; bringToTop reorders', () => {
    const { m, stage } = setup();
    m.launch('A', { n: 7 });
    m.launch('B');
    const first = m.getScene('A');
    m.restart('A');
    const second = m.getScene('A') as Probe;
    expect(second).not.toBe(first);
    expect(second.created).toEqual({ n: 7 });
    expect(m.getScenes().map((s) => s.key)).toEqual(['A', 'B']);
    second.nav.restart({ n: 8 });
    expect((m.getScene('A') as Probe).created).toEqual({ n: 8 });
    m.bringToTop('A');
    expect(m.getScenes().map((s) => s.key)).toEqual(['B', 'A']);
    expect(stage.children.at(-1)).toBe(m.getScene('A')!.view);
  });

  it('an unknown key or a failing create is reported, not thrown', () => {
    const { m } = setup();
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...a: unknown[]) => errors.push(a);
    try {
      m.launch('Nope');
      m.register('Bad', () => {
        const s = new Probe();
        s.create = () => {
          throw new Error('boom');
        };
        return s;
      });
      m.launch('Bad');
    } finally {
      console.error = original;
    }
    expect(errors.length).toBe(2);
    expect(m.isActive('Bad')).toBe(true);
  });
});
