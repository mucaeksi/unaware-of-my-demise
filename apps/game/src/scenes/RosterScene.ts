import { REF_W } from '../config';
import { Services } from '../services';
import { HubScene } from '../ui/hub';
import { stars } from '../ui/format';
import { Button, txt } from '../ui/kit';
import { describeCompanionAttachment } from '../ui/pilotAttachment';
import { F, T } from '../ui/theme';

const PER_PAGE = 12;

export class RosterScene extends HubScene {
  protected readonly heading = 'ROSTER';
  private page = 0;
  private list: { id: string; name: string; rarity: number; element: string; role: string; copies: number; shards: number }[] = [];

  constructor() {
    super('Roster');
  }

  protected async build(): Promise<void> {
    const releaseId = await Services.ready().content.activeReleaseId();
    const [inv, roster] = await Promise.all([Services.api.inventory(), Services.api.roster(releaseId)]);
    const byId = new Map(roster.map((c) => [c.id, c]));
    this.list = inv
      .filter((i) => i.item_type === 'character')
      .map((i) => ({ id: i.item_id, name: byId.get(i.item_id)?.name_en ?? i.item_id, rarity: byId.get(i.item_id)?.rarity ?? 0, element: byId.get(i.item_id)?.element ?? '', role: byId.get(i.item_id)?.role ?? '', copies: i.copies, shards: i.shards }))
      .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
    this.draw(roster.length);
  }

  private draw(total: number): void {
    this.body.removeAll(true);
    this.add_(new Button(this, REF_W - 300, 170, { label: 'INVITATIONS', w: 420, h: 90, onClick: () => this.scene.start('Recruit', { returnTo: 'Roster' }) }));
    this.add_(txt(this, REF_W / 2, 160, `${this.list.length} of ${total} companions`, { fontSize: '36px', color: T.dim }).setOrigin(0.5));
    const slice = this.list.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    slice.forEach((c, i) => {
      const x = 340 + (i % 4) * 415;
      const y = 330 + Math.floor(i / 4) * 215;
      const attach = describeCompanionAttachment(c.id, c.element, c.role);
      this.card(x, y, 390, 190, c.rarity === 5 ? 'hot' : 'normal').setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.start('Character', { id: c.id }));
      const nm = this.add_(txt(this, x, y - 56, c.name, { fontFamily: F.display, fontSize: '32px', fontStyle: '600', color: c.rarity === 5 ? '#ffd86b' : T.text }).setOrigin(0.5));
      if (nm.width > 350) nm.setScale(350 / nm.width);
      this.add_(txt(this, x, y - 16, stars(c.rarity), { fontSize: '30px', color: '#ffd86b' }).setOrigin(0.5));
      this.add_(txt(this, x, y + 18, c.rarity ? `${c.element} · ${c.role.replaceAll('_', ' ')} (${attach.formationSlot})` : 'Unavailable in this version', { fontSize: '21px', color: T.dim }).setOrigin(0.5));
      this.add_(txt(this, x, y + 48, attach.bondTitle, { fontSize: '18px', color: T.gold }).setOrigin(0.5));
      this.add_(txt(this, x, y + 74, c.copies > 1 || c.shards ? `copies ${c.copies} · shards ${c.shards}` : 'tap for details', { fontSize: '20px', color: T.dim }).setOrigin(0.5));
    });
    const pages = Math.max(1, Math.ceil(this.list.length / PER_PAGE));
    if (pages > 1) {
      this.add_(new Button(this, REF_W / 2 - 220, 960, { label: '‹', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + pages - 1) % pages; this.draw(total); } }));
      this.add_(txt(this, REF_W / 2, 960, `${this.page + 1} / ${pages}`, { fontSize: '36px' }).setOrigin(0.5));
      this.add_(new Button(this, REF_W / 2 + 220, 960, { label: '›', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + 1) % pages; this.draw(total); } }));
    }
  }
}
