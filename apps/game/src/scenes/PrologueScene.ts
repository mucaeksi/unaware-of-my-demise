import Phaser from 'phaser';
import type { Prologue, PrologueScene as PrologueData } from '@uomd/content-schema';
import { INTRO_FAST, REF_H, REF_W } from '../config';
import { advance } from '../entry/flow';
import { markPrologueSeen } from '../entry/state';
import { recordEntry } from '../entry/sync';
import { plateKey } from '../entry/plates';
import { prefs } from '../platform/prefs';
import { ArtLibrary } from '../content/ArtLibrary';
import { NarrativeStage } from '../presentation/NarrativeStage';
import { Services } from '../services';
import { Button, txt } from '../ui/kit';
import { C, DEPTH, F, T } from '../ui/theme';

/** Characters per second of the narration reveal (v006: no recording yet, so a fixed pace; the voice clock replaces it later). */
export const REVEAL_CPS = 26;
const CROSSFADE_MS = INTRO_FAST ? 60 : 800;
const TEXT_FADE_MS = INTRO_FAST ? 40 : 450;

/** Seconds a scene lasts on screen. Timing comes from the narrative script; `?fastintro` only shortens it for automated review. */
export const sceneSeconds = (s: PrologueData): number => (INTRO_FAST ? 0.35 : s.duration_seconds);

/**
 * "Before the Road": the ~120 s first-install interlude. Each scene is one plate with a slow camera move, a caption and one
 * narration line revealed at 26 characters per second. No controls and no skip (v006); the download runs underneath. After the last
 * scene the screen fades to black and offers CONTINUE, which records the prologue as seen and goes on to tutorial T-1.
 */
export class PrologueScene extends Phaser.Scene {
  private stage: NarrativeStage | null = null;
  private generation = 0;
  private data0: Prologue | null = null;
  private current: Phaser.GameObjects.Image | null = null;
  private caption!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private shade!: Phaser.GameObjects.Graphics;
  private typer: Phaser.Time.TimerEvent | null = null;
  private index = -1;
  private done = false;

  constructor() {
    super('Prologue');
  }

