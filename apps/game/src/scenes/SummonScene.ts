import type Phaser from 'phaser';
import { REF_H, REF_W } from '../config';
import { prefs } from '../platform/prefs';
import type { BannerInfo, PullResponse } from '../net/api';
import { currency } from '../net/currency';
import { Services } from '../services';
import { errText, HubScene } from '../ui/hub';
import { pct, stars } from '../ui/format';
import { Bar, Button, panel, title, txt } from '../ui/kit';
import { C, DEPTH, F, T } from '../ui/theme';

const RARITY_COLOR: Record<number, string> = { 5: '#ffd86b', 4: '#c9b6e4', 3: '#a99bb8' };

export class SummonScene extends HubScene {
  protected readonly heading = 'SUMMON';
  private banners: BannerInfo[] = [];
  private pity = new Map<string, { pity5: number; pity4: number; lost: number }>();
  private names = new Map<string, string>();
  private idx = 0;
  private busy = false;
  private releaseId: string | undefined;
  private overlay: Phaser.GameObjects.Container | null = null;
  private target: string | undefined;

  constructor() {
    super('Summon');
  }

  protected async build(): Promise<void> {
    const api = Services.api;
    this.releaseId = await Services.ready().content.activeReleaseId();
    const [banners, state, roster, names] = await Promise.all([api.banners(this.releaseId), api.gachaState(), api.roster(this.releaseId), api.catalogNames(this.releaseId)]);
    this.banners = banners;
    this.pity = new Map(state.map((s) => [s.pity_group, s]));
    this.names = new Map([...names, ...roster.map((c): [string, string] => [c.id, c.name_en])]);
    if (this.idx >= banners.length) this.idx = 0;
    this.draw();
  }

  private name(id: string): string {
    return this.names.get(id) ?? id;
  }

