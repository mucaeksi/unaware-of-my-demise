import Phaser from 'phaser';
import type { Combatant } from '@uomd/combat';
import type { UnitAnimState } from '@uomd/content-schema';
import type { ArtLibrary } from '../content/ArtLibrary';
import { prefs } from '../platform/prefs';
import { Bar, hpColor, txt } from '../ui/kit';
import { C, DEPTH, F, T } from '../ui/theme';
import type { Spot } from './formation';


export interface ViewInit {
  id: string;
  name: string;
  side: 'player' | 'enemy';
  artKey: string;
  maxHp: number;
  hp: number;
  spot: Spot;
}

/** Everything the player sees of one combatant: sprite, shadow, plate (HP/focus/status), intent tag. */
export class UnitView extends Phaser.GameObjects.Container {
  readonly id: string;
  readonly side: 'player' | 'enemy';
  readonly artKey: string;
  spot: Spot;
  readonly unitName: string;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
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
  alive = true;

  constructor(scene: Phaser.Scene, private readonly art: ArtLibrary, init: ViewInit, private readonly reduced: boolean) {
    super(scene, init.spot.x, init.spot.y);
    this.id = init.id;
    this.unitName = init.name;
    this.side = init.side;
    this.artKey = init.artKey;
    this.spot = init.spot;
    const u = art.unit(init.artKey);

    this.shadow = scene.add.ellipse(0, 0, u.heightPx * 0.62, u.heightPx * 0.12, 0x000000, 0.42);
    this.ring = scene.add.ellipse(0, 0, u.heightPx * 0.78, u.heightPx * 0.17, C.silver, 0).setStrokeStyle(4, C.goldHi, 0);
    this.sprite = scene.add.sprite(0, 0, u.textureKey);
    this.add([this.shadow, this.ring, this.sprite]);

    const idle = art.frameFor(init.artKey, 'idle');
    this.baseScale = (u.heightPx / (scene.textures.getFrame(idle.key, idle.frame)?.height ?? u.heightPx)) * init.spot.depthScale;
    this.applyState('idle');

    // plate under the feet
    const plateY = 44;
    const nameT = txt(scene, 0, 0, init.name.toUpperCase(), { fontFamily: F.display, fontSize: '24px', fontStyle: '600', color: init.side === 'player' ? '#cfe0ff' : '#ffb3c4', stroke: '#0a0610', strokeThickness: 4 }).setOrigin(0.5);
    this.hpBar = new Bar(scene, 0, 30, 210, 14, hpColor);
    this.hpBar.set(init.hp / init.maxHp, false);
    this.focusBar = init.side === 'player' ? new Bar(scene, 0, 50, 210, 8, () => C.focus) : null;
    this.focusBar?.set(0, false);
    this.shieldText = txt(scene, 112, 30, '', { fontSize: '24px', color: T.shield, stroke: '#0a0610', strokeThickness: 3 }).setOrigin(0, 0.5);
    this.statusText = txt(scene, 0, init.side === 'player' ? 74 : 56, '', { fontSize: '22px', color: '#e0d4ee', stroke: '#0a0610', strokeThickness: 3 }).setOrigin(0.5);
    this.intentText = txt(scene, 0, init.side === 'player' ? 74 : 84, '', { fontFamily: F.display, fontSize: '21px', fontStyle: '600', color: '#ffb3c4', stroke: '#0a0610', strokeThickness: 5 }).setOrigin(0.5).setVisible(false);
    // the plate lives on its own layer above every sprite so a front unit never hides a rear unit's bars
    this.plate = scene.add.container(init.spot.x, init.spot.y + plateY, [nameT, this.hpBar, ...(this.focusBar ? [this.focusBar] : []), this.shieldText, this.statusText, this.intentText]).setDepth(DEPTH.hud - 60);
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
    this.scene.tweens.add({ targets: this.plate, x: spot.x, y: spot.y + 44, duration: 320, ease: 'Quad.easeInOut' });
  }

  private placeTags(): void {
    const top = -this.art.unit(this.artKey).heightPx * this.spot.depthScale - 26;
    this.marker.setY(top + 4);
  }

  private startBreathing(): void {
    this.breathe?.stop();
    this.breathe = this.scene.tweens.add({
      targets: this.sprite,
      scaleY: this.sprite.scaleY * 1.014,
      scaleX: this.sprite.scaleX * 0.992,
      duration: 1100 + (this.spot.y % 7) * 40,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  applyState(state: UnitAnimState): void {
    this.animName = state;
    this.breathe?.stop();
    const f = this.art.frameFor(this.artKey, state);
    const u = this.art.unit(this.artKey);
    this.sprite.stop();
    this.sprite.setTexture(f.key, f.frame).setOrigin(f.pivotX, f.footY).setScale(this.baseScale * f.scale);
    if (f.animationKey && !this.reduced) this.sprite.play(f.animationKey);
    // players face right, enemies face left; mirror when the authored art faces the other way
    const wantRight = this.side === 'player';
    this.sprite.setFlipX((u.facing === 'right') !== wantRight);
    if (state === 'idle' && !this.reduced && this.alive) this.startBreathing();
  }

  get animState(): UnitAnimState {
    return this.animName;
  }

  get headY(): number {
    return this.y - this.art.unit(this.artKey).heightPx * this.spot.depthScale;
  }

  flash(color: number = 0xffffff, ms = 120): void {
    if (this.reduced || prefs().reduceFlash) return;
    this.sprite.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(ms, () => this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
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
      this.scene.tweens.add({ targets: this.marker, y: this.marker.y - 10, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', id: 'mk' } as Phaser.Types.Tweens.TweenBuilderConfig);
    } else {
      this.scene.tweens.killTweensOf(this.marker);
      this.placeTags();
    }
  }

  setHighlight(on: boolean): void {
    this.ring.setStrokeStyle(4, C.silver, on ? 0.8 : 0).setFillStyle(C.silver, on ? 0.12 : 0);
  }

  setIntent(text: string | null, targetsLabel?: string): void {
    this.intentText.setVisible(Boolean(text) && this.alive);
    if (text) this.intentText.setText(targetsLabel ? `▸ ${text} → ${targetsLabel}` : `▸ ${text}`);
  }

  setBadges(
    c: Pick<Combatant, 'statuses' | 'shields'>,
    statusNames: ReadonlyMap<string, string | { name: string; category: string }>
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
        .join('  ·  ')
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
    this.breathe?.stop();
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
