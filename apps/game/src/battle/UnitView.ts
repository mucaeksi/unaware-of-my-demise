import * as PIXI from 'pixi.js';
import type { Combatant } from '@uomd/combat';
import type { UnitAnimState } from '@uomd/content-schema';
import { Sfx } from '../audio/Sfx';
import type { ArtLibrary, UnitAnimation } from '../content/ArtLibrary';
import type { Handle } from '../core/anim';
import type { PixiScene } from '../core/PixiScene';
import { prefs } from '../platform/prefs';
import { Bar, hpColor, txt, type UiText } from '../ui/pixiKit';
import { C, DEPTH, F, T } from '../ui/theme';
import { vfxTextures } from '../vfx/textures';
import { BattleVfx } from './BattleVfx';
import type { Spot } from './formation';

export interface ViewInit {
  id: string;
  name: string;
  side: 'player' | 'enemy';
  artKey: string;
  element?: string;
  maxHp: number;
  hp: number;
  spot: Spot;
}

const fillFilters = new Map<number, PIXI.ColorMatrixFilter>();

/** constant-colour silhouette (PIXI tint only multiplies) */
function fillFilter(color: number): PIXI.ColorMatrixFilter {
  let f = fillFilters.get(color);
  if (!f) {
    f = new PIXI.ColorMatrixFilter();
    f.matrix = [0, 0, 0, 0, ((color >> 16) & 255) / 255, 0, 0, 0, 0, ((color >> 8) & 255) / 255, 0, 0, 0, 0, (color & 255) / 255, 0, 0, 0, 1, 0];
    fillFilters.set(color, f);
  }
  return f;
}

/**
 * Everything the player sees of one combatant, drawn with PIXI: SD chibi pose, aura ring, shadow, plate
 * (HP/focus/status), intent tag and the procedural motion rig. `pose` carries the rig's offset/scale/angle; the
 * image inside it only mirrors, so a flipped unit leans and squashes exactly like an unflipped one.
 */
export class UnitView extends PIXI.Container {
  readonly id: string;
  readonly side: 'player' | 'enemy';
  readonly artKey: string;
  readonly element: string;
  readonly unitName: string;
  spot: Spot;
  alive = true;
  private readonly pose = new PIXI.Container();
  private readonly img = new PIXI.Sprite();
  private readonly auraRing: PIXI.Sprite;
  private readonly ring = new PIXI.Graphics();
  private readonly ringR: { rx: number; ry: number };
  private readonly plate = new PIXI.Container();
  private readonly hpBar: Bar;
  private readonly focusBar: Bar | null;
  private readonly statusText: UiText;
  private readonly shieldText: UiText;
  private readonly intentText: UiText;
  private readonly marker: UiText;
  private readonly baseScale: number;
  private animName: UnitAnimState = 'idle';
  private loops: Handle[] = [];
  private frames: Handle | null = null;

