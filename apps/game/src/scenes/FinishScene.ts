import { Music } from '../audio/Music';
import { REF_W } from '../config';
import { PixiScene } from '../core/PixiScene';
import { advance } from '../entry/flow';
import { RANDOM_GAME_QUOTES, S } from '../entry/strings';
import { isInteractiveBrowser, loadEntry, nextStep } from '../entry/state';
import { confirmEntryComplete, syncEntry, watchEntrySaveState, type EntrySaveState } from '../entry/sync';
import { restartGame } from '../platform/native';
import { barFill } from '../patch/barFill';
import type { PatchStatus } from '../patch/PatchService';
import { Services } from '../services';
import { DomStage, type DomBar, type DomButton, type DomGroup, type DomText } from '../ui/domKit';
import { formatBytes } from '../ui/format';
import { errText, titleStyle } from '../ui/hubScreen';
import { backdrop, sceneFadeIn } from '../ui/pixiKit';
import { C, F, T } from '../ui/theme';
import { app } from '../core/app';

const MAIN_THEME_CUE = 'bgm_main_theme';

/**
 * Post-tutorial patch screen: opens when the background patch is still downloading/verifying after the third tutorial.
 * Plays the Main Theme, rotates canon quotes under the progress box, and restarts the client once the patch is ready.
 * Says truthfully where the entry progress is saved (R09).
 */
export class FinishScene extends PixiScene {
  private ui!: DomStage;
  private quoteTimer: { stop(): void } | null = null;
  private quoteIdx = 0;
  private restarting = false;
  private head!: DomText;
  private note!: DomText;
  private figures!: DomText;
  private saveLine!: DomText;
  private quote!: DomGroup;
  private quoteText!: DomText;
  private quoteSpeaker!: DomText;
  private bar!: DomBar;
  private action!: DomButton;
  private shown: 'waiting' | 'ready' | 'failed' | null = null;

  async create(): Promise<void> {
    const entry = loadEntry();
    if (!entry.prologue || entry.tutorials < 3) {
      advance(this, nextStep(entry));
      return;
    }
    const { art } = Services.ready();
    await Promise.all([art.ensureBoot(this).catch(() => undefined), art.loadMusic(this, MAIN_THEME_CUE).catch(() => undefined)]);
    if (!this.live) return;

    // the Main Theme plays while the patch downloads (again on the first touch when autoplay was blocked)
    const playTheme = (): void => {
      Music.resume();
      const m = art.music(MAIN_THEME_CUE);
      if (m) Music.play(m.key, m.loopStart, m.duration, 2.0);
    };
    playTheme();
    const canvas = app().canvas;
    canvas.addEventListener('pointerdown', playTheme);
    this.onClose(() => canvas.removeEventListener('pointerdown', playTheme));
    void backdrop(this, 'forest_whispering_ash').then((bg) => {
      if (!bg) return;
      bg.alpha = 0.38;
      bg.scale.set(bg.scale.x * 1.04);
    });

    this.ui = new DomStage(app().uiLayer);
    this.attachDom(this.ui.root);
    this.onClose(() => {
      this.quoteTimer?.stop();
      this.ui.destroy();
    });
    const cx = REF_W / 2;
    this.ui.panel(cx, 488, 1460, 584, 'hot');
    this.head = this.ui.text(cx, 265, '', titleStyle(50, T.gold)).setOrigin(0.5);
    this.note = this.ui.text(cx, 340, '', { fontSize: 34, color: T.text, align: 'center', wordWrap: { width: 1200 }, lineSpacing: 8 }).setOrigin(0.5, 0);
    this.note.el.setAttribute('aria-live', 'polite');
    this.bar = this.ui.bar(cx, 516, 1080, 28, () => C.goldHi);
    this.figures = this.ui.text(cx, 558, '', { fontSize: 28, color: T.dim }).setOrigin(0.5, 0);
    this.saveLine = this.ui.text(cx, 604, '', { fontSize: 24, color: T.dim }).setOrigin(0.5, 0);
    this.saveLine.el.setAttribute('aria-live', 'polite');
    this.action = this.ui.button(cx, 700, { label: S.finish.restart, w: 700, h: 112, fontSize: 34, variant: 'hot', onClick: () => void this.onAction() }).setVisible(false);

    // canon quotes under the box
    const rule = this.ui.group();
    this.ui.box(cx - 420, 815, 402, 1.5, C.gold, 0.45, rule);
    this.ui.box(cx + 18, 815, 402, 1.5, C.gold, 0.45, rule);
    this.ui.box(cx - 7, 809, 14, 14, C.goldHi, 0.85, rule).el.style.rotate = '45deg';
    this.quote = this.ui.group();
    this.quote.el.style.transition = 'opacity .42s ease-in-out';
    this.quoteIdx = Math.floor(Math.random() * RANDOM_GAME_QUOTES.length);
    const first = RANDOM_GAME_QUOTES[this.quoteIdx]!;
    this.quoteText = this.ui.text(cx, 842, first.quote, { fontFamily: F.body, fontSize: 36, fontStyle: 'italic 500', color: '#efe8f5', align: 'center', wordWrap: { width: 1420 }, stroke: '#05030a', strokeThickness: 4 }, this.quote).setOrigin(0.5, 0);
    this.quoteSpeaker = this.ui.text(cx, 932, `—  ${first.speaker}`, { fontFamily: F.display, fontSize: 22, fontStyle: '600', color: T.gold, letterSpacing: 3 }, this.quote).setOrigin(0.5, 0);
    const rotate = (): void => {
      this.quoteTimer = this.anim.after(4200, () => {
        this.cycleQuote();
        rotate();
      });
    };
    rotate();

    if (Services.patches.get().kind === 'idle') void Services.patches.start();
    this.onClose(Services.patches.subscribe((s) => this.render(s)));
    // R09: say truthfully where the entry progress is saved; re-push anything a tutorial step could not send
    this.onClose(watchEntrySaveState((st) => this.renderSave(st)));
    if (Services.api.signedIn) void syncEntry(Services.api);
    sceneFadeIn(this, 1300);
  }

