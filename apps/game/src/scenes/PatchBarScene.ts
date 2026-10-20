import { REF_H, REF_W } from '../config';
import { PixiScene } from '../core/PixiScene';
import { S } from '../entry/strings';
import { loadEntry } from '../entry/state';
import { restartGame } from '../platform/native';
import { prefs } from '../platform/prefs';
import { Services } from '../services';
import { barFill } from '../patch/barFill';
import type { PatchStatus } from '../patch/PatchService';
import { DomStage, type DomBox, type DomButton, type DomGroup, type DomText } from '../ui/domKit';
import { formatBytes } from '../ui/format';
import { C, F, T } from '../ui/theme';
import { app } from '../core/app';

const BAR_H = 10;
const STRIP_H = 110;
/** screens whose own controls sit along the bottom edge: the strip never takes their taps (a skill tap must not pause or restart) */
const GAMEPLAY = ['Battle', 'Story', 'Prologue'];

/**
 * The download strip along the bottom edge of every screen while the first-install patch downloads. An HTML overlay
 * above every scene (canvas and HTML); it only takes input to pause, retry or apply. Hidden when idle or ready.
 */
export class PatchBarScene extends PixiScene {
  private ui!: DomStage;
  private strip!: DomGroup;
  private fill!: DomBox;
  private shimmer!: DomBox;
  private left!: DomText;
  private right!: DomText;
  private action!: DomButton;
  private shown = false;
  private restarting = false;
  /** the strip offers pause/retry/restart; shown only while no gameplay screen is up */
  private wantAction = false;

  constructor() {
    super(null);
  }

  create(): void {
    // above every screen's own HTML layer
    this.ui = new DomStage(app().uiLayer, 50);
    this.attachDom(this.ui.root);
    this.onClose(() => this.ui.destroy());
    const g = (this.strip = this.ui.group());
    g.el.style.transition = 'opacity .35s ease-in-out';
    g.setAlpha(0);
    const shade = this.ui.box(0, REF_H - STRIP_H, REF_W, STRIP_H, 0x05030a, 1, g);
    shade.el.style.background = 'linear-gradient(rgba(5,3,10,0), rgba(5,3,10,.82))';
    this.ui.box(0, REF_H - BAR_H, REF_W, BAR_H, C.ink, 0.9, g);
    this.fill = this.ui.box(0, REF_H - BAR_H, 0, BAR_H, C.goldHi, 1, g);
    this.shimmer = this.ui.box(0, REF_H - BAR_H, 360, BAR_H, C.silver, 0.85, g).setVisible(false);
    if (!prefs().reducedMotion) {
      this.shimmer.el.animate([{ transform: 'translateX(-360px)' }, { transform: `translateX(${REF_W}px)` }], { duration: 1500, iterations: Infinity, easing: 'ease-in-out' });
    }
    this.left = this.ui.text(44, REF_H - 55, '', { fontFamily: F.body, fontSize: 28, fontStyle: '500', color: T.dim }, g).setOrigin(0, 0.5);
    this.right = this.ui.text(REF_W - 44, REF_H - 55, '', { fontFamily: F.body, fontSize: 28, fontStyle: '500', color: T.dim }, g).setOrigin(1, 0.5);
    // the strip itself is the button: pause a download, retry a failed one, or restart into staged content
    this.action = this.ui.button(REF_W / 2, REF_H - 55, { label: 'DOWNLOAD', bare: true, w: REF_W, h: STRIP_H, onClick: () => this.act() }, g).setVisible(false);
    this.left.el.setAttribute('aria-live', 'polite');
    this.onClose(Services.patches.subscribe((s) => this.render(s)));
    this.onTick(() => this.syncAction());
  }

  private syncAction(): void {
    this.action?.setVisible(this.wantAction && !GAMEPLAY.some((k) => this.nav.isActive(k)));
  }

  private act(): void {
    if (GAMEPLAY.some((k) => this.nav.isActive(k))) return;
    const state = Services.patches.get();
    if (state.kind === 'ready' && state.outcome.status === 'staged' && loadEntry().phase === 'completed' && !this.restarting) {
      this.restarting = true;
      void restartGame().catch(() => (this.restarting = false));
    } else if (state.kind === 'running') Services.patches.cancel();
    else if (state.kind === 'failed') void Services.patches.retry(state.requiresNetworkApproval ? { allowMetered: true } : {});
  }

  private show(on: boolean): void {
    if (this.shown === on) return;
    this.shown = on;
    this.strip.el.style.transitionDuration = on ? '.35s' : '.7s';
    this.strip.setAlpha(on ? 1 : 0);
  }

  private setFill(color: number, w: number): void {
    this.fill.setFill(color, 1).setSize(w, BAR_H);
  }

  private say(left: string, color: string, centered: boolean, right = '', action = ''): void {
    this.left.setText(left).setColor(color).setOrigin(centered ? 0.5 : 0, 0.5).setPosition(centered ? REF_W / 2 : 44);
    this.right.setText(right);
    this.wantAction = Boolean(action);
    this.action.setLabel(action || 'DOWNLOAD');
    this.syncAction();
  }

  private render(s: PatchStatus): void {
    if (!this.strip) return;
    if (s.kind === 'ready' && s.outcome.status === 'staged' && loadEntry().phase === 'completed') {
      this.show(true);
      this.shimmer.setVisible(false);
      this.setFill(C.goldHi, REF_W);
      this.say('Content ready · tap to restart and apply', T.gold, true, '', 'Restart and apply new content');
      return;
    }
    if (s.kind === 'idle' || s.kind === 'ready') {
      this.wantAction = false;
      this.syncAction();
      this.show(false);
      return;
    }
    this.show(true);
    if (s.kind === 'failed') {
      this.setFill(C.crimsonHi, REF_W);
      this.shimmer.setVisible(false);
      const text = s.updateRequired ? S.patch.updateRequired : s.requiresNetworkApproval ? 'Downloads paused · tap to use mobile data' : S.patch.failed;
      this.say(text, T.crimson, true, '', s.updateRequired ? '' : 'Retry the download');
      return;
    }
    const p = s.progress;
    const frac = barFill(s);
    this.shimmer.setVisible(frac === null && !prefs().reducedMotion);
    this.setFill(C.goldHi, frac === null ? 0 : Math.round(REF_W * frac));
    this.say(`${p ? S.patch[p.phase] : S.patch.checking} · tap to pause`, T.dim, false, p && p.bytesTotal > 0 && p.phase === 'downloading' ? `${Math.floor((frac ?? 0) * 100)} %   ·   ${formatBytes(p.bytesDone)} / ${formatBytes(p.bytesTotal)}` : '', 'Pause the download');
  }
}

