import { REF_W } from '../config';
import { hosted } from '../core/host';
import type { MailItem } from '../net/api';
import { Services } from '../services';
import { errText, HubScreen } from '../ui/hubScreen';
import { describeAttachments } from '../ui/format';
import { F, T } from '../ui/theme';

const PER_PAGE = 5;

export class MailScene extends HubScreen {
  protected readonly heading = 'MAIL';
  private mail: MailItem[] = [];
  private names = new Map<string, string>();
  private page = 0;
  private busy = false;

  protected async build(): Promise<void> {
    const releaseId = await Services.ready().content.activeReleaseId();
    const [mail, roster, catalog] = await Promise.all([Services.api.mail(), Services.api.roster(releaseId), Services.api.catalogNames(releaseId)]);
    this.mail = mail;
    this.names = new Map([...catalog, ...roster.map((c): [string, string] => [c.id, c.name_en])]);
    this.draw();
  }

  private draw(): void {
    this.body.removeAll();
    const open = this.mail.filter((m) => !m.claimed_at);
    this.text(REF_W / 2, 160, open.length ? `${open.length} waiting` : 'Nothing is waiting for you.', { fontSize: '36px', color: T.dim }).setOrigin(0.5);
    const slice = this.mail.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    slice.forEach((m, i) => {
      const y = 290 + i * 135;
      const done = Boolean(m.claimed_at);
      this.card(REF_W / 2 - 100, y, 1400, 120, done ? 'dim' : 'normal');
      this.text(280, y - 28, m.title, { fontFamily: F.display, fontSize: '32px', fontStyle: '600', color: done ? T.dim : T.text }).setOrigin(0, 0.5);
      this.text(280, y + 22, `${describeAttachments(m.attachments, new Map([...this.names, ...Object.entries(m.names ?? {})]))}   ·   ${done ? 'claimed' : `expires ${m.expires_at.slice(0, 10)}`}`, { fontSize: '26px', color: T.dim }).setOrigin(0, 0.5);
      this.button(REF_W - 250, y, { label: done ? 'CLAIMED' : 'CLAIM', w: 280, h: 100, fontSize: 30, variant: done ? 'dim' : 'hot', onClick: () => void this.claim(m) }).setEnabled(!done);
    });
    const pages = Math.max(1, Math.ceil(this.mail.length / PER_PAGE));
    if (pages > 1) {
      this.button(REF_W / 2 - 220, 980, { label: '‹', ariaLabel: 'Previous page', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + pages - 1) % pages; this.draw(); } });
      this.text(REF_W / 2, 980, `${this.page + 1} / ${pages}`, { fontSize: '36px' }).setOrigin(0.5);
      this.button(REF_W / 2 + 220, 980, { label: '›', ariaLabel: 'Next page', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + 1) % pages; this.draw(); } });
    }
    if (open.length > 1) this.button(REF_W - 330, 980, { label: 'CLAIM ALL', w: 380, h: 100, fontSize: 30, variant: 'hot', onClick: () => void this.claimAll() });
  }

  private async claim(m: MailItem): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await Services.api.claimMail(m.id);
      m.claimed_at = new Date().toISOString();
      this.say(`Claimed: ${describeAttachments(m.attachments, new Map([...this.names, ...Object.entries(m.names ?? {})]))}`);
      await this.updateWallet();
      this.draw();
    } catch (e) {
      this.say(errText(e));
      await this.refresh();
    } finally {
      this.busy = false;
    }
  }

  private async claimAll(): Promise<void> {
    for (const m of this.mail.filter((x) => !x.claimed_at)) await this.claim(m);
  }
}

export const MailHost = hosted('Mail', () => new MailScene());