  constructor(private readonly scene: PixiScene, private readonly art: ArtLibrary, init: ViewInit, private readonly reduced: boolean, onTap: (v: UnitView) => void) {
    super();
    this.id = init.id;
    this.unitName = init.name;
    this.side = init.side;
    this.artKey = init.artKey;
    this.element = init.element ?? 'Veil';
    this.spot = init.spot;
    this.position.set(init.spot.x, init.spot.y);
    const u = art.unit(init.artKey);
    const pal = BattleVfx.palette(this.element);
    BattleVfx.ensureTextures(scene);

    const d = init.spot.depthScale;
    const shadow = new PIXI.Graphics().ellipse(0, -3, u.heightPx * 0.31 * d, u.heightPx * 0.07 * d).fill({ color: 0x050208, alpha: 0.74 });
    this.auraRing = new PIXI.Sprite(vfxTextures().ring);
    this.auraRing.anchor.set(0.5);
    this.auraRing.position.set(0, -1);
    this.auraRing.tint = init.side === 'player' ? pal.primary : 0xe55b8a;
    this.auraRing.blendMode = 'add';
    this.auraRing.scale.set(0.32 * d, 0.12 * d);
    this.auraRing.alpha = 0.28;
    this.ringR = { rx: u.heightPx * 0.37 * d, ry: u.heightPx * 0.08 * d };
    this.drawRing(0, C.goldHi, 0);
    this.pose.addChild(this.img);
    this.addChild(shadow, this.auraRing, this.ring, this.pose);

    const idle = art.frameFor(init.artKey, 'idle');
    this.baseScale = (u.heightPx / (scene.tex(idle.key, idle.frame).height || u.heightPx)) * d;
    this.applyState('idle');

    // compact translucent plate under the feet
    const plateY = 18;
    const plateCenterY = init.side === 'player' ? 18 : 19;
    const plateH = init.side === 'player' ? 50 : 52;
    const plateW = init.side === 'player' ? 178 : 196;
    const plateBg = new PIXI.Graphics()
      .roundRect(-plateW / 2, plateCenterY - plateH / 2, plateW, plateH, Math.floor(plateH / 2))
      .fill({ color: 0x0a0610, alpha: init.side === 'player' ? 0.54 : 0.68 })
      .stroke({ width: 1.4, color: init.side === 'player' ? C.player : C.enemy, alpha: 0.58 });
    const nameT = txt(0, -1, init.name.toUpperCase(), { fontFamily: F.display, fontSize: 16, fontStyle: '600', color: init.side === 'player' ? '#cfe0ff' : '#ffb3c4', stroke: '#0a0610', strokeThickness: 4 }, 0.5);
    this.hpBar = new Bar(scene, 0, 19, 154, 10, hpColor);
    this.hpBar.set(init.hp / init.maxHp, false);
    this.focusBar = init.side === 'player' ? new Bar(scene, 0, 32, 154, 6, () => C.focus) : null;
    this.focusBar?.set(0, false);
    this.shieldText = txt(82, 19, '', { fontSize: 16, color: T.shield, stroke: '#0a0610', strokeThickness: 3 }, [0, 0.5]);
    this.statusText = txt(0, init.side === 'player' ? 48 : 52, '', { fontSize: 14, color: '#e0d4ee', stroke: '#0a0610', strokeThickness: 3 }, 0.5);
    this.intentText = txt(0, init.side === 'player' ? 64 : 34, '', { fontFamily: F.display, fontSize: 13, fontStyle: '600', color: '#ffb3c4', stroke: '#0a0610', strokeThickness: 4 }, 0.5);
    this.intentText.visible = false;
    // the plate lives on its own layer above every unit so a front unit never hides a rear unit's bars
    this.plate.addChild(plateBg, nameT, this.hpBar, ...(this.focusBar ? [this.focusBar] : []), this.shieldText, this.statusText, this.intentText);
    this.plate.position.set(init.spot.x, init.spot.y + plateY);
    scene.add(this.plate, DEPTH.hud - 60);
    this.marker = txt(0, 0, '▼', { fontSize: 34, color: T.gold, stroke: '#0a0610', strokeThickness: 4 }, 0.5);
    this.marker.visible = false;
    this.addChild(this.marker);
    this.placeTags();

    const w = u.heightPx * 0.85 * d;
    this.hitArea = new PIXI.Rectangle(-w / 2, -u.heightPx * d, w, u.heightPx * d + 64);
    this.eventMode = 'static';
    this.on('pointerup', () => onTap(this));
    this.zIndex = DEPTH.units + init.spot.y;
    scene.add(this, DEPTH.units + init.spot.y);
  }

  private drawRing(fillAlpha: number, stroke: number, strokeAlpha: number): void {
    const { rx, ry } = this.ringR;
    this.ring.clear().ellipse(0, -2, rx, ry).fill({ color: C.silver, alpha: fillAlpha }).stroke({ width: strokeAlpha > 0 ? 4 : 0, color: stroke, alpha: strokeAlpha });
  }

