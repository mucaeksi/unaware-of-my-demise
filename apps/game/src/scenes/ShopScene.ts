import { REF_W } from '../config';
import type { Product } from '../net/api';
import { buyProduct, restorePurchases, watchRewardedAd } from '../net/store';
import { isNative } from '../platform/native';
import { Services } from '../services';
import { errText, HubScene } from '../ui/hub';
import { currencyLabel } from '../ui/format';
import { Button, txt } from '../ui/kit';
import { F, T } from '../ui/theme';

/** Offers and rewarded ads. Purchases and ads run through the Android shell; the browser build only shows what exists. */
export class ShopScene extends HubScene {
  protected readonly heading = 'SHOP';

  constructor() {
    super('Shop');
  }

  protected async build(): Promise<void> {
    const api = Services.api;
    const native = isNative();
    // purchases Google still lists (interrupted flow, reinstall, another device) are re-verified by the server, which grants each once
    if (native) {
      const restored = await restorePurchases().catch(() => 0);
      if (restored > 0) {
        this.say(`${restored} earlier purchase(s) restored`);
        await this.updateWallet();
      }
    }
    const [products, ads] = await Promise.all([api.products(), api.adStatus().catch(() => null)]);
    this.add_(txt(this, REF_W / 2, 160, native ? 'Payments are handled by Google Play.' : 'Purchases and rewarded ads run inside the Android app.', { fontSize: '32px', color: T.dim }).setOrigin(0.5));
    if (products.length === 0) this.add_(txt(this, REF_W / 2, 420, 'No offers are on sale yet.', { fontSize: '44px' }).setOrigin(0.5));
    products.slice(0, 4).forEach((p, i) => this.row(p, 290 + i * 150, native));
    if (ads) {
      this.card(REF_W / 2, 940, 1400, 130, 'normal');
      this.add_(txt(this, 300, 915, 'Watch a memory', { fontFamily: F.display, fontSize: '34px', fontStyle: '600' }).setOrigin(0, 0.5));
      this.add_(txt(this, 300, 965, `${ads.reward} ${currencyLabel()} per view · ${ads.perWindow - ads.windowViews} of ${ads.perWindow} left in the last 12 hours`, { fontSize: '26px', color: T.dim }).setOrigin(0, 0.5));
      this.add_(new Button(this, REF_W - 330, 940, { label: 'WATCH', w: 300, h: 100, fontSize: 32, variant: 'hot', onClick: () => void this.watch() }).setEnabled(native && ads.windowViews < ads.perWindow));
    }
  }

  private row(p: Product, y: number, native: boolean): void {
    this.card(REF_W / 2, y, 1400, 130);
    this.add_(txt(this, 300, y - 26, p.title, { fontFamily: F.display, fontSize: '34px', fontStyle: '600' }).setOrigin(0, 0.5));
    const what = p.subscription
      ? `${p.subscription.duration_days}-day blessing: tokens now and twice a day`
      : p.grants.map((g) => (g.type === 'currency' ? `${g.amount} ${currencyLabel(g.currency)}` : (g.itemId ?? ''))).join(' · ');
    this.add_(txt(this, 300, y + 24, what, { fontSize: '26px', color: T.dim }).setOrigin(0, 0.5));
    this.add_(new Button(this, REF_W - 330, y, { label: 'BUY', w: 300, h: 100, fontSize: 32, variant: 'hot', onClick: () => void this.buy(p) }).setEnabled(native));
  }

  private busy = false;

  private async buy(p: Product): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await buyProduct(p);
      this.say(r.status === 'granted' ? 'Purchase complete. Check your mail and wallet.' : r.status === 'already_granted' ? 'Already delivered.' : r.status === 'pending' ? 'Payment is pending; it will be delivered when it clears.' : r.status === 'canceled' ? 'Purchase cancelled.' : 'The purchase could not be confirmed.');
      await this.updateWallet();
    } catch (e) {
      this.say(errText(e));
    } finally {
      this.busy = false;
    }
  }

  private async watch(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await watchRewardedAd();
      this.say(r === 'rewarded' ? 'Thank you. The reward is on its way to your wallet.' : r === 'closed_early' ? 'The memory was cut short: no reward this time.' : r === 'no_ad' ? 'No memory is available right now. Try again later.' : r === 'no_consent' ? 'Ads need your privacy choice first (Account > Privacy options).' : 'The ad could not be shown.');
      await this.updateWallet();
      await this.refresh();
    } catch (e) {
      this.say(errText(e));
    } finally {
      this.busy = false;
    }
  }
}
