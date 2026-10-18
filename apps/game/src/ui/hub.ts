import Phaser from '../engine';
import { REF_H, REF_W } from '../config';
import { S } from '../entry/strings';
import { ApiError, type Wallets } from '../net/api';
import { currency } from '../net/currency';
import { safeInsets } from '../platform/safeArea';
import { Services } from '../services';
import { Button, panel, sceneFadeIn, title, toast, txt } from './kit';
import { DEPTH, T } from './theme';

export const errText = (e: unknown): string => (e instanceof ApiError ? (e.code === 'feature_disabled' ? 'This feature is switched off for now.' : `${e.message} (${e.code})`) : e instanceof Error ? e.message : String(e));

/**
 * Shared frame of the account-backed screens: backdrop, heading, back button, wallet strip and a clearable body.
 * Subclasses implement build(); a signed-out player is sent to the Account screen instead of seeing broken data.
 */
export abstract class HubScene extends Phaser.Scene {
  protected body!: Phaser.GameObjects.Container;
  private walletText!: Phaser.GameObjects.Text;
  /** last known balance of the single main currency (for planning hints) */
  protected balance = 0;
  protected abstract readonly heading: string;
  protected readonly needsSignIn: boolean = true;
  protected readonly usesWallet: boolean = true;
  protected readonly backTo: string = 'Home';
  private refreshing = false;
  private rerender = false;
  private renderRevision = -1;

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0610);
    const { art } = Services.ready();
    void art.addBackdrop(this, 'forest_whispering_ash', -20);
    this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x0a0610, 0.88).setDepth(-10);
    sceneFadeIn(this, 350);
    const insets = safeInsets(this);
    title(this, REF_W / 2, 70 + Math.round(insets.top * 0.5), this.heading, 60, T.gold);
    new Button(this, 190 + insets.left, REF_H - 80 - insets.bottom, { label: S.hub.back, w: 300, h: 110, onClick: () => this.goBack() });
    this.walletText = txt(this, REF_W - 60 - insets.right, 70 + Math.round(insets.top * 0.5), '', { fontSize: '30px', color: T.text }).setOrigin(1, 0.5).setDepth(DEPTH.hud);
    this.body = this.add.container(0, 0);
    const authChanged = () => { void this.refresh(); };
    Services.api.addEventListener('auth', authChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      Services.api.removeEventListener('auth', authChanged);
      this.renderRevision = -1;
      this.rerender = false;
    });
    void this.refresh();
  }


  protected goBack(): void {
    this.scene.start(this.backTo);
  }

  /** Re-renders the body (and the wallet strip). */
  protected async refresh(): Promise<void> {
    if (this.refreshing) {
      this.rerender = true;
      this.body.removeAll(true);
      this.walletText.setText('');
      return;
    }
    this.refreshing = true;
    this.rerender = false;
    this.renderRevision = Services.api.authRevision;
    try {
      this.body.removeAll(true);
      const api = Services.api;
      if (this.needsSignIn && !api.signedIn) {
        this.walletText.setText('');
        this.body.add(txt(this, REF_W / 2, 400, 'Sign in to use this screen.', { fontSize: '44px' }).setOrigin(0.5));
        this.body.add(new Button(this, REF_W / 2, 560, { label: 'ACCOUNT', w: 520, onClick: () => this.scene.start('Account') }));
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
      if (this.rerender && this.sys.isActive()) void this.refresh();
    }
  }

  protected isCurrentView(): boolean {
    return (this.sys.isActive() || this.sys.settings.status === Phaser.Scenes.CREATING) && this.renderRevision === Services.api.authRevision;
  }

  private showWallet(w: Wallets): void {
    this.balance = w.eclipse_token ?? 0;
    this.walletText?.setText(`${currency.name} ${this.balance.toLocaleString('en-US')}`);
  }

  /** Cheap wallet refresh after an action. */
  protected async updateWallet(): Promise<void> {
    if (Services.api.signedIn) {
      const wallet = await Services.api.wallet().catch(() => ({}));
      if (this.isCurrentView()) this.showWallet(wallet);
    }
  }

  protected abstract build(): Promise<void> | void;

  protected say(message: string): void {
    if (!this.isCurrentView()) return;
    toast(this, message, 3400);
  }

  protected add_<T extends Phaser.GameObjects.GameObject>(o: T): T {
    if (!this.isCurrentView()) { o.destroy(); return o; }
    this.body.add(o);
    return o;
  }

  protected card(x: number, y: number, w: number, h: number, variant: 'normal' | 'hot' | 'dim' | 'danger' = 'normal'): Phaser.GameObjects.Image {
    return this.add_(panel(this, x, y, w, h, variant));
  }
}