  setDepth(z: number): void {
    this.zIndex = z;
  }

  /** reinforcements arrive and the side spreads again: glide to the new formation spot (plate included) */
  glideTo(spot: Spot): void {
    this.spot = spot;
    this.scene.anim.to(this, { x: spot.x, y: spot.y }, { duration: 320, ease: 'quad.inout' });
    this.scene.anim.to(this.plate, { x: spot.x, y: spot.y + 20 }, { duration: 320, ease: 'quad.inout' });
  }

  private placeTags(): void {
    this.marker.y = -this.art.unit(this.artKey).heightPx * this.spot.depthScale - 18;
  }

  private get sc(): number {
    return this.baseScale * this.art.frameFor(this.artKey, this.animName).scale;
  }

  private stopLoops(): void {
    for (const h of this.loops) h.stop();
    this.loops = [];
    this.frames?.stop();
    this.frames = null;
  }

  private startBreathing(): void {
    const base = this.sc;
    this.pose.scale.set(base);
    this.pose.angle = 0;
    this.pose.position.set(0, 0);
    const period = 860 + (this.spot.y % 9) * 38;
    // y stays 0 so the boots stay planted on the shadow while the torso breathes through scale
    this.loops.push(this.scene.anim.to(this.pose, { scaleY: base * 1.038, scaleX: base * 0.972 }, { duration: period, yoyo: true, repeat: -1, ease: 'sine.inout' }));
    this.loops.push(this.scene.anim.to(this.pose, { angle: { from: -1.2, to: 1.2 } }, { duration: period * 2, yoyo: true, repeat: -1, ease: 'sine.inout' }));
    this.loops.push(this.scene.anim.to(this.auraRing, { alpha: { from: 0.22, to: 0.46 } }, { duration: period * 1.5, yoyo: true, repeat: -1, ease: 'sine.inout' }));
  }

  private playFrames(a: UnitAnimation, key: string): void {
    const step = { t: 0 };
    const n = a.frames.length;
    const u = this.art.unit(this.artKey);
    // Non-looping action sequences weight the middle impact frame slightly longer (1.35x) so the strike silhouette reads crisply
    const weights = !a.loop && n >= 3
      ? a.frames.map((_, idx) => (idx === 0 ? 0.8 : idx === Math.floor(n / 2) ? 1.35 : 0.95))
      : a.frames.map(() => 1);
    const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;
    const cumulative: number[] = [];
    let accW = 0;
    for (const w of weights) {
      accW += w / totalWeight;
      cumulative.push(accW);
    }
    this.frames = this.scene.anim.to(step, { t: 1 }, {
      duration: (n * 1000) / Math.max(1, a.fps),
      repeat: a.loop ? -1 : 0,
      onUpdate: () => {
        const clamped = Math.min(0.9999, Math.max(0, step.t));
        let idx = cumulative.findIndex((c) => clamped <= c);
        if (idx < 0) idx = n - 1;
        const f = a.frames[idx];
        if (f && !this.img.destroyed) {
          this.img.texture = this.scene.tex(key, f);
          const st = u.states[f] ?? u.states[f.replace(/_\d+$/, '')] ?? u.states[this.animName];
          if (st) this.img.anchor.set(st.pivotX, 1);
        }
      }
    });
  }

