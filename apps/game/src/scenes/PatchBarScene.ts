import Phaser from '../engine';
import { REF_H, REF_W } from '../config';
import { S } from '../entry/strings';
import { loadEntry } from '../entry/state';
import { restartGame } from '../platform/native';
import { prefs } from '../platform/prefs';
import { Services } from '../services';
import { barFill } from '../patch/barFill';
import type { PatchStatus } from '../patch/PatchService';
import { formatBytes } from '../ui/format';
import { txt } from '../ui/kit';
import { C, DEPTH, F, T } from '../ui/theme';

const BAR_H = 10;
const STRIP_H = 110;

/**
 * The download strip along the bottom edge of every screen while the first-install patch is downloading. Registered last, so it
 * sits above whatever scene is running; it never takes input except to retry a failed download. Hidden when idle or ready.
 */
export class PatchBarScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private fill!: Phaser.GameObjects.Rectangle;
  private shimmer!: Phaser.GameObjects.Rectangle;
  private left!: Phaser.GameObjects.Text;
  private right!: Phaser.GameObjects.Text;
  private retryZone!: Phaser.GameObjects.Zone;
  private unsub: (() => void) | null = null;
  private shownAlpha = 0;
  private restarting = false;

  constructor() {
    super('PatchBar');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    const strip = this.add.graphics();
    strip.fillGradientStyle(0x05030a, 0x05030a, 0x05030a, 0x05030a, 0, 0, 0.82, 0.82);
    strip.fillRect(0, REF_H - STRIP_H, REF_W, STRIP_H);
    const track = this.add.rectangle(0, REF_H - BAR_H, REF_W, BAR_H, C.ink, 0.9).setOrigin(0, 0);
    this.fill = this.add.rectangle(0, REF_H - BAR_H, 0, BAR_H, C.goldHi, 1).setOrigin(0, 0);
    this.shimmer = this.add.rectangle(0, REF_H - BAR_H, 360, BAR_H, C.silver, 0.85).setOrigin(0, 0).setVisible(false);
    this.left = txt(this, 44, REF_H - 55, '', { fontFamily: F.body, fontSize: '28px', fontStyle: '500', color: T.dim }).setOrigin(0, 0.5);
    this.right = txt(this, REF_W - 44, REF_H - 55, '', { fontFamily: F.body, fontSize: '28px', fontStyle: '500', color: T.dim }).setOrigin(1, 0.5);
    this.retryZone = this.add.zone(REF_W / 2, REF_H - 55, REF_W, 110).setInteractive({ useHandCursor: true });
    this.retryZone.input!.enabled = false;
    this.retryZone.on('pointerup', () => { const state = Services.patches.get(); if (state.kind === 'ready' && state.outcome.status === 'staged' && loadEntry().phase === 'completed' && !this.restarting) { this.restarting = true; void restartGame().catch(() => { this.restarting = false; }); } else if (state.kind === 'running') Services.patches.cancel(); else if (state.kind === 'failed') void Services.patches.retry(state.requiresNetworkApproval ? { allowMetered: true } : {}); });
    this.root = this.add.container(0, 0, [strip, track, this.fill, this.shimmer, this.left, this.right, this.retryZone]).setDepth(DEPTH.toast + 100).setAlpha(0);
    if (!prefs().reducedMotion) this.tweens.add({ targets: this.shimmer, x: { from: -360, to: REF_W }, duration: 1500, repeat: -1, ease: 'Sine.easeInOut' });

    this.unsub = Services.patches.subscribe((s) => this.render(s));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsub?.());
  }

  private show(on: boolean): void {
    const target = on ? 1 : 0;
    if (this.shownAlpha === target) return;
    this.shownAlpha = target;
    this.tweens.add({ targets: this.root, alpha: target, duration: on ? 350 : 700, ease: 'Sine.easeInOut' });
  }

  private render(s: PatchStatus): void {
    if (!this.root) return;
    if (s.kind === 'ready' && s.outcome.status === 'staged' && loadEntry().phase === 'completed') {
      this.show(true); this.retryZone.input!.enabled = true; this.shimmer.setVisible(false); this.fill.setFillStyle(C.goldHi).setSize(REF_W, BAR_H); this.left.setText('Content ready · tap to restart and apply').setColor(T.gold).setOrigin(0.5).setX(REF_W / 2); this.right.setText(''); return;
    }
    if (s.kind === 'idle' || s.kind === 'ready') {
      this.retryZone.input!.enabled = false;
      this.show(false);
      return;
    }
    this.show(true);
    if (s.kind === 'failed') {
      this.retryZone.input!.enabled = !s.updateRequired;
      this.fill.setFillStyle(C.crimsonHi, 1).setSize(REF_W, BAR_H);
      this.shimmer.setVisible(false);
      this.left.setText(s.updateRequired ? S.patch.updateRequired : s.requiresNetworkApproval ? 'Downloads paused · tap to use mobile data' : S.patch.failed).setColor(T.crimson).setOrigin(0.5, 0.5).setX(REF_W / 2);
      this.right.setText('');
      return;
    }
    this.retryZone.input!.enabled = true;
    this.left.setColor(T.dim).setOrigin(0, 0.5).setX(44);
    this.fill.setFillStyle(C.goldHi, 1);
    const p = s.progress;
    this.left.setText(`${p ? S.patch[p.phase] : S.patch.checking} · tap to pause`);
    const frac = barFill(s);
    this.shimmer.setVisible(frac === null && !prefs().reducedMotion);
    this.fill.setSize(frac === null ? 0 : Math.round(REF_W * frac), BAR_H);
    this.right.setText(p && p.bytesTotal > 0 && p.phase === 'downloading' ? `${Math.floor((frac ?? 0) * 100)} %   ·   ${formatBytes(p.bytesDone)} / ${formatBytes(p.bytesTotal)}` : '');
  }
}
