import Phaser from 'phaser';
import { StoryRunner, type StoryEvent } from '@uomd/story';
import type { StoryCommand, StoryScene as StoryData } from '@uomd/content-schema';
import { REF_H, REF_W } from '../config';
import { NarrativeStage } from '../presentation/NarrativeStage';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { prefs } from '../platform/prefs';
import { safeInsets } from '../platform/safeArea';
import { CUTSCENE, cutsceneHoldSeconds, cutscenePauseSeconds } from '../entry/cutscene';
import { clearStoryCheckpoint, loadReadLines, loadStoryCheckpoint, saveReadLines, saveStoryCheckpoint } from '../entry/resume';
import { Services } from '../services';
import { Button, panel, sceneFadeIn, title, txt } from '../ui/kit';
import { C, DEPTH, F, SIZE, T } from '../ui/theme';

export interface StoryInit {
  path: string;
  data?: StoryData;
  authRevision?: number;
  onDone: (scene: Phaser.Scene) => void;
  onBack?: (scene: Phaser.Scene) => void;
}

const CPS = { slow: 26, normal: 46, fast: 95 } as const;

interface Actor {
  side: 'left' | 'right';
  image: Phaser.GameObjects.Image;
  emotion: string;
  baseX: number;
  baseY: number;
  offsetX: number;
  offsetY: number;
  tiltDeg: number;
  scaleMult: number;
  breatheTween: Phaser.Tweens.Tween | null;
}

export class StoryScene extends Phaser.Scene {
  private generation = 0;
  private stage: NarrativeStage | null = null;
  private voiceBtn: Button | null = null;
  private currentView: () => boolean = () => false;
  private init0!: StoryInit;
  private data0!: StoryData;
  private runner!: StoryRunner;
  private bg!: Phaser.GameObjects.Image;
  private actors = new Map<string, Actor>();
  private box!: Phaser.GameObjects.Container;
  private nameText!: Phaser.GameObjects.Text;
  private namePlate!: Phaser.GameObjects.Container;
  private actionBadge!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private caret!: Phaser.GameObjects.Text;
  private typing: Phaser.Time.TimerEvent | null = null;
  private fullText = '';
  private lineDone = true;
  private waiting = false;
  private auto = false;
  private skip = false;
  private autoTimer: Phaser.Time.TimerEvent | null = null;
  private read = new Set<string>();
  private currentLine: Extract<StoryEvent, { type: 'line' }> | null = null;
  private finished = false;
  private choiceLayer: Phaser.GameObjects.Container | null = null;
  private logLayer: Phaser.GameObjects.Container | null = null;
  private autoBtn!: Button;
  private skipBtn: Button | null = null;
  /** first-install cutscene rules (scene data carries a `presentation` block) */
  private cutscene = false;
  private pausing = false;
  private prevSpeaker: string | null = null;
  private lastLineId: string | null = null;

  constructor() {
    super('Story');
  }

  init(data: StoryInit): void {
    this.generation++;
    this.stage = null;
    this.voiceBtn = null;
    this.init0 = data;
    this.actors = new Map();
    this.finished = false;
    this.waiting = false;
    this.auto = false;
    this.skip = false;
    this.cutscene = false;
    this.pausing = false;
    this.prevSpeaker = null;
    this.currentLine = null;
    this.lineDone = true;
    this.typing = null;
    this.autoTimer = null;
    this.choiceLayer = null;
    this.logLayer = null;
    this.read = loadReadLines(Services.api.accountKey);
  }