  applyState(state: UnitAnimState): void {
    this.animName = state;
    this.stopLoops();
    this.scene.anim.killOf(this.pose);
    const f = this.art.frameFor(this.artKey, state);
    const u = this.art.unit(this.artKey);
    const sc = this.baseScale * f.scale;
    // anchored at the bottom of the trimmed frame so the soles sit on the shadow at y=0
    this.img.texture = this.scene.tex(f.key, f.frame);
    this.img.anchor.set(f.pivotX, 1);
    // players face right, enemies left; mirror when the authored art faces the other way
    this.img.scale.x = (u.facing === 'right') !== (this.side === 'player') ? -1 : 1;
    // every state's still frame reads on its own (defeat dims the fallen silhouette even under reducedMotion)
    this.img.tint = state === 'defeat' ? 0xc8bed6 : 0xffffff;
    this.pose.scale.set(sc);
    this.pose.angle = 0;
    this.pose.position.set(0, 0);
    if (f.animation && !this.reduced) this.playFrames(f.animation, f.key);
    if (this.reduced) return;
    if (state === 'idle' && this.alive) {
      this.startBreathing();
    } else if (state === 'walk' && this.alive) {
      const dir = this.side === 'player' ? 1 : -1;
      Sfx.footstep(this.artKey === 'mahmut' || this.artKey.includes('knight') || this.artKey.includes('warden'));
      this.loops.push(this.scene.anim.to(this.pose, { y: -14, scaleY: sc * 1.045, scaleX: sc * 0.96 }, { duration: 190, yoyo: true, repeat: -1, ease: 'quad.out' }));
      this.loops.push(this.scene.anim.to(this.pose, { angle: { from: -3.2 * dir, to: 3.8 * dir } }, { duration: 380, yoyo: true, repeat: -1, ease: 'sine.inout' }));
    } else if (state === 'basic' || state === 'active' || state === 'ultimate') {
      // 2-phase chibi action timing: brief anticipation coil -> forward impact snap + elemental ghost -> clean recovery
      const dir = this.side === 'player' ? 1 : -1;
      const mult = state === 'ultimate' ? 1.15 : state === 'active' ? 1.11 : 1.08;
      const lungeX = dir * (state === 'ultimate' ? 20 : state === 'active' ? 14 : 10);
      if (state === 'active' || state === 'ultimate') this.spawnGhost();
      this.pose.scale.set(sc * 0.9, sc * 1.1);
      this.pose.position.set(-dir * 7, 0);
      this.pose.angle = -dir * 3.5;
      this.scene.anim.to(
        this.pose,
        { x: lungeX, scaleX: sc * mult, scaleY: sc * 0.94, angle: dir * 4.2 },
        {
          duration: 145,
          yoyo: true,
          ease: 'back.out',
          onComplete: () => {
            this.pose.position.set(0, 0);
            this.pose.scale.set(sc);
            this.pose.angle = 0;
          }
        }
      );
    } else if (state === 'hit') {
      const push = this.side === 'player' ? -1 : 1;
      this.pose.scale.set(sc * 0.86, sc * 1.14);
      this.pose.angle = push * 8;
      this.scene.anim.to(this.pose, { x: push * 18, scaleX: sc * 1.08, scaleY: sc * 0.94, angle: 0 }, {
        duration: 120,
        yoyo: true,
        ease: 'back.out',
        onComplete: () => {
          this.pose.position.set(0, 0);
          this.pose.scale.set(sc);
          this.pose.angle = 0;
        }
      });
    } else if (state === 'defeat') {
      const fallDir = this.side === 'player' ? -1 : 1;
      this.scene.anim.to(this.pose, { x: fallDir * 14, angle: fallDir * 12, y: 8, scaleY: sc * 0.88, scaleX: sc * 1.05 }, { duration: 300, ease: 'cubic.out' });
    } else if (state === 'victory') {
      this.loops.push(this.scene.anim.to(this.pose, { y: -18, scaleY: sc * 1.06, scaleX: sc * 0.95 }, { duration: 380, yoyo: true, repeat: -1, ease: 'quad.out' }));
      this.loops.push(this.scene.anim.to(this.auraRing, { alpha: { from: 0.3, to: 0.72 } }, { duration: 420, yoyo: true, repeat: -1, ease: 'sine.inout' }));
    }
  }

  /** current pose image (the ultimate cut-in falls back to it when a hero has no portrait) */
  get poseTexture(): PIXI.Texture {
    return this.img.texture;
  }