  init(): void {
    this.generation++;
    this.stage = null;
    this.data0 = null;
    this.current = null;
    this.typer = null;
    this.index = -1;
    this.done = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x000000);
    this.shade = this.add.graphics().setDepth(DEPTH.hud - 100);
    this.shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.88, 0.88);
    this.shade.fillRect(0, REF_H - 470, REF_W, 470);
    this.shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
    this.shade.fillRect(0, 0, REF_W, 220);
    this.shade.setAlpha(0);
    this.caption = txt(this, REF_W / 2, 96, '', { fontFamily: F.display, fontSize: '34px', fontStyle: '600', color: '#e3c37d', stroke: '#05030a', strokeThickness: 5 }).setOrigin(0.5).setLetterSpacing(9).setDepth(DEPTH.hud).setAlpha(0);
    this.body = txt(this, REF_W / 2, REF_H - 300, '', { fontFamily: F.body, fontSize: '46px', fontStyle: '500', color: T.text, align: 'center', wordWrap: { width: 1520 }, lineSpacing: 14, stroke: '#05030a', strokeThickness: 6 }).setOrigin(0.5, 0).setDepth(DEPTH.hud);
    if (!prefs().reducedMotion && !INTRO_FAST) this.addMotes();
    void this.loadScript();
  }

  private async loadScript(): Promise<void> {
    const generation = this.generation;
    this.events.once('shutdown', () => { this.generation++; });
    const current = () => generation === this.generation && this.sys.isActive();
    try {
      const { content } = Services.ready();
      const entry = await content.entryIndex();
      this.data0 = await content.prologue(entry.prologue);
      const [pack, locale] = await Promise.all([content.presentation(), content.locale()]);
      if (!current()) return;
      this.stage = new NarrativeStage(this, content, Services.ready().art.art, pack, locale);
      if (this.data0.video_id) { await this.stage.video(this.data0.video_id, false); if (current()) this.ending(); return; }
      // plates are loaded here, not at boot (the stills group is lazy); a plate the content does not ship is drawn as a painted stand-in
      const ids = this.data0.scenes.flatMap((sc) => ArtLibrary.plateIds(sc.id, sc.visual));
      await Services.art?.loadStills(this, ids).catch((e: unknown) => console.warn('prologue plates unavailable', e));
    } catch (e) {
      // the prologue is a presentation: if it cannot load, the road must still open
      console.error('prologue unavailable', e);
      if (current()) this.finish();
      return;
    }
    if (!current()) return;
    this.tweens.add({ targets: this.shade, alpha: 1, duration: 600 });
    this.next();
  }

  private next(): void {
    const data = this.data0;
    if (!data || this.done) return;
    this.index++;
    const scene = data.scenes[this.index];
    if (!scene) {
      this.ending();
      return;
    }
    const first = this.index === 0;
    const holdMs = sceneSeconds(scene) * 1000;
    this.showPlate(scene, first, holdMs);
    this.showText(scene);
    // the next scene starts exactly when this one's script time is up (the crossfade overlaps the tail)
    this.time.delayedCall(Math.max(0, holdMs - CROSSFADE_MS), () => {
      this.fadeText(() => undefined);
      this.next();
    });
  }

  private showPlate(scene: PrologueData, first: boolean, holdMs: number): void {
    const art = ArtLibrary.plateIds(scene.id, scene.visual).map((id) => Services.art?.still(id)).find((k) => k) ?? null;
    const img = this.add.image(REF_W / 2, REF_H / 2, plateKey(this, scene.visual, art)).setDepth(DEPTH.bg + this.index).setAlpha(0);
    const cover = Math.max(REF_W / img.width, REF_H / img.height);
    const calm = prefs().reducedMotion;
    const zoomIn = this.index % 2 === 0;
    const from = cover * (calm ? 1.04 : zoomIn ? 1.0 : 1.09);
    const to = cover * (calm ? 1.04 : zoomIn ? 1.09 : 1.0);
    img.setScale(from);
    const drift = calm ? 0 : (this.index % 3 === 1 ? 46 : -46);
    img.x += drift * -1;
    this.tweens.add({ targets: img, alpha: 1, duration: first ? 1200 : CROSSFADE_MS, ease: 'Sine.easeInOut' });
    if (!calm) this.tweens.add({ targets: img, scale: to, x: REF_W / 2 + drift, duration: holdMs + CROSSFADE_MS, ease: 'Sine.easeInOut' });
    const old = this.current;
    this.current = img;
    if (old) this.time.delayedCall(CROSSFADE_MS + 60, () => old.destroy());
  }

  private showText(scene: PrologueData): void {
    this.typer?.remove(false);
    this.caption.setText(scene.caption_en.toUpperCase());
    this.body.setText('');
    this.tweens.add({ targets: this.caption, alpha: 1, duration: TEXT_FADE_MS * 2, delay: 300 });
    this.body.setAlpha(1);
    const full = this.stage?.text(scene.line_id, scene.text_en) ?? scene.text_en;
    void this.stage?.voice(scene.line_id);
    const step = INTRO_FAST ? 3 : 1;
    let n = 0;
    this.typer = this.time.addEvent({
      delay: 1000 / REVEAL_CPS,
      loop: true,
      callback: () => {
        n += step;
        this.body.setText(full.slice(0, n));
        if (n >= full.length) this.typer?.remove(false);
      }
    });
  }

  private fadeText(done: () => void): void {
    this.typer?.remove(false);
    this.tweens.add({ targets: [this.body, this.caption], alpha: 0, duration: TEXT_FADE_MS, onComplete: done });
  }

  private ending(): void {
    if (this.done) return;
    this.done = true;
    const black = this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x000000, 1).setDepth(DEPTH.modal).setAlpha(0);
    this.tweens.add({
      targets: black,
      alpha: 1,
      duration: INTRO_FAST ? 60 : 1400,
      ease: 'Sine.easeIn',
      onComplete: () => {
        const btn = new Button(this, REF_W / 2, REF_H / 2 + 40, { label: 'CONTINUE', w: 520, h: 128, fontSize: 44, variant: 'hot', onClick: () => this.finish() }).setDepth(DEPTH.modal + 1).setAlpha(0);
        this.tweens.add({ targets: btn, alpha: 1, duration: 700 });
      }
    });
  }

  /** The prologue counts as seen once the player moves on (or when it cannot be shown at all). */
  private finish(): void {
    recordEntry(Services.api, (s) => markPrologueSeen(s));
    advance(this);
  }

  /** A few slow ash motes over every plate, built-in Phaser particles on the shared soft dot. */
  private addMotes(): void {
    if (!this.textures.exists('fx_spark')) return;
    this.add
      .particles(0, 0, 'fx_spark', {
        x: { min: 0, max: REF_W },
        y: REF_H + 20,
        lifespan: 11000,
        speedY: { min: -52, max: -24 },
        speedX: { min: -14, max: 14 },
        scale: { min: 0.04, max: 0.14 },
        alpha: { start: 0.3, end: 0 },
        frequency: 380,
        tint: [0xc9b6e4, 0xe3c37d, 0xefe8f5],
        blendMode: 'ADD'
      })
      .setDepth(DEPTH.fx);
    void C;
  }
}
