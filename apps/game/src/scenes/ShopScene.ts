import { REF_W } from '../config';
import type { Product } from '../net/api';
import {
  buyProduct,
  formatOfferTerms,
  loadStoreCatalog,
  restorePurchases,
  watchRewardedAd
} from '../net/store';
import { isNative, type StoreProduct } from '../platform/native';
import { Services } from '../services';
import { errText, HubScene } from '../ui/hub';
import { currencyLabel } from '../ui/format';
import { Button, txt } from '../ui/kit';
import { F, T } from '../ui/theme';

/** Offers and rewarded ads. Purchases and ads run through the Android shell; the browser build only shows what exists. */
export class ShopScene extends HubScene {
  protected readonly heading = 'SHOP';
  private selectedOfferByProduct = new Map<string, number>();

  constructor() {
    super('Shop');
  }

  protected async build(): Promise<void> {
    const api = Services.api;
    const native = isNative();
    if (native) {
      const restored = await restorePurchases().catch((error) => {
        this.say(errText(error));
        return null;
      });
      if (!this.isCurrentView()) return;
      if (restored && (restored.granted || restored.pending || restored.unconfirmed || restored.notEntitled)) {
        const messages = [
          restored.granted ? `${restored.granted} purchase(s) restored.` : '',
          restored.pending ? `${restored.pending} payment(s) pending.` : '',
          restored.unconfirmed ? `${restored.unconfirmed} purchase(s) still need confirmation. Tap Restore to retry.` : '',
          restored.notEntitled ? `${restored.notEntitled} purchase(s) have no current benefits.` : ''
        ].filter(Boolean);
        this.say(messages.join(' '));
        await this.updateWallet();
      }
    }
    const releaseId = await Services.ready().content.activeReleaseId();
    const [products, ads] = await Promise.all([api.products(releaseId), api.adStatus().catch(() => null)]);
    const storeCatalog = await loadStoreCatalog(products);
    if (!this.isCurrentView()) return;

    this.add_(
      txt(
        this,
        REF_W / 2 - (native ? 140 : 0),
        160,
        native
          ? 'Payments handled by Google Play · Subscriptions auto-renew until cancelled in Google Play.'
          : 'Purchases and rewarded ads run inside the Android app.',
        { fontSize: '28px', color: T.dim }
      ).setOrigin(0.5)
    );
    if (native) {
      this.add_(
        new Button(this, REF_W - 310, 160, {
          label: 'RESTORE',
          w: 260,
          h: 72,
          fontSize: 24,
          onClick: () => void this.manualRestore()
        })
      );
    }
    if (products.length === 0)
      this.add_(txt(this, REF_W / 2, 420, 'No offers are on sale yet.', { fontSize: '44px' }).setOrigin(0.5));
    products.slice(0, 4).forEach((p, i) => this.row(p, storeCatalog.get(p.productId) ?? null, 290 + i * 150, native));
    if (ads) {
      this.card(REF_W / 2, 940, 1400, 130, 'normal');
      this.add_(
        txt(this, 300, 915, 'Watch a memory', { fontFamily: F.display, fontSize: '34px', fontStyle: '600' }).setOrigin(
          0,
          0.5
        )
      );
      this.add_(
        txt(
          this,
          300,
          965,
          `${ads.reward} ${currencyLabel()} per view · ${ads.perWindow - ads.windowViews} of ${ads.perWindow} left in the last 12 hours`,
          { fontSize: '26px', color: T.dim }
        ).setOrigin(0, 0.5)
      );
      this.add_(
        new Button(this, REF_W - 330, 940, {
          label: 'WATCH',
          w: 300,
          h: 100,
          fontSize: 32,
          variant: 'hot',
          onClick: () => void this.watch()
        }).setEnabled(native && ads.windowViews < ads.perWindow)
      );
    }
  }

