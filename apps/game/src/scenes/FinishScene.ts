import Phaser from '../engine';
import { Music } from '../audio/Music';
import { REF_H, REF_W } from '../config';
import { advance } from '../entry/flow';
import { RANDOM_GAME_QUOTES, S } from '../entry/strings';
import { isInteractiveBrowser, loadEntry, nextStep } from '../entry/state';
import { confirmEntryComplete } from '../entry/sync';
import { restartGame } from '../platform/native';
import { barFill } from '../patch/barFill';
import type { PatchStatus } from '../patch/PatchService';
import { Services } from '../services';
import { formatBytes } from '../ui/format';
import { errText } from '../ui/hub';
import { Bar, Button, panel, sceneFadeIn, title, txt } from '../ui/kit';
import { C, F, T } from '../ui/theme';

const MAIN_THEME_CUE = 'bgm_main_theme';

/**
 * Post-tutorial Patch Screen. Opens when the background patch is still downloading/verifying after the 3-part tutorial finishes.
 * Plays the Main Theme music, displays a rotating carousel of iconic game quotes beneath the progress box so the player is never bored,
 * and automatically fades to black and restarts the client the moment the patch completes.
 */
export class FinishScene extends Phaser.Scene {
  private unsub: (() => void) | null = null;
  private quoteTimer: Phaser.Time.TimerEvent | null = null;
  private quoteIdx = 0;
  private restarting = false;
  private head!: Phaser.GameObjects.Text;
  private note!: Phaser.GameObjects.Text;
  private figures!: Phaser.GameObjects.Text;
  private quoteText!: Phaser.GameObjects.Text;
  private quoteSpeaker!: Phaser.GameObjects.Text;
  private bar!: Bar;
  private action!: Button;
  private shown: 'waiting' | 'ready' | 'failed' | null = null;

  constructor() {
    super('Finish');
  }

