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
import { buildSubtitleSchedule, resolveSubtitleProgress, type SubtitleSchedule } from '../ui/subtitles';
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
  private lineShimmer!: Phaser.GameObjects.Rectangle;
  private voiceSyncTrack!: Phaser.GameObjects.Rectangle;
  private voiceSyncFill!: Phaser.GameObjects.Rectangle;
  private typing: Phaser.Time.TimerEvent | null = null;
  private activeSchedule: SubtitleSchedule | null = null;
  private typingStartedAt = 0;
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
    this.activeSchedule = null;
    this.typingStartedAt = 0;
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
        if (!set) {
          set = new Set(
            ch === 'fadyme'
              ? ['composed', 'dry_amusement', 'soft_smile', 'determined']
              : ch === 'mahmut'
                ? ['composed', 'watchful', 'dry_humor', 'protective']
                : ['composed'],
          );
          charEmotions.set(ch, set);
        }
        set.add(em);
      };
      const locations = new Set([this.data0.location_id]);
      for (const c of this.data0.commands) {
        if (c.op === 'background') locations.add(c.location_id);
        if (c.op === 'show') addEmotion(c.character);
        if (c.op === 'say') addEmotion(c.speaker, c.emotion ?? 'composed');
      }
      // Always load all character emotion portraits so both speaker and listener react dynamically
      await Promise.all([
        ...[...locations].map((id) => art.loadBackground(this, id)),
        ...(this.data0.illustration_id ? [art.loadStills(this, [this.data0.illustration_id])] : []),
        art.loadPortraits(this, [...chars], charEmotions)
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

    this.lineShimmer = this.add.rectangle(-640, -104, 240, 2, C.gold, 0).setOrigin(0.5);
    this.voiceSyncTrack = this.add.rectangle(0, 104, 760, 2, 0xc9b6e4, 0.16).setOrigin(0.5);
    this.voiceSyncFill = this.add.rectangle(-380, 104, 0, 2, C.gold, 0.88).setOrigin(0, 0.5);

    this.nameText = txt(this, 0, 0, '', {
      fontFamily: F.display,
      fontSize: '28px',
      fontStyle: '700',
      color: T.gold,
      stroke: '#0a0610',
      strokeThickness: 4
    })
      .setOrigin(0.5)
      .setLetterSpacing(2);
    const plateBg = panel(this, 0, 0, 490, 68, 'hot');
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
      strokeThickness: 3.5
    }).setShadow(0, 4, '#050208', 10, true, true);
    this.caret = txt(this, 780, 88, '▼', { fontSize: '32px', color: T.gold }).setOrigin(1, 0.5).setVisible(false);
    this.box = this.add
      .container(REF_W / 2, 902 - insets.bottom, [
        panelBg,
        lnFrame,
        this.lineShimmer,
        this.voiceSyncTrack,
        this.voiceSyncFill,
        this.actionBadge,
        this.bodyText,
        this.caret
      ])
      .setDepth(DEPTH.hud);

    const topBtnY = 58 + insets.top;
    const btnW = 148;
    const btnH = 62;
    const btnGap = 14;
    const skipX = REF_W - 104 - insets.right;
    const autoX = skipX - (btnW + btnGap);
    const logX = autoX - (btnW + btnGap);
    const voiceX = logX - (btnW + btnGap);
    this.skipBtn = new Button(this, skipX, topBtnY, { label: 'SKIP', w: btnW, h: btnH, fontSize: 21, onClick: () => this.toggleSkip() }).setDepth(DEPTH.hud + 3);
    this.autoBtn = new Button(this, autoX, topBtnY, { label: this.auto ? 'AUTO ✓' : 'AUTO', w: btnW, h: btnH, fontSize: 21, onClick: () => this.toggleAuto() }).setDepth(DEPTH.hud + 3);
    new Button(this, logX, topBtnY, { label: 'LOG', w: btnW, h: btnH, fontSize: 21, onClick: () => this.showLog() }).setDepth(DEPTH.hud + 3);
    this.voiceBtn = new Button(this, voiceX, topBtnY, { label: 'VOICE', w: btnW, h: btnH, fontSize: 20, onClick: () => { if (this.currentLine) void this.stage?.voice(this.currentLine.lineId); } }).setDepth(DEPTH.hud + 3).setVisible(false);
    title(this, 60 + insets.left, topBtnY, this.data0.title_en, 30, T.dim).setDepth(DEPTH.hud + 3).setOrigin(0, 0.5);
    if (this.init0.authRevision !== undefined && this.init0.onBack) new Button(this, 160 + insets.left, topBtnY + 76, { label: 'ARCHIVE', w: 200, h: 62, fontSize: 21, onClick: () => this.init0.onBack?.(this) }).setDepth(DEPTH.hud + 3);
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
    Music.stop(0.1);
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
        Music.stop(0.1);
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

  private targetBustHeight(character: string): number {
    return character === 'fadyme' ? 895 : 955;
  }

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
    const baseX = side === 'left' ? 460 : REF_W - 460;
    const baseY = 955;
    const img = this.add
      .image(immediate ? baseX : baseX + (side === 'left' ? -90 : 90), baseY, key)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.world)
      .setAlpha(immediate ? 0.86 : 0);
    const k = this.targetBustHeight(character) / img.height;
    img.setScale(k);
    // Fadyme's knee-up sprites natively face left; Mahmut's natively face right. Flip only if needed to face inward.
    const nativeFacing = character === 'fadyme' ? 'left' : 'right';
    const desiredFacing = side === 'left' ? 'right' : 'left';
    img.setFlipX(nativeFacing !== desiredFacing);

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
      this.tweens.add({ targets: img, x: baseX, alpha: 0.86, duration: prefs().reducedMotion ? 1 : 950, ease: 'Cubic.easeOut' });
    }
  }

  private hideActor(character: string): void {
    const a = this.actors.get(character);
    if (!a) return;
    a.breatheTween?.stop();
    this.actors.delete(character);
    this.tweens.add({ targets: a.image, alpha: 0, duration: 450, onComplete: () => a.image.destroy() });
  }

  /** Smoothly crossfades a character's portrait texture to `newEmotion` and plays a physical reaction impulse. */
  private setActorEmotion(character: string, newEmotion: string, reactionImpulse = true): void {
    const a = this.actors.get(character);
    if (!a) return;
    const { art } = Services.ready();
    const key = art.portrait(character, newEmotion) ?? art.portrait(character, 'composed');
    if (!key) return;
    const changed = a.emotion !== newEmotion || a.image.texture.key !== key;
    a.emotion = newEmotion;
    if (!changed) return;

    const prevKey = a.image.texture.key;
    const ghost = this.add
      .image(a.image.x, a.image.y, prevKey)
      .setOrigin(0.5, 1)
      .setScale(a.image.scaleX, a.image.scaleY)
      .setFlipX(a.image.flipX)
      .setAngle(a.image.angle)
      .setTint(a.image.tintTopLeft)
      .setAlpha(a.image.alpha)
      .setDepth(a.image.depth);

    const sc = (this.targetBustHeight(character) / a.image.height) * a.scaleMult;
    a.image.setTexture(key).setScale(sc);

    this.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: prefs().reducedMotion ? 1 : 220,
      ease: 'Quad.easeOut',
      onComplete: () => ghost.destroy()
    });

    if (reactionImpulse && !prefs().reducedMotion) {
      if (newEmotion === 'dry_amusement' || newEmotion === 'dry_humor') {
        this.tweens.add({ targets: a.image, y: a.image.y - 10, duration: 130, yoyo: true, ease: 'Sine.easeInOut' });
      } else if (newEmotion === 'protective' || newEmotion === 'determined') {
        this.tweens.add({ targets: a.image, scaleX: sc * 1.035, scaleY: sc * 1.035, duration: 150, yoyo: true, ease: 'Back.easeOut' });
      } else if (newEmotion === 'soft_smile') {
        this.tweens.add({ targets: a.image, y: a.image.y + 8, duration: 180, yoyo: true, ease: 'Sine.easeInOut' });
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
      case 'tutorial_t1_before_012':
      case 'tutorial_t1_before_013':
        if (m) { m.offsetX = 115; m.offsetY = -12; m.scaleMult = 1.055; m.tiltDeg = 2.5; }
        if (f) { f.offsetX = -35; }
        if (!prefs().reducedMotion && id === 'tutorial_t1_before_012') {
          this.cameras.main.shake(260, 0.003);
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
        if (m) { m.offsetX = 125; m.tiltDeg = 3.0; }
        if (f) { f.offsetX = -85; f.tiltDeg = -1.6; }
        stageCue = 'HE BRUSHES A TORN ASH LEAF FROM HER SHOULDER';
        this.time.delayedCall(1800, () => {
          if (!this.sys.isActive() || !m) return;
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

    this.actionBadge.setText(stageCue);
    const MOOD_LABELS: Record<string, string> = {
      watchful: 'WATCHFUL',
      composed: 'CALM',
      dry_humor: 'DRY HUMOR',
      dry_amusement: 'WRY WIT',
      soft_smile: 'WARMTH',
      protective: 'GUARDIAN',
      determined: 'RESOLVE',
    };
    return {
      speakerEmotion: resolvedEmotion,
      moodLabel: MOOD_LABELS[resolvedEmotion] ?? 'COMPOSED',
    };
  }

  private animateActorTransform(character: string, a: Actor, ms = 420): void {
    const baseScale = this.targetBustHeight(character) / a.image.height;
    const targetScale = baseScale * a.scaleMult;
    const active = this.currentLine?.speaker === character;
    const liftY = active ? -16 : 6;
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
    if (speaker && emotion) {
      this.setActorEmotion(speaker, emotion, false);
    }
    for (const [id, a] of this.actors) {
      const active = id === speaker;
      const isNarr = speaker === '';
      a.image.setDepth(active ? DEPTH.world + 2 : DEPTH.world);
      this.tweens.add({
        targets: a.image,
        alpha: active ? 1 : isNarr ? 0.9 : 0.72,
        duration: ms
      });
      a.image.setTint(active ? 0xffffff : isNarr ? 0xe8e0f2 : 0xb0a4c2);
      this.animateActorTransform(id, a, Math.max(360, ms));
    }
  }

  // ------------------------------------------------------------------ dialogue

  private currentMoodLabel = '';

  private showLine(e: Extract<StoryEvent, { type: 'line' }>): void {
    this.currentLine = e;
    const hasVoiceLine = Boolean(this.stage?.hasVoice(e.lineId));
    this.voiceBtn?.setVisible(hasVoiceLine);
    this.stage?.stopVoice();
    const narr = e.speaker === 'narration';
    const rawPause = this.cutscene ? cutscenePauseSeconds(this.prevSpeaker, e.speaker, this.data0.presentation?.speaker_pause_seconds ?? 1) : 0;
    const speakerChanged = this.prevSpeaker !== null && this.prevSpeaker !== e.speaker;
    const pause = hasVoiceLine ? Math.min(rawPause, speakerChanged ? 0.3 : 0.16) : rawPause;
    this.prevSpeaker = e.speaker;

    // Shape and animate character busts according to speaker emotion and script actions
    const { speakerEmotion, moodLabel } = this.applyLineChoreography(e);
    this.currentMoodLabel = moodLabel;
    this.focusSpeaker(narr ? '' : e.speaker, speakerEmotion, rawPause > CUTSCENE.sameSpeakerPauseSeconds ? CUTSCENE.dissolveSeconds * 1000 : 320);

    const accentColor = narr ? 0xc9b6e4 : e.speaker === 'fadyme' ? 0xe2d2ff : C.gold;
    this.voiceSyncFill.setFillStyle(accentColor, 0.88).setSize(0, 2);
    this.lineShimmer.setFillStyle(accentColor, 0);

    this.namePlate.setVisible(!narr);
    if (!narr) {
      const a = this.actors.get(e.speaker);
      const left = !a || a.side === 'left';
      const label = this.currentMoodLabel ? `${e.speakerDisplay.toUpperCase()}  ·  ${this.currentMoodLabel}` : e.speakerDisplay.toUpperCase();
      this.nameText.setText(label);
      this.nameText.setColor(e.speaker === 'fadyme' ? '#e2d2ff' : T.gold);
      this.namePlate.setPosition(left ? 365 : REF_W - 365, 756);
    }
    const isProtectiveOrResolve = speakerEmotion === 'protective' || speakerEmotion === 'determined';
    const isWarm = speakerEmotion === 'soft_smile';
    this.bodyText.setStyle({
      fontStyle: narr ? 'italic 500' : isProtectiveOrResolve ? '600' : '500',
      color: narr ? '#dfd4ee' : isWarm ? '#fff6ea' : isProtectiveOrResolve ? '#f7ecf9' : T.text
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
    if (pause > 0 && !this.skip) {
      this.pausing = true;
      this.typing = this.time.delayedCall(pause * 1000, () => {
        this.pausing = false;
        this.startTyping(e, narr, speakerEmotion, speakerChanged);
      });
    } else {
      this.pausing = false;
      this.startTyping(e, narr, speakerEmotion, speakerChanged);
    }
  }

  private startTyping(
    e: Extract<StoryEvent, { type: 'line' }>,
    narr: boolean,
    speakerEmotion = 'composed',
    speakerChanged = false
  ): void {
    if (this.finished) return;
    if (!this.skip) void this.stage?.voice(e.lineId);
    this.namePlate.setVisible(!narr);
    if (!narr) {
      const a = this.actors.get(e.speaker);
      const left = !a || a.side === 'left';
      const label = this.currentMoodLabel ? `${e.speakerDisplay.toUpperCase()}  ·  ${this.currentMoodLabel}` : e.speakerDisplay.toUpperCase();
      this.nameText.setText(label);
      this.nameText.setColor(e.speaker === 'fadyme' ? '#e2d2ff' : T.gold);
      const targetX = left ? 365 : REF_W - 365;
      this.namePlate.setPosition(targetX, 756);
      if (speakerChanged && !prefs().reducedMotion && !this.skip) {
        this.tweens.killTweensOf(this.namePlate);
        this.namePlate.setY(764).setAlpha(0.5);
        this.tweens.add({
          targets: this.namePlate,
          y: 756,
          alpha: 1,
          duration: 240,
          ease: 'Cubic.easeOut'
        });
      } else {
        this.namePlate.setAlpha(1);
      }
    }

    if (!prefs().reducedMotion && !this.skip) {
      this.tweens.killTweensOf(this.bodyText);
      this.bodyText.setY(-52).setAlpha(0.18);
      this.tweens.add({
        targets: this.bodyText,
        y: -68,
        alpha: 1,
        duration: 280,
        ease: 'Cubic.easeOut'
      });

      this.tweens.killTweensOf(this.lineShimmer);
      this.lineShimmer.setPosition(-640, -104).setAlpha(0.75);
      this.tweens.add({
        targets: this.lineShimmer,
        x: 640,
        alpha: 0,
        duration: 700,
        ease: 'Cubic.easeOut'
      });

      if (this.actionBadge.text) {
        this.tweens.killTweensOf(this.actionBadge);
        this.actionBadge.setY(-90).setAlpha(0);
        this.tweens.add({
          targets: this.actionBadge,
          y: -96,
          alpha: 0.9,
          duration: 320,
          ease: 'Sine.easeOut'
        });
      }
    } else {
      this.bodyText.setY(-68).setAlpha(1);
    }

    const baseCps = this.skip ? 400 : this.cutscene ? CUTSCENE.cps : CPS[prefs().textSpeed];
    const cpsMult =
      speakerEmotion === 'protective' || speakerEmotion === 'determined'
        ? 1.18
        : speakerEmotion === 'soft_smile'
          ? 0.9
          : speakerEmotion === 'dry_amusement' || speakerEmotion === 'dry_humor'
            ? 1.06
            : 1.0;
    const cps = baseCps * cpsMult;
    const hasVoiceLine = Boolean(this.stage?.hasVoice(e.lineId));
    const voiceDur = this.stage?.voiceDuration(e.lineId) ?? 0;
    const schedule = buildSubtitleSchedule(this.fullText, this.skip ? 0 : voiceDur, cps);
    this.activeSchedule = schedule;
    this.typingStartedAt = this.time.now;

    if (this.skip) {
      let n = 0;
      this.typing = this.time.addEvent({
        delay: 12,
        loop: true,
        callback: () => {
          n += 6;
          this.bodyText.setText(this.fullText.slice(0, n));
          if (n >= this.fullText.length) this.finishTyping();
        }
      });
      return;
    }

    let shownCount = 0;
    this.typing = this.time.addEvent({
      delay: 28,
      loop: true,
      callback: () => {
        const elapsedMs = Math.max(0, this.time.now - this.typingStartedAt);
        const vp = this.stage?.voiceProgress(e.lineId);
        const liveSec = vp && vp.playing ? vp.currentTime : undefined;
        const { count, revealRatio, voiceRatio, done } = resolveSubtitleProgress(schedule, elapsedMs, liveSec);
        if (count > shownCount) {
          shownCount = count;
          this.bodyText.setText(this.fullText.slice(0, shownCount));
          if (shownCount % 3 === 0 && !narr && !hasVoiceLine) Sfx.tap();
        }
        const waveRatio = vp && vp.duration > 0 ? Math.max(voiceRatio, vp.ratio) : revealRatio;
        this.voiceSyncFill.setSize(760 * Math.min(1, waveRatio), 2);
        if (done || shownCount >= this.fullText.length) {
          this.finishTyping();
        }
      }
    });
  }

  private finishTyping(): void {
    const wasPausing = this.pausing;
    this.pausing = false;
    this.typing?.remove();
    this.typing = null;
    if (wasPausing && !this.skip && this.currentLine) {
      void this.stage?.voice(this.currentLine.lineId);
    }
    this.bodyText.setText(this.fullText).setY(-68).setAlpha(1);
    this.voiceSyncFill.setSize(760, 2);
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
    const voiceSeconds = line ? (this.stage?.voiceDuration(line.lineId) ?? 0) : 0;
    const last = line !== null && line.lineId === this.lastLineId;
    if (voiceSeconds > 0 && line) {
      const vp = this.stage?.voiceProgress(line.lineId);
      const elapsedSec =
        this.typingStartedAt > 0
          ? Math.max(0, (this.time.now - this.typingStartedAt) / 1000)
          : (this.activeSchedule?.totalRevealMs ?? 1200) / 1000;
      const spokenSec = vp && vp.currentTime > 0 ? Math.max(elapsedSec, vp.currentTime) : elapsedSec;
      const remainingVoiceSec = Math.max(0, voiceSeconds - spokenSec);
      const voiceSyncedHoldMs = Math.max(1050, (remainingVoiceSec + 0.72) * 1000);
      if (last && this.data0.closing_hold_seconds !== undefined) {
        return Math.max(voiceSyncedHoldMs, this.data0.closing_hold_seconds * 1000);
      }
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
    this.autoTimer?.remove();
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
      this.autoTimer?.remove();
      if (this.auto && this.lineDone && this.waiting && !this.pausing) this.autoTimer = this.time.delayedCall(this.autoHoldMs(), () => this.advance());
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
      this.typing?.remove();
      this.autoTimer?.remove();
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
