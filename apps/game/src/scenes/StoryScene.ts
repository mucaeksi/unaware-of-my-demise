import * as PIXI from 'pixi.js';
import type Phaser from '../engine';
import { StoryRunner, type StoryEvent } from '@uomd/story';
import type { StoryCommand, StoryScene as StoryData } from '@uomd/content-schema';
import { REF_H, REF_W } from '../config';
import { NarrativeStage } from '../presentation/NarrativeStage';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import type { Handle } from '../core/anim';
import { hosted } from '../core/host';
import { PixiScene } from '../core/PixiScene';
import { prefs } from '../platform/prefs';
import { safeInsets } from '../platform/safeArea';
import { CUTSCENE, cutsceneHoldSeconds, cutscenePauseSeconds } from '../entry/cutscene';
import { isDevServer } from '../entry/state';
import { clearStoryCheckpoint, loadFlowCheckpoint, loadReadLines, loadStoryCheckpoint, saveReadLines, saveStoryCheckpoint } from '../entry/resume';
import { Services } from '../services';
import { blocker, Button, panel, sceneFadeIn, title, txt, verticalShade, type UiText } from '../ui/pixiKit';
import { buildSubtitleSchedule, resolveSubtitleProgress, type SubtitleSchedule } from '../ui/subtitles';
import { C, DEPTH, F, SIZE, T } from '../ui/theme';
import { Sparks } from '../vfx/sparks';
import { vfxTextures } from '../vfx/textures';

export interface StoryInit {
  path: string;
  data?: StoryData;
  authRevision?: number;
  onDone: (scene: Phaser.Scene) => void;
  onBack?: (scene: Phaser.Scene) => void;
}

const CPS = { slow: 26, normal: 46, fast: 95 } as const;

/** a portrait bust: `image` carries the choreography (offset, tilt, scale); the sprite inside it only mirrors */
interface Actor {
  side: 'left' | 'right';
  image: PIXI.Container;
  sprite: PIXI.Sprite;
  key: string;
  emotion: string;
  baseX: number;
  baseY: number;
  offsetX: number;
  offsetY: number;
  tiltDeg: number;
  scaleMult: number;
  breathe: Handle | null;
}

/** Visual-novel reader for story scenes, drawn with PIXI (D-25). Story logic lives in @uomd/story's StoryRunner. */
export class StoryScene extends PixiScene<StoryInit> {
  private stage: NarrativeStage | null = null;
  private voiceBtn: Button | null = null;
  private currentView: () => boolean = () => false;
  private init0!: StoryInit;
  private data0!: StoryData;
  private runner!: StoryRunner;
  private bg!: PIXI.Sprite;
  private bgKey = '';
  private cgImage: PIXI.Sprite | null = null;
  private cgActive = false;
  private actors = new Map<string, Actor>();
  private nameText!: UiText;
  private namePlate!: PIXI.Container;
  private actionBadge!: UiText;
  private bodyText!: UiText;
  private caret!: UiText;
  private lineShimmer = new PIXI.Graphics();
  private voiceSyncFill = new PIXI.Graphics();
  private syncColor: number = C.gold;
  private typing: Handle | null = null;
  private stopTyping: (() => void) | null = null;
  private activeSchedule: SubtitleSchedule | null = null;
  private typingStartedAt = 0;
  private fullText = '';
  private lineDone = true;
  private waiting = false;
  private auto = false;
  private skip = false;
  private autoTimer: Handle | null = null;
  private read = new Set<string>();
  private currentLine: Extract<StoryEvent, { type: 'line' }> | null = null;
  private finished = false;
  private choiceLayer: PIXI.Container | null = null;
  private logLayer: PIXI.Container | null = null;
  private autoBtn!: Button;
  private skipBtn: Button | null = null;
  /** first-install cutscene rules (scene data carries a `presentation` block) */
  private cutscene = false;
  private pausing = false;
  private prevSpeaker: string | null = null;
  private lastLineId: string | null = null;
  private activeMusicCue = '';
  private currentMoodLabel = '';

  get illustration(): PIXI.Sprite | null {
    return this.cgImage;
  }

  async create(data: StoryInit): Promise<void> {
    this.init0 = data;
    this.read = loadReadLines(Services.api.accountKey);
    const current = (): boolean => this.live && (this.init0.authRevision === undefined || this.init0.authRevision === Services.api.authRevision);
    this.currentView = current;
    const accountChanged = (): void => {
      if (!current() && (this.host.sys.isActive() || this.host.sys.isPaused())) this.init0.onBack?.(this.host);
    };
    if (this.init0.authRevision !== undefined) Services.api.addEventListener('auth', accountChanged);
    this.onClose(() => {
      this.stopTyping?.();
      Services.api.removeEventListener('auth', accountChanged);
      if (!loadFlowCheckpoint(Services.api.accountKey)) clearStoryCheckpoint(Services.api.accountKey, this.init0.path);
    });
    const { content, art } = Services.ready();
    try {
      const story = this.init0.data ?? (await content.story(this.init0.path));
      if (!current()) return;
      this.data0 = story;
      this.cutscene = Boolean(this.data0.presentation);
      this.auto = this.data0.presentation?.auto ?? false;
      const lastLine = [...this.data0.commands].reverse().find((c): c is Extract<StoryCommand, { op: 'say' | 'narrate' }> => c.op === 'say' || c.op === 'narrate');
      this.lastLineId = lastLine?.line_id ?? null;
      const [profile, locale] = await Promise.all([content.presentation(), content.locale()]);
      if (!current()) return;
      this.stage = new NarrativeStage(this, content, art.art, profile, locale);
      const chars = new Set<string>();
      const charEmotions = new Map<string, Set<string>>();
      const addEmotion = (ch: string, em = 'composed'): void => {
        chars.add(ch);
        let set = charEmotions.get(ch);
        if (!set) {
          set = new Set(ch === 'fadyme' ? ['composed', 'dry_amusement', 'soft_smile', 'determined'] : ch === 'mahmut' ? ['composed', 'watchful', 'dry_humor', 'protective'] : ['composed']);
          charEmotions.set(ch, set);
        }
        set.add(em);
      };
      const locations = new Set([this.data0.location_id]);
      const musicCues = new Set<string>(this.sceneMusicCuesFor(this.data0.scene_id));
      for (const c of this.data0.commands) {
        if (c.op === 'background') locations.add(c.location_id);
        if (c.op === 'show') addEmotion(c.character);
        if (c.op === 'say') addEmotion(c.speaker, c.emotion ?? 'composed');
        if (c.op === 'music' && c.cue_id && c.cue_id !== 'stop') musicCues.add(c.cue_id);
      }
      // every emotion portrait and scene music cue loads up front so speaker, listener and soundtrack react at once
      await Promise.all([
        ...[...locations].map((id) => art.loadBackground(this.host, id)),
        ...(this.data0.illustration_id ? [art.loadStills(this.host, [this.data0.illustration_id])] : []),
        art.loadPortraits(this.host, [...chars], charEmotions),
        ...[...musicCues].map((cue) => art.loadMusic(this.host, cue).catch(() => undefined))
      ]);
    } catch (e) {
      if (!current()) return;
      this.fail(e);
      return;
    }
    if (!current()) return;
    const savedCp = loadFlowCheckpoint(Services.api.accountKey) ? loadStoryCheckpoint(Services.api.accountKey, this.init0.path, this.data0.scene_id) : null;
    this.runner = new StoryRunner(this.data0, savedCp?.state);
    this.build();
    this.restoreFromRunner();
    sceneFadeIn(this, 1300);
    this.pump();
  }

