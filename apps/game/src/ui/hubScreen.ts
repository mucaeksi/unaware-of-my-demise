import * as PIXI from 'pixi.js';
import { REF_H, REF_W } from '../config';
import { PixiScene } from '../core/PixiScene';
import { S } from '../entry/strings';
import { ApiError, type Wallets } from '../net/api';
import { currency } from '../net/currency';
import { prefs } from '../platform/prefs';
import { safeInsets } from '../platform/safeArea';
import { Services } from '../services';
import { type DomBar, type DomBox, type DomButton, type DomGroup, type DomPanel, type DomScroll, DomStage, type DomText, type DomButtonOptions } from './domKit';
import { backdrop, sceneFadeIn, type PanelVariant, type TextOptions } from './pixiKit';
import { DEPTH, F, SIZE, T } from './theme';

export const errText = (e: unknown): string => (e instanceof ApiError ? (e.code === 'feature_disabled' ? 'This feature is switched off for now.' : `${e.message} (${e.code})`) : e instanceof Error ? e.message : String(e));

/** heading text options (the kit's `title` look) */
export const titleStyle = (size: number = SIZE.h2, color: string = T.text): TextOptions => ({ fontFamily: F.display, fontSize: size, fontStyle: '600', color, stroke: '#0a0610', strokeThickness: prefs().highContrast ? 6 : 4 });

/**
 * Shared frame of the account-backed screens (R10, D-25): PIXI backdrop, HTML controls (heading, Back, wallet strip,
 * clearable body). Subclasses implement build(); a signed-out player is sent to the Account screen instead of broken
 * data. Body helpers drop what a stale render (account switch, re-render) tries to add.
 */
export abstract class HubScreen<D = unknown> extends PixiScene<D> {
  protected ui!: DomStage;
  protected body!: DomGroup;
  private walletText!: DomText;
  /** last known balance of the single main currency (for planning hints) */
  protected balance = 0;
  protected abstract readonly heading: string;
  protected readonly needsSignIn: boolean = true;
  protected readonly usesWallet: boolean = true;
  protected readonly backTo: string = 'Home';
  private modalGroup: DomGroup | null = null;
  private refreshing = false;
  private rerender = false;
  private renderRevision = -1;

  create(_data?: D): void {
    void backdrop(this, 'forest_whispering_ash');
    this.add(new PIXI.Graphics().rect(0, 0, REF_W, REF_H).fill({ color: 0x0a0610, alpha: 0.88 }), -10);
    this.ui = new DomStage(this.host.game.uiLayer);
    this.attachDom(this.ui.root);
    sceneFadeIn(this, 350);
    this.onClose(() => this.ui.destroy());
    const insets = safeInsets(this.host);
    const headY = 70 + Math.round(insets.top * 0.5);
    this.ui.text(REF_W / 2, headY, this.heading, titleStyle(60, T.gold)).setOrigin(0.5);
    this.ui.button(190 + insets.left, REF_H - 80 - insets.bottom, { label: S.hub.back, w: 300, h: 110, escape: true, onClick: () => this.goBack() });
    this.walletText = this.ui.text(REF_W - 60 - insets.right, headY, '', { fontSize: 30, color: T.text }).setOrigin(1, 0.5).setDepth(DEPTH.hud);
    this.body = this.ui.group();
    const authChanged = (): void => void this.refresh();
    Services.api.addEventListener('auth', authChanged);
    this.onClose(() => {
      Services.api.removeEventListener('auth', authChanged);
      this.renderRevision = -1;
      this.rerender = false;
    });
    void this.refresh();
  }

  protected goBack(): void {
    this.nav.start(this.backTo);
  }

