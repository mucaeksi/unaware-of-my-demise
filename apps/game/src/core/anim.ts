export type Ease = (t: number) => number;

const S = 1.70158;
const out = (f: Ease): Ease => (t) => 1 - f(1 - t);
const inOut = (f: Ease): Ease => (t) => (t < 0.5 ? f(2 * t) / 2 : 1 - f(2 - 2 * t) / 2);
const quad: Ease = (t) => t * t;
const cubic: Ease = (t) => t * t * t;
const sine: Ease = (t) => 1 - Math.cos((t * Math.PI) / 2);
const back: Ease = (t) => (S + 1) * t * t * t - S * t * t;
const expo: Ease = (t) => (t === 0 ? 0 : 2 ** (10 * t - 10));

/** the VFX preset grammar names a subset of these (content-schema VfxEase) */
export const EASES = {
  linear: (t: number) => t,
  'quad.in': quad,
  'quad.out': out(quad),
  'quad.inout': inOut(quad),
  'cubic.in': cubic,
  'cubic.out': out(cubic),
  'cubic.inout': inOut(cubic),
  'sine.in': sine,
  'sine.out': out(sine),
  'sine.inout': inOut(sine),
  'back.in': back,
  'back.out': out(back),
  'expo.in': expo,
  'expo.out': out(expo)
} satisfies Record<string, Ease>;
export type EaseName = keyof typeof EASES;

export interface Handle {
  stop(): void;
}

interface Job {
  target: object | null;
  delay: number;
  duration: number;
  elapsed: number;
  ease: Ease;
  started: boolean;
  stopped: boolean;
  /** total plays (1 + repeats; Infinity loops) and the current one */
  plays: number;
  play: number;
  yoyo: boolean;
  onStart?: () => void;
  onUpdate?: (k: number) => void;
  onComplete?: () => void;
}

/** a tweened value: the target number, or an explicit start (`from`) for this tween */
export type TweenValue = number | { from: number; to: number };

export interface TweenOptions {
  duration: number;
  delay?: number;
  ease?: EaseName | Ease;
  /** play back to the start after each forward play */
  yoyo?: boolean;
  /** extra plays after the first; -1 loops until stopped */
  repeat?: number;
  onStart?: () => void;
  onUpdate?: () => void;
  onComplete?: () => void;
}

interface Prop {
  get(): number;
  set(v: number): void;
}

/** PIXI containers keep scale in an ObservablePoint: scale/scaleX/scaleY address it, every other key is a plain field */
function prop(target: Record<string, unknown>, key: string): Prop {
  const pt = target.scale as { x: number; y: number; set?: (x: number, y?: number) => void } | undefined;
  if (pt && typeof pt === 'object') {
    if (key === 'scaleX') return { get: () => pt.x, set: (v) => (pt.x = v) };
    if (key === 'scaleY') return { get: () => pt.y, set: (v) => (pt.y = v) };
    if (key === 'scale') return { get: () => pt.x, set: (v) => ((pt.x = v), (pt.y = v)) };
  }
  return { get: () => Number(target[key]) || 0, set: (v) => (target[key] = v) };
}

/**
 * Frame-driven tweens and timers for pure-PIXI scenes. It owns no ticker: the scene calls update(dtMs), so speed-up,
 * hit-stop and pause work by scaling or withholding dt (`timeScale`).
 */
export class Animator {
  timeScale = 1;
  private jobs: Job[] = [];

  /** k runs 0→1 through `ease` over `duration` ms after `delay` ms */
  tween(opts: { delay?: number; duration: number; ease?: Ease; onStart?: () => void; onUpdate?: (k: number) => void; onComplete?: () => void }): Handle {
    return this.push(null, { ...opts, plays: 1, yoyo: false });
  }

