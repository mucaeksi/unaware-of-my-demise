import { REF_W } from '../config';
import { currency } from '../net/currency';
import { Services } from '../services';
import { errText, HubScene } from '../ui/hub';
import { stars } from '../ui/format';
import { Button, txt } from '../ui/kit';
import { F, T } from '../ui/theme';

const SLOTS = ['weapon', 'armor', 'necklace', 'ring'] as const;

/** One companion: level and ascension (materials from the server-side stacks), skill ranks, final stats and the four gear slots. */
export class CharacterScene extends HubScene {
  protected readonly heading = 'COMPANION';
  protected override readonly backTo = 'Roster';
  private id = '';
  private busy = false;

  constructor() {
    super('Character');
  }

  init(data: { id?: string }): void {
    this.id = data.id ?? '';
  }

  protected async build(): Promise<void> {
    const api = Services.api;
    const releaseId = await Services.ready().content.activeReleaseId();
    const [mine, roster, names, stacks, gear, st] = await Promise.all([api.characters(releaseId), api.roster(releaseId), api.catalogNames(releaseId), api.stacks(), api.gear(), api.characterStats(this.id, releaseId).catch(() => null)]);
    const c = mine.characters.find((x) => x.id === this.id);
    const meta = roster.find((x) => x.id === this.id);
    if (!c || !meta) {
      this.add_(txt(this, REF_W / 2, 400, 'You do not own this companion.', { fontSize: '40px' }).setOrigin(0.5));
      return;
    }
    const have = new Map(stacks.map((s) => [s.item_id, s.qty]));
    const nm = (id: string): string => names.get(id) ?? id;

    this.card(520, 430, 880, 520, meta.rarity === 5 ? 'hot' : 'normal');
    this.add_(txt(this, 520, 230, meta.name_en, { fontFamily: F.display, fontSize: '54px', fontStyle: '600', color: meta.rarity === 5 ? '#ffd86b' : T.text }).setOrigin(0.5));
    this.add_(txt(this, 520, 292, `${stars(meta.rarity)}   ${meta.element} · ${meta.role.replaceAll('_', ' ')}`, { fontSize: '30px', color: T.dim }).setOrigin(0.5));
    this.add_(txt(this, 520, 360, `Level ${c.level} / ${c.cap}    Ascension ${c.ascension}`, { fontSize: '40px' }).setOrigin(0.5));
    this.add_(txt(this, 520, 410, c.xpToNext === null ? 'Maximum level' : `XP ${c.xp} / ${c.xpToNext}`, { fontSize: '30px', color: T.dim }).setOrigin(0.5));
    const s = st?.stats ?? {};
    this.add_(txt(this, 520, 490, ['hp', 'atk', 'def', 'spd'].map((k) => `${k.toUpperCase()} ${Math.round(s[k] ?? 0)}`).join('    '), { fontSize: '34px', color: T.gold }).setOrigin(0.5));

    const xpItem = api.xpItems.find((i) => (have.get(i.itemId) ?? 0) > 0);
    const canLevel = c.level < c.cap && Boolean(xpItem);
    this.add_(new Button(this, 340, 600, { label: 'LEVEL UP', sub: xpItem ? `uses 1 ${nm(xpItem.itemId)}` : 'no XP items', w: 400, h: 120, fontSize: 32, variant: 'hot', onClick: () => void this.act(async () => { await api.levelUp(this.id, [{ itemId: (xpItem as { itemId: string }).itemId, quantity: 1 }], releaseId); this.say('Level up'); }) }).setEnabled(canLevel));
    const asc = c.nextAscension;
    const ascOk = Boolean(asc) && c.level >= c.cap && asc !== null && asc.items.every((i) => (have.get(i.itemId) ?? 0) >= i.quantity);
    this.add_(new Button(this, 700, 600, { label: 'ASCEND', sub: asc ? `→ cap ${asc.cap} · account Lv ${asc.accountLevel}` : 'fully ascended', w: 400, h: 120, fontSize: 32, onClick: () => void this.act(async () => { await api.ascend(this.id, releaseId); this.say('Ascended'); }) }).setEnabled(ascOk));
    if (asc) this.add_(txt(this, 520, 690, `${asc.items.map((i) => `${nm(i.itemId)} ${(have.get(i.itemId) ?? 0)}/${i.quantity}`).join('  ·  ')}  ·  ${Math.ceil(asc.fee)} ${currency.name}`, { fontSize: '26px', color: T.dim }).setOrigin(0.5));

    // skills
    this.add_(txt(this, 1280, 175, 'SKILLS', { fontFamily: F.display, fontSize: '34px', color: T.gold }).setOrigin(0.5));
    c.skills.forEach((sk, i) => {
      const y = 245 + i * 100;
      this.card(1280, y, 760, 88, 'dim');
      this.add_(txt(this, 930, y - 14, sk.name, { fontSize: '28px' }).setOrigin(0, 0.5));
      this.add_(txt(this, 930, y + 20, `${sk.type} · rank ${sk.rank}/${sk.maxRank}`, { fontSize: '22px', color: T.dim }).setOrigin(0, 0.5));
      const n = sk.next;
      const ok = n !== null && c.level >= n.unlockLevel && (have.get(n.itemId) ?? 0) >= n.quantity;
      this.add_(new Button(this, 1530, y, { label: n ? 'RANK UP' : 'MAX', sub: n ? `${nm(n.itemId)} ×${n.quantity}` : undefined, w: 220, h: 80, fontSize: 24, onClick: () => void this.act(async () => { await api.upgradeSkill(this.id, sk.skillId, releaseId); this.say(`${sk.name} improved`); }) }).setEnabled(ok));
    });

    // gear slots
    SLOTS.forEach((slot, i) => {
      const x = 330 + i * 330;
      const g = gear.find((x2) => x2.slot === slot && x2.equippedBy === this.id);
      this.card(x, 850, 310, 150, g ? 'normal' : 'dim');
      this.add_(txt(this, x, 805, slot.toUpperCase(), { fontSize: '22px', color: T.dim }).setOrigin(0.5));
      const label = this.add_(txt(this, x, 850, g ? g.name : '— empty —', { fontSize: '26px', color: g ? T.text : T.dim, align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5));
      if (label.height > 60) label.setScale(60 / label.height);
      this.add_(new Button(this, x, 925, { label: 'CHANGE', w: 200, h: 56, fontSize: 22, onClick: () => this.scene.start('Gear', { characterId: this.id, slot }) }));
    });
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
