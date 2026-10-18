import * as PIXI from 'pixi.js';
import type Phaser from '../engine';
import type { Prologue, PrologueScene as PrologueData } from '@uomd/content-schema';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { INTRO_FAST, REF_H, REF_W } from '../config';
import type { Handle } from '../core/anim';
import { hosted } from '../core/host';
import { PixiScene } from '../core/PixiScene';
import { advance } from '../entry/flow';
import { S } from '../entry/strings';
import { clearPrologueCheckpoint, loadPrologueCheckpoint, savePrologueCheckpoint } from '../entry/resume';
import { isDevServer, isForceFreshEntry, isInteractiveBrowser, isReplaying, loadEntry, markPrologueSeen } from '../entry/state';
import { recordEntry } from '../entry/sync';
import { plateTexture } from '../entry/plates';
import { prefs } from '../platform/prefs';
import { safeInsets } from '../platform/safeArea';
import { ArtLibrary } from '../content/ArtLibrary';
import { NarrativeStage } from '../presentation/NarrativeStage';
import { Services } from '../services';
import { Button, title, txt, verticalShade, type UiText } from '../ui/pixiKit';
import { buildSubtitleSchedule, resolveSubtitleProgress } from '../ui/subtitles';
import { C, DEPTH, F } from '../ui/theme';
import { Sparks } from '../vfx/sparks';
import { vfxTextures } from '../vfx/textures';

/** Fallback characters per second when no voice recording is present. */
export const REVEAL_CPS = 26;
const CROSSFADE_MS = INTRO_FAST ? 60 : 1400;
const TEXT_FADE_MS = INTRO_FAST ? 40 : 650;
const WAVE_W = 560;
const BAR_W = 440;

/** Seconds a scene lasts on screen. Timing comes from the narrative script; `?fastintro` only shortens it for automated review. */
export const sceneSeconds = (s: PrologueData): number => (INTRO_FAST ? 0.35 : s.duration_seconds);

/**
 * "Before the Road": the 120 s first-install interlude, drawn with PIXI (D-25). Each shot is one plate with a slow camera
 * move, a caption and one narration line revealed in sync with the Japanese voiceover (`Algieba`). Pause/Mute are always
 * available and Skip on replay; the download runs underneath. After the last shot the screen fades to black, records the
 * prologue as seen and enters tutorial T-1.
 *
 * Shot overlap contract: a shot holds exactly `duration_seconds`; its caption block fades out during the last
 * TEXT_FADE_MS of that hold, and the next shot's text starts fresh at the boundary (every text node gets its own tween,
 * so the new shot always cancels the outgoing fade). The plates cross-fade over CROSSFADE_MS into the next hold, so the
 * whole opening lasts the authored sum of the holds.
 */
export class PrologueScene extends PixiScene {
  private stage: NarrativeStage | null = null;
  private data0: Prologue | null = null;
  private current: PIXI.Sprite | null = null;
  private caption!: UiText;
  private captionRule!: PIXI.Graphics;
  private subtitlePlaque!: PIXI.Graphics;
  private subtitleShimmer!: PIXI.Graphics;
  private voiceWaveTrack!: PIXI.Graphics;
  private voiceWaveFill!: PIXI.Graphics;
  private body!: UiText;
  private baseCapY = 82;
  private baseBodyY = REF_H - 292;
  private progressFill!: PIXI.Graphics;
  private shade!: PIXI.Container;
  private stopTyper: (() => void) | null = null;
  private fadeTimer: Handle | null = null;
  private advanceTimer: Handle | null = null;
  private pauseBtn: Button | null = null;
  private muteBtn: Button | null = null;
  private skipBtn: Button | null = null;
  private pausedByUser = false;
  private hidden = false;
  private muted = false;
  private index = -1;
  private done = false;

  constructor() {
    super(0x000000);
  }

  /** the text nodes of one shot (each tweened on its own, see the overlap contract) */
  private get textNodes(): PIXI.Container[] {
    return [this.body, this.caption, this.captionRule, this.subtitlePlaque, this.subtitleShimmer, this.voiceWaveTrack, this.voiceWaveFill];
  }

