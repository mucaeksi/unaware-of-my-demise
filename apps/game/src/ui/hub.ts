import Phaser from 'phaser';
import { REF_H, REF_W } from '../config';
import { ApiError, type Wallets } from '../net/api';
import { currency } from '../net/currency';
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
  protected readonly backTo: string = 'Home';

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0610);
    const { art } = Services.ready();
    const bg = this.add.image(REF_W / 2, REF_H / 2, art.background('forest_whispering_ash'));
    bg.setScale(Math.max(REF_W / bg.width, REF_H / bg.height));
    this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x0a0610, 0.88);
    sceneFadeIn(this, 350);
    title(this, REF_W / 2, 70, this.heading, 60, T.gold);
    new Button(this, 190, REF_H - 80, { label: 'BACK', w: 300, h: 110, onClick: () => this.scene.start(this.backTo) });
    this.walletText = txt(this, REF_W - 60, 70, '', { fontSize: '30px', color: T.text }).setOrigin(1, 0.5).setDepth(DEPTH.hud);
    this.body = this.add.container(0, 0);
    void this.refresh();
  }

  /** Re-renders the body (and the wallet strip). */
  protected async refresh(): Promise<void> {
    this.body.removeAll(true);
    const api = Services.api;
    if (this.needsSignIn && !api.signedIn) {
      this.walletText.setText('');
      this.body.add(txt(this, REF_W / 2, 400, 'Sign in to use this screen.', { fontSize: '44px' }).setOrigin(0.5));
      this.body.add(new Button(this, REF_W / 2, 560, { label: 'ACCOUNT', w: 520, onClick: () => this.scene.start('Account') }));
      return;
    }
    try {
      if (api.signedIn) this.showWallet(await api.wallet());
      await this.build();
    } catch (e) {
      this.say(errText(e));
    }
  }

  private showWallet(w: Wallets): void {
    this.balance = w.eclipse_token ?? 0;
    this.walletText?.setText(`${currency.name} ${this.balance.toLocaleString('en-US')}`);
  }

  /** Cheap wallet refresh after an action. */
  protected async updateWallet(): Promise<void> {
    if (Services.api.signedIn) this.showWallet(await Services.api.wallet().catch(() => ({})));
  }

  protected abstract build(): Promise<void> | void;

  protected say(message: string): void {
    toast(this, message, 3400);
  }

  protected add_<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.body.add(o);
    return o;
  }

  protected card(x: number, y: number, w: number, h: number, variant: 'normal' | 'hot' | 'dim' | 'danger' = 'normal'): Phaser.GameObjects.Image {
    return this.add_(panel(this, x, y, w, h, variant));
  }
}
