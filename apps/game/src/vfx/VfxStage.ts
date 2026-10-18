import * as PIXI from 'pixi.js';
import type { VfxElement, VfxPack, VfxPreset, VfxProps } from '@uomd/content-schema';
import { Animator, EASES } from '../core/anim';
import { vfxTextures } from './textures';

type LayerName = 'ground' | 'fx' | 'overlay';
type TextureName = Extract<VfxElement, { kind: 'sprite' }>['texture'];
type Palette = { primary: number; secondary: number; core: number };
type Tweened = Extract<VfxElement, { kind: 'sprite' | 'shape' }>;

const CRIT_GOLD = 0xffe48f;
const FALLBACK: Palette = { primary: 0xb98eff, secondary: 0xe55b8a, core: 0xf4e8ff };

export interface PlayOptions {
  x: number;
  y: number;
  element?: string;
  /** uniform size multiplier (offsets, scales and speeds) */
  scale?: number;
  /** 1 = attack travels left→right, -1 mirrors offsets, angles and crescent bows */
  dir?: 1 | -1;
  /** timing multiplier for the whole preset (2 = twice as long); authored timing is 1 */
  pace?: number;
  /** landing point for a projectile element */
  target?: { x: number; y: number };
  onCue?: (cue: 'hit_stop' | 'shake' | 'flash', durationMs: number, intensity: number) => void;
}

export interface VfxEnvironment {
  particles: boolean;
  particleDensity: number;
  reducedMotion: boolean;
  reduceFlash: boolean;
}

interface Particle {
  sprite: PIXI.Sprite;
  vx: number;
  vy: number;
  gy: number;
  spin: number;
  age: number;
  life: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
}

const rand = (r: readonly [number, number]): number => r[0] + Math.random() * (r[1] - r[0]);
const blendMode = (b: 'normal' | 'add' | 'screen'): PIXI.BLEND_MODES => b;

/**
 * Pure PixiJS v8 player for data-driven VFX presets (vfx/vfx_presets.json). It owns three layer containers that the
 * host places in its scene (ground under units, fx over units, overlay above the HUD) and advances only when the host
 * calls update(dt), so hit-stop/pause scale it like the rest of the battle.
 */
export class VfxStage {
  readonly layers: Record<LayerName, PIXI.Container>;
  readonly animator = new Animator();
  private particles: Particle[] = [];
  private pack: VfxPack | null = null;
  private destroyed = false;

  constructor(
    private readonly env: () => VfxEnvironment,
    private readonly textures: () => Record<TextureName, PIXI.Texture> = vfxTextures
  ) {
    const make = (label: string): PIXI.Container => new PIXI.Container({ label, sortableChildren: true });
    this.layers = { ground: make('vfx-ground'), fx: make('vfx-fx'), overlay: make('vfx-overlay') };
  }

  setPack(pack: VfxPack | null): void {
    this.pack = pack;
  }

  has(id: string): boolean {
    return Boolean(this.pack && Object.hasOwn(this.pack.presets, id));
  }

  /** preset assigned to a skill by the content pack, if any */
  presetForSkill(skillId: string): string | undefined {
    const id = this.pack?.skills[skillId];
    return id && this.has(id) ? id : undefined;
  }

  /** resolves when the projectile lands, or when the last element finishes when there is no projectile */
  play(id: string, o: PlayOptions): Promise<void> {
    const preset: VfxPreset | undefined = this.pack?.presets[id];
    const env = this.env();
    if (!preset || this.destroyed || env.reducedMotion) return Promise.resolve();
    const pal = this.palette(o.element);
    const ctx = { o, pal, s: o.scale ?? 1, dir: o.dir ?? 1, env, pace: Math.max(0.1, o.pace ?? 1) };
    let end = 0;
    let landing: Promise<void> | null = null;
    for (const el of preset.elements) {
      switch (el.kind) {
        case 'sprite':
        case 'shape':
          if (env.reduceFlash) break;
          end = Math.max(end, this.playTweened(el, ctx));
          break;
        case 'burst':
          if (env.reduceFlash || !env.particles || env.particleDensity <= 0) break;
          end = Math.max(end, this.playBurst(el, ctx));
          break;
        case 'projectile':
          landing = this.playProjectile(el, ctx);
          break;
        case 'cue':
          if (o.onCue) this.animator.after(el.delay_ms * ctx.pace, () => o.onCue!(el.cue, el.duration_ms * ctx.pace, el.intensity));
          break;
      }
    }
    if (landing) return landing;
    return new Promise((resolve) => this.animator.after(end, resolve));
  }