  create(): void {
    this.muted = this.host.sound.mute;
    const insets = safeInsets(this.host);
    this.shade = this.add(new PIXI.Container(), DEPTH.hud - 100);
    this.shade.addChild(
      verticalShade(0, REF_H - 470, REF_W, 470, 0x000000, 0, 0.9),
      verticalShade(0, 0, REF_W, 240, 0x000000, 0.62, 0),
      // subtle cinematic border
      new PIXI.Graphics().rect(24 + insets.left, 20 + insets.top, REF_W - 48 - insets.left - insets.right, REF_H - 40 - insets.top - insets.bottom).stroke({ width: 1, color: C.plumHi, alpha: 0.35 })
    );
    this.shade.alpha = 0;

    const capY = 82 + Math.round(insets.top * 0.5);
    this.baseCapY = capY;
    this.caption = this.add(txt(REF_W / 2, capY, '', { fontFamily: F.display, fontSize: 34, fontStyle: '600', color: '#e3c37d', stroke: '#05030a', strokeThickness: 5, letterSpacing: 9, shadow: { x: 0, y: 2, color: '#05030a', blur: 8 } }, 0.5), DEPTH.hud);
    this.caption.alpha = 0;

    this.captionRule = this.add(
      new PIXI.Graphics().moveTo(-220, 0).lineTo(-14, 0).moveTo(14, 0).lineTo(220, 0).stroke({ width: 1.2, color: C.gold, alpha: 0.48 }).poly([0, -6, 6, 0, 0, 6, -6, 0]).fill({ color: C.goldHi, alpha: 0.85 }),
      DEPTH.hud
    );
    this.captionRule.position.set(REF_W / 2, capY + 28);
    this.captionRule.alpha = 0;

    const plaqueTop = REF_H - 314 - insets.bottom;
    const bodyY = plaqueTop + 44;
    this.baseBodyY = bodyY;
    const plaqueW = 1580 - insets.left - insets.right;
    const plaqueH = 210;
    const cx = REF_W / 2;
    this.subtitlePlaque = this.add(
      new PIXI.Graphics()
        .roundRect(cx - plaqueW / 2, plaqueTop, plaqueW, plaqueH, 26)
        .fill({ color: 0x0b0614, alpha: 0.48 })
        .stroke({ width: 1, color: C.gold, alpha: 0.28 })
        .moveTo(cx - 340, plaqueTop)
        .lineTo(cx - 12, plaqueTop)
        .moveTo(cx + 12, plaqueTop)
        .lineTo(cx + 340, plaqueTop)
        .stroke({ width: 1.2, color: C.goldHi, alpha: 0.42 })
        .poly([cx, plaqueTop - 5, cx + 5, plaqueTop, cx, plaqueTop + 5, cx - 5, plaqueTop])
        .fill({ color: C.goldHi, alpha: 0.78 }),
      DEPTH.hud - 2
    );
    this.subtitlePlaque.alpha = 0;

    this.subtitleShimmer = this.add(new PIXI.Graphics().rect(-60, -1, 120, 2).fill(0xf6e3b4), DEPTH.hud + 1);
    this.subtitleShimmer.position.set(cx - 340, plaqueTop);
    this.subtitleShimmer.alpha = 0;

    const waveY = plaqueTop + plaqueH - 12;
    this.voiceWaveTrack = this.add(new PIXI.Graphics().rect(cx - WAVE_W / 2, waveY - 1, WAVE_W, 2).fill({ color: C.plumHi, alpha: 0.35 }), DEPTH.hud);
    this.voiceWaveTrack.alpha = 0;
    // unit-wide fills scaled along x: width = scale.x
    this.voiceWaveFill = this.add(new PIXI.Graphics().rect(0, -1.25, 1, 2.5).fill({ color: C.goldHi, alpha: 0.88 }), DEPTH.hud + 1);
    this.voiceWaveFill.position.set(cx - WAVE_W / 2, waveY);
    this.voiceWaveFill.scale.x = 0;
    this.voiceWaveFill.alpha = 0;

    this.body = this.add(txt(cx, bodyY, '', { fontFamily: F.body, fontSize: 46, fontStyle: '500', color: '#f8f2e8', align: 'center', wordWrap: { width: 1490 - insets.left - insets.right }, lineSpacing: 14, stroke: '#05030a', strokeThickness: 6, shadow: { x: 0, y: 3, color: '#05030a', blur: 10 } }, [0.5, 0]), DEPTH.hud);

    const barY = capY + 46;
    this.add(new PIXI.Graphics().rect(cx - BAR_W / 2, barY - 1.5, BAR_W, 3).fill({ color: C.plumHi, alpha: 0.45 }), DEPTH.hud);
    this.progressFill = this.add(new PIXI.Graphics().rect(0, -1.5, 1, 3).fill({ color: C.goldHi, alpha: 0.85 }), DEPTH.hud + 1);
    this.progressFill.position.set(cx - BAR_W / 2, barY);
    this.progressFill.scale.x = 0;

    this.buildControls();
    if (!prefs().reducedMotion && !INTRO_FAST) this.addMotes();
    void this.loadScript();
  }

