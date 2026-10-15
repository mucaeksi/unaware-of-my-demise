import Phaser from 'phaser';
import type { Combatant } from '@uomd/combat';
import type { UnitAnimState } from '@uomd/content-schema';
import type { ArtLibrary } from '../content/ArtLibrary';
import { prefs } from '../platform/prefs';
import { Bar, hpColor, txt } from '../ui/kit';
import { C, DEPTH, F, T } from '../ui/theme';
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

/** Everything the player sees of one combatant: SD Chibi sprite, aura ring, shadow, plate (HP/focus/status), intent tag, and procedural motion rig. */
export class UnitView extends Phaser.GameObjects.Container {
  readonly id: string;
  readonly side: 'player' | 'enemy';
  readonly artKey: string;
  readonly element: string;
  spot: Spot;
  readonly unitName: string;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly auraRing: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Ellipse;
  private readonly plate: Phaser.GameObjects.Container;
  private readonly hpBar: Bar;
  private readonly focusBar: Bar | null;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly shieldText: Phaser.GameObjects.Text;
  private readonly intentText: Phaser.GameObjects.Text;
  private readonly marker: Phaser.GameObjects.Text;
  private baseScale = 1;
  private animName: UnitAnimState = 'idle';
  private breathe: Phaser.Tweens.Tween | null = null;
  private sway: Phaser.Tweens.Tween | null = null;
  alive = true;

  constructor(scene: Phaser.Scene, private readonly art: ArtLibrary, init: ViewInit, private readonly reduced: boolean) {
    super(scene, init.spot.x, init.spot.y);
    this.id = init.id;
    this.unitName = init.name;
    this.side = init.side;
    this.artKey = init.artKey;
    this.element = init.element ?? 'Veil';
    this.spot = init.spot;
    const u = art.unit(init.artKey);
    const pal = BattleVfx.palette(this.element);
    BattleVfx.ensureTextures(scene);

    this.shadow = scene.add.ellipse(0, 0, u.heightPx * 0.64, u.heightPx * 0.14, 0x000000, 0.48);
    this.auraRing = scene.add
      .image(0, 2, 'fx_ring')
      .setTint(init.side === 'player' ? pal.primary : 0xe55b8a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.46 * init.spot.depthScale, 0.18 * init.spot.depthScale)
      .setAlpha(0.28);
    this.ring = scene.add.ellipse(0, 0, u.heightPx * 0.78, u.heightPx * 0.17, C.silver, 0).setStrokeStyle(4, C.goldHi, 0);
    this.sprite = scene.add.sprite(0, 0, u.textureKey);
    this.add([this.shadow, this.auraRing, this.ring, this.sprite]);

    const idle = art.frameFor(init.artKey, 'idle');
    this.baseScale = (u.heightPx / (scene.textures.getFrame(idle.key, idle.frame)?.height ?? u.heightPx)) * init.spot.depthScale;
    this.applyState('idle');

    // plate under the feet
    const plateY = 38;
    const plateBg = scene.add
      .rectangle(0, init.side === 'player' ? 24 : 26, 244, init.side === 'player' ? 68 : 74, 0x0a0610, 0.68)
      .setStrokeStyle(1.5, init.side === 'player' ? C.player : C.enemy, 0.48);
    const nameT = txt(scene, 0, 0, init.name.toUpperCase(), {
      fontFamily: F.display,
      fontSize: '22px',
      fontStyle: '600',
      color: init.side === 'player' ? '#cfe0ff' : '#ffb3c4',
      stroke: '#0a0610',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.hpBar = new Bar(scene, 0, 26, 210, 13, hpColor);
    this.hpBar.set(init.hp / init.maxHp, false);
    this.focusBar = init.side === 'player' ? new Bar(scene, 0, 44, 210, 8, () => C.focus) : null;
    this.focusBar?.set(0, false);
    this.shieldText = txt(scene, 112, 26, '', { fontSize: '22px', color: T.shield, stroke: '#0a0610', strokeThickness: 3 }).setOrigin(0, 0.5);
    this.statusText = txt(scene, 0, init.side === 'player' ? 66 : 48, '', { fontSize: '20px', color: '#e0d4ee', stroke: '#0a0610', strokeThickness: 3 }).setOrigin(0.5);
    this.intentText = txt(scene, 0, init.side === 'player' ? 66 : 52, '', {
      fontFamily: F.display,
      fontSize: '20px',
      fontStyle: '600',
      color: '#ffb3c4',
      stroke: '#0a0610',
      strokeThickness: 5,
    })
      .setOrigin(0.5)
      .setVisible(false);

    // the plate lives on its own layer above every sprite so a front unit never hides a rear unit's bars
    this.plate = scene.add
      .container(init.spot.x, init.spot.y + plateY, [
        plateBg,
        nameT,
        this.hpBar,
        ...(this.focusBar ? [this.focusBar] : []),
        this.shieldText,
        this.statusText,
        this.intentText,
      ])
      .setDepth(DEPTH.hud - 60);
    this.marker = txt(scene, 0, 0, '▼', { fontSize: '44px', color: T.gold, stroke: '#0a0610', strokeThickness: 4 }).setOrigin(0.5).setVisible(false);
    this.add(this.marker);
    this.placeTags();

    const w = u.heightPx * 0.8;
    this.setSize(w, u.heightPx * this.spot.depthScale);
    this.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -u.heightPx * this.spot.depthScale, w, u.heightPx * this.spot.depthScale + 70), Phaser.Geom.Rectangle.Contains);
    scene.add.existing(this);
    if (!reduced) this.startBreathing();
  }