  update(dtMs: number): void {
    if (this.destroyed) return;
    this.animator.update(dtMs);
    const dt = (dtMs * this.animator.timeScale) / 1000;
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.age += dt * 1000;
      if (p.age >= p.life || p.sprite.destroyed) {
        p.sprite.destroy();
        continue;
      }
      p.vy += p.gy * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += p.spin * dt;
      const k = p.age / p.life;
      p.sprite.scale.set(p.s0 + (p.s1 - p.s0) * k);
      p.sprite.alpha = p.a0 + (p.a1 - p.a0) * k;
      alive.push(p);
    }
    this.particles = alive;
  }

  /** number of live animations + particles (tests, idle detection) */
  get busy(): number {
    return this.animator.active + this.particles.length;
  }

  destroy(): void {
    this.destroyed = true;
    this.animator.clear();
    this.particles = [];
    for (const layer of Object.values(this.layers)) layer.destroy({ children: true });
  }

  private palette(element?: string): Palette {
    const p = (element && this.pack?.palettes[element]) || this.pack?.palettes.Veil;
    return p ?? FALLBACK;
  }

  private color(c: string, pal: Palette): number {
    if (c === 'primary' || c === 'secondary' || c === 'core') return pal[c];
    if (c === 'crit') return CRIT_GOLD;
    return Number.parseInt(c.slice(1), 16);
  }

  private playTweened(el: Tweened, ctx: { o: PlayOptions; pal: Palette; s: number; dir: 1 | -1; pace: number }): number {
    const reps = el.repeat?.count ?? 1;
    let end = 0;
    for (let i = 0; i < reps; i++) {
      const start = (el.delay_ms + i * (el.repeat?.every_ms ?? 0)) * ctx.pace;
      const duration = el.duration_ms * ctx.pace;
      const mirror = el.repeat?.mirror_angle && i % 2 === 1 ? -1 : 1;
      const tint = el.repeat?.tints ? el.repeat.tints[i % el.repeat.tints.length]! : el.tint;
      const step = (el.repeat?.scale_step ?? 0) * i;
      const fadeEnd = el.fade ? (el.fade.delay_ms + el.fade.duration_ms) * ctx.pace : 0;
      end = Math.max(end, start + Math.max(duration, fadeEnd));
      this.animator.after(start, () => {
        if (this.destroyed) return;
        const node = el.kind === 'sprite' ? this.sprite(el.texture, this.color(tint, ctx.pal)) : this.shape(el, this.color(tint, ctx.pal), this.color(el.tint2, ctx.pal), ctx.pal.secondary);
        node.blendMode = blendMode(el.blend);
        node.zIndex = el.depth + i;
        this.layers[el.layer].addChild(node);
        const from = this.resolve(el.from, ctx, mirror, 0);
        const to = this.resolve({ ...el.from, ...el.to }, ctx, mirror, step);
        this.apply(node, from, ctx.o);
        let alphaFromTween = to.alpha !== from.alpha;
        this.animator.tween({
          duration,
          ease: EASES[el.ease],
          onUpdate: (k) => {
            const lerp = (a: number, b: number): number => a + (b - a) * k;
            node.position.set(ctx.o.x + lerp(from.x, to.x), ctx.o.y + lerp(from.y, to.y));
            node.scale.set(lerp(from.sx, to.sx), lerp(from.sy, to.sy));
            node.angle = lerp(from.angle, to.angle);
            if (alphaFromTween) node.alpha = lerp(from.alpha, to.alpha);
          },
          onComplete: () => {
            if (!el.fade) node.destroy();
          }
        });
        if (el.fade) {
          const fade = el.fade;
          this.animator.tween({
            delay: fade.delay_ms * ctx.pace,
            duration: fade.duration_ms * ctx.pace,
            ease: EASES[fade.ease],
            onStart: () => {
              alphaFromTween = false;
            },
            onUpdate: (k) => {
              node.alpha = from.alpha * (1 - k);
            },
            onComplete: () => node.destroy()
          });
        }
      });
    }
    return end;
  }

  /** offsets/scales follow the play scale; dir mirrors horizontally (negative x scale + negated angle) */
  private resolve(p: VfxProps, ctx: { s: number; dir: 1 | -1 }, mirror: number, step: number): { x: number; y: number; sx: number; sy: number; alpha: number; angle: number } {
    const base = (v: number | undefined): number => ((v ?? 1) + step) * ctx.s;
    return {
      x: (p.x ?? 0) * ctx.s * ctx.dir,
      y: (p.y ?? 0) * ctx.s,
      sx: base(p.scale_x ?? p.scale) * ctx.dir,
      sy: base(p.scale_y ?? p.scale),
      alpha: p.alpha ?? 1,
      angle: (p.angle ?? 0) * mirror * ctx.dir
    };
  }

  private apply(node: PIXI.Container, v: { x: number; y: number; sx: number; sy: number; alpha: number; angle: number }, o: PlayOptions): void {
    node.position.set(o.x + v.x, o.y + v.y);
    node.scale.set(v.sx, v.sy);
    node.angle = v.angle;
    node.alpha = v.alpha;
  }

  private sprite(texture: TextureName, tint: number): PIXI.Sprite {
    const s = new PIXI.Sprite(this.textures()[texture]);
    s.anchor.set(0.5);
    s.tint = tint;
    return s;
  }

  private shape(el: Extract<VfxElement, { kind: 'shape' }>, tint: number, tint2: number, secondary: number): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const r = el.size;
    switch (el.shape) {
      case 'crescent': {
        // two filled crescents (outer colour + bright core) bowed toward the attack direction; dir is applied by scale
        const steps = Math.max(4, el.count);
        const band = (span: number, edge: number, bowOuter: number, bowInner: number, color: number, alpha: number): void => {
          const pts: number[] = [];
          const curve = (bow: number, u: number): number => edge * (1 - u) * (1 - u) + 2 * (1 - u) * u * bow + edge * u * u;
          for (let s = 0; s <= steps; s++) pts.push(-span + (s / steps) * span * 2, curve(bowOuter, s / steps));
          for (let s = steps; s >= 0; s--) pts.push(-span + (s / steps) * span * 2, curve(bowInner, s / steps));
          g.poly(pts, true).fill({ color, alpha });
        };
        band(r, 24, el.bow, el.bow * 0.42, tint, el.fill_alpha);
        band(r * 0.84, 18, el.bow * 0.82, el.bow * 0.52, tint2, 0.98);
        break;
      }
      case 'star_flare': {
        g.circle(0, 0, el.thickness).fill({ color: tint, alpha: 0.85 });
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          const len = i % 2 === 0 ? r : r * 0.78;
          g.poly([Math.cos(a) * len, Math.sin(a) * len, Math.cos(a + Math.PI / 2) * 10, Math.sin(a + Math.PI / 2) * 10, -Math.cos(a) * len, -Math.sin(a) * len, Math.cos(a - Math.PI / 2) * 10, Math.sin(a - Math.PI / 2) * 10], true).fill({ color: tint2, alpha: 0.98 });
        }
        break;
      }
      case 'spikes': {
        for (let i = 0; i < el.count; i++) {
          const a = (i * Math.PI * 2) / el.count + (i % 2 === 0 ? 0.12 : -0.08);
          const r0 = 22;
          // dense crit bursts alternate long and short spikes
          const r1 = el.count >= 12 && i % 2 === 1 ? r * 0.65 : r;
          g.poly([Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a - 0.07) * (r0 + 28), Math.sin(a - 0.07) * (r0 + 28), Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a + 0.07) * (r0 + 28), Math.sin(a + 0.07) * (r0 + 28)], true).fill({ color: i % 2 === 0 ? tint : tint2, alpha: 0.95 });
        }
        break;
      }
      case 'crest': {
        g.circle(0, 0, r * 0.737).stroke({ width: el.thickness + 2, color: tint2, alpha: 0.95 });
        for (let k = 0; k < el.count; k++) {
          const a = (k * Math.PI * 2) / el.count;
          g.moveTo(Math.cos(a) * r * 0.342, Math.sin(a) * r * 0.342).lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.stroke({ width: el.thickness, color: tint, alpha: 0.88 });
        break;
      }
      case 'rings': {
        g.circle(0, 0, r).stroke({ width: el.thickness, color: tint, alpha: 0.95 });
        g.circle(0, 0, r * 0.722).stroke({ width: Math.max(1, el.thickness * 0.6), color: tint2, alpha: 0.85 });
        break;
      }
      case 'bars': {
        // vertical energy column rising from the anchor: widest/softest first, brightest core last
        for (let i = 0; i < el.count; i++) {
          const w = el.thickness * (1 - (i / el.count) * 0.75);
          const color = i === 0 ? tint : i === el.count - 1 ? tint2 : secondary;
          g.rect(-w / 2, -r, w, r).fill({ color, alpha: 0.55 + (0.4 * i) / Math.max(1, el.count - 1) });
        }
        break;
      }
    }
    return g;
  }

  private playBurst(el: Extract<VfxElement, { kind: 'burst' }>, ctx: { o: PlayOptions; pal: Palette; s: number; dir: 1 | -1; env: VfxEnvironment; pace: number }): number {
    const count = Math.max(Math.min(4, el.count), Math.round(el.count * ctx.env.particleDensity));
    this.animator.after(el.delay_ms * ctx.pace, () => {
      if (this.destroyed) return;
      const tex = this.textures()[el.texture];
      for (let i = 0; i < count; i++) {
        const sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.tint = this.color(el.tints[i % el.tints.length]!, ctx.pal);
        sprite.blendMode = blendMode(el.blend);
        sprite.zIndex = el.depth;
        sprite.position.set(ctx.o.x + rand(el.offset_x) * ctx.s * ctx.dir, ctx.o.y + rand(el.offset_y) * ctx.s);
        const a = (rand(el.angle) * Math.PI) / 180;
        const sp = rand(el.speed) * ctx.s;
        const p: Particle = { sprite, vx: Math.cos(a) * sp * ctx.dir, vy: Math.sin(a) * sp, gy: el.gravity_y, spin: el.spin ? (Math.random() * 2 - 1) * 12 : 0, age: 0, life: el.lifespan_ms * ctx.pace, s0: el.scale.start * ctx.s, s1: el.scale.end * ctx.s, a0: el.alpha.start, a1: el.alpha.end };
        sprite.scale.set(p.s0);
        sprite.alpha = p.a0;
        sprite.rotation = el.spin ? Math.random() * Math.PI * 2 : 0;
        this.layers[el.layer].addChild(sprite);
        this.particles.push(p);
      }
    });
    return (el.delay_ms + el.lifespan_ms) * ctx.pace;
  }

  private playProjectile(el: Extract<VfxElement, { kind: 'projectile' }>, ctx: { o: PlayOptions; pal: Palette; s: number; env: VfxEnvironment; pace: number }): Promise<void> {
    const to = ctx.o.target ?? { x: ctx.o.x, y: ctx.o.y };
    const from = { x: ctx.o.x, y: ctx.o.y };
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - el.arc_height };
    const orb = this.sprite(el.texture, this.color(el.tint, ctx.pal));
    orb.scale.set(el.scale * ctx.s);
    orb.blendMode = blendMode(el.blend);
    orb.zIndex = el.depth;
    const halo = el.halo ? this.sprite(el.halo, this.color(el.halo_tint, ctx.pal)) : null;
    if (halo) {
      halo.scale.set(el.scale * 2.2 * ctx.s);
      halo.blendMode = blendMode(el.blend);
      halo.zIndex = el.depth - 1;
      this.layers[el.layer].addChild(halo);
    }
    this.layers[el.layer].addChild(orb);
    let sinceTrail = 0;
    let last = 0;
    const trail = el.trail && ctx.env.particles && ctx.env.particleDensity > 0 ? el.trail : null;
    return new Promise((resolve) => {
      this.animator.tween({
        duration: el.duration_ms * ctx.pace,
        ease: EASES[el.ease],
        onUpdate: (k) => {
          const u = 1 - k;
          const x = u * u * from.x + 2 * u * k * mid.x + k * k * to.x;
          const y = u * u * from.y + 2 * u * k * mid.y + k * k * to.y;
          orb.position.set(x, y);
          orb.rotation = k * Math.PI * 2 * el.spin_turns;
          halo?.position.set(x, y);
          if (!trail) return;
          sinceTrail += (k - last) * el.duration_ms * ctx.pace;
          last = k;
          while (sinceTrail >= trail.every_ms) {
            sinceTrail -= trail.every_ms;
            const s = this.sprite(trail.texture, this.color(trail.tints[Math.floor(Math.random() * trail.tints.length)]!, ctx.pal));
            s.position.set(x, y);
            s.blendMode = blendMode(el.blend);
            s.zIndex = el.depth - 2;
            this.layers[el.layer].addChild(s);
            const a = Math.random() * Math.PI * 2;
            const sp = 20 + Math.random() * 60;
            this.particles.push({ sprite: s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gy: 0, spin: 6, age: 0, life: trail.lifespan_ms, s0: trail.scale * ctx.s, s1: 0, a0: 0.85, a1: 0 });
          }
        },
        onComplete: () => {
          orb.destroy();
          halo?.destroy();
          resolve();
        }
      });
    });
  }
}