  async create(): Promise<void> {
    this.restarting = false;
    this.shown = null;
    const entry = loadEntry();
    if (!entry.prologue || entry.tutorials < 3) {
      advance(this, nextStep(entry));
      return;
    }
    const { art } = Services.ready();
    await Promise.all([
      art.ensureBoot(this).catch(() => undefined),
      art.loadMusic(this, MAIN_THEME_CUE).catch(() => undefined)
    ]);
    if (!this.sys.isActive()) return;
    this.cameras.main.setBackgroundColor(0x0a0610);

    // Play the Main Theme while the patch downloads
    const m = art.music(MAIN_THEME_CUE);
    if (m) Music.play(this.cache.audio, m.key, m.loopStart, m.duration, 2.0);

    try {
      const bg = this.add.image(REF_W / 2, REF_H / 2, art.background('forest_whispering_ash')).setAlpha(0.38);
      bg.setScale(Math.max(REF_W / bg.width, REF_H / bg.height) * 1.04);
    } catch {
      /* the backdrop is decoration only */
    }

    // Center Patch Box
    panel(this, REF_W / 2, 480, 1460, 560, 'hot');
    this.head = title(this, REF_W / 2, 265, '', 50, T.gold);
    this.note = txt(this, REF_W / 2, 340, '', {
      fontSize: '34px',
      color: T.text,
      align: 'center',
      wordWrap: { width: 1200 },
      lineSpacing: 8
    }).setOrigin(0.5, 0);
    this.bar = new Bar(this, REF_W / 2, 520, 1080, 28, () => C.goldHi);
    this.figures = txt(this, REF_W / 2, 560, '', { fontSize: '28px', color: T.dim }).setOrigin(0.5, 0);
    this.action = new Button(this, REF_W / 2, 700, {
      label: S.finish.restart,
      w: 700,
      h: 112,
      fontSize: 34,
      variant: 'hot',
      onClick: () => void this.onAction()
    });
    this.action.setVisible(false);

    // Rotating random game quotes beneath the Patch Box
    const quoteRule = this.add.graphics();
    quoteRule.lineStyle(1.5, C.gold, 0.45);
    quoteRule.lineBetween(REF_W / 2 - 420, 800, REF_W / 2 - 18, 800);
    quoteRule.lineBetween(REF_W / 2 + 18, 800, REF_W / 2 + 420, 800);
    quoteRule.fillStyle(C.goldHi, 0.85);
    quoteRule.fillPoints(
      [
        new Phaser.Math.Vector2(REF_W / 2, 793),
        new Phaser.Math.Vector2(REF_W / 2 + 7, 800),
        new Phaser.Math.Vector2(REF_W / 2, 807),
        new Phaser.Math.Vector2(REF_W / 2 - 7, 800)
      ],
      true
    );

    this.quoteIdx = Math.floor(Math.random() * RANDOM_GAME_QUOTES.length);
    const firstQ = RANDOM_GAME_QUOTES[this.quoteIdx]!;
    this.quoteText = txt(this, REF_W / 2, 830, firstQ.quote, {
      fontFamily: F.body,
      fontSize: '36px',
      fontStyle: 'italic 500',
      color: '#efe8f5',
      align: 'center',
      wordWrap: { width: 1420 },
      stroke: '#05030a',
      strokeThickness: 4
    }).setOrigin(0.5, 0);
    this.quoteSpeaker = txt(this, REF_W / 2, 920, `—  ${firstQ.speaker}`, {
      fontFamily: F.display,
      fontSize: '22px',
      fontStyle: '600',
      color: T.gold
    })
      .setOrigin(0.5, 0)
      .setLetterSpacing(3);

    this.quoteTimer = this.time.addEvent({
      delay: 4200,
      loop: true,
      callback: () => this.cycleQuote()
    });

    if (Services.patches.get().kind === 'idle') void Services.patches.start();
    this.unsub = Services.patches.subscribe((s) => this.render(s));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsub?.();
      this.quoteTimer?.remove(false);
    });
    sceneFadeIn(this, 1300);
  }

  private cycleQuote(): void {
    if (!this.quoteText?.active || !this.quoteSpeaker?.active) return;
    this.quoteIdx = (this.quoteIdx + 1) % RANDOM_GAME_QUOTES.length;
    const nextQ = RANDOM_GAME_QUOTES[this.quoteIdx]!;
    this.tweens.add({
      targets: [this.quoteText, this.quoteSpeaker],
      alpha: 0,
      duration: 420,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!this.quoteText?.active) return;
        this.quoteText.setText(nextQ.quote);
        this.quoteSpeaker.setText(`—  ${nextQ.speaker}`);
        this.tweens.add({
          targets: [this.quoteText, this.quoteSpeaker],
          alpha: 1,
          duration: 520,
          ease: 'Sine.easeInOut'
        });
      }
    });
  }

  private render(s: PatchStatus): void {
    if (this.restarting || !this.head.active) return;
    if (s.kind === 'ready') {
      if (this.shown !== 'ready') {
        this.shown = 'ready';
        this.head.setText(S.finish.readyTitle);
        this.note.setText(S.finish.readyBody);
        this.bar.set(1);
        this.bar.setVisible(true);
        this.figures.setText('100 %   ·   READY');
        if (isInteractiveBrowser()) {
          this.action.setVisible(true).setLabel(S.finish.restarting).setEnabled(false);
          void this.triggerAutoRestart();
        } else {
          this.action.setVisible(true).setLabel(S.finish.restart).setEnabled(true);
        }
      }
      return;
    }
    if (s.kind === 'failed') {
      this.shown = 'failed';
      this.head.setText(S.finish.waitingTitle);
      this.note.setText(
        s.updateRequired
          ? S.patch.updateRequired
          : s.requiresNetworkApproval
            ? 'Downloads are paused on this data-saving connection.'
            : `${S.finish.failedBody}\n${s.detail.slice(0, 180)}`
      );
      this.bar.setVisible(false);
      this.figures.setText('');
      this.action.setVisible(!s.updateRequired).setLabel(s.requiresNetworkApproval ? 'USE MOBILE DATA' : S.finish.retry).setEnabled(true);
      return;
    }
    this.shown = 'waiting';
    this.head.setText(S.finish.waitingTitle);
    this.note.setText(S.finish.waitingBody);
    this.action.setVisible(true).setLabel('PAUSE DOWNLOAD').setEnabled(true);
    this.bar.setVisible(true);
    const frac = barFill(s);
    this.bar.set(frac ?? 0);
    const p = s.kind === 'running' ? s.progress : null;
    this.figures.setText(
      p && p.bytesTotal > 0 && p.phase === 'downloading'
        ? `${Math.floor((frac ?? 0) * 100)} %   ·   ${formatBytes(p.bytesDone)} / ${formatBytes(p.bytesTotal)}`
        : p
          ? S.patch[p.phase]
          : S.patch.checking
    );
  }

  private async triggerAutoRestart(): Promise<void> {
    if (this.restarting) return;
    this.restarting = true;
    this.action.setLabel(Services.api.signedIn ? 'SAVING TO ACCOUNT…' : S.finish.restarting).setEnabled(false);
    try {
      await confirmEntryComplete(Services.api);
    } catch (e) {
      if (!this.sys.isActive()) return;
      this.restarting = false;
      this.note.setText(`${S.finish.readyBody}\n\nCould not confirm your entry checkpoint on the server: ${errText(e)}`);
      this.action.setVisible(true).setLabel('RETRY SAVE & RESTART').setEnabled(true);
      return;
    }
    if (!this.sys.isActive()) return;
    this.note.setText(S.finish.readyBody);
    this.action.setLabel(S.finish.restarting).setEnabled(false);
    if (isInteractiveBrowser()) {
      this.cameras.main.fadeOut(1300, 0, 0, 0);
      await new Promise<void>((r) => this.time.delayedCall(1350, () => r()));
    } else {
      await new Promise<void>((r) => this.time.delayedCall(450, () => r()));
    }
    try {
      await restartGame();
    } catch (e) {
      if (!this.sys.isActive()) return;
      this.restarting = false;
      if (isInteractiveBrowser()) this.cameras.main.fadeIn(400, 0, 0, 0);
      this.note.setText(`${S.finish.readyBody}\n\nCheckpoint saved, but the automatic restart could not complete: ${errText(e)}`);
      this.action.setVisible(true).setLabel('RETRY RESTART').setEnabled(true);
    }
  }

  private async onAction(): Promise<void> {
    if (this.restarting) return;
    if (this.shown === 'waiting') {
      Services.patches.cancel();
      return;
    }
    if (this.shown === 'failed') {
      const state = Services.patches.get();
      void Services.patches.retry(state.kind === 'failed' && state.requiresNetworkApproval ? { allowMetered: true } : {});
      return;
    }
    if (this.shown !== 'ready') return;
    await this.triggerAutoRestart();
  }
}