  /** Reinforcements arrive and the side is spread again: glide to the new formation spot (plate included). */
  glideTo(spot: Spot): void {
    this.spot = spot;
    this.scene.tweens.add({ targets: this, x: spot.x, y: spot.y, duration: 320, ease: 'Quad.easeInOut' });
    this.scene.tweens.add({ targets: this.plate, x: spot.x, y: spot.y + 38, duration: 320, ease: 'Quad.easeInOut' });
  }

  private placeTags(): void {
    const top = -this.art.unit(this.artKey).heightPx * this.spot.depthScale - 26;
    this.marker.setY(top + 4);
  }

  private startBreathing(): void {
    this.breathe?.stop();
    this.sway?.stop();
    const f = this.art.frameFor(this.artKey, this.animName);
    const base = this.baseScale * f.scale;
    this.sprite.setScale(base).setAngle(0).setPosition(0, 0);

    const period = 860 + (this.spot.y % 9) * 38;
    this.breathe = this.scene.tweens.add({
      targets: this.sprite,
      scaleY: base * 1.044,
      scaleX: base * 0.968,
      y: -5,
      duration: period,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.sway = this.scene.tweens.add({
      targets: this.sprite,
      angle: { from: -1.6, to: 1.6 },
      duration: period * 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  applyState(state: UnitAnimState): void {
    this.animName = state;
    this.breathe?.stop();
    this.sway?.stop();
    const f = this.art.frameFor(this.artKey, state);
    const u = this.art.unit(this.artKey);
    this.sprite.stop();
    const sc = this.baseScale * f.scale;
    this.sprite.setTexture(f.key, f.frame).setOrigin(f.pivotX, f.footY).setScale(sc).setAngle(0).setPosition(0, 0);
    if (f.animationKey && !this.reduced) this.sprite.play(f.animationKey);
    // players face right, enemies face left; mirror when the authored art faces the other way
    const wantRight = this.side === 'player';
    this.sprite.setFlipX((u.facing === 'right') !== wantRight);
    if (state === 'idle' && !this.reduced && this.alive) {
      this.startBreathing();
    } else if ((state === 'basic' || state === 'active' || state === 'ultimate') && !this.reduced) {
      // Dynamic Chibi action pop (overshoot squash-stretch)
      this.sprite.setScale(sc * 0.86, sc * 1.16);
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: sc * 1.08,
        scaleY: sc * 0.96,
        duration: 120,
        yoyo: true,
        ease: 'Back.easeOut',
        onComplete: () => this.sprite.setScale(sc),
      });
    } else if (state === 'victory' && !this.reduced) {
      this.scene.tweens.add({
        targets: this.sprite,
        y: -18,
        scaleY: sc * 1.06,
        scaleX: sc * 0.95,
        duration: 380,
        yoyo: true,
        repeat: -1,
        ease: 'Quad.easeOut',
      });
    }
  }

  /** Spawns a fading elemental afterimage silhouette at the unit's current world position. */
  spawnGhost(tint?: number): void {
    if (this.reduced || prefs().reduceFlash) return;
    const pal = BattleVfx.palette(this.element);
    const g = this.scene.add
      .image(this.x + this.sprite.x, this.y + this.sprite.y, this.sprite.texture.key, this.sprite.frame.name)
      .setOrigin(this.sprite.originX, this.sprite.originY)
      .setScale(this.sprite.scaleX, this.sprite.scaleY)
      .setFlipX(this.sprite.flipX)
      .setAngle(this.sprite.angle)
      .setTint(tint ?? pal.primary)
      .setTintMode(Phaser.TintModes.FILL)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.55)
      .setDepth(this.depth - 1);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: g.scaleX * 1.06,
      scaleY: g.scaleY * 1.06,
      duration: 240,
      ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  /** Dynamic anticipation crouch + parabolic hop-dash + elemental ghost trail toward target. */
  playDashTo(toX: number, toY: number): Promise<void> {
    if (this.reduced) return Promise.resolve();
    const f = this.art.frameFor(this.artKey, this.animName);
    const sc = this.baseScale * f.scale;
    const startX = this.x;
    const startY = this.y;
    const dir = toX >= startX ? 1 : -1;

    return new Promise((resolve) => {
      // 1. Anticipation crouch
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: sc * 1.18,
        scaleY: sc * 0.82,
        angle: -5 * dir,
        duration: 65,
        ease: 'Quad.easeOut',
        onComplete: () => {
          // 2. Parabolic hop-dash with ghost trail
          const state = { t: 0, lastGhost: 0 };
          this.sprite.setScale(sc * 0.92, sc * 1.12).setAngle(8 * dir);
          this.scene.tweens.add({
            targets: state,
            t: 1,
            duration: 185,
            ease: 'Cubic.easeOut',
            onUpdate: () => {
              const t = state.t;
              const arcY = -Math.sin(t * Math.PI) * 54;
              this.setPosition(
                Phaser.Math.Linear(startX, toX, t),
                Phaser.Math.Linear(startY, toY, t) + arcY,
              );
              if (t - state.lastGhost >= 0.22) {
                state.lastGhost = t;
                this.spawnGhost();
              }
            },
            onComplete: () => {
              this.setPosition(toX, toY);
              // 3. Strike impact scale punch
              this.sprite.setScale(sc * 1.16, sc * 0.9).setAngle(0);
              this.scene.tweens.add({
                targets: this.sprite,
                scaleX: sc,
                scaleY: sc,
                duration: 110,
                ease: 'Back.easeOut',
              });
              resolve();
            },
          });
        },
      });
    });
  }

  /** Caster levitation pulse + spinning gothic spell circle under feet. */
  playCast(isUltimate = false): void {
    if (this.reduced) return;
    BattleVfx.castSigil(this.scene, this.x, this.y, this.element, isUltimate ? 1.45 : 1.05, isUltimate ? 820 : 620);
    const f = this.art.frameFor(this.artKey, this.animName);
    const sc = this.baseScale * f.scale;
    this.spawnGhost(BattleVfx.palette(this.element).core);
    this.scene.tweens.add({
      targets: this.sprite,
      y: isUltimate ? -32 : -18,
      scaleX: sc * 1.08,
      scaleY: sc * 1.08,
      duration: 210,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  /** Elastic knockback slide, squash-stretch jolt, and chromatic elemental flash when taking damage. */
  playHitReaction(isCrit = false): void {
    if (this.reduced) return;
    const f = this.art.frameFor(this.artKey, this.animName);
    const sc = this.baseScale * f.scale;
    const pushDir = this.side === 'player' ? -1 : 1;
    const pushPx = isCrit ? 34 : 22;

    this.sprite.setScale(sc * 0.82, sc * 1.2).setAngle(pushDir * 9);
    this.scene.tweens.add({
      targets: this.sprite,
      x: pushDir * pushPx,
      scaleX: sc * 1.1,
      scaleY: sc * 0.92,
      angle: 0,
      duration: 110,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.sprite.setPosition(0, 0).setScale(sc).setAngle(0);
      },
    });
  }

  get animState(): UnitAnimState {
    return this.animName;
  }

  get headY(): number {
    return this.y - this.art.unit(this.artKey).heightPx * this.spot.depthScale;
  }

  flash(color: number = 0xffffff, ms = 120): void {
    if (this.reduced || prefs().reduceFlash) return;
    const pal = BattleVfx.palette(this.element);
    this.sprite.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(ms * 0.55, () => {
      if (this.sprite.active) this.sprite.setTint(pal.primary).setTintMode(Phaser.TintModes.MULTIPLY);
    });
    this.scene.time.delayedCall(ms, () => {
      if (this.sprite.active) this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }

  setHp(hp: number, maxHp: number): void {
    this.hpBar.set(hp / maxHp);
  }

  setFocus(total: number): void {
    this.focusBar?.set(total / 100);
  }

  setSelectable(on: boolean): void {
    this.ring.setStrokeStyle(4, C.goldHi, on ? 0.95 : 0);
    this.marker.setVisible(on);
    if (on) {
      this.marker.setText('▼');
      this.scene.tweens.add({
        targets: this.marker,
        y: this.marker.y - 10,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        id: 'mk',
      } as Phaser.Types.Tweens.TweenBuilderConfig);
    } else {
      this.scene.tweens.killTweensOf(this.marker);
      this.placeTags();
    }
  }

  setHighlight(on: boolean): void {
    this.ring.setStrokeStyle(4, C.silver, on ? 0.85 : 0).setFillStyle(C.silver, on ? 0.16 : 0);
    this.auraRing.setAlpha(on ? 0.68 : 0.28);
  }

  setIntent(text: string | null, targetsLabel?: string): void {
    this.intentText.setVisible(Boolean(text) && this.alive);
    if (text) this.intentText.setText(targetsLabel ? `▸ ${text} → ${targetsLabel}` : `▸ ${text}`);
  }

  setBadges(
    c: Pick<Combatant, 'statuses' | 'shields'>,
    statusNames: ReadonlyMap<string, string | { name: string; category: string }>,
  ): void {
    const shield = c.shields.reduce((n, s) => n + s.amount, 0);
    this.shieldText.setText(shield > 0 ? `⛨ SH ${shield}` : '');
    this.statusText.setText(
      c.statuses
        .map((s) => {
          const meta = statusNames.get(s.statusId);
          const name = typeof meta === 'string' ? meta : meta?.name ?? s.statusId;
          const cat = typeof meta === 'object' && meta ? meta.category : '';
          const cue = cat === 'buff' ? '▲ ' : cat === 'control' ? '◆ ' : cat === 'debuff' ? '▼ ' : '';
          return `${cue}${name} ${s.turnsLeft}`;
        })
        .join('  ·  '),
    );
  }

  override destroy(fromScene?: boolean): void {
    this.plate.destroy(fromScene);
    super.destroy(fromScene);
  }

  /** Fades the plate with its unit (used when an enemy is defeated). */
  fadePlate(ms: number): void {
    this.scene.tweens.add({ targets: this.plate, alpha: 0, duration: ms });
  }

  markDead(): void {
    this.alive = false;
    this.intentText.setVisible(false);
    this.marker.setVisible(false);
    this.focusBar?.setVisible(false);
    this.statusText.setText('');
    this.shieldText.setText('');
    this.auraRing.setVisible(false);
    this.breathe?.stop();
    this.sway?.stop();
  }

  pose(): Phaser.GameObjects.Image {
    return this.sprite;
  }

  get hitPoint(): { x: number; y: number } {
    return { x: this.x, y: this.y - this.art.unit(this.artKey).heightPx * this.spot.depthScale * 0.5 };
  }

  reducedMotion(): boolean {
    return this.reduced;
  }
}
