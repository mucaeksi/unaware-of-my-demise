import { REF_W } from '../config';
import type { Product } from '../net/api';
import { Services } from '../services';
import { errText, HubScene } from '../ui/hub';
import { CURRENCY_NAME } from '../ui/format';
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
    const [products, ads] = await Promise.all([api.products(), api.adStatus().catch(() => null)]);
    const native = Services.identity?.kind === 'native';
    this.add_(txt(this, REF_W / 2, 160, native ? 'Payments are handled by Google Play.' : 'Purchases and rewarded ads run inside the Android app.', { fontSize: '32px', color: T.dim }).setOrigin(0.5));
    if (products.length === 0) this.add_(txt(this, REF_W / 2, 420, 'No offers are on sale yet.', { fontSize: '44px' }).setOrigin(0.5));
    products.slice(0, 4).forEach((p, i) => this.row(p, 290 + i * 150, native));
    if (ads) {
      this.card(REF_W / 2, 940, 1400, 130, 'normal');
      this.add_(txt(this, 300, 915, 'Watch a memory', { fontFamily: F.display, fontSize: '34px', fontStyle: '600' }).setOrigin(0, 0.5));
      this.add_(txt(this, 300, 965, `${ads.reward} Eclipse Tokens per view · ${ads.perWindow - ads.windowViews} left this half-day · ${ads.perDay - ads.dayViews} left today`, { fontSize: '26px', color: T.dim }).setOrigin(0, 0.5));
      this.add_(new Button(this, REF_W - 330, 940, { label: 'WATCH', w: 300, h: 100, fontSize: 32, variant: 'hot', onClick: () => void this.watch() }).setEnabled(native && ads.windowViews < ads.perWindow));
    }
  }

  private row(p: Product, y: number, native: boolean): void {
    this.card(REF_W / 2, y, 1400, 130);
    this.add_(txt(this, 300, y - 26, p.title, { fontFamily: F.display, fontSize: '34px', fontStyle: '600' }).setOrigin(0, 0.5));
    const what = p.subscription
      ? `${p.subscription.duration_days}-day blessing: tokens now and twice a day`
      : p.grants.map((g) => (g.type === 'currency' ? `${g.amount} ${CURRENCY_NAME[g.currency ?? ''] ?? g.currency}` : (g.itemId ?? ''))).join(' · ');
    this.add_(txt(this, 300, y + 24, what, { fontSize: '26px', color: T.dim }).setOrigin(0, 0.5));
    this.add_(new Button(this, REF_W - 330, y, { label: 'BUY', w: 300, h: 100, fontSize: 32, variant: 'hot', onClick: () => this.say('Opening Google Play…') }).setEnabled(native));
  }

  private async watch(): Promise<void> {
    try {
      await Services.api.adStatus();
      this.say('Rewarded ads run inside the Android app.');
    } catch (e) {
      this.say(errText(e));
    }
  }
}