  private fail(e: unknown): void {
    this.finished = true;
    this.stage?.destroy();
    this.autoTimer?.stop();
    this.stopTyping?.();
    this.add(title(REF_W / 2, REF_H / 2 - 40, 'This scene could not be loaded', SIZE.h2, T.crimson), DEPTH.modal);
    this.add(txt(REF_W / 2, REF_H / 2 + 30, String(e instanceof Error ? e.message : e), { fontSize: SIZE.small, color: T.dim, align: 'center', wordWrap: { width: 1400 } }, 0.5), DEPTH.modal);
    this.add(new Button(this, REF_W / 2, REF_H / 2 + 200, { label: 'BACK', w: 360, onClick: () => (this.init0.onBack ? this.init0.onBack(this.host) : this.nav.start('Title')) }), DEPTH.modal);
  }

  // ------------------------------------------------------------------ layout

  private setBackground(key: string): void {
    if (this.bgKey === key) return;
    this.bgKey = key;
    this.bg.texture = this.tex(key);
  }

  private build(): void {
    const { art } = Services.ready();
    const reduced = prefs().reducedMotion;
    this.bg = this.add(new PIXI.Sprite(), DEPTH.bg);
    this.bg.anchor.set(0.5);
    this.bg.position.set(REF_W / 2, REF_H / 2);
    this.setBackground(art.background(this.data0.location_id));
    const cover = Math.max(REF_W / (this.bg.texture.width || REF_W), REF_H / (this.bg.texture.height || REF_H));
    this.bg.scale.set(cover * 1.04);
    if (!reduced) this.anim.to(this.bg, { scale: cover * 1.09, x: REF_W / 2 - 18 }, { duration: 36000, ease: 'sine.inout', yoyo: true, repeat: -1 });

    if (this.data0.illustration_id) {
      const stillKey = art.still(this.data0.illustration_id);
      if (stillKey) {
        const cg = this.add(new PIXI.Sprite(this.tex(stillKey)), DEPTH.world + 4);
        cg.anchor.set(0.5);
        cg.position.set(REF_W / 2, REF_H / 2);
        cg.alpha = 0;
        cg.scale.set(Math.max(REF_W / (cg.texture.width || REF_W), REF_H / (cg.texture.height || REF_H)) * 1.02);
        this.cgImage = cg;
      }
    }

    // atmospheric ash and ember motes behind the busts
    if (!reduced) {
      const motes = this.add(new Sparks(vfxTextures().spark), DEPTH.bg + 2);
      motes.ambient({ every: 420, area: { x: [0, REF_W], y: [REF_H - 180, REF_H - 180] }, vx: [-14, 14], vy: [-42, -16], look: { lifespan: 9500, scale: [0.04, 0.13], randomScale: true, alpha: [0.28, 0], tint: [0xc9b6e4, 0xe3c37d, 0xefe8f5] } });
      this.onTick((dt) => motes.update(dt));
    }

    // grade the world below the HUD so the dialogue and the busts keep their contrast
    this.add(verticalShade(0, 0, REF_W, REF_H, 0x0a0610, 0.08, 0.76), DEPTH.bg + 5);

    // tap anywhere to advance; buttons sit above this zone
    const zone = this.add(new PIXI.Container(), DEPTH.hud - 10);
    zone.hitArea = new PIXI.Rectangle(0, 0, REF_W, REF_H);
    zone.eventMode = 'static';
    zone.on('pointerup', () => this.advance());
    const onKey = (ev: KeyboardEvent): void => {
      if ((ev.key === ' ' || ev.key === 'Enter') && this.host.sys.isActive() && !(ev.target instanceof HTMLButtonElement)) this.advance();
    };
    window.addEventListener('keydown', onKey);
    this.onClose(() => window.removeEventListener('keydown', onKey));

    const insets = safeInsets(this.host);
    // light-novel reader box with its ornamental inner rules
    const box = new PIXI.Container();
    box.position.set(REF_W / 2, 886 - insets.bottom);
    const rules = new PIXI.Graphics().moveTo(-790, -96).lineTo(790, -96).moveTo(-790, 96).lineTo(790, 96).stroke({ width: 1, color: C.gold, alpha: 0.32 });
    const syncTrack = new PIXI.Graphics().rect(-380, 95, 760, 2).fill({ color: 0xc9b6e4, alpha: 0.16 });
    this.voiceSyncFill.position.set(-380, 95);
    this.lineShimmer.rect(-120, -1, 240, 2).fill(0xffffff);
    this.lineShimmer.position.set(-640, -96);
    this.lineShimmer.alpha = 0;
    this.nameText = txt(0, 0, '', { fontFamily: F.display, fontSize: 28, fontStyle: '700', color: T.gold, stroke: '#0a0610', strokeThickness: 4, letterSpacing: 2 }, 0.5);
    this.namePlate = this.add(new PIXI.Container(), DEPTH.hud + 2);
    this.namePlate.addChild(panel(0, 0, 490, 68, 'hot'), this.nameText);
    this.namePlate.visible = false;
    this.actionBadge = txt(0, -88, '', { fontFamily: F.display, fontSize: 20, fontStyle: '600', color: '#e3c37d', stroke: '#0a0610', strokeThickness: 3, letterSpacing: 4 }, 0.5);
    this.actionBadge.alpha = 0.88;
    this.bodyText = txt(-780, -64, '', { fontFamily: F.body, fontSize: 41, color: T.text, lineSpacing: 10, wordWrap: { width: 1560 }, stroke: '#07040c', strokeThickness: 3.5, shadow: { x: 0, y: 4, color: '#050208', blur: 10 } });
    this.caret = txt(780, 78, '▼', { fontSize: 32, color: T.gold }, [1, 0.5]);
    this.caret.visible = false;
    box.addChild(panel(0, 0, 1680, 248, 'normal'), rules, this.lineShimmer, syncTrack, this.voiceSyncFill, this.actionBadge, this.bodyText, this.caret);
    this.add(box, DEPTH.hud);

    const topBtnY = 58 + insets.top;
    const btnW = 148;
    const btnH = 62;
    const btnGap = 14;
    const showSkip = !this.cutscene || isDevServer();
    const skipX = REF_W - 104 - insets.right;
    const autoX = showSkip ? skipX - (btnW + btnGap) : skipX;
    const logX = autoX - (btnW + btnGap);
    const voiceX = logX - (btnW + btnGap);
    const top = DEPTH.hud + 3;
    if (showSkip) this.skipBtn = this.add(new Button(this, skipX, topBtnY, { label: 'SKIP', w: btnW, h: btnH, fontSize: 21, onClick: () => this.toggleSkip() }), top);
    this.autoBtn = this.add(new Button(this, autoX, topBtnY, { label: this.auto ? 'AUTO ✓' : 'AUTO', w: btnW, h: btnH, fontSize: 21, onClick: () => this.toggleAuto() }), top);
    this.add(new Button(this, logX, topBtnY, { label: 'LOG', w: btnW, h: btnH, fontSize: 21, onClick: () => this.showLog() }), top);
    this.voiceBtn = this.add(new Button(this, voiceX, topBtnY, { label: 'VOICE', w: btnW, h: btnH, fontSize: 20, onClick: () => { if (this.currentLine) void this.stage?.voice(this.currentLine.lineId); } }), top);
    this.voiceBtn.visible = false;
    const heading = this.add(title(60 + insets.left, topBtnY, this.data0.title_en, 30, T.dim), top);
    heading.anchor.set(0, 0.5);
    if (this.init0.authRevision !== undefined && this.init0.onBack) this.add(new Button(this, 220 + insets.left, 210 + insets.top, { label: 'ARCHIVE', w: 340, h: 110, onClick: () => this.init0.onBack?.(this.host) }), top);
    this.anim.to(this.caret, { alpha: 0.2 }, { duration: 600, yoyo: true, repeat: -1 });

    const onContextLost = (): void => {
      if (this.finished || !this.data0 || !this.runner) return;
      saveStoryCheckpoint(Services.api.accountKey, { path: this.init0.path, sceneId: this.data0.scene_id, checkpointId: this.currentLine?.lineId, state: this.runner.saveAtCurrentEvent() });
      saveReadLines(Services.api.accountKey, this.read);
    };
    const game = this.host.game;
    game.events.on('webgl:contextlost', onContextLost);
    // a WebView may start with audio suspended until the first touch
    const resumeAudio = (): void => {
      Sfx.resume();
      if (this.activeMusicCue) this.playSceneMusic(this.activeMusicCue, 0.8);
    };
    game.canvas.addEventListener('pointerdown', resumeAudio);
    this.onClose(() => {
      game.events.off('webgl:contextlost', onContextLost);
      game.canvas.removeEventListener('pointerdown', resumeAudio);
    });
  }