  /** timers, tweens and the typer all run on the animator, so pausing it freezes the whole shot */
  private syncPause(): void {
    const paused = this.pausedByUser || this.hidden;
    this.anim.timeScale = paused ? 0 : 1;
    Music.setPaused(paused);
  }

  private buildControls(): void {
    const insets = safeInsets(this.host);
    const canvas = this.host.game.canvas;
    const onPointer = (): void => {
      const ctx = this.host.sound.context;
      if (ctx?.state === 'suspended' && !this.pausedByUser) void ctx.resume().then(() => this.ensurePrologueMusic()).catch(() => undefined);
      else this.ensurePrologueMusic();
    };
    canvas.addEventListener('pointerdown', onPointer);
    const top = DEPTH.hud + 3;
    this.pauseBtn = this.add(new Button(this, 108 + insets.left, 56 + insets.top, { label: 'PAUSE', w: 148, h: 62, fontSize: 21, onClick: () => this.togglePause() }), top);
    this.muteBtn = this.add(new Button(this, 270 + insets.left, 56 + insets.top, { label: this.muted ? 'UNMUTE' : 'MUTE', w: 148, h: 62, fontSize: 21, onClick: () => this.toggleMute() }), top);
    // entry contract: no Skip on a first viewing (the dev server keeps it for the owner's review loop)
    if (loadEntry().phase === 'completed' || isReplaying() || isDevServer()) this.skipBtn = this.add(new Button(this, REF_W - 108 - insets.right, 56 + insets.top, { label: 'SKIP', w: 148, h: 62, fontSize: 21, onClick: () => this.finish() }), top);
    const onVisibility = (): void => {
      if (!this.live || this.done) return;
      this.hidden = document.hidden;
      this.syncPause();
    };
    const onContextLost = (): void => {
      if (!this.done && this.index >= 0) savePrologueCheckpoint(Services.flowKey(), this.index);
    };
    const game = this.host.game;
    document.addEventListener('visibilitychange', onVisibility);
    game.events.on('webgl:contextlost', onContextLost);
    this.onClose(() => {
      canvas.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      game.events.off('webgl:contextlost', onContextLost);
      this.stopTyper?.();
      Music.setPaused(false);
    });
  }

  private togglePause(): void {
    if (this.done) return;
    this.pausedByUser = !this.pausedByUser;
    this.syncPause();
    this.stage?.setPaused(this.pausedByUser);
    this.pauseBtn?.setLabel(this.pausedByUser ? 'RESUME' : 'PAUSE');
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    this.host.sound.mute = this.muted;
    Music.setVolume(this.muted ? 0 : prefs().musicVolume);
    this.stage?.setVoiceMuted(this.muted);
    this.muteBtn?.setLabel(this.muted ? 'UNMUTE' : 'MUTE');
  }

  private ensurePrologueMusic(forceOffset?: number): void {
    if (this.done) return;
    try {
      const m = Services.art?.music('bgm_prologue_before_the_road');
      if (m) Music.play(this.host.cache.audio, m.key, m.loopStart, m.duration, 2.2, forceOffset ?? 0);
    } catch {
      /* music is optional */
    }
  }