  /** animates numeric fields of `target` (Phaser-style: start values are read when the tween starts) */
  to(target: object, props: Record<string, TweenValue>, o: TweenOptions): Handle {
    const t = target as Record<string, unknown>;
    let lanes: { p: Prop; from: number; to: number }[] = [];
    return this.push(target, {
      delay: o.delay,
      duration: o.duration,
      ease: typeof o.ease === 'function' ? o.ease : EASES[o.ease ?? 'linear'],
      plays: o.repeat === -1 ? Infinity : 1 + Math.max(0, o.repeat ?? 0),
      yoyo: o.yoyo ?? false,
      onStart: () => {
        lanes = Object.entries(props).map(([key, v]) => {
          const p = prop(t, key);
          const from = typeof v === 'number' ? p.get() : v.from;
          return { p, from, to: typeof v === 'number' ? v : v.to };
        });
        o.onStart?.();
      },
      onUpdate: (k) => {
        for (const l of lanes) l.p.set(l.from + (l.to - l.from) * k);
        o.onUpdate?.();
      },
      onComplete: o.onComplete
    });
  }

  /** resolves when the tween ends (or at once when `skip`, e.g. reduced motion, after jumping to the end values) */
  toAsync(target: object, props: Record<string, TweenValue>, o: TweenOptions & { skip?: boolean }): Promise<void> {
    if (o.skip) {
      for (const [key, v] of Object.entries(props)) prop(target as Record<string, unknown>, key).set(typeof v === 'number' ? v : v.to);
      o.onComplete?.();
      return Promise.resolve();
    }
    return new Promise((resolve) => this.to(target, props, { ...o, onComplete: () => (o.onComplete?.(), resolve()) }));
  }

  after(ms: number, fn: () => void): Handle {
    return this.tween({ delay: ms, duration: 1, onComplete: fn });
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.after(ms, resolve));
  }

  /** stops every tween animating `target` without finishing it */
  killOf(target: object): void {
    for (const j of this.jobs) if (j.target === target) j.stopped = true;
  }

  private push(target: object | null, o: { delay?: number; duration: number; ease?: Ease; plays: number; yoyo: boolean; onStart?: () => void; onUpdate?: (k: number) => void; onComplete?: () => void }): Handle {
    const job: Job = { target, delay: o.delay ?? 0, duration: Math.max(1, o.duration), elapsed: 0, ease: o.ease ?? EASES.linear, started: false, stopped: false, plays: o.plays, play: 0, yoyo: o.yoyo, onStart: o.onStart, onUpdate: o.onUpdate, onComplete: o.onComplete };
    this.jobs.push(job);
    return { stop: () => (job.stopped = true) };
  }

  update(dtMs: number): void {
    const dt = dtMs * this.timeScale;
    // callbacks may add jobs; iterate over the current batch only
    const batch = this.jobs;
    this.jobs = [];
    const keep: Job[] = [];
    for (const j of batch) {
      if (j.stopped) continue;
      if (j.delay > 0) {
        j.delay -= dt;
        if (j.delay > 0) {
          keep.push(j);
          continue;
        }
        j.elapsed = -j.delay;
        j.delay = 0;
      } else {
        j.elapsed += dt;
      }
      if (!j.started) {
        j.started = true;
        j.onStart?.();
      }
      const span = j.yoyo ? j.duration * 2 : j.duration;
      // a long frame may cross several plays; land on the last one it reaches
      const skip = Math.min(Math.floor(j.elapsed / span), j.plays - 1 - j.play);
      if (skip > 0) {
        j.elapsed -= skip * span;
        j.play += skip;
      }
      const done = j.elapsed >= span;
      const e = Math.min(j.elapsed, span);
      const t = j.yoyo ? (e <= j.duration ? e / j.duration : 2 - e / j.duration) : e / j.duration;
      j.onUpdate?.(j.ease(Math.min(1, Math.max(0, t))));
      if (done) j.onComplete?.();
      else keep.push(j);
    }
    this.jobs = keep.concat(this.jobs);
  }

  get active(): number {
    return this.jobs.filter((j) => !j.stopped).length;
  }

  clear(): void {
    this.jobs = [];
  }
}