  /** fading elemental afterimage at the unit's current position */
  spawnGhost(tint?: number): void {
    if (this.reduced || prefs().reduceFlash || this.destroyed) return;
    const g = new PIXI.Container();
    const s = new PIXI.Sprite(this.img.texture);
    s.anchor.copyFrom(this.img.anchor);
    s.scale.x = this.img.scale.x;
    s.filters = [fillFilter(tint ?? BattleVfx.palette(this.element).primary)];
    s.blendMode = 'add';
    g.addChild(s);
    g.position.set(this.x + this.pose.x, this.y + this.pose.y);
    g.scale.copyFrom(this.pose.scale);
    g.angle = this.pose.angle;
    g.alpha = 0.55;
    this.scene.add(g, this.zIndex - 1);
    this.scene.anim.to(g, { alpha: 0, scaleX: g.scale.x * 1.06, scaleY: g.scale.y * 1.06 }, { duration: 240, ease: 'cubic.out', onComplete: () => g.destroy({ children: true }) });
  }

  /** anticipation crouch, parabolic hop-dash with an elemental ghost trail, strike punch */
  playDashTo(toX: number, toY: number): Promise<void> {
    if (this.reduced) return Promise.resolve();
    this.scene.anim.killOf(this.pose);
    this.pose.position.set(0, 0);
    const sc = this.sc;
    const startX = this.x;
    const startY = this.y;
    const dir = toX >= startX ? 1 : -1;
    const a = this.scene.anim;
    return new Promise((resolve) => {
      a.to(this.pose, { scaleX: sc * 1.18, scaleY: sc * 0.82, angle: -5 * dir }, {
        duration: 65,
        ease: 'quad.out',
        onComplete: () => {
          const st = { t: 0, lastGhost: 0 };
          this.pose.scale.set(sc * 0.92, sc * 1.12);
          this.pose.angle = 8 * dir;
          a.to(st, { t: 1 }, {
            duration: 185,
            ease: 'cubic.out',
            onUpdate: () => {
              this.position.set(startX + (toX - startX) * st.t, startY + (toY - startY) * st.t - Math.sin(st.t * Math.PI) * 54);
              if (st.t - st.lastGhost >= 0.22) {
                st.lastGhost = st.t;
                this.spawnGhost();
              }
            },
            onComplete: () => {
              this.position.set(toX, toY);
              this.pose.scale.set(sc * 1.16, sc * 0.9);
              this.pose.angle = 0;
              a.to(this.pose, { scaleX: sc, scaleY: sc }, { duration: 110, ease: 'back.out' });
              resolve();
            }
          });
        }
      });
    });
  }

  /** caster levitation pulse and a spell circle under the feet */
  playCast(isUltimate = false): void {
    if (this.reduced) return;
    this.scene.anim.killOf(this.pose);
    this.pose.position.set(0, 0);
    this.pose.angle = 0;
    BattleVfx.castSigil(this.scene, this.x, this.y, this.element, isUltimate ? 1.45 : 1.05, isUltimate ? 820 : 620);
    const sc = this.sc;
    this.spawnGhost(BattleVfx.palette(this.element).core);
    this.scene.anim.to(this.pose, { y: isUltimate ? -32 : -18, scaleX: sc * 1.08, scaleY: sc * 1.08 }, { duration: 210, yoyo: true, ease: 'sine.out' });
  }

  /** elastic knockback, squash-stretch jolt */
  playHitReaction(isCrit = false): void {
    if (this.reduced) return;
    this.scene.anim.killOf(this.pose);
    this.pose.position.set(0, 0);
    const sc = this.sc;
    const push = this.side === 'player' ? -1 : 1;
    this.pose.scale.set(sc * 0.82, sc * 1.2);
    this.pose.angle = push * 9;
    this.scene.anim.to(this.pose, { x: push * (isCrit ? 34 : 22), scaleX: sc * 1.1, scaleY: sc * 0.92, angle: 0 }, {
      duration: 110,
      yoyo: true,
      ease: 'back.out',
      onComplete: () => {
        this.pose.position.set(0, 0);
        this.pose.scale.set(sc);
        this.pose.angle = 0;
      }
    });
  }