  private async loadScript(): Promise<void> {
    const current = (): boolean => this.live;
    try {
      const { content } = Services.ready();
      const entry = await content.entryIndex();
      this.data0 = await content.prologue(entry.prologue);
      const [pack, locale] = await Promise.all([content.presentation(), content.locale()]);
      if (!current()) return;
      this.stage = new NarrativeStage(this, content, Services.ready().art.art, pack, locale);
      if (this.data0.video_id) {
        await this.stage.video(this.data0.video_id, false);
        if (current()) this.ending();
        return;
      }
      const allIds = this.data0.scenes.flatMap((sc) => ArtLibrary.plateIds(sc.id, sc.visual));
      const firstScene = this.data0.scenes[0];
      const initialIds = !INTRO_FAST && firstScene ? ArtLibrary.plateIds(firstScene.id, firstScene.visual) : allIds;
      await Promise.all([
        Services.art?.loadStills(this.host, initialIds).catch((e: unknown) => console.warn('prologue plates unavailable', e)),
        Services.art?.loadMusic(this.host, 'bgm_prologue_before_the_road').catch(() => undefined)
      ]);
      if (!current()) return;
      if (!INTRO_FAST && allIds.length > initialIds.length) void Services.art?.loadStills(this.host, allIds).catch((e: unknown) => console.warn('prologue background plates unavailable', e));
    } catch (e) {
      // the road must still open, but a mandatory opening is never marked seen behind the player's back (R09)
      console.error('prologue unavailable', e);
      if (current()) this.unavailable();
      return;
    }
    if (!current()) return;
    const savedIndex = isForceFreshEntry() ? null : loadPrologueCheckpoint(Services.flowKey(), this.data0.scenes.length);
    if (savedIndex !== null && savedIndex > 0) this.index = savedIndex - 1;
    this.ensurePrologueMusic();
    this.anim.to(this.shade, { alpha: 1 }, { duration: 1100 });
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
    savePrologueCheckpoint(Services.flowKey(), this.index);
    const first = this.index === 0;
    const holdMs = sceneSeconds(scene) * 1000;
    const total = Math.max(1, data.scenes.length);
    this.anim.killOf(this.progressFill.scale);
    this.progressFill.scale.x = BAR_W * (this.index / total);
    this.anim.to(this.progressFill.scale, { x: BAR_W * ((this.index + 1) / total) }, { duration: holdMs });
    if (!this.muted && !INTRO_FAST && !this.stage?.hasVoice(scene.line_id)) Sfx.bell(this.index === 4 ? 220 : 330 + (this.index % 3) * 55, 0.08, 1.5);
    this.showPlate(scene, first, holdMs);
    this.showText(scene);
    this.fadeTimer?.stop();
    this.advanceTimer?.stop();
    this.fadeTimer = this.anim.after(Math.max(0, holdMs - TEXT_FADE_MS), () => this.fadeText());
    // advance exactly when this shot's duration_seconds has elapsed, so the holds sum to the authored opening length
    this.advanceTimer = this.anim.after(holdMs, () => this.next());
  }

  private showPlate(scene: PrologueData, first: boolean, holdMs: number): void {
    const artKey = ArtLibrary.plateIds(scene.id, scene.visual).map((id) => Services.art?.still(id)).find((k) => k) ?? null;
    const img = this.add(new PIXI.Sprite(plateTexture(scene.visual, artKey ? this.tex(artKey) : null)), DEPTH.bg + this.index);
    img.anchor.set(0.5);
    img.position.set(REF_W / 2, REF_H / 2);
    img.alpha = 0;
    const cover = Math.max(REF_W / (img.texture.width || REF_W), REF_H / (img.texture.height || REF_H));
    const calm = prefs().reducedMotion;
    const zoomIn = this.index % 2 === 0;
    img.scale.set(cover * (calm ? 1.04 : zoomIn ? 1.0 : 1.09));
    const to = cover * (calm ? 1.04 : zoomIn ? 1.09 : 1.0);
    const drift = calm ? 0 : this.index % 3 === 1 ? 46 : -46;
    img.x -= drift;
    this.anim.to(img, { alpha: 1 }, { duration: first ? (INTRO_FAST ? 60 : 1700) : CROSSFADE_MS, ease: 'sine.inout' });
    if (!calm) this.anim.to(img, { scale: to, x: REF_W / 2 + drift }, { duration: holdMs + CROSSFADE_MS, ease: 'sine.inout' });
    const old = this.current;
    this.current = img;
    if (old) this.anim.after(CROSSFADE_MS + 80, () => old.destroy());
  }

