import Phaser from 'phaser';
import type { Prologue, PrologueScene as PrologueData } from '@uomd/content-schema';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { INTRO_FAST, REF_H, REF_W } from '../config';
import { advance } from '../entry/flow';
import { clearPrologueCheckpoint, loadPrologueCheckpoint, savePrologueCheckpoint } from '../entry/resume';
import { loadEntry, markPrologueSeen } from '../entry/state';
import { recordEntry } from '../entry/sync';
import { plateKey } from '../entry/plates';
import { prefs } from '../platform/prefs';
import { safeInsets } from '../platform/safeArea';
import { ArtLibrary } from '../content/ArtLibrary';
import { NarrativeStage } from '../presentation/NarrativeStage';
import { Services } from '../services';
import { Button, txt } from '../ui/kit';
import { C, DEPTH, F, T } from '../ui/theme';

/** Characters per second of the narration reveal (v006: no recording yet, so a fixed pace; the voice clock replaces it later). */
export const REVEAL_CPS = 26;
const CROSSFADE_MS = INTRO_FAST ? 60 : 1400;
const TEXT_FADE_MS = INTRO_FAST ? 40 : 650;

/** Seconds a scene lasts on screen. Timing comes from the narrative script; `?fastintro` only shortens it for automated review. */
export const sceneSeconds = (s: PrologueData): number => (INTRO_FAST ? 0.35 : s.duration_seconds);

/**
 * "Before the Road": the 120 s first-install interlude. Each scene is one plate with a slow camera move, a caption and one
 * narration line revealed at 26 characters per second. Pause/Mute controls are available on all runs, and Skip is available on replay;
 * the download runs underneath. After the last scene the screen slowly fades to black, records the prologue as seen
 * and seamlessly enters tutorial T-1.
 */
