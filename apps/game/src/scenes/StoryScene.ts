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
  private illustration: Phaser.GameObjects.Image | null = null;

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
    this.illustration = null;
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
      const hasStill = Boolean(this.data0.illustration_id && art.art.stills[this.data0.illustration_id]);
      await Promise.all([
        ...[...locations].map((id) => art.loadBackground(this, id)),
        this.data0.illustration_id ? art.loadStills(this, [this.data0.illustration_id]).catch(() => undefined) : Promise.resolve(),
        hasStill ? Promise.resolve() : art.loadPortraits(this, [...chars], charEmotions),
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
    sceneFadeIn(this, 500);
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
    this.bg.setScale(cover * 1.02);
    if (!prefs().reducedMotion) this.tweens.add({ targets: this.bg, scale: cover * 1.08, duration: 40000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    // a shared illustration (roadside_rest, shelter_evening) replaces the backdrop and the portraits for the whole scene when the content ships it
    const illustrationKey = this.data0.illustration_id ? art.still(this.data0.illustration_id) : null;
    if (illustrationKey) {
      this.illustration = this.add.image(REF_W / 2, REF_H / 2, illustrationKey).setDepth(DEPTH.bg + 1);
      const illCover = Math.max(REF_W / this.illustration.width, REF_H / this.illustration.height);
      this.illustration.setScale(illCover * 1.01);
      if (!prefs().reducedMotion) {
        this.tweens.add({ targets: this.illustration, scale: illCover * 1.05, duration: 36000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
      }
      this.bg.setAlpha(0);
    }

    // Grade the world below the HUD so dialogue and reader controls keep their contrast.
    const shade = this.add.graphics().setDepth(DEPTH.bg + 5);
    shade.fillGradientStyle(0x0a0610, 0x0a0610, 0x0a0610, 0x0a0610, 0.05, 0.05, 0.7, 0.7);
    shade.fillRect(0, 0, REF_W, REF_H);

    // tap anywhere to advance; buttons sit above this zone
    const zone = this.add.zone(REF_W / 2, REF_H / 2, REF_W, REF_H).setDepth(DEPTH.hud - 10).setInteractive();
    zone.on('pointerup', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());

    const insets = safeInsets(this);
    const panelBg = panel(this, 0, 0, 1640, 250, 'normal');
    this.nameText = txt(this, 0, 0, '', { fontFamily: F.display, fontSize: '36px', fontStyle: '600', color: T.gold, stroke: '#0a0610', strokeThickness: 4 }).setOrigin(0.5);
    const plateBg = panel(this, 0, 0, 380, 72, 'hot');
    this.namePlate = this.add.container(0, 0, [plateBg, this.nameText]).setDepth(DEPTH.hud + 2).setVisible(false);
    this.bodyText = txt(this, -770, -88, '', { fontSize: '40px', color: T.text, lineSpacing: 6, wordWrap: { width: 1540 } });
    this.caret = txt(this, 770, 86, '▼', { fontSize: '32px', color: T.gold }).setOrigin(1, 0.5).setVisible(false);
    this.box = this.add.container(REF_W / 2, 902 - insets.bottom, [panelBg, this.bodyText, this.caret]).setDepth(DEPTH.hud);

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
        // single-location scenes today; a location swap cross-fades the background
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
          this.cameras.main.fadeOut(e.seconds * 1000, 10, 6, 16);
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
    this.time.delayedCall(450, () => this.init0.onDone(this));
  }

  // ------------------------------------------------------------------ actors

  private showActor(character: string, side: 'left' | 'right', emotion = 'composed', immediate = false): void {
    if (this.illustration) return; // the illustration carries the characters
    const { art } = Services.ready();
    const key = art.portrait(character, emotion) ?? art.portrait(character, 'composed');
    if (!key) return;
    const existing = this.actors.get(character);
    if (existing) {
      existing.image.destroy();
      this.actors.delete(character);
    }
    const x = side === 'left' ? 500 : REF_W - 500;
    const img = this.add.image(immediate ? x : x + (side === 'left' ? -80 : 80), REF_H + 30, key).setOrigin(0.5, 1).setDepth(DEPTH.world).setAlpha(immediate ? 0.72 : 0);
    const k = 980 / img.height;
    img.setScale(k);
    if (side === 'left') img.setFlipX(false);
    this.actors.set(character, { side, image: img, emotion });
    if (!immediate) {
      this.tweens.add({ targets: img, x, alpha: 0.72, duration: prefs().reducedMotion ? 1 : 700, ease: 'Cubic.easeOut' });
    }
  }


  private hideActor(character: string): void {
    const a = this.actors.get(character);
    if (!a) return;
    this.actors.delete(character);
    this.tweens.add({ targets: a.image, alpha: 0, duration: 300, onComplete: () => a.image.destroy() });
  }

  private focusSpeaker(speaker: string, emotion?: string, ms = 220): void {
    const { art } = Services.ready();
    for (const [id, a] of this.actors) {
      const active = id === speaker;
      if (active && emotion && a.emotion !== emotion) {
        const key = art.portrait(id, emotion);
        if (key && key !== a.image.texture.key) {
          a.emotion = emotion;
          this.tweens.add({
            targets: a.image,
            alpha: 0.35,
            duration: 90,
            yoyo: true,
            onYoyo: () => a.image.setTexture(key).setScale(980 / a.image.height)
          });
        }
      }
      a.image.setDepth(active ? DEPTH.world + 2 : DEPTH.world);
      this.tweens.add({ targets: a.image, alpha: active ? 1 : 0.72, duration: ms });
      a.image.setTint(active ? 0xffffff : 0xa89fb6);
      this.tweens.add({ targets: a.image, y: REF_H + (active ? 18 : 40), duration: Math.max(260, ms), ease: 'Sine.easeOut' });
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
    // a speaker change dissolves the portrait focus over 0.8 s (inside the 1 s pause); the same speaker continuing only waits
    this.focusSpeaker(narr ? '' : e.speaker, e.emotion, pause > CUTSCENE.sameSpeakerPauseSeconds ? CUTSCENE.dissolveSeconds * 1000 : 220);
    this.namePlate.setVisible(false);
    this.bodyText.setStyle({ fontStyle: narr ? 'italic' : 'normal', color: narr ? '#cfc4dd' : T.text });
    this.fullText = this.bodyText.getWrappedText(this.stage?.text(e.lineId, e.text) ?? e.text).join('\n');
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
