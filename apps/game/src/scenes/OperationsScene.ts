import { REF_W } from '../config';
import type { OperationRecord } from '../net/operations';
import { Services } from '../services';
import { errText, HubScene } from '../ui/hub';
import { Button, txt } from '../ui/kit';
import { F, T } from '../ui/theme';

const PER_PAGE = 4;
const caption = (record: OperationRecord): string => {
  if (record.path === '/api/v1/gacha/pull') return record.body.count === 1 || record.body.count === 10 ? `Wish ×${record.body.count}` : 'Wish';
  if (record.path === '/api/v1/progress/battle') return 'Battle result';
  if (record.path === '/api/v1/progress/story') return 'Story progress';
  if (record.path.startsWith('/api/v1/recruitment/')) return 'Invitation choice';
  if (record.path.startsWith('/api/v1/characters/')) return 'Character growth';
  if (record.path.startsWith('/api/v1/gear/')) return 'Equipment growth';
  if (record.path.startsWith('/api/v1/mail/')) return 'Mail reward';
  if (record.path === '/api/v1/tasks/claim') return 'Errand reward';
  return record.path === '/api/v1/entry' ? 'Opening checkpoint' : 'Cloud save';
};

export class OperationsScene extends HubScene {
  protected readonly heading = 'SAVED ACTIONS';
  protected override readonly usesWallet = false;
  private records: OperationRecord[] = [];
  private page = 0;
  private filter: 'pending' | 'history' = 'pending';
  private busy = false;

  constructor() { super('Operations'); }

  protected async build(): Promise<void> {
    const records = await Services.api.operations();
    if (!this.isCurrentView()) return;
    this.records = records.sort((a, b) => b.at - a.at);
    this.draw();
  }

  private draw(): void {
    if (!this.isCurrentView()) return;
    this.body.removeAll(true);
    this.add_(txt(this, REF_W / 2, 175, 'Pending actions keep your original choices. History shows the last known result.', { fontSize: '30px', color: T.dim, align: 'center', wordWrap: { width: 1600 } }).setOrigin(0.5));
    const pending = this.records.filter((r) => r.state === 'pending').length;
    for (const [index, tab] of [{ key: 'pending' as const, label: `PENDING (${pending})` }, { key: 'history' as const, label: 'HISTORY' }].entries()) {
      this.add_(new Button(this, REF_W / 2 - 310 + index * 620, 270, { label: tab.label, w: 560, h: 100, variant: this.filter === tab.key ? 'hot' : 'normal',
        onClick: () => { this.filter = tab.key; this.page = 0; this.draw(); } }).setEnabled(!this.busy));
    }
    const records = this.records.filter((r) => this.filter === 'pending' ? r.state === 'pending' : r.state !== 'pending');
    const pages = Math.max(1, Math.ceil(records.length / PER_PAGE)); this.page = Math.min(this.page, pages - 1);
    if (!records.length) this.add_(txt(this, REF_W / 2, 520, this.filter === 'pending' ? 'No actions are waiting for confirmation.' : 'No saved results yet.', { fontSize: '38px', color: T.dim }).setOrigin(0.5));
    records.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((record, index) => {
      const y = 380 + index * 145;
      this.card(REF_W / 2 - 70, y, 1490, 124, record.state === 'pending' ? 'normal' : 'dim');
      this.add_(txt(this, 245, y - 24, caption(record), { fontFamily: F.display, fontSize: '36px', color: T.text }).setOrigin(0, 0.5));
      const state = record.state === 'pending' ? 'Waiting for confirmation' : record.state === 'confirmed' ? 'Last known: confirmed' : 'Last known: not completed';
      this.add_(txt(this, 245, y + 27, `${state} · ${new Date(record.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, { fontSize: '28px', color: T.dim }).setOrigin(0, 0.5));
      this.add_(new Button(this, REF_W - 260, y, { label: record.state === 'pending' ? 'RETRY ACTION' : 'VERIFY', w: 340, h: 100, fontSize: 28,
        variant: record.state === 'pending' ? 'hot' : 'normal', onClick: () => void this.recover(record) }).setEnabled(!this.busy && record.state !== 'rejected'));
    });
    this.add_(new Button(this, REF_W - 260, 980, { label: 'REFRESH', w: 340, h: 100, onClick: () => void this.refresh() }).setEnabled(!this.busy));
    if (pages > 1) {
      this.add_(new Button(this, REF_W / 2 - 220, 980, { label: '‹', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + pages - 1) % pages; this.draw(); } }).setEnabled(!this.busy));
      this.add_(txt(this, REF_W / 2, 980, `${this.page + 1} / ${pages}`, { fontSize: '36px' }).setOrigin(0.5));
      this.add_(new Button(this, REF_W / 2 + 220, 980, { label: '›', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + 1) % pages; this.draw(); } }).setEnabled(!this.busy));
    }
  }

  private async recover(record: OperationRecord): Promise<void> {
    if (this.busy || !this.isCurrentView()) return;
    this.busy = true; this.draw();
    try {
      await Services.api.retryOperation(record.id);
      this.say('Result confirmed. No extra action was created.');
    } catch (error) { this.say(errText(error)); }
    finally { this.busy = false; if (this.isCurrentView()) await this.refresh(); }
  }
}