export class PrologueScene extends Phaser.Scene {
  private stage: NarrativeStage | null = null;
  private generation = 0;
  private data0: Prologue | null = null;
  private current: Phaser.GameObjects.Image | null = null;
  private caption!: Phaser.GameObjects.Text;
  private captionRule!: Phaser.GameObjects.Graphics;
  private body!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private shade!: Phaser.GameObjects.Graphics;
  private typer: Phaser.Time.TimerEvent | null = null;
  private fadeTimer: Phaser.Time.TimerEvent | null = null;
  private advanceTimer: Phaser.Time.TimerEvent | null = null;
  private pauseBtn: Button | null = null;
  private muteBtn: Button | null = null;
  private pausedByUser = false;
  private muted = false;
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
    this.fadeTimer = null;
    this.advanceTimer = null;
    this.pauseBtn = null;
    this.muteBtn = null;
    this.pausedByUser = false;
    this.muted = this.sound.mute;
    this.index = -1;
    this.done = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x000000);
    const insets = safeInsets(this);
    this.shade = this.add.graphics().setDepth(DEPTH.hud - 100);
    this.shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.9, 0.9);
    this.shade.fillRect(0, REF_H - 470, REF_W, 470);
    this.shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.62, 0.62, 0, 0);
    this.shade.fillRect(0, 0, REF_W, 240);
    // Subtle cinematic vignette border
    this.shade.lineStyle(1, C.plumHi, 0.35);
    this.shade.strokeRect(24 + insets.left, 20 + insets.top, REF_W - 48 - insets.left - insets.right, REF_H - 40 - insets.top - insets.bottom);
    this.shade.setAlpha(0);

    const capY = 82 + Math.round(insets.top * 0.5);
    this.caption = txt(this, REF_W / 2, capY, '', {
      fontFamily: F.display,
      fontSize: '34px',
      fontStyle: '600',
      color: '#e3c37d',
      stroke: '#05030a',
      strokeThickness: 5
    }).setOrigin(0.5).setLetterSpacing(9).setDepth(DEPTH.hud).setAlpha(0);

    this.captionRule = this.add.graphics().setDepth(DEPTH.hud).setAlpha(0);
    this.captionRule.lineStyle(1.2, C.gold, 0.48);
    this.captionRule.lineBetween(REF_W / 2 - 220, capY + 28, REF_W / 2 - 14, capY + 28);
    this.captionRule.lineBetween(REF_W / 2 + 14, capY + 28, REF_W / 2 + 220, capY + 28);
    this.captionRule.fillStyle(C.goldHi, 0.85);
    this.captionRule.fillPoints(
      [
        new Phaser.Math.Vector2(REF_W / 2, capY + 22),
        new Phaser.Math.Vector2(REF_W / 2 + 6, capY + 28),
        new Phaser.Math.Vector2(REF_W / 2, capY + 34),
        new Phaser.Math.Vector2(REF_W / 2 - 6, capY + 28)
      ],
      true
    );

    this.body = txt(this, REF_W / 2, REF_H - 300 - insets.bottom, '', {
      fontFamily: F.body,
      fontSize: '46px',
      fontStyle: '500',
      color: T.text,
      align: 'center',
      wordWrap: { width: 1520 - insets.left - insets.right },
      lineSpacing: 14,
      stroke: '#05030a',
      strokeThickness: 6
    }).setOrigin(0.5, 0).setDepth(DEPTH.hud);

    const barW = 440;
    const barY = capY + 46;
    this.add.rectangle(REF_W / 2, barY, barW, 3, C.plumHi, 0.45).setDepth(DEPTH.hud);
    this.progressFill = this.add.rectangle(REF_W / 2 - barW / 2, barY, 0, 3, C.goldHi, 0.85).setOrigin(0, 0.5).setDepth(DEPTH.hud + 1);

    this.buildControls();
    if (!prefs().reducedMotion && !INTRO_FAST) this.addMotes();
    void this.loadScript();
  }

  private buildControls(): void {
    const insets = safeInsets(this);
    this.input.on('pointerdown', () => {
      const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context;
      if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined);
    });
    this.pauseBtn = new Button(this, 130 + insets.left, 64 + insets.top, {
      label: 'PAUSE',
      w: 180,
      h: 72,
      fontSize: 24,
      onClick: () => this.togglePause()
    }).setDepth(DEPTH.hud + 3);
    this.muteBtn = new Button(this, 330 + insets.left, 64 + insets.top, {
      label: this.muted ? 'UNMUTE' : 'MUTE',
      w: 180,
      h: 72,
      fontSize: 24,
      onClick: () => this.toggleMute()
    }).setDepth(DEPTH.hud + 3);
    if (loadEntry().phase === 'completed') {
      new Button(this, REF_W - 150 - insets.right, 70 + insets.top, {
        label: 'SKIP',
        w: 200,
        h: 78,
        fontSize: 26,
        onClick: () => this.finish()
      }).setDepth(DEPTH.hud + 3);
    }
    const onVisibility = (): void => {
      if (!this.sys.isActive() || this.done) return;
      if (document.hidden) {
        this.time.paused = true;
        this.tweens.pauseAll();
      } else if (!this.pausedByUser) {
        this.time.paused = false;
        this.tweens.resumeAll();
      }
    };
    const onContextLost = (): void => {
      if (!this.done && this.index >= 0) savePrologueCheckpoint(Services.api.accountKey, this.index);
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.game.events.on('webgl:contextlost', onContextLost);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', onVisibility);
      this.game.events.off('webgl:contextlost', onContextLost);
      this.time.paused = false;
    });
  }

  private togglePause(): void {
    if (this.done) return;
    this.pausedByUser = !this.pausedByUser;
    this.time.paused = this.pausedByUser;
    if (this.pausedByUser) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.pauseBtn?.setLabel(this.pausedByUser ? 'RESUME' : 'PAUSE');
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    this.sound.mute = this.muted;
    Music.setVolume(this.muted ? 0 : prefs().musicVolume);
    this.muteBtn?.setLabel(this.muted ? 'UNMUTE' : 'MUTE');
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
    const savedIndex = loadPrologueCheckpoint(Services.api.accountKey, this.data0.scenes.length);
    if (savedIndex !== null && savedIndex > 0) {
      this.index = savedIndex - 1;
    }
    this.tweens.add({ targets: this.shade, alpha: 1, duration: 1100 });
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
    savePrologueCheckpoint(Services.api.accountKey, this.index);
    const first = this.index === 0;
    const holdMs = sceneSeconds(scene) * 1000;
    const total = Math.max(1, data.scenes.length);
    const startW = 440 * (this.index / total);
    const endW = 440 * ((this.index + 1) / total);
    this.tweens.killTweensOf(this.progressFill);
    this.progressFill.width = startW;
    this.tweens.add({ targets: this.progressFill, width: endW, duration: holdMs, ease: 'Linear' });
    if (!this.muted && !INTRO_FAST) {
      Sfx.bell(this.index === 4 ? 220 : 330 + (this.index % 3) * 55, 0.08, 1.5);
    }
    this.showPlate(scene, first, holdMs);
    this.showText(scene);
    this.fadeTimer?.remove(false);
    this.advanceTimer?.remove(false);
    this.fadeTimer = this.time.delayedCall(Math.max(0, holdMs - TEXT_FADE_MS), () => {
      this.fadeText(() => undefined);
    });
    // Advance exactly when this scene's full duration_seconds has elapsed so all 9 scenes sum to 120 s.
    this.advanceTimer = this.time.delayedCall(holdMs, () => {
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
    this.tweens.add({ targets: img, alpha: 1, duration: first ? (INTRO_FAST ? 60 : 1700) : CROSSFADE_MS, ease: 'Sine.easeInOut' });
    if (!calm) this.tweens.add({ targets: img, scale: to, x: REF_W / 2 + drift, duration: holdMs + CROSSFADE_MS, ease: 'Sine.easeInOut' });
    const old = this.current;
    this.current = img;
    if (old) this.time.delayedCall(CROSSFADE_MS + 80, () => old.destroy());
  }

  private showText(scene: PrologueData): void {
    this.typer?.remove(false);
    this.tweens.killTweensOf([this.body, this.caption, this.captionRule]);
    this.caption.setText(scene.caption_en.toUpperCase()).setAlpha(0);
    this.captionRule.setAlpha(0);
    this.body.setText('').setAlpha(1);
    this.tweens.add({ targets: [this.caption, this.captionRule], alpha: 1, duration: TEXT_FADE_MS * 2, delay: INTRO_FAST ? 15 : 260 });
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
    this.tweens.killTweensOf([this.body, this.caption, this.captionRule]);
    this.tweens.add({ targets: [this.body, this.caption, this.captionRule], alpha: 0, duration: TEXT_FADE_MS, onComplete: done });
  }

  private ending(): void {
    if (this.done) return;
    this.done = true;
    if (this.pausedByUser) {
      this.pausedByUser = false;
      this.time.paused = false;
      this.tweens.resumeAll();
    }
    const black = this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x000000, 1).setDepth(DEPTH.modal).setAlpha(0);
    this.tweens.add({
      targets: black,
      alpha: 1,
      duration: INTRO_FAST ? 60 : 2000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.time.delayedCall(INTRO_FAST ? 30 : 400, () => this.finish());
      }
    });
  }

  /** The prologue counts as seen once the player moves on (or when it cannot be shown at all). */
  private finish(): void {
    this.time.paused = false;
    clearPrologueCheckpoint(Services.api.accountKey);
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