  get animState(): UnitAnimState {
    return this.animName;
  }

  get headY(): number {
    return this.y - this.art.unit(this.artKey).heightPx * this.spot.depthScale;
  }

  get hitPoint(): { x: number; y: number } {
    return { x: this.x, y: this.y - this.art.unit(this.artKey).heightPx * this.spot.depthScale * 0.5 };
  }

  flash(color = 0xffffff, ms = 120): void {
    if (this.reduced || prefs().reduceFlash) return;
    this.img.filters = [fillFilter(color)];
    this.scene.anim.after(ms * 0.55, () => {
      if (this.img.destroyed) return;
      this.img.filters = null;
      this.img.tint = BattleVfx.palette(this.element).primary;
    });
    this.scene.anim.after(ms, () => {
      if (!this.img.destroyed) this.img.tint = 0xffffff;
    });
  }

  setHp(hp: number, maxHp: number): void {
    this.hpBar.set(hp / maxHp);
  }

  setFocus(total: number): void {
    this.focusBar?.set(total / 100);
  }

  setSelectable(on: boolean): void {
    this.drawRing(0, C.goldHi, on ? 0.95 : 0);
    this.marker.visible = on;
    this.scene.anim.killOf(this.marker);
    this.placeTags();
    if (on) this.scene.anim.to(this.marker, { y: this.marker.y - 10 }, { duration: 420, yoyo: true, repeat: -1, ease: 'sine.inout' });
  }

  setHighlight(on: boolean): void {
    this.drawRing(on ? 0.16 : 0, C.silver, on ? 0.85 : 0);
    this.scene.anim.killOf(this.auraRing);
    this.auraRing.alpha = on ? 0.68 : 0.32;
  }

  setIntent(text: string | null, targetsLabel?: string): void {
    this.intentText.visible = Boolean(text) && this.alive;
    if (text) this.intentText.text = targetsLabel ? `▸ ${text} → ${targetsLabel}` : `▸ ${text}`;
  }

  setBadges(c: Pick<Combatant, 'statuses' | 'shields'>, statusNames: ReadonlyMap<string, string | { name: string; category: string }>): void {
    const shield = c.shields.reduce((n, s) => n + s.amount, 0);
    this.shieldText.text = shield > 0 ? `⛨ SH ${shield}` : '';
    this.statusText.text = c.statuses
      .map((s) => {
        const meta = statusNames.get(s.statusId);
        const name = typeof meta === 'string' ? meta : (meta?.name ?? s.statusId);
        const cat = typeof meta === 'object' && meta ? meta.category : '';
        const cue = cat === 'buff' ? '▲ ' : cat === 'control' ? '◆ ' : cat === 'debuff' ? '▼ ' : '';
        return `${cue}${name} ${s.turnsLeft}`;
      })
      .join('  ·  ');
  }

  /** fades the plate with its unit (a defeated enemy) */
  fadePlate(ms: number): void {
    this.scene.anim.to(this.plate, { alpha: 0 }, { duration: ms });
  }

  markDead(): void {
    this.alive = false;
    this.intentText.visible = false;
    this.marker.visible = false;
    if (this.focusBar) this.focusBar.visible = false;
    this.statusText.text = '';
    this.shieldText.text = '';
    this.auraRing.visible = false;
    this.stopLoops();
  }

  reducedMotion(): boolean {
    return this.reduced;
  }

  override destroy(options?: PIXI.DestroyOptions): void {
    this.stopLoops();
    if (!this.plate.destroyed) this.plate.destroy({ children: true });
    super.destroy(options);
  }
}
