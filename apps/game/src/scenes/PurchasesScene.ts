import { REF_W } from '../config';
import type { PurchaseRecord } from '../net/api';
import { Services } from '../services';
import { HubScene } from '../ui/hub';
import { Button, txt } from '../ui/kit';
import { T } from '../ui/theme';

export class PurchasesScene extends HubScene {
  protected readonly heading = 'PURCHASE HISTORY';
  protected override readonly usesWallet = false;
  private records: PurchaseRecord[] = [];
  private page = 0;
  private truncated = false;

  constructor() { super('Purchases'); }

  protected async build(): Promise<void> {
    const history = await Services.api.purchaseHistory();
    if (!this.isCurrentView()) return;
    this.records = history.records; this.truncated = history.truncated; this.draw();
  }

  private draw(): void {
    if (!this.isCurrentView()) return;
    this.body.removeAll(true);
    this.add_(txt(this, REF_W / 2, 180, 'Recorded deliveries and last observed payment state.', { fontSize: '32px', color: T.dim }).setOrigin(0.5));
    const pages = Math.max(1, Math.ceil(this.records.length / 4)); this.page = Math.min(this.page, pages - 1);
    if (!this.records.length) this.add_(txt(this, REF_W / 2, 500, 'No server purchase records yet.', { fontSize: '40px' }).setOrigin(0.5));
    this.records.slice(this.page * 4, this.page * 4 + 4).forEach((record, index) => {
      const y = 330 + index * 150;
      this.card(REF_W / 2, y, 1540, 132, record.deliveryState === 'unconfirmed' ? 'normal' : 'dim');
      this.add_(txt(this, 255, y - 30, record.title.slice(0, 55), { fontSize: '34px', color: T.text }).setOrigin(0, 0.5));
      const state = record.deliveryState === 'granted' ? 'Delivery recorded' : record.deliveryState === 'refunded' ? 'Refund recorded'
        : record.recoveryState === 'review' ? 'Needs payment review' : 'Awaiting server confirmation';
      const provider = record.kind === 'subscription' && record.providerState ? ` · Last observed: ${record.providerState}` : '';
      this.add_(txt(this, 255, y + 22, `${state}${provider}`, { fontSize: '28px', color: T.dim }).setOrigin(0, 0.5));
      this.add_(txt(this, REF_W - 255, y - 28, new Date(record.recordedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }), { fontSize: '26px', color: T.dim }).setOrigin(1, 0.5));
      if (record.orderId) this.add_(txt(this, REF_W - 255, y + 22, `Order …${record.orderId.slice(-12)}`, { fontSize: '26px', color: T.dim }).setOrigin(1, 0.5));
    });
    if (this.truncated) this.add_(txt(this, REF_W / 2, 905, 'Showing the latest 30 records.', { fontSize: '28px', color: T.dim }).setOrigin(0.5));
    this.add_(new Button(this, REF_W - 260, 980, { label: 'REFRESH', w: 340, h: 100, onClick: () => void this.refresh() }));
    if (pages > 1) {
      this.add_(new Button(this, 740, 980, { label: '‹', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + pages - 1) % pages; this.draw(); } }));
      this.add_(txt(this, 960, 980, `${this.page + 1} / ${pages}`, { fontSize: '36px' }).setOrigin(0.5));
      this.add_(new Button(this, 1180, 980, { label: '›', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + 1) % pages; this.draw(); } }));
    }
  }
}