  private row(p: Product, storeProduct: StoreProduct | null, y: number, native: boolean): void {
    const selectedIdx = this.selectedOfferByProduct.get(p.productId);
    const terms = formatOfferTerms(p, storeProduct, selectedIdx);
    this.card(REF_W / 2, y, 1400, 136);
    this.add_(
      txt(this, 290, y - 34, `${p.title}  ·  ${terms.priceLabel}`, {
        fontFamily: F.display,
        fontSize: '30px',
        fontStyle: '600'
      }).setOrigin(0, 0.5)
    );
    const what = p.subscription
      ? `${p.subscription.duration_days}-day blessing · ${terms.offerLabel ?? ''} · ${terms.phasesLabel ?? ''}`
      : p.grants
          .map((g) => (g.type === 'currency' ? `${g.amount} ${currencyLabel(g.currency)}` : (g.itemId ?? '')))
          .join(' · ');
    this.add_(txt(this, 290, y + 6, what, { fontSize: '22px', color: T.dim }).setOrigin(0, 0.5));
    if (terms.cancellationLabel) {
      this.add_(txt(this, 290, y + 38, terms.cancellationLabel, { fontSize: '18px', color: T.dim }).setOrigin(0, 0.5));
    }
    if (terms.offers.length > 1) {
      const idx = selectedIdx !== undefined ? selectedIdx : -1;
      const offerBtnLabel = idx >= 0 ? `PLAN ${idx + 1}/${terms.offers.length}` : `PICK PLAN (${terms.offers.length})`;
      this.add_(
        new Button(this, REF_W - 620, y, {
          label: offerBtnLabel,
          w: 240,
          h: 88,
          fontSize: 22,
          onClick: () => {
            const nextIdx = idx + 1 >= terms.offers.length ? 0 : idx + 1;
            this.selectedOfferByProduct.set(p.productId, nextIdx);
            void this.refresh();
          }
        })
      );
    }
    this.add_(
      new Button(this, REF_W - 330, y, {
        label: terms.requiresOfferSelection ? 'SELECT PLAN' : 'BUY',
        sub: storeProduct?.formattedPrice ?? undefined,
        w: 300,
        h: 100,
        fontSize: 28,
        variant: terms.requiresOfferSelection ? 'dim' : 'hot',
        onClick: () => void this.buy(p, storeProduct, terms.selectedOffer?.offerToken, terms.selectedOffer?.basePlanId)
      }).setEnabled(native && !terms.requiresOfferSelection)
    );
  }

  private busy = false;

  private async manualRestore(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const restored = await restorePurchases();
      if (restored.granted > 0) {
        this.say(`${restored.granted} purchase(s) restored to your account.`);
      } else if (restored.pending > 0 || restored.unconfirmed > 0) {
        this.say(`${restored.pending + restored.unconfirmed} purchase(s) are still awaiting confirmation.`);
      } else {
        this.say('All Google Play purchases for this account are up to date.');
      }
      await this.updateWallet();
    } catch (e) {
      this.say(errText(e));
    } finally {
      this.busy = false;
    }
  }

  private async buy(
    p: Product,
    storeProduct: StoreProduct | null,
    offerToken?: string,
    basePlanId?: string
  ): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await buyProduct(p, { storeProduct, offerToken, basePlanId });
      this.say(
        r.status === 'granted'
          ? 'Purchase complete. Check your mail and wallet.'
          : r.status === 'already_granted'
            ? 'Already delivered.'
            : r.status === 'pending'
              ? 'Payment is pending; it will be delivered when it clears.'
              : r.status === 'canceled'
                ? 'Purchase cancelled.'
                : 'The purchase could not be confirmed.'
      );
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
      const msg =
        r === 'verified'
          ? 'Reward verified by server and added to your wallet.'
          : r === 'test_callback'
            ? 'Test ad callback verified (test key grants no production currency).'
            : r === 'pending'
              ? 'Memory complete; server verification is still pending. Your wallet will update when confirmed.'
              : r === 'rejected'
                ? 'Ad reward was rejected or the 12-hour window cap was reached.'
                : r === 'closed_early'
                  ? 'The memory was cut short: no reward this time.'
                  : r === 'no_ad'
                    ? 'No memory is available right now. Try again later.'
                    : r === 'no_consent'
                      ? 'Ads need your privacy choice first (Account > Privacy options).'
                      : 'The ad could not be shown.';
      this.say(msg);
      await this.updateWallet();
      await this.refresh();
    } catch (e) {
      this.say(errText(e));
    } finally {
      this.busy = false;
    }
  }
}