  private draw(): void {
    this.body.removeAll(true);
    const b = this.banners[this.idx];
    if (!b) {
      this.add_(txt(this, REF_W / 2, 480, 'No banner is open right now.', { fontSize: '46px' }).setOrigin(0.5));
      return;
    }
    const p = this.pity.get(b.pityGroup) ?? { pity5: 0, pity4: 0, lost: 0 };
    const next = p.pity5 + 1;
    this.target = b.featured?.targetMode === 'selectable' ? (this.target && b.pools.fiveFeatured.includes(this.target) ? this.target : b.pools.fiveFeatured[0]) : undefined;

    this.add_(title(this, REF_W / 2, 175, b.title.toUpperCase(), 54, T.text));
    this.add_(txt(this, REF_W / 2, 235, `${this.idx + 1} / ${this.banners.length}${b.endsAt ? `   ·   ends ${b.endsAt.slice(0, 10)}` : ''}`, { fontSize: '28px', color: T.dim }).setOrigin(0.5));
    if (this.banners.length > 1) {
      this.add_(new Button(this, 330, 190, { label: '‹', w: 140, h: 130, fontSize: 64, onClick: () => { this.idx = (this.idx + this.banners.length - 1) % this.banners.length; this.draw(); } }));
      this.add_(new Button(this, REF_W - 330, 190, { label: '›', w: 140, h: 130, fontSize: 64, onClick: () => { this.idx = (this.idx + 1) % this.banners.length; this.draw(); } }));
    }

    this.card(560, 520, 940, 440);
    const feat = b.featured ? `Featured: ${b.pools.fiveFeatured.map((i) => this.name(i)).join(', ')} — ${pct(b.featured.chance, 0)} on a 5★${b.featured.lossesToGuarantee === 1 ? ', guaranteed after a miss' : `, guaranteed after ${b.featured.lossesToGuarantee} misses`}` : `5★ pool: ${b.pools.fiveOther.map((i) => this.name(i)).join(', ')}`;
    const lines = [
      `5★ rate ${pct(b.baseFiveStarRate)}${b.softPity ? `, rising ${pct(b.softPity.increment, 0)} per pull from pull ${b.softPity.startPull}` : ''}, guaranteed by pull ${b.hardPity}`,
      feat,
      `A 4★ or better at least every ${b.minFourStarEvery} pulls. A 10-pull has no bonus rate.`,
      `Average ${b.analysis.expectedPullsPerFiveStar.toFixed(1)} pulls per 5★${b.analysis.expectedPullsPerTarget ? `, ${b.analysis.expectedPullsPerTarget.toFixed(1)} per featured (at most ${b.analysis.worstCasePullsForTarget})` : ''}`
    ];
    this.add_(txt(this, 120, 340, lines.join('\n\n'), { fontSize: '31px', wordWrap: { width: 880 }, lineSpacing: 2 }));

    this.card(1400, 520, 760, 440, 'hot');
    this.add_(txt(this, 1400, 350, 'PITY', { fontFamily: F.display, fontSize: '34px', fontStyle: '600', color: T.gold }).setOrigin(0.5));
    this.add_(txt(this, 1400, 410, `Pull ${next} of ${b.hardPity}`, { fontSize: '52px' }).setOrigin(0.5));
    const bar = new Bar(this, 1400, 480, 600, 26, () => C.goldHi);
    bar.set(Math.min(1, p.pity5 / b.hardPity), false);
    this.add_(bar);
    const rateNow = Math.min(1, next >= b.hardPity ? 1 : b.softPity && next >= b.softPity.startPull ? b.baseFiveStarRate + b.softPity.increment * (next - (b.softPity.startPull - 1)) : b.baseFiveStarRate);
    this.add_(txt(this, 1400, 545, `5★ chance on the next pull: ${pct(rateNow)}`, { fontSize: '30px' }).setOrigin(0.5));
    const guaranteed = b.featured && p.lost >= b.featured.lossesToGuarantee;
    this.add_(txt(this, 1400, 600, guaranteed ? 'The next 5★ is the featured one.' : b.featured ? `Misses so far: ${p.lost} / ${b.featured.lossesToGuarantee}` : '', { fontSize: '30px', color: guaranteed ? T.heal : T.dim }).setOrigin(0.5));
    this.add_(txt(this, 1400, 655, `4★ guaranteed in ${Math.max(1, b.minFourStarEvery - p.pity4)} pull(s)`, { fontSize: '28px', color: T.dim }).setOrigin(0.5));
    if (b.featured?.targetMode === 'selectable') {
      this.add_(new Button(this, 1400, 725, { label: `TARGET: ${this.name(this.target ?? '')}`, w: 640, h: 90, fontSize: 28, onClick: () => { const list = b.pools.fiveFeatured; this.target = list[(list.indexOf(this.target ?? '') + 1) % list.length]; this.draw(); } }));
    }

    const one = b.cost.perPull;
    this.add_(new Button(this, 760, 850, { label: 'PULL ×1', sub: `${one.toLocaleString('en-US')} ${currency.name}`, w: 400, h: 130, fontSize: 42, variant: 'hot', onClick: () => void this.pull(b, 1) }).setEnabled(this.balance >= one));
    this.add_(new Button(this, 1180, 850, { label: 'PULL ×10', sub: `${(one * 10).toLocaleString('en-US')} ${currency.name}`, w: 400, h: 130, fontSize: 42, variant: 'hot', onClick: () => void this.pull(b, 10) }).setEnabled(this.balance >= one * 10));
    // the same currency pays for upgrades and shop items: show what a pull leaves behind
    this.add_(txt(this, 970, 952, `You have ${this.balance.toLocaleString('en-US')} ${currency.name}. The same currency pays for upgrades and the shop: after ×10 you keep ${Math.max(0, this.balance - one * 10).toLocaleString('en-US')}.`, { fontSize: '27px', color: T.dim }).setOrigin(0.5));
    this.add_(new Button(this, 760, 1026, { label: 'POOLS', w: 300, h: 84, fontSize: 28, onClick: () => this.showPools(b) }));
    this.add_(new Button(this, 1180, 1026, { label: 'HISTORY', w: 300, h: 84, fontSize: 28, onClick: () => void this.showHistory() }));
  }