  /** Re-renders the body (and the wallet strip). */
  protected async refresh(): Promise<void> {
    if (this.refreshing) {
      this.rerender = true;
      this.body.removeAll();
      this.walletText.setText('');
      return;
    }
    this.refreshing = true;
    this.rerender = false;
    this.renderRevision = Services.api.authRevision;
    try {
      this.closeModal();
      this.body.removeAll();
      const api = Services.api;
      if (this.needsSignIn && !api.signedIn) {
        this.walletText.setText('');
        this.text(REF_W / 2, 400, 'Sign in to use this screen.', { fontSize: 44 }).setOrigin(0.5);
        this.button(REF_W / 2, 560, { label: 'ACCOUNT', w: 520, onClick: () => this.nav.start('Account') });
        return;
      }
      try {
        if (api.signedIn && this.usesWallet) {
          const wallet = await api.wallet();
          if (!this.isCurrentView()) return;
          this.showWallet(wallet);
        }
        await this.build();
      } catch (e) {
        this.say(errText(e));
      }
    } finally {
      this.refreshing = false;
      if (this.rerender && this.live) void this.refresh();
    }
  }

  protected isCurrentView(): boolean {
    return this.live && this.renderRevision === Services.api.authRevision;
  }

  private showWallet(w: Wallets): void {
    this.balance = w.eclipse_token ?? 0;
    this.walletText.setText(`${currency.name} ${this.balance.toLocaleString('en-US')}`);
  }

  /** Cheap wallet refresh after an action. */
  protected async updateWallet(): Promise<void> {
    if (!Services.api.signedIn) return;
    const wallet = await Services.api.wallet().catch(() => ({}));
    if (this.isCurrentView()) this.showWallet(wallet);
  }

  protected abstract build(): Promise<void> | void;

  protected say(message: string): void {
    if (this.isCurrentView()) this.ui.toast(message, 3400);
  }

  /**
   * A dimmed layer above the screen; the rest of the screen is inert until it closes (focus stays inside, screen readers
   * see only it). Build its content with the helpers' `into` argument.
   */
  protected openModal(alpha = 0.86, color = 0x07040c): DomGroup {
    this.closeModal();
    const g = this.ui.group().setDepth(DEPTH.modal);
    this.ui.blocker(alpha, g, color);
    this.modalGroup = g;
    this.ui.setModal(g.el);
    return g;
  }

  protected closeModal(): void {
    if (!this.modalGroup) return;
    this.modalGroup.destroy();
    this.modalGroup = null;
    this.ui.setModal(null);
  }

  /** body (or modal) nodes: a stale render's nodes are created detached and thrown away */
  private keep<N extends DomText | DomButton | DomPanel | DomBox | DomBar | DomGroup | DomScroll>(make: (into: DomGroup) => N, into?: DomGroup): N {
    const node = make(into ?? this.body);
    if (!this.isCurrentView()) node.destroy();
    return node;
  }

  protected text(x: number, y: number, s: string, o: TextOptions = {}, into?: DomGroup): DomText {
    return this.keep((g) => this.ui.text(x, y, s, o, g), into);
  }

  protected button(x: number, y: number, opts: DomButtonOptions, into?: DomGroup): DomButton {
    return this.keep((g) => this.ui.button(x, y, opts, g), into);
  }

  protected card(x: number, y: number, w: number, h: number, variant: PanelVariant = 'normal', into?: DomGroup): DomPanel {
    return this.keep((g) => this.ui.panel(x, y, w, h, variant, g), into);
  }

  protected box(x: number, y: number, w: number, h: number, color: number, alpha = 1, into?: DomGroup): DomBox {
    return this.keep((g) => this.ui.box(x, y, w, h, color, alpha, g), into);
  }

  protected scroll(x: number, y: number, w: number, h: number): DomScroll {
    return this.keep((g) => this.ui.scroll(x, y, w, h, g));
  }

  protected bar(x: number, y: number, w: number, h: number, colorFn: (ratio: number) => number, into?: DomGroup): DomBar {
    return this.keep((g) => this.ui.bar(x, y, w, h, colorFn, g), into);
  }
}