  private drawSyncFill(ratio: number): void {
    this.voiceSyncFill.clear();
    if (ratio > 0) this.voiceSyncFill.rect(0, 0, 760 * Math.min(1, ratio), 2).fill({ color: this.syncColor, alpha: 0.88 });
  }

  private sceneMusicCuesFor(sceneId: string): string[] {
    switch (sceneId) {
      case 'tutorial_t1_before':
        return ['bgm_ch1_ash_forest_calm', 'bgm_ch1_ash_forest_uneasy'];
      case 'tutorial_t1_after':
        return ['bgm_ch1_ash_forest_calm', 'bgm_fadyme_theme'];
      case 'tutorial_t2_before':
      case 'tutorial_t3_before':
        return ['bgm_ch1_ash_forest_uneasy', 'bgm_ch1_ash_forest_chaotic'];
      default:
        return ['bgm_fadyme_theme'];
    }
  }

  private defaultMusicCueForScene(): string {
    return this.sceneMusicCuesFor(this.data0.scene_id)[0] ?? 'bgm_fadyme_theme';
  }

  private playSceneMusic(cueId: string, fade = 1.6): void {
    this.activeMusicCue = cueId;
    const m = Services.ready().art.music(cueId);
    if (m) Music.play(this.host.cache.audio, m.key, m.loopStart, m.duration, fade);
  }

  /** Applies reconstructed visual/audio state when resuming from a mid-scene checkpoint. */
  private restoreFromRunner(): void {
    const { art } = Services.ready();
    const r = this.runner.restored;
    this.setBackground(art.background(r.locationId));
    this.playSceneMusic(r.musicCueId && r.musicCueId !== 'stop' ? r.musicCueId : this.defaultMusicCueForScene(), 1.5);
    for (const [character, a] of r.actors) this.showActor(character, a.side, a.emotion, true);
    this.prevSpeaker = r.prevSpeaker;
  }

  // ------------------------------------------------------------------ program flow

  private pump(): void {
    if (this.finished || !this.currentView()) return;
    for (;;) {
      const e = this.runner.next();
      if (!e) {
        this.complete();
        return;
      }
      if (this.apply(e)) return;
    }
  }

  private checkpoint(checkpointId?: string, atCurrentEvent = true): void {
    saveStoryCheckpoint(Services.api.accountKey, {
      path: this.init0.path,
      sceneId: this.data0.scene_id,
      ...(checkpointId !== undefined ? { checkpointId } : {}),
      state: atCurrentEvent ? this.runner.saveAtCurrentEvent() : this.runner.save()
    });
  }

  /** Applies an event; returns true when the story must pause for input. */
  private apply(e: StoryEvent): boolean {
    const { art } = Services.ready();
    switch (e.type) {
      case 'presentation': {
        this.waiting = false;
        void this.stage
          ?.execute(e.command)
          .then(() => {
            if (this.currentView()) this.pump();
          })
          .catch((error: unknown) => {
            if (this.currentView()) this.fail(error);
          });
        return true;
      }
      case 'background':
        this.setBackground(art.background(e.locationId));
        return false;
      case 'music':
        if (e.cueId && e.cueId !== 'stop') this.playSceneMusic(e.cueId, 1.5);
        return false;
      case 'fade':
        if (e.direction === 'out') void this.fadeOut(this.data0.scene_id === 'tutorial_t3_after' ? 2200 : Math.max(1200, e.seconds * 1000));
        return false;
      case 'flash':
        if (!prefs().reducedMotion) this.flash(e.seconds * 1000);
        return false;
      case 'shake':
        if (!prefs().reducedMotion) this.shake(e.seconds * 1000, 0.006 * e.intensity);
        return false;
      case 'show':
        this.showActor(e.character, e.side);
        return false;
      case 'hide':
        this.hideActor(e.character);
        return false;
      case 'checkpoint':
        this.checkpoint(e.checkpointId, false);
        return false;
      case 'wait':
        this.anim.after(e.seconds * 1000, () => this.pump());
        return true;
      case 'line':
        this.checkpoint(e.lineId);
        this.showLine(e);
        return true;
      case 'choice':
        this.checkpoint();
        this.showChoices(e);
        return true;
      case 'end':
        this.complete();
        return true;
    }
  }

  private complete(): void {
    if (this.finished) return;
    this.finished = true;
    clearStoryCheckpoint(Services.api.accountKey, this.init0.path);
    saveReadLines(Services.api.accountKey, this.read);
    this.autoTimer?.stop();
    const holdOutMs = this.data0.scene_id === 'tutorial_t3_after' ? 2200 : 1200;
    void this.fadeOut(holdOutMs);
    this.anim.after(holdOutMs, () => this.init0.onDone(this.host));
  }

  // ------------------------------------------------------------------ actors & bust choreography

  private targetBustHeight(character: string): number {
    return character === 'fadyme' ? 1150 : 1040;
  }

  private bustScale(character: string, a: Actor): number {
    return this.targetBustHeight(character) / (a.sprite.texture.height || 1);
  }

  private activateCg(immediate = false): void {
    const cg = this.cgImage;
    if (!cg || this.cgActive) return;
    this.cgActive = true;
    const cover = Math.max(REF_W / (cg.texture.width || REF_W), REF_H / (cg.texture.height || REF_H));
    const ms = immediate || prefs().reducedMotion ? 1 : 1100;
    this.anim.to(cg, { alpha: 1 }, { duration: ms, ease: 'sine.inout' });
    if (!prefs().reducedMotion) this.anim.to(cg, { scaleX: cover * 1.065, scaleY: cover * 1.065, y: REF_H / 2 - 12 }, { duration: 28000, yoyo: true, repeat: -1, ease: 'sine.inout' });
    for (const [, a] of this.actors) {
      this.anim.killOf(a.image);
      this.anim.to(a.image, { alpha: 0 }, { duration: Math.min(650, ms), ease: 'sine.out' });
    }
  }