  private async pull(b: BannerInfo, count: 1 | 10): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await Services.api.pull(b.id, count, this.target, this.releaseId);
      const st = await Services.api.gachaState();
      this.pity = new Map(st.map((s) => [s.pity_group, s]));
      await this.updateWallet();
      this.draw();
      this.showResults(r);
    } catch (e) {
      this.say(errText(e));
    } finally {
      this.busy = false;
    }
  }

  private modal(heading: string, w: number, h: number): { items: Phaser.GameObjects.GameObject[]; cx: number; cy: number } {
    this.overlay?.destroy();
    const dim = this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x000000, 0.8).setInteractive();
    const box = panel(this, REF_W / 2, REF_H / 2, w, h, 'normal');
    const head = title(this, REF_W / 2, REF_H / 2 - h / 2 + 64, heading, 44, T.gold);
    return { items: [dim, box, head], cx: REF_W / 2, cy: REF_H / 2 };
  }

  private showResults(r: PullResponse): void {
    const { items, cx, cy } = this.modal(r.replayed ? 'RESULT (already rolled)' : 'THE THREAD PULLS TIGHT', 1760, 860);
    const cols = Math.min(5, r.pulls.length);
    const cw = 300;
    const ch = 200;
    r.pulls.forEach((p, i) => {
      const x = cx - ((cols - 1) * (cw + 20)) / 2 + (i % cols) * (cw + 20);
      const y = cy - 100 + Math.floor(i / cols) * (ch + 24) - (r.pulls.length > 5 ? 20 : -90);
      const card = panel(this, x, y, cw, ch, p.rarity === 5 ? 'hot' : p.rarity === 4 ? 'normal' : 'dim');
      const nm = txt(this, x, y - 40, this.name(p.itemId), { fontFamily: F.display, fontSize: '28px', fontStyle: '600', color: RARITY_COLOR[p.rarity] }).setOrigin(0.5);
      if (nm.width > cw - 30) nm.setScale((cw - 30) / nm.width);
      const star = txt(this, x, y + 5, stars(p.rarity), { fontSize: '34px', color: RARITY_COLOR[p.rarity] }).setOrigin(0.5);
      const tag = txt(this, x, y + 58, p.duplicate ? `+${p.shards} shards` : p.outcome === 'guaranteed' ? 'NEW · guaranteed' : 'NEW', { fontSize: '26px', color: p.duplicate ? T.dim : T.heal }).setOrigin(0.5);
      const group = [card, nm, star, tag];
      items.push(...group);
      if (!prefs().reducedMotion) {
        group.forEach((o) => (o as Phaser.GameObjects.Image).setAlpha(0));
        this.tweens.add({ targets: group, alpha: 1, duration: 260, delay: 140 * i });
      }
    });
    items.push(new Button(this, cx, cy + 340, { label: 'CLOSE', w: 420, onClick: () => { this.overlay?.destroy(); this.overlay = null; } }));
    this.overlay = this.add.container(0, 0, items).setDepth(DEPTH.modal);
  }

  private showPools(b: BannerInfo): void {
    const { items, cx, cy } = this.modal('POOLS & RATES', 1500, 840);
    const list = (ids: string[]): string => (ids.length ? ids.map((i) => this.name(i)).join(', ') : '—');
    const body = [
      `5★ featured: ${list(b.pools.fiveFeatured)}`,
      `5★ other: ${list(b.pools.fiveOther)}`,
      `4★: ${list(b.pools.four)}`,
      `3★: ${list(b.pools.three)}`,
      '',
      `Duplicates become character-bound Memory Shards: 5★ ${b.duplicateShards['5']}, 4★ ${b.duplicateShards['4']}, 3★ ${b.duplicateShards['3']}.`,
      `Pity is kept per account and shared between banners of the same kind.`
    ];
    items.push(txt(this, cx - 680, cy - 270, body.join('\n'), { fontSize: '29px', wordWrap: { width: 1360 }, lineSpacing: 8 }));
    items.push(new Button(this, cx, cy + 340, { label: 'CLOSE', w: 420, onClick: () => { this.overlay?.destroy(); this.overlay = null; } }));
    this.overlay = this.add.container(0, 0, items).setDepth(DEPTH.modal);
  }

  private async showHistory(): Promise<void> {
    try {
      const rows = await Services.api.history();
      const { items, cx, cy } = this.modal('YOUR LAST PULLS', 1500, 860);
      const text = rows.length ? rows.slice(0, 14).map((r) => `${stars(r.rarity).padEnd(5, ' ')}  ${this.name(r.item_id)}  ·  ${r.banner_id}  ·  pull ${r.pull_number}${r.duplicate ? '  (duplicate)' : ''}`).join('\n') : 'Nothing yet.';
      items.push(txt(this, cx - 680, cy - 290, text, { fontSize: '28px', lineSpacing: 6 }));
      items.push(new Button(this, cx, cy + 350, { label: 'CLOSE', w: 420, onClick: () => { this.overlay?.destroy(); this.overlay = null; } }));
      this.overlay = this.add.container(0, 0, items).setDepth(DEPTH.modal);
    } catch (e) {
      this.say(errText(e));
    }
  }
}