  private killText(): void {
    this.stopTyper?.();
    this.stopTyper = null;
    for (const n of this.textNodes) this.anim.killOf(n);
    this.anim.killOf(this.voiceWaveFill.scale);
    this.anim.killOf(this.captionRule.scale);
  }

  private showText(scene: PrologueData): void {
    this.killText();
    const calm = prefs().reducedMotion || INTRO_FAST;
    this.caption.text = scene.caption_en.toUpperCase();
    this.caption.alpha = 0;
    this.caption.y = calm ? this.baseCapY : this.baseCapY - 12;
    this.captionRule.alpha = 0;
    this.captionRule.scale.x = calm ? 1 : 0.25;
    this.subtitlePlaque.alpha = 0;
    this.subtitlePlaque.y = calm ? 0 : 16;
    this.voiceWaveTrack.alpha = 0;
    this.voiceWaveFill.alpha = 0;
    this.voiceWaveFill.scale.x = 0;
    this.body.text = '';
    this.body.alpha = 1;
    this.body.y = calm ? this.baseBodyY : this.baseBodyY + 18;

    this.anim.to(this.caption, { alpha: 1, y: this.baseCapY }, { duration: TEXT_FADE_MS * 1.6, delay: INTRO_FAST ? 15 : 180, ease: 'cubic.out' });
    this.anim.to(this.captionRule, { alpha: 1, scaleX: 1 }, { duration: TEXT_FADE_MS * 1.8, delay: INTRO_FAST ? 15 : 220, ease: 'back.out' });
    for (const n of [this.subtitlePlaque, this.voiceWaveTrack, this.voiceWaveFill]) this.anim.to(n, n === this.subtitlePlaque ? { alpha: 1, y: 0 } : { alpha: 1 }, { duration: INTRO_FAST ? 40 : 480, ease: 'cubic.out' });
    this.anim.to(this.body, { y: this.baseBodyY }, { duration: INTRO_FAST ? 40 : 520, ease: 'cubic.out' });
    if (!calm) {
      this.subtitleShimmer.x = REF_W / 2 - 340;
      this.subtitleShimmer.alpha = 0.85;
      this.anim.to(this.subtitleShimmer, { x: REF_W / 2 + 340, alpha: 0 }, { duration: 1250, ease: 'sine.out' });
    }

    const full = this.stage?.text(scene.line_id, scene.text_en) ?? scene.text_en;
    void this.stage?.voice(scene.line_id);

    if (INTRO_FAST || !isInteractiveBrowser()) {
      const step = INTRO_FAST ? 3 : 1;
      const every = 1000 / REVEAL_CPS;
      let n = 0;
      let acc = 0;
      this.stopTyper = this.onTick((dt) => {
        acc += dt;
        while (acc >= every && n < full.length) {
          acc -= every;
          n += step;
        }
        this.body.text = full.slice(0, n);
        this.voiceWaveFill.scale.x = Math.round(WAVE_W * Math.min(1, n / Math.max(1, full.length)));
        if (n >= full.length) this.stopTyper?.();
      });
      return;
    }

    const voiceDur = this.stage?.voiceDuration(scene.line_id) || Math.max(4, scene.duration_seconds - 1.4);
    const schedule = buildSubtitleSchedule(full, voiceDur, REVEAL_CPS);
    let elapsedMs = 0;
    this.stopTyper = this.onTick((dt) => {
      elapsedMs += dt;
      const vp = this.stage?.voiceProgress(scene.line_id);
      const prog = resolveSubtitleProgress(schedule, elapsedMs, vp?.playing ? vp.currentTime : undefined);
      this.body.text = full.slice(0, prog.count);
      const waveRatio = vp?.playing ? vp.ratio : prog.voiceRatio;
      this.voiceWaveFill.scale.x = Math.round(WAVE_W * Math.min(1, waveRatio));
      if (prog.done && waveRatio >= 0.99) this.stopTyper?.();
    });
  }

