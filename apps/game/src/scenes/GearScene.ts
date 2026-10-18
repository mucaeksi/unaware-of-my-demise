import { REF_W } from '../config';
import { hosted } from '../core/host';
import type { GearView } from '../net/api';
import { Services } from '../services';
import { errText, HubScreen } from '../ui/hubScreen';
import { stars } from '../ui/format';
import { F, T } from '../ui/theme';

const PER_PAGE = 6;
const statLine = (g: GearView): string => (g.stats ? [g.stats.main, ...g.stats.subs].map((s) => `${s.stat.replace('_pct', '%')} ${s.value}`).join(' · ') : (g.passive ? `${g.passive.name}${g.passive.supported === false ? ' · Passive not available yet' : ''}` : ''));

/** Gear list. Opened from a companion it filters to one slot and offers Equip; opened alone it lists everything. */
export class GearScene extends HubScreen {
  protected readonly heading = 'ARMORY';
  private characterId: string | null = null;
  private slot: GearView['slot'] | null = null;
  private page = 0;
  private list: GearView[] = [];
  private busy = false;
  private releaseId: string | undefined;

  init(data: { characterId?: string; slot?: GearView['slot'] }): void {
    this.characterId = data.characterId ?? null;
    this.slot = data.slot ?? null;
    this.page = 0;
  }

  protected override goBack(): void {
    if (this.characterId) this.nav.start('Character', { id: this.characterId });
    else this.nav.start('Home');
  }

  protected async build(): Promise<void> {
    this.releaseId = await Services.ready().content.activeReleaseId();
    const all = await Services.api.gear(this.releaseId);
    this.list = all.filter((g) => (this.slot ? g.slot === this.slot : true));
    this.draw();
  }

  private draw(): void {
    this.body.removeAll();
    this.text(REF_W / 2, 160, this.slot ? `${this.slot} · ${this.list.length} owned` : `${this.list.length} items`, { fontSize: '36px', color: T.dim }).setOrigin(0.5);
    this.list.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((g, i) => {
      const y = 260 + i * 120;
      const mine = this.characterId !== null && g.equippedBy === this.characterId;
      this.card(REF_W / 2 - 100, y, 1500, 108, mine ? 'hot' : 'normal');
      this.text(190, y - 24, `${g.name}  ${stars(g.rarity)}`, { fontFamily: F.display, fontSize: '28px', fontStyle: '600' }).setOrigin(0, 0.5);
      this.text(190, y + 22, `${g.unavailableReason ? `${g.unavailableReason} · ` : ''}${g.slot} · Lv ${g.level}/${g.levelCap}${g.equippedBy ? ` · on ${g.equippedBy}` : ''}   ${statLine(g)}`, { fontSize: '22px', color: T.dim }).setOrigin(0, 0.5);
      if (this.characterId) {
        this.button(REF_W - 250, y, { label: mine ? 'REMOVE' : 'EQUIP', w: 280, h: 90, fontSize: 28, variant: mine ? 'normal' : 'hot', onClick: () => void this.act(async () => { if (mine) await Services.api.unequip(g.id, this.releaseId); else await Services.api.equip(g.id, this.characterId as string, this.releaseId); this.say(mine ? 'Removed' : 'Equipped'); }) }).setEnabled(mine || !g.unavailableReason && g.passive?.supported !== false);
      }
    });
    const pages = Math.max(1, Math.ceil(this.list.length / PER_PAGE));
    if (pages > 1) {
      this.button(REF_W / 2 - 220, 980, { label: '‹', ariaLabel: 'Previous page', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + pages - 1) % pages; this.draw(); } });
      this.text(REF_W / 2, 980, `${this.page + 1} / ${pages}`, { fontSize: '36px' }).setOrigin(0.5);
      this.button(REF_W / 2 + 220, 980, { label: '›', ariaLabel: 'Next page', w: 160, h: 100, fontSize: 56, onClick: () => { this.page = (this.page + 1) % pages; this.draw(); } });
    }
  }

  private async act(fn: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await fn();
      await this.refresh();
    } catch (e) {
      this.say(errText(e));
    } finally {
      this.busy = false;
    }
  }
}

export const GearHost = hosted('Gear', () => new GearScene());