  override notify(message: string, ms = 2600): void {
    if (this.live) this.ui.toast(message, ms);
  }

  private renderSave(st: EntrySaveState): void {
    if (!this.saveLine?.active) return;
    const [text, color] = !Services.api.signedIn
      ? ['Progress is saved on this device only. Sign in to keep it on your account.', T.dim]
      : st === 'confirmed'
        ? ['✓ Progress saved to your account', T.heal]
        : st === 'failed'
          ? ['Not saved to your account yet — it is kept on this device and will be sent again', T.crimson]
          : ['Saving progress to your account…', T.dim];
    this.saveLine.setText(text).setColor(color);
  }

  private cycleQuote(): void {
    if (!this.quoteText?.active) return;
    this.quoteIdx = (this.quoteIdx + 1) % RANDOM_GAME_QUOTES.length;
    const next = RANDOM_GAME_QUOTES[this.quoteIdx]!;
    this.quote.setAlpha(0);
    this.anim.after(420, () => {
      if (!this.quoteText.active) return;
      this.quoteText.setText(next.quote);
      this.quoteSpeaker.setText(`—  ${next.speaker}`);
      this.quote.setAlpha(1);
    });
  }

  private render(s: PatchStatus): void {
    if (this.restarting || !this.head?.active) return;
    const previewHold = new URLSearchParams(window.location.search).get('preview_scene') === 'finish_wait';
    if (s.kind === 'ready') {
      if (this.shown === 'ready') return;
      this.shown = 'ready';
      this.head.setText(S.finish.readyTitle);
      this.note.setText(S.finish.readyBody);
      this.bar.set(1);
      this.bar.setVisible(true);
      this.figures.setText('100 %   ·   READY');
      if (isInteractiveBrowser() && !previewHold) {
        this.action.setVisible(true).setLabel(S.finish.restarting).setEnabled(false);
        void this.triggerAutoRestart();
      } else {
        this.action.setVisible(true).setLabel(S.finish.restart).setEnabled(true);
      }
      return;
    }
    if (s.kind === 'failed') {
      this.shown = 'failed';
      this.head.setText(S.finish.waitingTitle);
      this.note.setText(s.updateRequired ? S.patch.updateRequired : s.requiresNetworkApproval ? 'Downloads are paused on this data-saving connection.' : `${S.finish.failedBody}\n${s.detail.slice(0, 180)}`);
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
    this.figures.setText(p && p.bytesTotal > 0 && p.phase === 'downloading' ? `${Math.floor((frac ?? 0) * 100)} %   ·   ${formatBytes(p.bytesDone)} / ${formatBytes(p.bytesTotal)}` : p ? S.patch[p.phase] : S.patch.checking);
  }

  private async triggerAutoRestart(): Promise<void> {
    if (this.restarting) return;
    this.restarting = true;
    this.action.setLabel(Services.api.signedIn ? 'SAVING TO ACCOUNT…' : S.finish.restarting).setEnabled(false);
    try {
      await confirmEntryComplete(Services.api);
    } catch (e) {
      if (!this.live) return;
      this.restarting = false;
      this.note.setText(`${S.finish.readyBody}\n\nCould not confirm your entry checkpoint on the server: ${errText(e)}`);
      this.action.setVisible(true).setLabel('RETRY SAVE & RESTART').setEnabled(true);
      return;
    }
    if (!this.live) return;
    this.note.setText(S.finish.readyBody);
    this.action.setLabel(S.finish.restarting).setEnabled(false);
    if (isInteractiveBrowser()) await this.fadeOut(1300, 0x000000);
    else await this.anim.wait(450);
    try {
      await restartGame();
    } catch (e) {
      if (!this.live) return;
      this.restarting = false;
      if (isInteractiveBrowser()) this.fadeIn(400, 0x000000);
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
    if (this.shown === 'ready') await this.triggerAutoRestart();
  }
}

