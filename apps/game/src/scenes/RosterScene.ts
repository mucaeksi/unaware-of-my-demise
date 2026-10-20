import { REF_W } from '../config';
import { Services } from '../services';
import { stars } from '../ui/format';
import { HubScreen } from '../ui/hubScreen';
import { describeCompanionAttachment } from '../ui/pilotAttachment';
import { F, T } from '../ui/theme';

const PER_PAGE = 12;
/** the page survives Roster -> Character -> BACK, which builds a new Roster scene */
let lastPage = 0;

export class RosterScene extends HubScreen {
  protected readonly heading = 'ROSTER';
  private page = lastPage;
  private list: { id: string; name: string; rarity: number; element: string; role: string; copies: number; shards: number }[] = [];

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
    this.body.removeAll();
    this.button(REF_W - 300, 170, { label: 'INVITATIONS', w: 420, h: 90, onClick: () => this.nav.start('Recruit', { returnTo: 'Roster' }) });
    this.text(REF_W / 2, 160, `${this.list.length} of ${total} companions`, { fontSize: 36, color: T.dim }).setOrigin(0.5);
    lastPage = this.page = Math.min(this.page, Math.max(0, Math.ceil(this.list.length / PER_PAGE) - 1));
    const slice = this.list.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    slice.forEach((c, i) => {
      const x = 340 + (i % 4) * 415;
      const y = 330 + Math.floor(i / 4) * 215;
      const attach = describeCompanionAttachment(c.id, c.element, c.role);
      this.card(x, y, 390, 190, c.rarity === 5 ? 'hot' : 'normal').onTap(() => this.nav.start('Character', { id: c.id }), `${c.name}, ${c.rarity} stars: details`);
      this.text(x, y - 56, c.name, { fontFamily: F.display, fontSize: 32, fontStyle: '600', color: c.rarity === 5 ? '#ffd86b' : T.text }).setOrigin(0.5).fit(350);
      this.text(x, y - 16, stars(c.rarity), { fontSize: 30, color: '#ffd86b' }).setOrigin(0.5);
      this.text(x, y + 18, c.rarity ? `${c.element} · ${c.role.replaceAll('_', ' ')} (${attach.formationSlot})` : 'Unavailable in this version', { fontSize: 21, color: T.dim }).setOrigin(0.5);
      this.text(x, y + 48, attach.bondTitle, { fontSize: 18, color: T.gold }).setOrigin(0.5);
      this.text(x, y + 74, c.copies > 1 || c.shards ? `copies ${c.copies} · shards ${c.shards}` : 'tap for details', { fontSize: 20, color: T.dim }).setOrigin(0.5);
    });
    const pages = Math.max(1, Math.ceil(this.list.length / PER_PAGE));
    if (pages > 1) {
      this.button(REF_W / 2 - 220, 960, { label: '‹', ariaLabel: 'Previous page', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + pages - 1) % pages; this.draw(total); } });
      this.text(REF_W / 2, 960, `${this.page + 1} / ${pages}`, { fontSize: 36 }).setOrigin(0.5);
      this.button(REF_W / 2 + 220, 960, { label: '›', ariaLabel: 'Next page', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + 1) % pages; this.draw(total); } });
    }
  }
}

