import { describe, expect, it } from 'vitest';
import { Animator, EASES } from './anim';

describe('Animator', () => {
  it('runs delayed tweens to completion and honours timeScale', () => {
    const a = new Animator();
    const seen: number[] = [];
    let done = false;
    a.tween({ delay: 50, duration: 100, onUpdate: (k) => seen.push(k), onComplete: () => (done = true) });
    a.update(40);
    expect(seen).toEqual([]);
    a.timeScale = 0.5;
    a.update(100); // 50 effective: the last 10 ms of delay, then 40 into the tween
    expect(seen.at(-1)).toBeCloseTo(0.4, 5);
    a.timeScale = 1;
    a.update(100);
    expect(done).toBe(true);
    for (const ease of Object.values(EASES)) {
      expect(ease(0)).toBeCloseTo(0, 6);
      expect(ease(1)).toBeCloseTo(1, 6);
    }
  });

  it('tweens fields and PIXI-style scale points from their values at start, with from/to overrides', () => {
    const a = new Animator();
    const o = { x: 10, alpha: 1, scale: { x: 1, y: 1 } };
    a.to(o, { x: 110, alpha: { from: 0, to: 0.5 }, scaleY: 3 }, { duration: 100, delay: 20 });
    o.x = 20; // moved before the tween starts: it starts from here
    a.update(20);
    expect(o.alpha).toBe(0);
    a.update(50);
    expect(o.x).toBeCloseTo(65, 5);
    a.update(60);
    expect(o).toEqual({ x: 110, alpha: 0.5, scale: { x: 1, y: 3 } });
  });

  it('a fade cancelled at a shot boundary never overwrites the next shot (R09 prologue caption lifecycle)', () => {
    // prologue: the caption fades out over the last 650 ms of a 1000 ms hold; the next shot resets it at 1000 ms
    for (const resetFirst of [true, false]) {
      const a = new Animator();
      const body = { alpha: 1 };
      const nextShot = (): void => {
        a.killOf(body);
        body.alpha = 1;
      };
      if (resetFirst) a.after(1000, nextShot);
      a.after(350, () => a.to(body, { alpha: 0 }, { duration: 650 }));
      if (!resetFirst) a.after(1000, nextShot);
      a.update(350);
      a.update(650); // the fade's last frame and the boundary land in the same update
      expect(body.alpha).toBe(1);
      a.update(100);
      expect(body.alpha).toBe(1);
    }
  });

  it('a tween on a destroyed object or a throwing callback never stops the other tweens and timers', async () => {
    // a PIXI container destroyed mid-tween throws on position reads; the battle loop awaits timers in the same animator
    const a = new Animator();
    const gone = { destroyed: false, get y(): number { if (this.destroyed) throw new TypeError("Cannot read properties of null (reading 'y')"); return 0; }, set y(_v: number) { if (this.destroyed) throw new TypeError("Cannot set properties of null (setting 'y')"); } };
    let effectDone = false;
    void a.toAsync(gone, { y: 10 }, { duration: 100, delay: 10 }).then(() => (effectDone = true));
    gone.destroyed = true;
    let timerFired = false;
    void a.wait(50).then(() => (timerFired = true));
    a.tween({ duration: 10, onUpdate: () => { throw new Error('broken effect'); } });
    expect(() => a.update(60)).not.toThrow();
    a.update(60);
    await Promise.resolve();
    expect(timerFired).toBe(true);
    expect(effectDone).toBe(true); // whoever awaited the destroyed object's tween is released
    expect(a.active).toBe(0);
  });

  it('yoyos, repeats, loops until killed, and resolves toAsync', async () => {
    const a = new Animator();
    const o = { y: 0 };
    let completes = 0;
    a.to(o, { y: 10 }, { duration: 100, yoyo: true, repeat: 1, onComplete: () => completes++ });
    a.update(100);
    expect(o.y).toBeCloseTo(10, 5);
    a.update(150); // into the second play, half way up
    expect(o.y).toBeCloseTo(5, 5);
    a.update(500);
    expect(o.y).toBe(0);
    expect(completes).toBe(1);

    const loop = { r: 0 };
    a.to(loop, { r: 1 }, { duration: 10, repeat: -1 });
    a.update(1e6);
    expect(a.active).toBe(1);
    a.killOf(loop);
    a.update(1);
    expect(a.active).toBe(0);

    const p = { v: 0 };
    let resolved = false;
    void a.toAsync(p, { v: 1 }, { duration: 30 }).then(() => (resolved = true));
    a.update(30);
    await Promise.resolve();
    expect(resolved).toBe(true);
    await a.toAsync(p, { v: 7 }, { duration: 30, skip: true });
    expect(p.v).toBe(7);
  });
});