  private fadeText(): void {
    this.killText();
    for (const n of this.textNodes) if (n !== this.subtitleShimmer) this.anim.to(n, { alpha: 0 }, { duration: TEXT_FADE_MS, ease: 'sine.inout' });
  }

  private ending(): void {
    if (this.done) return;
    this.done = true;
    this.pausedByUser = false;
    this.hidden = false;
    this.syncPause();
    Music.stop(INTRO_FAST ? 0.1 : 1.8);
    this.add(new PIXI.Graphics().rect(0, 0, REF_W, REF_H).fill({ color: 0x05030a, alpha: 0.86 }), DEPTH.modal);
    const t = this.add(title(REF_W / 2, REF_H / 2 - 110, S.prologue.endTitle, 52, '#e3c37d'), DEPTH.modal + 1);
    const btn = this.add(new Button(this, REF_W / 2, REF_H / 2 + 40, { label: S.prologue.continue, w: 500, h: 112, fontSize: 34, variant: 'hot', onClick: () => this.finish() }), DEPTH.modal + 1);
    t.alpha = 0;
    btn.alpha = 0;
    for (const n of [t, btn]) this.anim.to(n, { alpha: 1 }, { duration: INTRO_FAST ? 60 : 800, ease: 'sine.inout' });
  }

  /** the opening could not load: say so, offer a retry, and only move on when the player chooses to */
  private unavailable(): void {
    this.done = true;
    Music.stop(0.4);
    for (const b of [this.pauseBtn, this.muteBtn, this.skipBtn]) if (b) b.visible = false;
    this.add(new PIXI.Graphics().rect(0, 0, REF_W, REF_H).fill({ color: 0x05030a, alpha: 0.9 }), DEPTH.modal);
    this.add(title(REF_W / 2, REF_H / 2 - 170, S.prologue.unavailableTitle, 46, '#e3c37d'), DEPTH.modal + 1);
    this.add(txt(REF_W / 2, REF_H / 2 - 90, S.prologue.unavailableBody, { fontSize: 32, color: '#efe8f5', align: 'center', wordWrap: { width: 1300 } }, [0.5, 0]), DEPTH.modal + 1);
    this.add(new Button(this, REF_W / 2 - 280, REF_H / 2 + 140, { label: S.prologue.retry, w: 480, h: 110, fontSize: 32, variant: 'hot', onClick: () => this.nav.restart() }), DEPTH.modal + 1);
    this.add(new Button(this, REF_W / 2 + 280, REF_H / 2 + 140, { label: S.prologue.continueWithout, w: 480, h: 110, fontSize: 28, onClick: () => this.finish() }), DEPTH.modal + 1);
  }

  /** The prologue counts as seen once the player moves on (from its end, Skip on replay, or an explicit continue). */
  private finish(): void {
    this.anim.timeScale = 1;
    Music.setPaused(false);
    clearPrologueCheckpoint(Services.flowKey());
    recordEntry(Services.api, (s) => markPrologueSeen(s));
    advance(this.host);
  }

  /** a few slow ash motes over every plate */
  private addMotes(): void {
    const motes = this.add(new Sparks(vfxTextures().spark), DEPTH.fx);
    motes.ambient({ every: 380, area: { x: [0, REF_W], y: [REF_H + 20, REF_H + 20] }, vx: [-14, 14], vy: [-52, -24], look: { lifespan: 11000, scale: [0.04, 0.14], randomScale: true, alpha: [0.3, 0], tint: [0xc9b6e4, 0xe3c37d, 0xefe8f5] } });
    this.onTick((dt) => motes.update(dt));
  }
}

/** engine registration under the 'Prologue' key every flow already starts */
export const PrologueHost: new () => Phaser.Scene = hosted('Prologue', () => new PrologueScene());