  private showActor(character: string, side: 'left' | 'right', emotion = 'composed', immediate = false): void {
    const { art } = Services.ready();
    const key = art.portrait(character, emotion) ?? art.portrait(character, 'composed');
    if (!key) return;
    const existing = this.actors.get(character);
    if (existing) {
      existing.breathe?.stop();
      this.anim.killOf(existing.image);
      existing.image.destroy({ children: true });
      this.actors.delete(character);
    }
    const baseX = side === 'left' ? 460 : REF_W - 460;
    const baseY = REF_H + 18;
    const image = this.add(new PIXI.Container(), DEPTH.world);
    const sprite = new PIXI.Sprite(this.tex(key));
    sprite.anchor.set(0.5, 1);
    // Fadyme's knee-up art faces left and Mahmut's faces right: mirror so each looks inward
    const nativeFacing = character === 'fadyme' ? 'left' : 'right';
    sprite.scale.x = nativeFacing !== (side === 'left' ? 'right' : 'left') ? -1 : 1;
    image.addChild(sprite);
    image.position.set(immediate ? baseX : baseX + (side === 'left' ? -90 : 90), baseY);
    image.alpha = this.cgActive ? 0 : immediate ? 0.86 : 0;
    const actor: Actor = { side, image, sprite, key, emotion, baseX, baseY, offsetX: 0, offsetY: 0, tiltDeg: 0, scaleMult: 1, breathe: null };
    const k = this.bustScale(character, actor);
    image.scale.set(k);
    if (!prefs().reducedMotion) actor.breathe = this.anim.to(image, { scaleY: k * 1.012 }, { duration: side === 'left' ? 2800 : 2500, yoyo: true, repeat: -1, ease: 'sine.inout' });
    this.actors.set(character, actor);
    if (!immediate && !this.cgActive) this.anim.to(image, { x: baseX, alpha: 0.86 }, { duration: prefs().reducedMotion ? 1 : 950, ease: 'cubic.out' });
  }

  private hideActor(character: string): void {
    const a = this.actors.get(character);
    if (!a) return;
    a.breathe?.stop();
    this.actors.delete(character);
    this.anim.to(a.image, { alpha: 0 }, { duration: 450, onComplete: () => a.image.destroy({ children: true }) });
  }

  /** Smoothly crossfades a character's portrait to `newEmotion` and plays a physical reaction impulse. */
  private setActorEmotion(character: string, newEmotion: string, reactionImpulse = true): void {
    const a = this.actors.get(character);
    if (!a) return;
    const { art } = Services.ready();
    const key = art.portrait(character, newEmotion) ?? art.portrait(character, 'composed');
    if (!key) return;
    const changed = a.emotion !== newEmotion || a.key !== key;
    a.emotion = newEmotion;
    if (!changed) return;
    const prev = a.sprite.texture;
    a.key = key;
    a.sprite.texture = this.tex(key);
    const sc = this.bustScale(character, a) * a.scaleMult;
    if (this.cgActive) {
      a.image.scale.set(sc);
      a.image.alpha = 0;
      return;
    }
    const ghost = new PIXI.Container();
    const gs = new PIXI.Sprite(prev);
    gs.anchor.set(0.5, 1);
    gs.scale.x = a.sprite.scale.x;
    gs.tint = a.sprite.tint;
    ghost.addChild(gs);
    ghost.position.copyFrom(a.image.position);
    ghost.scale.copyFrom(a.image.scale);
    ghost.angle = a.image.angle;
    ghost.alpha = a.image.alpha;
    this.add(ghost, a.image.zIndex);
    a.image.scale.set(sc);
    this.anim.to(ghost, { alpha: 0 }, { duration: prefs().reducedMotion ? 1 : 220, ease: 'quad.out', onComplete: () => ghost.destroy({ children: true }) });

    if (reactionImpulse && !prefs().reducedMotion) {
      if (newEmotion === 'dry_amusement' || newEmotion === 'dry_humor') {
        this.anim.to(a.image, { y: Math.max(REF_H + 4, a.image.y - 10) }, { duration: 130, yoyo: true, ease: 'sine.inout' });
      } else if (newEmotion === 'protective' || newEmotion === 'determined') {
        this.anim.to(a.image, { scaleX: sc * 1.035, scaleY: sc * 1.035 }, { duration: 150, yoyo: true, ease: 'back.out' });
      } else if (newEmotion === 'soft_smile') {
        this.anim.to(a.image, { y: a.image.y + 8 }, { duration: 180, yoyo: true, ease: 'sine.inout' });
      }
    }
  }

  /**
   * Shapes and animates the character busts (`portrait_mahmut_*` and `portrait_fadyme_*`)
   * according to the flow, content, and spirit of each line, updating both speaker and listener reactions!
   */
  private applyLineChoreography(e: Extract<StoryEvent, { type: 'line' }>): { speakerEmotion: string; moodLabel: string } {
    const id = e.lineId;
    const m = this.actors.get('mahmut');
    const f = this.actors.get('fadyme');
    let stageCue = '';

    // Activate full-screen Event CG illustration when the seated vignette begins
    if (
      (this.data0.illustration_id === 'roadside_rest' && id >= 'tutorial_t2_after_005') ||
      (this.data0.illustration_id === 'shelter_evening' && id >= 'tutorial_t3_after_011')
    ) {
      this.activateCg();
    }

    // Context-aware emotion overrides for lines where the base script used repeated 'composed' tags
    const EMOTION_OVERRIDES: Record<string, { speaker?: string; listener?: { char: string; emotion: string } }> = {
      tutorial_t1_before_001: { listener: { char: 'mahmut', emotion: 'watchful' } },
      tutorial_t1_before_003: { listener: { char: 'mahmut', emotion: 'dry_humor' } },
      tutorial_t1_before_005: { listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t1_before_006: { listener: { char: 'fadyme', emotion: 'composed' } },
      tutorial_t1_before_009: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t1_before_012: { speaker: 'determined', listener: { char: 'mahmut', emotion: 'protective' } },
      tutorial_t1_before_013: { speaker: 'protective', listener: { char: 'fadyme', emotion: 'determined' } },

      tutorial_t1_after_002: { listener: { char: 'fadyme', emotion: 'dry_amusement' } },
      tutorial_t1_after_006: { speaker: 'composed', listener: { char: 'fadyme', emotion: 'soft_smile' } },
      tutorial_t1_after_007: { speaker: 'composed', listener: { char: 'fadyme', emotion: 'dry_amusement' } },
      tutorial_t1_after_012: { speaker: 'determined', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t1_after_014: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'dry_humor' } },

      tutorial_t2_before_003: { speaker: 'composed', listener: { char: 'mahmut', emotion: 'watchful' } },
      tutorial_t2_before_004: { speaker: 'watchful' },
      tutorial_t2_before_005: { speaker: 'dry_amusement', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t2_before_007: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t2_before_011: { speaker: 'protective', listener: { char: 'fadyme', emotion: 'determined' } },

      tutorial_t2_after_003: { speaker: 'watchful', listener: { char: 'fadyme', emotion: 'dry_amusement' } },
      tutorial_t2_after_005: { speaker: 'composed', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t2_after_006: { speaker: 'dry_humor', listener: { char: 'fadyme', emotion: 'composed' } },
      tutorial_t2_after_007: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t2_after_008: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t2_after_015: { speaker: 'composed', listener: { char: 'fadyme', emotion: 'soft_smile' } },
      tutorial_t2_after_016: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'dry_humor' } },
      tutorial_t2_after_018: { speaker: 'dry_humor', listener: { char: 'fadyme', emotion: 'soft_smile' } },

      tutorial_t3_before_007: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'watchful' } },
      tutorial_t3_before_008: { speaker: 'protective', listener: { char: 'fadyme', emotion: 'composed' } },
      tutorial_t3_before_009: { speaker: 'dry_amusement', listener: { char: 'mahmut', emotion: 'protective' } },
      tutorial_t3_before_012: { speaker: 'composed', listener: { char: 'fadyme', emotion: 'soft_smile' } },
      tutorial_t3_before_014: { speaker: 'determined', listener: { char: 'mahmut', emotion: 'protective' } },

