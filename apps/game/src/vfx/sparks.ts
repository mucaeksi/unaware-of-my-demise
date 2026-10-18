import * as PIXI from 'pixi.js';

type Range = readonly [number, number];

export interface SparkLook {
  lifespan: number;
  /** start → end, or one constant size per particle picked from the range when `randomScale` */
  scale: Range;
  randomScale?: boolean;
  alpha: Range;
  /** one tint, or one picked at random per particle */
  tint: number | readonly number[];
}

interface Spark {
  s: PIXI.Sprite;
  scale: Range;
  vx: number;
  vy: number;
  age: number;
  life: number;
  look: SparkLook;
}

const between = ([a, b]: Range): number => a + Math.random() * (b - a);

/**
 * Additive spark particles for scene ambience and one-shot bursts (pure PIXI; the data-driven VfxStage covers skill
 * effects). Sprites are pooled; `update` is driven by the owning scene's (time-scaled) tick.
 */
export class Sparks extends PIXI.Container {
  private live: Spark[] = [];
  private pool: PIXI.Sprite[] = [];
  private stream: { every: number; acc: number; area: { x: Range; y: Range }; vx: Range; vy: Range; look: SparkLook } | null = null;

  constructor(private readonly texture: PIXI.Texture) {
    super();
  }

  /** continuous emission over an area, one particle every `every` ms */
  ambient(o: { every: number; area: { x: Range; y: Range }; vx: Range; vy: Range; look: SparkLook }): this {
    this.stream = { ...o, acc: 0 };
    return this;
  }

  /** `count` particles flying out from (x, y) in every direction */
  burst(x: number, y: number, count: number, speed: Range, look: SparkLook): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = between(speed);
      this.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, look);
    }
  }

  private spawn(x: number, y: number, vx: number, vy: number, look: SparkLook): void {
    const s = this.pool.pop() ?? new PIXI.Sprite(this.texture);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    s.tint = typeof look.tint === 'number' ? look.tint : (look.tint[Math.floor(Math.random() * look.tint.length)] ?? 0xffffff);
    s.position.set(x, y);
    s.visible = true;
    this.addChild(s);
    const k = look.randomScale ? between(look.scale) : null;
    this.live.push({ s, scale: k === null ? look.scale : [k, k], vx, vy, age: 0, life: look.lifespan, look });
  }

  get count(): number {
    return this.live.length;
  }

  update(dtMs: number): void {
    if (this.destroyed) return;
    const st = this.stream;
    if (st) {
      st.acc += dtMs;
      // cap catch-up after a long frame so a resumed tab does not flood the screen
      st.acc = Math.min(st.acc, st.every * 8);
      while (st.acc >= st.every) {
        st.acc -= st.every;
        this.spawn(between(st.area.x), between(st.area.y), between(st.vx), between(st.vy), st.look);
      }
    }
    const k = dtMs / 1000;
    const keep: Spark[] = [];
    for (const p of this.live) {
      p.age += dtMs;
      if (p.age >= p.life) {
        p.s.visible = false;
        this.removeChild(p.s);
        this.pool.push(p.s);
        continue;
      }
      const t = p.age / p.life;
      p.s.x += p.vx * k;
      p.s.y += p.vy * k;
      p.s.scale.set(p.scale[0] + (p.scale[1] - p.scale[0]) * t);
      p.s.alpha = p.look.alpha[0] + (p.look.alpha[1] - p.look.alpha[0]) * t;
      keep.push(p);
    }
    this.live = keep;
  }

  override destroy(options?: PIXI.DestroyOptions): void {
    for (const s of this.pool) s.destroy();
    this.pool = [];
    super.destroy(options);
  }
}
