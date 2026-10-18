import type { VfxPreset } from '@uomd/content-schema';

type EaseName = Extract<VfxPreset['elements'][number], { ease: unknown }>['ease'];
export type Ease = (t: number) => number;

const S = 1.70158;
export const EASES: Record<EaseName, Ease> = {
  linear: (t) => t,
  'quad.in': (t) => t * t,
  'quad.out': (t) => t * (2 - t),
  'cubic.out': (t) => 1 - (1 - t) ** 3,
  'back.out': (t) => 1 + (S + 1) * (t - 1) ** 3 + S * (t - 1) ** 2,
  'sine.inout': (t) => -(Math.cos(Math.PI * t) - 1) / 2
};

interface Job {
  delay: number;
  duration: number;
  elapsed: number;
  ease: Ease;
  started: boolean;
  onStart?: () => void;
  onUpdate?: (k: number) => void;
  onComplete?: () => void;
}

/**
 * Minimal frame-driven tween/timer runner for pure-PIXI code. It owns no ticker: the host calls update(dtMs), so
 * hit-stop and pause work by scaling or withholding dt (`timeScale`).
 */
export class Animator {
  timeScale = 1;
  private jobs: Job[] = [];

  /** k runs 0→1 through `ease` over `duration` ms after `delay` ms */
  tween(opts: { delay?: number; duration: number; ease?: Ease; onStart?: () => void; onUpdate?: (k: number) => void; onComplete?: () => void }): void {
    this.jobs.push({ delay: opts.delay ?? 0, duration: Math.max(1, opts.duration), elapsed: 0, ease: opts.ease ?? EASES.linear, started: false, onStart: opts.onStart, onUpdate: opts.onUpdate, onComplete: opts.onComplete });
  }

  after(ms: number, fn: () => void): void {
    this.tween({ delay: ms, duration: 1, onComplete: fn });
  }

  update(dtMs: number): void {
    const dt = dtMs * this.timeScale;
    // callbacks may add jobs; iterate over the current batch only
    const batch = this.jobs;
    this.jobs = [];
    const keep: Job[] = [];
    for (const j of batch) {
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
      const t = Math.min(1, j.elapsed / j.duration);
      j.onUpdate?.(j.ease(t));
      if (t >= 1) j.onComplete?.();
      else keep.push(j);
    }
    this.jobs = keep.concat(this.jobs);
  }

  get active(): number {
    return this.jobs.length;
  }

  clear(): void {
    this.jobs = [];
  }
}
