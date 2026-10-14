import Phaser from 'phaser';
import { REF_H, REF_W } from '../config';
import { S } from '../entry/strings';
import { markCompleted } from '../entry/state';
import { recordEntry } from '../entry/sync';
import { restartGame } from '../platform/native';
import { barFill } from '../patch/barFill';
import type { PatchStatus } from '../patch/PatchService';
import { Services } from '../services';
import { formatBytes } from '../ui/format';
import { Bar, Button, panel, sceneFadeIn, title, txt } from '../ui/kit';
import { C, T } from '../ui/theme';

/**
 * The end of the first-install flow. Either the download is still running (the last story dissolves into this page, with progress and
 * a retry path) or it has finished (confirmation + RESTART & ENTER GAME). There is no automatic jump into the game: the restart is the
 * player's press, and pressing it any number of times requests exactly one restart.
 */
export class FinishScene extends Phaser.Scene {
  private unsub: (() => void) | null = null;
  private restarting = false;
  private head!: Phaser.GameObjects.Text;
  private note!: Phaser.GameObjects.Text;
  private figures!: Phaser.GameObjects.Text;
  private bar!: Bar;
  private action!: Button;
  private shown: 'waiting' | 'ready' | 'failed' | null = null;

  constructor() {
    super('Finish');
  }

  async create(): Promise<void> {
    this.restarting = false;
    this.shown = null;
    const { art } = Services.ready();
    await art.ensureBoot(this).catch(() => undefined);
    if (!this.sys.isActive()) return;
    this.cameras.main.setBackgroundColor(0x0a0610);
    try {
      const bg = this.add.image(REF_W / 2, REF_H / 2, art.background('forest_whispering_ash')).setAlpha(0.35);
      bg.setScale(Math.max(REF_W / bg.width, REF_H / bg.height));
    } catch {
      /* the backdrop is decoration only */
    }
    panel(this, REF_W / 2, REF_H / 2, 1380, 600, 'hot');
    this.head = title(this, REF_W / 2, 360, '', 54, T.gold);
    this.note = txt(this, REF_W / 2, 450, '', { fontSize: '36px', color: T.text, align: 'center', wordWrap: { width: 1160 }, lineSpacing: 8 }).setOrigin(0.5, 0);
    this.bar = new Bar(this, REF_W / 2, 600, 1000, 26, () => C.goldHi);
    this.figures = txt(this, REF_W / 2, 650, '', { fontSize: '32px', color: T.dim }).setOrigin(0.5, 0);
    this.action = new Button(this, REF_W / 2, 700, { label: S.finish.restart, w: 700, h: 128, fontSize: 40, variant: 'hot', onClick: () => void this.onAction() });
    this.action.setVisible(false);
    void Services.patches.start(); // a no-op while it runs or when it has finished; covers a player who resumed straight at this step
    this.unsub = Services.patches.subscribe((s) => this.render(s));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsub?.());
    sceneFadeIn(this, 900);
  }

  private render(s: PatchStatus): void {
    if (this.restarting || !this.head.active) return;
    if (s.kind === 'ready') {
      if (this.shown !== 'ready') {
        this.shown = 'ready';
        this.head.setText(S.finish.readyTitle);
        this.note.setText(S.finish.readyBody);
        this.bar.set(1);
        this.bar.setVisible(false);
        this.figures.setText('');
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

  private async onAction(): Promise<void> {
    if (this.restarting) return;
    if (this.shown === 'waiting') { Services.patches.cancel(); return; }
    if (this.shown === 'failed') {
      const state = Services.patches.get();
      void Services.patches.retry(state.kind === 'failed' && state.requiresNetworkApproval ? { allowMetered: true } : {});
      return;
    }
    if (this.shown !== 'ready') return;
    this.restarting = true; // one restart however many presses
    this.action.setLabel(S.finish.restarting).setEnabled(false);
    // the entry flow is complete: remember it on the device at once and on the account when reachable (a short wait, never a blocker)
    recordEntry(Services.api, (st) => markCompleted(st));
    await new Promise<void>((r) => this.time.delayedCall(450, () => r()));
    await restartGame();
  }
}