  async create(): Promise<void> {
    const generation = this.generation;
    const current = (): boolean => generation === this.generation && (this.init0.authRevision === undefined || this.init0.authRevision === Services.api.authRevision);
    this.currentView = current;
    const accountChanged = (): void => { if (!current() && (this.sys.isActive() || this.sys.isPaused())) this.init0.onBack?.(this); };
    if (this.init0.authRevision !== undefined) Services.api.addEventListener('auth', accountChanged);
    this.events.once('shutdown', () => { this.generation++; Services.api.removeEventListener('auth', accountChanged); });
    const { content, art } = Services.ready();
    this.cameras.main.setBackgroundColor(0x0a0610);
    try {
      const data = this.init0.data ?? await content.story(this.init0.path);
      if (!current()) return;
      this.data0 = data;
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
        if (!set) { set = new Set(['composed']); charEmotions.set(ch, set); }
        set.add(em);
      };
      const locations = new Set([this.data0.location_id]);
      const cues = new Set<string>();
      for (const c of this.data0.commands) {
        if (c.op === 'background') locations.add(c.location_id);
        if (c.op === 'show') addEmotion(c.character);
        if (c.op === 'say') addEmotion(c.speaker, c.emotion ?? 'composed');
        if (c.op === 'music' && c.cue_id !== 'stop') cues.add(c.cue_id);
      }
      // Always load original character portraits so all cutscenes stage the canonical character busts
      await Promise.all([
        ...[...locations].map((id) => art.loadBackground(this, id)),
        art.loadPortraits(this, [...chars], charEmotions),
        ...[...cues].map((q) => art.loadMusic(this, q))
      ]);
    } catch (e) {
      if (!current()) return;
      this.fail(e);
      return;
    }
    if (!current()) return;
    const savedCp = loadStoryCheckpoint(Services.api.accountKey, this.init0.path, this.data0.scene_id);
    this.runner = new StoryRunner(this.data0, savedCp?.state);
    this.build();
    this.restoreFromRunner();
    sceneFadeIn(this, 1300);
    this.pump();
  }

  private fail(e: unknown): void {
    this.finished = true; this.stage?.destroy(); this.autoTimer?.remove(); this.typing?.remove();
    title(this, REF_W / 2, REF_H / 2 - 40, 'This scene could not be loaded', SIZE.h2, T.crimson);
    txt(this, REF_W / 2, REF_H / 2 + 30, String(e instanceof Error ? e.message : e), { fontSize: `${SIZE.small}px`, color: T.dim, align: 'center', wordWrap: { width: 1400 } }).setOrigin(0.5);
    new Button(this, REF_W / 2, REF_H / 2 + 200, { label: 'BACK', w: 360, onClick: () => this.init0.onBack ? this.init0.onBack(this) : this.scene.start('Title') });
  }

  // ------------------------------------------------------------------ layout

  private build(): void {
    const { art } = Services.ready();
    this.bg = this.add.image(REF_W / 2, REF_H / 2, art.background(this.data0.location_id)).setDepth(DEPTH.bg);
    const cover = Math.max(REF_W / this.bg.width, REF_H / this.bg.height);
    this.bg.setScale(cover * 1.04);
    if (!prefs().reducedMotion) {
      this.tweens.add({
        targets: this.bg,
        scale: cover * 1.09,
        x: REF_W / 2 - 18,
        duration: 36000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
    }

    // Subtle atmospheric ash & ember motes behind the character busts
    if (!prefs().reducedMotion && this.textures.exists('fx_spark')) {
      this.add
        .particles(0, 0, 'fx_spark', {
          x: { min: 0, max: REF_W },
          y: REF_H - 180,
          lifespan: 9500,
          speedY: { min: -42, max: -16 },
          speedX: { min: -14, max: 14 },
          scale: { min: 0.04, max: 0.13 },
          alpha: { start: 0.28, end: 0 },
          frequency: 420,
          tint: [0xc9b6e4, 0xe3c37d, 0xefe8f5],
          blendMode: 'ADD'
        })
        .setDepth(DEPTH.bg + 2);
    }

    // Grade the world below the HUD so Light Novel dialogue and original character busts keep rich contrast.
    const shade = this.add.graphics().setDepth(DEPTH.bg + 5);
    shade.fillGradientStyle(0x0a0610, 0x0a0610, 0x0a0610, 0x0a0610, 0.08, 0.08, 0.76, 0.76);
    shade.fillRect(0, 0, REF_W, REF_H);

    // tap anywhere to advance; buttons sit above this zone
    const zone = this.add.zone(REF_W / 2, REF_H / 2, REF_W, REF_H).setDepth(DEPTH.hud - 10).setInteractive();
    zone.on('pointerup', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());

    const insets = safeInsets(this);
    const panelBg = panel(this, 0, 0, 1680, 264, 'normal');
    // Light Novel ornamental inner rule inside the reader box
    const lnFrame = this.add.graphics();
    lnFrame.lineStyle(1, C.gold, 0.32);
    lnFrame.lineBetween(-790, -104, 790, -104);
    lnFrame.lineBetween(-790, 104, 790, 104);

    this.nameText = txt(this, 0, 0, '', {
      fontFamily: F.display,
      fontSize: '34px',
      fontStyle: '700',
      color: T.gold,
      stroke: '#0a0610',
      strokeThickness: 4
    })
      .setOrigin(0.5)
      .setLetterSpacing(3);
    const plateBg = panel(this, 0, 0, 390, 70, 'hot');
    this.namePlate = this.add.container(0, 0, [plateBg, this.nameText]).setDepth(DEPTH.hud + 2).setVisible(false);

    this.actionBadge = txt(this, 0, -96, '', {
      fontFamily: F.display,
      fontSize: '20px',
      fontStyle: '600',
      color: '#e3c37d',
      stroke: '#0a0610',
      strokeThickness: 3
    })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setAlpha(0.88);

    this.bodyText = txt(this, -780, -68, '', {
      fontFamily: F.body,
      fontSize: '41px',
      color: T.text,
      lineSpacing: 10,
      wordWrap: { width: 1560 },
      stroke: '#07040c',
      strokeThickness: 3
    });
    this.caret = txt(this, 780, 88, '▼', { fontSize: '32px', color: T.gold }).setOrigin(1, 0.5).setVisible(false);
    this.box = this.add
      .container(REF_W / 2, 902 - insets.bottom, [panelBg, lnFrame, this.actionBadge, this.bodyText, this.caret])
      .setDepth(DEPTH.hud);

    this.voiceBtn = new Button(this, REF_W - 160 - insets.right, 210 + insets.top, { label: 'VOICE', w: 240, h: 110, fontSize: 28, onClick: () => { if (this.currentLine) void this.stage?.voice(this.currentLine.lineId); } }).setDepth(DEPTH.hud + 3).setVisible(false);
    // cutscenes have no Skip and a single on/off Auto toggle (v006); the regular reader keeps Skip
    if (!this.cutscene) this.skipBtn = new Button(this, REF_W - 150 - insets.right, 70 + insets.top, { label: 'SKIP', w: 220, h: 86, fontSize: 28, onClick: () => this.toggleSkip() }).setDepth(DEPTH.hud + 3);
    const rightEdge = (this.cutscene ? REF_W - 150 : REF_W - 400) - insets.right;
    this.autoBtn = new Button(this, rightEdge, 70 + insets.top, { label: this.auto ? 'AUTO ✓' : 'AUTO', w: 220, h: 86, fontSize: 28, onClick: () => this.toggleAuto() }).setDepth(DEPTH.hud + 3);
    new Button(this, rightEdge - 250, 70 + insets.top, { label: 'LOG', w: 220, h: 86, fontSize: 28, onClick: () => this.showLog() }).setDepth(DEPTH.hud + 3);
    title(this, 170 + insets.left, 70 + insets.top, this.data0.title_en, 34, T.dim).setDepth(DEPTH.hud + 3).setOrigin(0, 0.5).setX(60 + insets.left);
    if (this.init0.authRevision !== undefined && this.init0.onBack) new Button(this, 220 + insets.left, 210 + insets.top, { label: 'ARCHIVE', w: 340, h: 110, onClick: () => this.init0.onBack?.(this) }).setDepth(DEPTH.hud + 3);
    this.tweens.add({ targets: this.caret, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    const onContextLost = (): void => {
      if (!this.finished && this.data0 && this.runner) {
        saveStoryCheckpoint(Services.api.accountKey, {
          path: this.init0.path,
          sceneId: this.data0.scene_id,
          checkpointId: this.currentLine?.lineId,
          state: this.runner.saveAtCurrentEvent()
        });
        saveReadLines(Services.api.accountKey, this.read);
      }
    };
    this.game.events.on('webgl:contextlost', onContextLost);
    this.events.once('shutdown', () => {
      this.game.events.off('webgl:contextlost', onContextLost);
    });
  }

  /** Applies reconstructed visual/audio state when resuming from a mid-scene checkpoint. */
  private restoreFromRunner(): void {
    const { art } = Services.ready();
    const r = this.runner.restored;
    const bgKey = art.background(r.locationId);
    if (this.bg.texture.key !== bgKey) this.bg.setTexture(bgKey);
    if (r.musicCueId !== null) {
      if (r.musicCueId === 'stop') Music.stop();
      else {
        const m = art.music(r.musicCueId);
        if (m) Music.play(this.cache.audio, m.key, m.loopStart, m.duration);
      }
    }
    for (const [character, a] of r.actors) {
      this.showActor(character, a.side, a.emotion, true);
    }
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

  /** Applies an event; returns true when the story must pause for input. */
  private apply(e: StoryEvent): boolean {
    const { art } = Services.ready();
    switch (e.type) {
      case 'presentation': {
        const generation = this.generation;
        this.waiting = false;
        void this.stage?.execute(e.command).then(() => { if (generation === this.generation && this.currentView()) this.pump(); }).catch((error: unknown) => { if (generation === this.generation && this.currentView()) this.fail(error); });
        return true;
      }
      case 'background': {
        const key = art.background(e.locationId);
        if (this.bg.texture.key !== key) this.bg.setTexture(key);
        return false;
      }
      case 'music': {
        if (e.cueId === 'stop') Music.stop();
        else {
          const m = art.music(e.cueId);
          if (m) Music.play(this.cache.audio, m.key, m.loopStart, m.duration);
        }
        return false;
      }
      case 'fade':
        if (e.direction === 'out') {
          const isFinalTutorialScene = this.data0.scene_id === 'tutorial_t3_after';
          const fadeMs = isFinalTutorialScene ? 2200 : Math.max(1200, e.seconds * 1000);
          this.cameras.main.fadeOut(fadeMs, 10, 6, 16);
        }
        return false;
      case 'flash':
        if (!prefs().reducedMotion) this.cameras.main.flash(e.seconds * 1000, 255, 255, 255);
        return false;
      case 'shake':
        if (!prefs().reducedMotion) this.cameras.main.shake(e.seconds * 1000, 0.006 * e.intensity);
        return false;
      case 'show':
        this.showActor(e.character, e.side);
        return false;
      case 'hide':
        this.hideActor(e.character);
        return false;
      case 'checkpoint':
        saveStoryCheckpoint(Services.api.accountKey, {
          path: this.init0.path,
          sceneId: this.data0.scene_id,
          checkpointId: e.checkpointId,
          state: this.runner.save()
        });
        return false;
      case 'wait':
        this.time.delayedCall(e.seconds * 1000, () => this.pump());
        return true;
      case 'line':
        saveStoryCheckpoint(Services.api.accountKey, {
          path: this.init0.path,
          sceneId: this.data0.scene_id,
          checkpointId: e.lineId,
          state: this.runner.saveAtCurrentEvent()
        });
        this.showLine(e);
        return true;
      case 'choice':
        saveStoryCheckpoint(Services.api.accountKey, {
          path: this.init0.path,
          sceneId: this.data0.scene_id,
          state: this.runner.saveAtCurrentEvent()
        });
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
    this.autoTimer?.remove();
    const isFinalTutorialScene = this.data0.scene_id === 'tutorial_t3_after';
    const holdOutMs = isFinalTutorialScene ? 2200 : 1200;
    this.cameras.main.fadeOut(holdOutMs, 10, 6, 16);
    this.time.delayedCall(holdOutMs, () => this.init0.onDone(this));
  }

  // ------------------------------------------------------------------ actors & bust choreography

  private showActor(character: string, side: 'left' | 'right', emotion = 'composed', immediate = false): void {
    const { art } = Services.ready();
    const key = art.portrait(character, emotion) ?? art.portrait(character, 'composed');
    if (!key) return;
    const existing = this.actors.get(character);
    if (existing) {
      existing.breatheTween?.stop();
      existing.image.destroy();
      this.actors.delete(character);
    }
    const baseX = side === 'left' ? 500 : REF_W - 500;
    const baseY = REF_H + 30;
    const img = this.add
      .image(immediate ? baseX : baseX + (side === 'left' ? -90 : 90), baseY, key)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.world)
      .setAlpha(immediate ? 0.82 : 0);
    const k = 980 / img.height;
    img.setScale(k);
    if (side === 'left') img.setFlipX(false);

    let breatheTween: Phaser.Tweens.Tween | null = null;
    if (!prefs().reducedMotion) {
      breatheTween = this.tweens.add({
        targets: img,
        scaleY: k * 1.012,
        duration: side === 'left' ? 2800 : 2500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    const actor: Actor = {
      side,
      image: img,
      emotion,
      baseX,
      baseY,
      offsetX: 0,
      offsetY: 0,
      tiltDeg: 0,
      scaleMult: 1,
      breatheTween
    };
    this.actors.set(character, actor);
    if (!immediate) {
      this.tweens.add({ targets: img, x: baseX, alpha: 0.82, duration: prefs().reducedMotion ? 1 : 950, ease: 'Cubic.easeOut' });
    }
  }

  private hideActor(character: string): void {
    const a = this.actors.get(character);
    if (!a) return;
    a.breatheTween?.stop();
    this.actors.delete(character);
    this.tweens.add({ targets: a.image, alpha: 0, duration: 450, onComplete: () => a.image.destroy() });
  }

  /**
   * Shapes and animates the original character busts (`portrait_mahmut_*` and `portrait_fadyme_*`)
   * according to both what they say (emotion/dialogue) and what they do in the narrative script!
   */
  private applyLineChoreography(e: Extract<StoryEvent, { type: 'line' }>): void {
    const id = e.lineId;
    const m = this.actors.get('mahmut');
    const f = this.actors.get('fadyme');
    let stageCue = '';

    // 1. Default emotion-driven micro-posture for the active speaker
    if (e.speaker !== 'narration') {
      const sp = this.actors.get(e.speaker);
      if (sp) {
        const inward = sp.side === 'left' ? 1 : -1;
        switch (e.emotion) {
          case 'watchful':
            sp.tiltDeg = inward * 1.2;
            sp.scaleMult = 1.01;
            break;
          case 'dry_humor':
          case 'dry_amusement':
            sp.tiltDeg = inward * -1.8;
            sp.scaleMult = 1.01;
            break;
          case 'soft_smile':
            sp.tiltDeg = inward * 1.6;
            sp.scaleMult = 1.015;
            break;
          case 'protective':
          case 'determined':
            sp.tiltDeg = inward * 2.0;
            sp.offsetX = Math.max(sp.offsetX * inward, 36) * inward;
            sp.scaleMult = 1.045;
            break;
          default:
            sp.tiltDeg = 0;
            sp.scaleMult = 1.0;
            break;
        }
      }
    }

    // 2. Scene & line-specific narrative action choreography
    switch (id) {
      case 'tutorial_t1_before_006':
        // "That one is loose. Give me your hand."
        if (m) { m.offsetX = 75; m.tiltDeg = 2.2; }
        stageCue = 'MAHMUT EXTENDS HIS HAND ACROSS THE WET STONES';
        break;
      case 'tutorial_t1_before_009':
        // "She took his hand. On the other side, neither let go quite as promptly as the crossing required."
        if (m) { m.offsetX = 95; m.tiltDeg = 1.8; }
        if (f) { f.offsetX = -95; f.tiltDeg = -2.2; }
        stageCue = 'HAND IN HAND ACROSS THE SLIPPERY CROSSING';
        break;
      case 'tutorial_t1_before_012':
      case 'tutorial_t1_before_013':
        // "Something scraped across the stones ahead. Mahmut turned..." / "Two of them. Stay beside the wall."
        if (m) { m.offsetX = 115; m.offsetY = -12; m.scaleMult = 1.055; m.tiltDeg = 2.5; }
        if (f) { f.offsetX = -35; }
        if (!prefs().reducedMotion && id === 'tutorial_t1_before_012') {
          this.cameras.main.shake(260, 0.003);
        }
        stageCue = 'BELLBOUND DEAD APPROACH IN THE MIST';
        break;
      case 'tutorial_t1_before_014':
        // "Beside it. Not behind you. I know the difference."
        if (f) { f.offsetX = -90; f.offsetY = -12; f.scaleMult = 1.05; f.tiltDeg = -2.0; }
        stageCue = 'STANDING SIDE BY SIDE';
        break;

      case 'tutorial_t1_after_004':
      case 'tutorial_t1_after_005':
        // "Your sleeve." / "A branch. It has dreadful manners."
        if (m) { m.offsetX = 70; m.tiltDeg = 1.8; }
        if (f) { f.tiltDeg = -2.2; }
        break;
      case 'tutorial_t1_after_006':
        // "He brushed a torn leaf from her shoulder, then found a reason to check his shield."
        if (m) { m.offsetX = 125; m.tiltDeg = 3.0; }
        if (f) { f.offsetX = -85; f.tiltDeg = -1.6; }
        stageCue = 'HE BRUSHES A TORN ASH LEAF FROM HER SHOULDER';
        this.time.delayedCall(1800, () => {
          if (!this.sys.isActive() || !m) return;
          m.offsetX = 35;
          m.tiltDeg = -1.5;
          this.animateActorTransform(m, 650);
        });
        break;
      case 'tutorial_t1_after_014':
        // "He shortened his stride. She noticed, and chose not to thank him for it aloud."
        if (m) { m.offsetX = 55; m.tiltDeg = 1.0; }
        if (f) { f.offsetX = -55; f.tiltDeg = -1.2; }
        stageCue = 'MATCHING STRIDES ALONG THE ASH ROAD';
        break;

      case 'tutorial_t2_before_006':
        // "For a moment she watched the empty movement without speaking. Mahmut did not hurry her."
        if (f) { f.tiltDeg = -2.0; f.offsetX = -30; }
        stageCue = 'WATCHING THE LONE HOLLOW PILGRIM';
        break;
      case 'tutorial_t2_before_011':
      case 'tutorial_t2_before_012':
      case 'tutorial_t2_before_013':
        // "The pilgrim stopped. Its head turned toward them."
        if (m) { m.offsetX = 95; m.offsetY = -10; m.scaleMult = 1.05; m.tiltDeg = 2.2; }
        if (f) { f.offsetX = -80; f.offsetY = -8; f.scaleMult = 1.04; f.tiltDeg = -1.8; }
        stageCue = 'COMBAT STANCE AT THE FORGOTTEN STONE CROSSING';
        break;

      case 'tutorial_t2_after_001':
      case 'tutorial_t2_after_002':
        // "Beyond the narrow path, a fallen stone offered a seat..." / "Sit. The trees have survived your inspection."
        if (f) { f.offsetY = 52; f.offsetX = -65; f.tiltDeg = -1.5; }
        if (m) { m.offsetY = id === 'tutorial_t2_after_002' ? 48 : 10; m.offsetX = 65; }
        stageCue = 'RESTING UPON THE MOSSY FALLEN STONE';
        break;
      case 'tutorial_t2_after_003':
      case 'tutorial_t2_after_004':
        if (m) { m.offsetY = 52; m.offsetX = 85; m.tiltDeg = 1.5; }
        if (f) { f.offsetY = 52; f.offsetX = -85; f.tiltDeg = -1.8; }
        break;
      case 'tutorial_t2_after_005':
      case 'tutorial_t2_after_006':
      case 'tutorial_t2_after_007':
      case 'tutorial_t2_after_008':
        // "She drew his wrist toward her and threaded the loose leather through its buckle."
        if (m) { m.offsetY = 54; m.offsetX = 130; m.tiltDeg = 2.6; m.scaleMult = 1.02; }
        if (f) { f.offsetY = 54; f.offsetX = -130; f.tiltDeg = -3.2; f.scaleMult = 1.02; }
        stageCue = 'FADYME TIGHTENS THE LOOSE LEATHER STRAP ON HIS GAUNTLET';
        break;
      case 'tutorial_t2_after_016':
        // "She smiled down at the finished knot. He looked away first, but not quickly."
        if (f) { f.offsetY = 52; f.offsetX = -110; f.tiltDeg = -1.8; }
        if (m) { m.offsetY = 52; m.offsetX = 95; m.tiltDeg = -2.2; }
        stageCue = 'A QUIET SMILE OVER THE FINISHED BUCKLE';
        break;

      case 'tutorial_t3_before_007':
        // "She laughed softly. He was still listening when a shape moved beneath the eaves."
        if (f && !prefs().reducedMotion) {
          this.tweens.add({ targets: f.image, y: f.image.y - 14, duration: 160, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
        }
        if (m) { m.tiltDeg = 2.0; m.offsetX = 60; }
        break;
      case 'tutorial_t3_before_008':
      case 'tutorial_t3_before_010':
        if (m) { m.offsetX = 95; m.offsetY = -10; m.scaleMult = 1.05; m.tiltDeg = 2.2; }
        stageCue = 'SHADOWS STIR BENEATH THE SHELTER EAVES';
        break;
      case 'tutorial_t3_before_014':
        // "This time they stepped forward together."
        if (m) { m.offsetX = 115; m.offsetY = -14; m.scaleMult = 1.06; m.tiltDeg = 2.0; }
        if (f) { f.offsetX = -115; f.offsetY = -14; f.scaleMult = 1.06; f.tiltDeg = -2.0; }
        stageCue = 'STEPPING FORWARD TOGETHER AS ONE';
        break;

      case 'tutorial_t3_after_005':
      case 'tutorial_t3_after_006':
        // "He laid his cloak over the cold stone. She sat on one edge and left the other unmistakably free."
        if (f) { f.offsetY = 56; f.offsetX = -85; f.tiltDeg = -1.8; }
        if (m) { m.offsetY = 0; m.offsetX = 50; m.tiltDeg = 1.2; }
        stageCue = 'HIS OXBLOOD CLOAK SPREAD OVER THE COLD STONE BENCH';
        break;
      case 'tutorial_t3_after_007':
      case 'tutorial_t3_after_009':
        // "I will check the doorway."
        if (m) { m.offsetY = 0; m.offsetX = 20; m.tiltDeg = -2.0; }
        break;
      case 'tutorial_t3_after_011':
        // "He sat. His shield rested within reach; her shoulder rested almost within reach of his."
        if (m) { m.offsetY = 56; m.offsetX = 135; m.tiltDeg = 1.8; }
        if (f) { f.offsetY = 56; f.offsetX = -135; f.tiltDeg = -1.8; }
        stageCue = 'SEATED SIDE BY SIDE WITHIN THE WAYSIDE SHELTER';
        break;
      case 'tutorial_t3_after_016':
        // "She broke the loaf in two, considered the pieces, and put the larger one in his hand."
        if (f) { f.offsetY = 56; f.offsetX = -148; f.tiltDeg = -2.8; }
        if (m) { m.offsetY = 56; m.offsetX = 140; m.tiltDeg = 2.0; }
        stageCue = 'SHARING A LOAF OF BREAD AT DUSK';
        break;
      case 'tutorial_t3_after_020':
        // "She looked toward the doorway. For a moment her answer did not come."
        if (f) { f.offsetY = 56; f.offsetX = -95; f.tiltDeg = 2.6; }
        stageCue = 'GAZING OUT TOWARD THE DARKENING ROAD';
        break;
      case 'tutorial_t3_after_025':
      case 'tutorial_t3_after_026':
      case 'tutorial_t3_after_029':
      case 'tutorial_t3_after_034':
        // "That made her turn back to him..." / "He stayed..." / "For tonight, a dry corner, half a loaf, and a place beside each other were enough."
        if (f) { f.offsetY = 56; f.offsetX = -145; f.tiltDeg = -2.0; }
        if (m) { m.offsetY = 56; m.offsetX = 145; m.tiltDeg = 1.8; }
        if (id === 'tutorial_t3_after_034') {
          stageCue = 'A DRY CORNER, HALF A LOAF, AND A PLACE BESIDE EACH OTHER';
        }
        break;
    }

    this.actionBadge.setText(stageCue);
  }

  private animateActorTransform(a: Actor, ms = 420): void {
    const baseScale = 980 / a.image.height;
    const targetScale = baseScale * a.scaleMult;
    const active = this.currentLine?.speaker === (a.side === 'left' ? 'mahmut' : 'fadyme');
    const liftY = active ? -14 : 6;
    this.tweens.add({
      targets: a.image,
      x: a.baseX + a.offsetX,
      y: a.baseY + a.offsetY + liftY,
      angle: prefs().reducedMotion ? 0 : a.tiltDeg,
      scaleX: targetScale,
      scaleY: targetScale,
      duration: prefs().reducedMotion ? 1 : ms,
      ease: 'Cubic.easeOut'
    });
  }

  private focusSpeaker(speaker: string, emotion?: string, ms = 280): void {
    const { art } = Services.ready();
    for (const [id, a] of this.actors) {
      const active = id === speaker;
      const isNarr = speaker === '';
      if (active && emotion && a.emotion !== emotion) {
        const key = art.portrait(id, emotion);
        if (key && key !== a.image.texture.key) {
          a.emotion = emotion;
          this.tweens.add({
            targets: a.image,
            alpha: 0.48,
            duration: 110,
            yoyo: true,
            onYoyo: () => {
              const sc = (980 / a.image.height) * a.scaleMult;
              a.image.setTexture(key).setScale(sc);
            }
          });
        }
      }
      a.image.setDepth(active ? DEPTH.world + 2 : DEPTH.world);
      this.tweens.add({
        targets: a.image,
        alpha: active ? 1 : isNarr ? 0.88 : 0.74,
        duration: ms
      });
      a.image.setTint(active ? 0xffffff : isNarr ? 0xe4dcef : 0xb2a8c2);
      this.animateActorTransform(a, Math.max(360, ms));
    }
  }

  // ------------------------------------------------------------------ dialogue

  private showLine(e: Extract<StoryEvent, { type: 'line' }>): void {
    this.currentLine = e;
    this.voiceBtn?.setVisible(this.stage?.hasVoice(e.lineId) ?? false);
    void this.stage?.voice(e.lineId);
    const narr = e.speaker === 'narration';
    const pause = this.cutscene ? cutscenePauseSeconds(this.prevSpeaker, e.speaker, this.data0.presentation?.speaker_pause_seconds ?? 1) : 0;
    this.prevSpeaker = e.speaker;

    // Shape and animate character busts according to speaker emotion and script actions
    this.applyLineChoreography(e);
    this.focusSpeaker(narr ? '' : e.speaker, e.emotion, pause > CUTSCENE.sameSpeakerPauseSeconds ? CUTSCENE.dissolveSeconds * 1000 : 320);

    this.namePlate.setVisible(false);
    this.bodyText.setStyle({
      fontStyle: narr ? 'italic 500' : '500',
      color: narr ? '#dfd4ee' : T.text
    });
    const rawLine = this.stage?.text(e.lineId, e.text) ?? e.text;
    const formattedLine = narr ? `— ${rawLine}` : `“${rawLine}”`;
    this.fullText = this.bodyText.getWrappedText(formattedLine).join('\n');
    this.bodyText.setText('');
    this.caret.setVisible(false);
    this.lineDone = false;
    this.waiting = true;
    this.typing?.remove();
    this.autoTimer?.remove();
    if (pause > 0) {
      this.pausing = true;
      this.time.delayedCall(pause * 1000, () => {
        this.pausing = false;
        this.startTyping(e, narr);
      });
    } else {
      this.startTyping(e, narr);
    }
  }

  private startTyping(e: Extract<StoryEvent, { type: 'line' }>, narr: boolean): void {
    if (this.finished) return;
    this.namePlate.setVisible(!narr);
    if (!narr) {
      const a = this.actors.get(e.speaker);
      const left = !a || a.side === 'left';
      this.nameText.setText(e.speakerDisplay.toUpperCase());
      this.nameText.setColor(e.speaker === 'fadyme' ? '#e2d2ff' : T.gold);
      this.namePlate.setPosition(left ? 330 : REF_W - 330, 756);
    }
    const cps = this.cutscene ? CUTSCENE.cps : this.skip ? 400 : CPS[prefs().textSpeed];
    let n = 0;
    this.typing = this.time.addEvent({
      delay: 1000 / cps,
      loop: true,
      callback: () => {
        n += cps > 100 ? 4 : 1;
        this.bodyText.setText(this.fullText.slice(0, n));
        if (n % 3 === 0 && !narr) Sfx.tap();
        if (n >= this.fullText.length) this.finishTyping();
      }
    });
  }

  private finishTyping(): void {
    this.typing?.remove();
    this.typing = null;
    this.bodyText.setText(this.fullText);
    this.lineDone = true;
    this.caret.setVisible(true);
    if (this.currentLine) this.read.add(this.currentLine.lineId);
    if (this.skip) {
      this.autoTimer = this.time.delayedCall(90, () => this.advance());
    } else if (this.auto) {
      this.autoTimer = this.time.delayedCall(this.autoHoldMs(), () => this.advance());
    }
  }

  private autoHoldMs(): number {
    const line = this.currentLine;
    if (!this.cutscene) return (line?.holdSeconds ?? 2.4) * 1000 + this.fullText.length * 22;
    const last = line !== null && line.lineId === this.lastLineId;
    return (
      cutsceneHoldSeconds({ chars: this.fullText.length, ...(line?.holdSeconds !== undefined ? { holdSeconds: line.holdSeconds } : {}), last, ...(this.data0.closing_hold_seconds !== undefined ? { closingHoldSeconds: this.data0.closing_hold_seconds } : {}) }) * 1000
    );
  }

  private advance(): void {
    if (this.finished || this.choiceLayer || this.logLayer || this.pausing) return;
    this.autoTimer?.remove();
    if (!this.waiting) return;
    if (!this.lineDone) {
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
      this.autoTimer?.remove();
      if (this.auto && this.lineDone && this.waiting && !this.pausing) this.autoTimer = this.time.delayedCall(this.autoHoldMs(), () => this.advance());
      return;
    }
    if (this.auto && this.lineDone && this.waiting) this.advance();
  }

  private toggleSkip(): void {
    this.skip = !this.skip;
    this.skipBtn?.setLabel(this.skip ? 'SKIP ✓' : 'SKIP');
    if (this.skip && this.lineDone && this.waiting) this.advance();
  }

  // ------------------------------------------------------------------ overlays

  private showChoices(e: Extract<StoryEvent, { type: 'choice' }>): void {
    this.caret.setVisible(false);
    const items: Phaser.GameObjects.GameObject[] = [this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x000000, 0.55).setInteractive()];
    const gap = 150;
    const top = REF_H / 2 - ((e.options.length - 1) * gap) / 2;
    if (e.prompt) items.push(title(this, REF_W / 2, top - 130, e.prompt, 40, T.gold));
    e.options.forEach((o, i) => {
      items.push(
        new Button(this, REF_W / 2, top + i * gap, {
          label: o.text,
          w: 1100,
          fontSize: 34,
          onClick: () => {
            this.choiceLayer?.destroy();
            this.choiceLayer = null;
            this.runner.choose(o.id);
            this.waiting = false;
            this.pump();
          }
        })
      );
    });
    this.choiceLayer = this.add.container(0, 0, items).setDepth(DEPTH.modal);
  }

  private showLog(): void {
    if (this.logLayer) return;
    const lines = this.runner.history.slice(-7);
    const dim = this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x000000, 0.7).setInteractive();
    const bg = panel(this, REF_W / 2, REF_H / 2, 1500, 860, 'normal');
    const items: Phaser.GameObjects.GameObject[] = [dim, bg, title(this, REF_W / 2, 190, 'BACKLOG', 44, T.gold)];
    let y = 270;
    for (const l of lines) {
      const who = l.speaker === 'narration' ? '' : `${l.speakerDisplay.toUpperCase()}  `;
      const t = txt(this, 290, y, `${who}${this.stage?.text(l.lineId, l.text) ?? l.text}`, { fontSize: '32px', color: l.speaker === 'narration' ? '#b9aecb' : T.text, wordWrap: { width: 1340 } });
      items.push(t);
      y += t.height + 22;
    }
    items.push(new Button(this, REF_W / 2, 910, { label: 'CLOSE', w: 360, onClick: () => { this.logLayer?.destroy(); this.logLayer = null; } }));
    this.logLayer = this.add.container(0, 0, items).setDepth(DEPTH.modal);
    void C;
  }
}