      tutorial_t3_after_005: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t3_after_008: { speaker: 'dry_amusement', listener: { char: 'mahmut', emotion: 'dry_humor' } },
      tutorial_t3_after_011: { speaker: 'composed', listener: { char: 'fadyme', emotion: 'soft_smile' } },
      tutorial_t3_after_016: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'watchful' } },
      tutorial_t3_after_020: { speaker: 'composed', listener: { char: 'mahmut', emotion: 'watchful' } },
      tutorial_t3_after_021: { speaker: 'composed', listener: { char: 'mahmut', emotion: 'watchful' } },
      tutorial_t3_after_023: { speaker: 'dry_amusement', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t3_after_024: { speaker: 'composed', listener: { char: 'fadyme', emotion: 'composed' } },
      tutorial_t3_after_025: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t3_after_026: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t3_after_029: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'composed' } },
      tutorial_t3_after_030: { speaker: 'dry_humor', listener: { char: 'fadyme', emotion: 'soft_smile' } },
      tutorial_t3_after_031: { speaker: 'dry_amusement', listener: { char: 'mahmut', emotion: 'dry_humor' } },
      tutorial_t3_after_032: { speaker: 'composed', listener: { char: 'fadyme', emotion: 'soft_smile' } },
      tutorial_t3_after_034: { speaker: 'soft_smile', listener: { char: 'mahmut', emotion: 'composed' } },
    };

    const ov = EMOTION_OVERRIDES[id];
    const resolvedEmotion = ov?.speaker ?? e.emotion ?? 'composed';

    if (e.speaker === 'narration') {
      if (ov?.speaker && f) this.setActorEmotion('fadyme', ov.speaker, true);
      if (ov?.listener) this.setActorEmotion(ov.listener.char, ov.listener.emotion, true);
    } else {
      this.setActorEmotion(e.speaker, resolvedEmotion, true);
      if (ov?.listener) {
        this.setActorEmotion(ov.listener.char, ov.listener.emotion, false);
      } else {
        // Default reactive listener expression based on speaker's tone
        const otherChar = e.speaker === 'mahmut' ? 'fadyme' : 'mahmut';
        if (resolvedEmotion === 'protective' || resolvedEmotion === 'determined') {
          this.setActorEmotion(otherChar, otherChar === 'fadyme' ? 'determined' : 'protective', false);
        } else if (resolvedEmotion === 'dry_amusement' || resolvedEmotion === 'dry_humor') {
          this.setActorEmotion(otherChar, otherChar === 'fadyme' ? 'soft_smile' : 'dry_humor', false);
        }
      }
    }

    // 1. Default emotion-driven micro-posture for the active speaker
    if (e.speaker !== 'narration') {
      const sp = this.actors.get(e.speaker);
      if (sp) {
        const inward = sp.side === 'left' ? 1 : -1;
        switch (resolvedEmotion) {
          case 'watchful':
            sp.tiltDeg = inward * 1.4;
            sp.scaleMult = 1.015;
            break;
          case 'dry_humor':
          case 'dry_amusement':
            sp.tiltDeg = inward * -2.2;
            sp.scaleMult = 1.015;
            break;
          case 'soft_smile':
            sp.tiltDeg = inward * 1.8;
            sp.scaleMult = 1.02;
            break;
          case 'protective':
          case 'determined':
            sp.tiltDeg = inward * 2.4;
            sp.offsetX = Math.max(sp.offsetX * inward, 42) * inward;
            sp.scaleMult = 1.05;
            break;
          default:
            sp.tiltDeg = 0;
            sp.scaleMult = 1.0;
            break;
        }
      }
    }

    // 2. Scene & line-specific narrative action choreography
    // 2. Scene & line-specific narrative action choreography
    switch (id) {
      case 'tutorial_t1_before_006':
        if (m) { m.offsetX = 75; m.tiltDeg = 2.2; }
        stageCue = 'MAHMUT EXTENDS HIS HAND ACROSS THE WET STONES';
        break;
      case 'tutorial_t1_before_009':
        if (m) { m.offsetX = 95; m.tiltDeg = 1.8; }
        if (f) { f.offsetX = -95; f.tiltDeg = -2.2; }
        stageCue = 'HAND IN HAND ACROSS THE SLIPPERY CROSSING';
        break;
      case 'tutorial_t1_before_011':
        this.playSceneMusic('bgm_ch1_ash_forest_uneasy', 1.4);
        break;
      case 'tutorial_t1_before_012':
      case 'tutorial_t1_before_013':
        this.playSceneMusic('bgm_ch1_ash_forest_uneasy', 1.4);
        if (m) { m.offsetX = 115; m.offsetY = -12; m.scaleMult = 1.055; m.tiltDeg = 2.5; }
        if (f) { f.offsetX = -35; }
        if (!prefs().reducedMotion && id === 'tutorial_t1_before_012') {
          this.shake(260, 0.003);
        }
        stageCue = 'BELLBOUND DEAD APPROACH IN THE MIST';
        break;
      case 'tutorial_t1_before_014':
        if (f) { f.offsetX = -90; f.offsetY = -12; f.scaleMult = 1.05; f.tiltDeg = -2.0; }
        stageCue = 'STANDING SIDE BY SIDE';
        break;

      case 'tutorial_t1_after_004':
      case 'tutorial_t1_after_005':
        if (m) { m.offsetX = 70; m.tiltDeg = 1.8; }
        if (f) { f.tiltDeg = -2.2; }
        break;
      case 'tutorial_t1_after_006':
        this.playSceneMusic('bgm_fadyme_theme', 1.8);
        if (m) { m.offsetX = 125; m.tiltDeg = 3.0; }
        if (f) { f.offsetX = -85; f.tiltDeg = -1.6; }
        stageCue = 'HE BRUSHES A TORN ASH LEAF FROM HER SHOULDER';
        this.anim.after(1800, () => {
          if (!this.live || !m) return;
          m.offsetX = 35;
          m.tiltDeg = -1.5;
          this.animateActorTransform('mahmut', m, 650);
        });
        break;
      case 'tutorial_t1_after_014':
        if (m) { m.offsetX = 55; m.tiltDeg = 1.0; }
        if (f) { f.offsetX = -55; f.tiltDeg = -1.2; }
        stageCue = 'MATCHING STRIDES ALONG THE ASH ROAD';
        break;

      case 'tutorial_t2_before_006':
        if (f) { f.tiltDeg = -2.0; f.offsetX = -30; }
        stageCue = 'WATCHING THE LONE HOLLOW PILGRIM';
        break;
      case 'tutorial_t2_before_011':
      case 'tutorial_t2_before_012':
      case 'tutorial_t2_before_013':
        this.playSceneMusic('bgm_ch1_ash_forest_chaotic', 1.4);
        if (m) { m.offsetX = 95; m.offsetY = -10; m.scaleMult = 1.05; m.tiltDeg = 2.2; }
        if (f) { f.offsetX = -80; f.offsetY = -8; f.scaleMult = 1.04; f.tiltDeg = -1.8; }
        stageCue = 'COMBAT STANCE AT THE FORGOTTEN STONE CROSSING';
        break;

      case 'tutorial_t2_after_001':
      case 'tutorial_t2_after_002':
        if (f) { f.offsetY = 44; f.offsetX = -65; f.tiltDeg = -1.5; }
        if (m) { m.offsetY = id === 'tutorial_t2_after_002' ? 40 : 10; m.offsetX = 65; }
        stageCue = 'RESTING UPON THE MOSSY FALLEN STONE';
        break;
      case 'tutorial_t2_after_003':
      case 'tutorial_t2_after_004':
        if (m) { m.offsetY = 44; m.offsetX = 85; m.tiltDeg = 1.5; }
        if (f) { f.offsetY = 44; f.offsetX = -85; f.tiltDeg = -1.8; }
        break;
      case 'tutorial_t2_after_005':
      case 'tutorial_t2_after_006':
      case 'tutorial_t2_after_007':
      case 'tutorial_t2_after_008':
        if (m) { m.offsetY = 46; m.offsetX = 125; m.tiltDeg = 2.4; m.scaleMult = 1.02; }
        if (f) { f.offsetY = 46; f.offsetX = -125; f.tiltDeg = -2.8; f.scaleMult = 1.02; }
        stageCue = 'FADYME TIGHTENS THE LOOSE LEATHER STRAP ON HIS GAUNTLET';
        break;
      case 'tutorial_t2_after_016':
        if (f) { f.offsetY = 44; f.offsetX = -105; f.tiltDeg = -1.8; }
        if (m) { m.offsetY = 44; m.offsetX = 95; m.tiltDeg = -2.0; }
        stageCue = 'A QUIET SMILE OVER THE FINISHED BUCKLE';
        break;

      case 'tutorial_t3_before_007':
        if (f && !prefs().reducedMotion) {
          this.anim.to(f.image, { y: Math.max(REF_H + 4, f.image.y - 14) }, { duration: 160, yoyo: true, repeat: 1, ease: 'sine.inout' });
        }
        if (m) { m.tiltDeg = 2.0; m.offsetX = 60; }
        break;
      case 'tutorial_t3_before_008':
        this.playSceneMusic('bgm_ch1_ash_forest_uneasy', 1.4);
        if (m) { m.offsetX = 95; m.offsetY = -10; m.scaleMult = 1.05; m.tiltDeg = 2.2; }
        stageCue = 'SHADOWS STIR BENEATH THE SHELTER EAVES';
        break;
      case 'tutorial_t3_before_010':
        this.playSceneMusic('bgm_ch1_ash_forest_chaotic', 1.4);
        if (m) { m.offsetX = 95; m.offsetY = -10; m.scaleMult = 1.05; m.tiltDeg = 2.2; }
        stageCue = 'SHADOWS STIR BENEATH THE SHELTER EAVES';
        break;
      case 'tutorial_t3_before_014':
        this.playSceneMusic('bgm_ch1_ash_forest_chaotic', 1.2);
        if (m) { m.offsetX = 115; m.offsetY = -14; m.scaleMult = 1.06; m.tiltDeg = 2.0; }
        if (f) { f.offsetX = -115; f.offsetY = -14; f.scaleMult = 1.06; f.tiltDeg = -2.0; }
        stageCue = 'STEPPING FORWARD TOGETHER AS ONE';
        break;

      case 'tutorial_t3_after_005':
      case 'tutorial_t3_after_006':
        if (f) { f.offsetY = 48; f.offsetX = -85; f.tiltDeg = -1.8; }
        if (m) { m.offsetY = 0; m.offsetX = 50; m.tiltDeg = 1.2; }
        stageCue = 'HIS OXBLOOD CLOAK SPREAD OVER THE COLD STONE BENCH';
        break;
      case 'tutorial_t3_after_007':
      case 'tutorial_t3_after_009':
        if (m) { m.offsetY = 0; m.offsetX = 20; m.tiltDeg = -2.0; }
        break;
      case 'tutorial_t3_after_011':
        if (m) { m.offsetY = 48; m.offsetX = 130; m.tiltDeg = 1.8; }
        if (f) { f.offsetY = 48; f.offsetX = -130; f.tiltDeg = -1.8; }
        stageCue = 'SEATED SIDE BY SIDE WITHIN THE WAYSIDE SHELTER';
        break;
      case 'tutorial_t3_after_016':
        if (f) { f.offsetY = 48; f.offsetX = -142; f.tiltDeg = -2.6; }
        if (m) { m.offsetY = 48; m.offsetX = 136; m.tiltDeg = 2.0; }
        stageCue = 'SHARING A LOAF OF BREAD AT DUSK';
        break;
      case 'tutorial_t3_after_020':
        if (f) { f.offsetY = 48; f.offsetX = -95; f.tiltDeg = 2.4; }
        stageCue = 'GAZING OUT TOWARD THE DARKENING ROAD';
        break;
      case 'tutorial_t3_after_025':
      case 'tutorial_t3_after_026':
      case 'tutorial_t3_after_029':
      case 'tutorial_t3_after_034':
        if (f) { f.offsetY = 48; f.offsetX = -140; f.tiltDeg = -2.0; }
        if (m) { m.offsetY = 48; m.offsetX = 140; m.tiltDeg = 1.8; }
        if (id === 'tutorial_t3_after_034') {
          stageCue = 'A DRY CORNER, HALF A LOAF, AND A PLACE BESIDE EACH OTHER';
        }
        break;
    }

    this.actionBadge.text = stageCue;
    const MOOD_LABELS: Record<string, string> = {
      watchful: 'WATCHFUL',
      composed: 'CALM',
      dry_humor: 'DRY HUMOR',
      dry_amusement: 'WRY WIT',
      soft_smile: 'WARMTH',
      protective: 'GUARDIAN',
      determined: 'RESOLVE'
    };
    return { speakerEmotion: resolvedEmotion, moodLabel: MOOD_LABELS[resolvedEmotion] ?? 'COMPOSED' };
  }

  private animateActorTransform(character: string, a: Actor, ms = 420): void {
    const targetScale = this.bustScale(character, a) * a.scaleMult;
    const liftY = this.currentLine?.speaker === character ? -14 : 6;
    this.anim.to(a.image, { x: a.baseX + a.offsetX, y: Math.max(REF_H + 4, a.baseY + a.offsetY + liftY), angle: prefs().reducedMotion ? 0 : a.tiltDeg, scaleX: targetScale, scaleY: targetScale }, { duration: prefs().reducedMotion ? 1 : ms, ease: 'cubic.out' });
  }

  private focusSpeaker(speaker: string, emotion?: string, ms = 280): void {
    if (speaker && emotion) this.setActorEmotion(speaker, emotion, false);
    if (this.cgActive) {
      for (const [, a] of this.actors) a.image.alpha = 0;
      return;
    }
    for (const [id, a] of this.actors) {
      const active = id === speaker;
      const isNarr = speaker === '';
      a.image.zIndex = active ? DEPTH.world + 2 : DEPTH.world;
      this.anim.to(a.image, { alpha: active ? 1 : isNarr ? 0.9 : 0.72 }, { duration: ms });
      a.sprite.tint = active ? 0xffffff : isNarr ? 0xe8e0f2 : 0xb0a4c2;
      this.animateActorTransform(id, a, Math.max(360, ms));
    }
  }

  // ------------------------------------------------------------------ dialogue

  private placeNamePlate(e: Extract<StoryEvent, { type: 'line' }>): void {
    const a = this.actors.get(e.speaker);
    const left = this.cgActive ? e.speaker === 'fadyme' : !a || a.side === 'left';
    this.nameText.text = this.currentMoodLabel ? `${e.speakerDisplay.toUpperCase()}  ·  ${this.currentMoodLabel}` : e.speakerDisplay.toUpperCase();
    this.nameText.style.fill = e.speaker === 'fadyme' ? '#e2d2ff' : T.gold;
    this.namePlate.position.set(left ? 365 : REF_W - 365, 746);
  }

  private showLine(e: Extract<StoryEvent, { type: 'line' }>): void {
    this.currentLine = e;
    const hasVoiceLine = Boolean(this.stage?.hasVoice(e.lineId));
    if (this.voiceBtn) this.voiceBtn.visible = hasVoiceLine;
    this.stage?.stopVoice();
    const narr = e.speaker === 'narration';
    const rawPause = this.cutscene ? cutscenePauseSeconds(this.prevSpeaker, e.speaker, this.data0.presentation?.speaker_pause_seconds ?? 1) : 0;
    const speakerChanged = this.prevSpeaker !== null && this.prevSpeaker !== e.speaker;
    const pause = hasVoiceLine ? Math.min(rawPause, speakerChanged ? 0.3 : 0.16) : rawPause;
    this.prevSpeaker = e.speaker;

    // shape and animate the busts from the speaker's emotion and the script's actions
    const { speakerEmotion, moodLabel } = this.applyLineChoreography(e);
    this.currentMoodLabel = moodLabel;
    this.focusSpeaker(narr ? '' : e.speaker, speakerEmotion, rawPause > CUTSCENE.sameSpeakerPauseSeconds ? CUTSCENE.dissolveSeconds * 1000 : 320);

    const accentColor = narr ? 0xc9b6e4 : e.speaker === 'fadyme' ? 0xe2d2ff : C.gold;
    this.syncColor = accentColor;
    this.drawSyncFill(0);
    this.lineShimmer.tint = accentColor;
    this.lineShimmer.alpha = 0;

    this.namePlate.visible = !narr;
    if (!narr) this.placeNamePlate(e);
    const resolve = speakerEmotion === 'protective' || speakerEmotion === 'determined';
    const warm = speakerEmotion === 'soft_smile';
    this.bodyText.setFontStyle(narr ? 'italic 500' : resolve ? '600' : '500');
    this.bodyText.style.fill = narr ? '#dfd4ee' : warm ? '#fff6ea' : resolve ? '#f7ecf9' : T.text;
    const rawLine = this.stage?.text(e.lineId, e.text) ?? e.text;
    this.fullText = this.bodyText.wrap(rawLine).join('\n');
    this.bodyText.text = '';
    this.caret.visible = false;
    this.lineDone = false;
    this.waiting = true;
    this.typing?.stop();
    this.stopTyping?.();
    this.autoTimer?.stop();
    if (pause > 0 && !this.skip) {
      this.pausing = true;
      this.typing = this.anim.after(pause * 1000, () => {
        this.pausing = false;
        this.startTyping(e, narr, speakerEmotion, speakerChanged);
      });
    } else {
      this.pausing = false;
      this.startTyping(e, narr, speakerEmotion, speakerChanged);
    }
  }

  private startTyping(e: Extract<StoryEvent, { type: 'line' }>, narr: boolean, speakerEmotion = 'composed', speakerChanged = false): void {
    if (this.finished) return;
    if (!this.skip) void this.stage?.voice(e.lineId);
    this.namePlate.visible = !narr;
    const reduced = prefs().reducedMotion;
    if (!narr) {
      this.placeNamePlate(e);
      this.anim.killOf(this.namePlate);
      if (speakerChanged && !reduced && !this.skip) {
        this.namePlate.y = 754;
        this.namePlate.alpha = 0.5;
        this.anim.to(this.namePlate, { y: 746, alpha: 1 }, { duration: 240, ease: 'cubic.out' });
      } else {
        this.namePlate.alpha = 1;
      }
    }

    this.anim.killOf(this.bodyText);
    if (!reduced && !this.skip) {
      this.bodyText.y = -50;
      this.bodyText.alpha = 0.18;
      this.anim.to(this.bodyText, { y: -64, alpha: 1 }, { duration: 280, ease: 'cubic.out' });
      this.anim.killOf(this.lineShimmer);
      this.lineShimmer.position.set(-640, -96);
      this.lineShimmer.alpha = 0.75;
      this.anim.to(this.lineShimmer, { x: 640, alpha: 0 }, { duration: 700, ease: 'cubic.out' });
      if (this.actionBadge.text) {
        this.anim.killOf(this.actionBadge);
        this.actionBadge.y = -82;
        this.actionBadge.alpha = 0;
        this.anim.to(this.actionBadge, { y: -88, alpha: 0.9 }, { duration: 320, ease: 'sine.out' });
      }
    } else {
      this.bodyText.y = -64;
      this.bodyText.alpha = 1;
    }

    const baseCps = this.skip ? 400 : this.cutscene ? CUTSCENE.cps : CPS[prefs().textSpeed];
    const cpsMult = speakerEmotion === 'protective' || speakerEmotion === 'determined' ? 1.18 : speakerEmotion === 'soft_smile' ? 0.9 : speakerEmotion === 'dry_amusement' || speakerEmotion === 'dry_humor' ? 1.06 : 1.0;
    const hasVoiceLine = Boolean(this.stage?.hasVoice(e.lineId));
    const voiceDur = this.stage?.voiceDuration(e.lineId) ?? 0;
    const schedule = buildSubtitleSchedule(this.fullText, this.skip ? 0 : voiceDur, baseCps * cpsMult);
    this.activeSchedule = schedule;
    this.typingStartedAt = performance.now();

    if (this.skip) {
      let n = 0;
      let acc = 0;
      this.stopTyping = this.onTick((dt) => {
        acc += dt;
        while (acc >= 12) {
          acc -= 12;
          n += 6;
        }
        this.bodyText.text = this.fullText.slice(0, n);
        if (n >= this.fullText.length) this.finishTyping();
      });
      return;
    }

    let shownCount = 0;
    this.stopTyping = this.onTick(() => {
      const elapsedMs = Math.max(0, performance.now() - this.typingStartedAt);
      const vp = this.stage?.voiceProgress(e.lineId);
      const { count, revealRatio, voiceRatio, done } = resolveSubtitleProgress(schedule, elapsedMs, vp && vp.playing ? vp.currentTime : undefined);
      if (count > shownCount) {
        shownCount = count;
        this.bodyText.text = this.fullText.slice(0, shownCount);
        if (shownCount % 3 === 0 && !narr && !hasVoiceLine) Sfx.tap();
      }
      this.drawSyncFill(vp && vp.duration > 0 ? Math.max(voiceRatio, vp.ratio) : revealRatio);
      if (done || shownCount >= this.fullText.length) this.finishTyping();
    });
  }

  private finishTyping(): void {
    const wasPausing = this.pausing;
    this.pausing = false;
    this.typing?.stop();
    this.typing = null;
    this.stopTyping?.();
    this.stopTyping = null;
    if (wasPausing && !this.skip && this.currentLine) void this.stage?.voice(this.currentLine.lineId);
    this.anim.killOf(this.bodyText);
    this.bodyText.text = this.fullText;
    this.bodyText.y = -64;
    this.bodyText.alpha = 1;
    this.drawSyncFill(1);
    this.lineDone = true;
    this.caret.visible = true;
    if (this.currentLine) this.read.add(this.currentLine.lineId);
    if (this.skip) this.autoTimer = this.anim.after(90, () => this.advance());
    else if (this.auto) this.autoTimer = this.anim.after(this.autoHoldMs(), () => this.advance());
  }

  private autoHoldMs(): number {
    const line = this.currentLine;
    const voiceSeconds = line ? (this.stage?.voiceDuration(line.lineId) ?? 0) : 0;
    const last = line !== null && line.lineId === this.lastLineId;
    if (voiceSeconds > 0 && line) {
      const vp = this.stage?.voiceProgress(line.lineId);
      const elapsedSec = this.typingStartedAt > 0 ? Math.max(0, (performance.now() - this.typingStartedAt) / 1000) : (this.activeSchedule?.totalRevealMs ?? 1200) / 1000;
      const spokenSec = vp && vp.currentTime > 0 ? Math.max(elapsedSec, vp.currentTime) : elapsedSec;
      const voiceSyncedHoldMs = Math.max(1050, (Math.max(0, voiceSeconds - spokenSec) + 0.72) * 1000);
      if (last && this.data0.closing_hold_seconds !== undefined) return Math.max(voiceSyncedHoldMs, this.data0.closing_hold_seconds * 1000);
      return voiceSyncedHoldMs;
    }
    const revealSeconds = this.fullText.length / (this.cutscene ? CUTSCENE.cps : CPS[prefs().textSpeed]);
    const voiceHoldMs = voiceSeconds > 0 ? Math.max(950, (voiceSeconds - revealSeconds + 0.65) * 1000) : 0;
    if (!this.cutscene) return Math.max(voiceHoldMs, (line?.holdSeconds ?? 2.4) * 1000 + this.fullText.length * 22);
    const textHoldMs =
      cutsceneHoldSeconds({
        chars: this.fullText.length,
        ...(line?.holdSeconds !== undefined ? { holdSeconds: line.holdSeconds } : {}),
        last,
        ...(this.data0.closing_hold_seconds !== undefined ? { closingHoldSeconds: this.data0.closing_hold_seconds } : {})
      }) * 1000;
    return Math.max(voiceHoldMs, textHoldMs);
  }

  private advance(): void {
    if (this.finished || this.choiceLayer || this.logLayer) return;
    this.autoTimer?.stop();
    if (!this.waiting) return;
    if (this.pausing || !this.lineDone) {
      this.finishTyping();
      return;
    }
    this.waiting = false;
    this.pump();
  }

  private toggleAuto(): void {
    this.auto = !this.auto;
    this.autoBtn.setLabel(this.auto ? 'AUTO ✓' : 'AUTO');
    if (this.cutscene) {
      // one on/off switch: turning it off keeps the current line on screen, turning it on resumes the normal reading hold
      this.autoTimer?.stop();
      if (this.auto && this.lineDone && this.waiting && !this.pausing) this.autoTimer = this.anim.after(this.autoHoldMs(), () => this.advance());
      return;
    }
    if (this.auto && this.lineDone && this.waiting) this.advance();
  }

  private toggleSkip(): void {
    if (this.finished || this.choiceLayer) return;
    const hasChoices = this.data0.commands.some((c) => c.op === 'choice');
    if (this.cutscene || !hasChoices) {
      this.skip = true;
      this.skipBtn?.setLabel('SKIP ✓');
      this.typing?.stop();
      this.stopTyping?.();
      this.autoTimer?.stop();
      this.complete();
      return;
    }
    this.skip = !this.skip;
    this.skipBtn?.setLabel(this.skip ? 'SKIP ✓' : 'SKIP');
    if (this.skip && this.waiting) {
      if (!this.lineDone) this.finishTyping();
      else this.advance();
    }
  }

  // ------------------------------------------------------------------ overlays

  private showChoices(e: Extract<StoryEvent, { type: 'choice' }>): void {
    this.caret.visible = false;
    const layer = new PIXI.Container();
    layer.addChild(blocker(0x000000, 0.55));
    const gap = 150;
    const top = REF_H / 2 - ((e.options.length - 1) * gap) / 2;
    if (e.prompt) layer.addChild(title(REF_W / 2, top - 130, e.prompt, 40, T.gold));
    e.options.forEach((o, i) => {
      layer.addChild(
        new Button(this, REF_W / 2, top + i * gap, {
          label: o.text,
          w: 1100,
          fontSize: 34,
          onClick: () => {
            this.choiceLayer?.destroy({ children: true });
            this.choiceLayer = null;
            this.runner.choose(o.id);
            this.waiting = false;
            this.pump();
          }
        })
      );
    });
    this.choiceLayer = this.add(layer, DEPTH.modal);
  }

  private showLog(): void {
    if (this.logLayer) return;
    const layer = new PIXI.Container();
    layer.addChild(blocker(0x000000, 0.7), panel(REF_W / 2, REF_H / 2, 1500, 860, 'normal'), title(REF_W / 2, 190, 'BACKLOG', 44, T.gold));
    let y = 270;
    for (const l of this.runner.history.slice(-7)) {
      const who = l.speaker === 'narration' ? '' : `${l.speakerDisplay.toUpperCase()}  `;
      const t = layer.addChild(txt(290, y, `${who}${this.stage?.text(l.lineId, l.text) ?? l.text}`, { fontSize: 32, color: l.speaker === 'narration' ? '#b9aecb' : T.text, wordWrap: { width: 1340 } }));
      y += t.height + 22;
    }
    layer.addChild(
      new Button(this, REF_W / 2, 910, {
        label: 'CLOSE',
        w: 360,
        onClick: () => {
          this.logLayer?.destroy({ children: true });
          this.logLayer = null;
        }
      })
    );
    this.logLayer = this.add(layer, DEPTH.modal);
  }
}

/** engine registration under the 'Story' key every flow already starts */
export const StoryHost = hosted<StoryInit>('Story', () => new StoryScene());
