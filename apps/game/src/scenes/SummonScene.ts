import { REF_H, REF_W } from '../config';
import { prefs } from '../platform/prefs';
import type { BannerInfo, PullResponse } from '../net/api';
import { currency } from '../net/currency';
import { Services } from '../services';
import type { DomGroup, DomNode } from '../ui/domKit';
import { pct, stars } from '../ui/format';
import { errText, HubScreen, titleStyle } from '../ui/hubScreen';
import { describeCompanionAttachment } from '../ui/pilotAttachment';
import { C, F, T } from '../ui/theme';

const RARITY_COLOR: Record<number, string> = { 5: '#ffd86b', 4: '#c9b6e4', 3: '#a99bb8' };

export class SummonScene extends HubScreen {
  protected readonly heading = 'SUMMON';
  private banners: BannerInfo[] = [];
  private pity = new Map<string, { pity5: number; pity4: number; lost: number }>();
  private names = new Map<string, string>();
  private idx = 0;
  private busy = false;
  private releaseId: string | undefined;
  private target: string | undefined;

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
    this.closeModal();
    this.body.removeAll();
    const b = this.banners[this.idx];
    if (!b) {
      this.text(REF_W / 2, 480, 'No banner is open right now.', { fontSize: 46 }).setOrigin(0.5);
      return;
    }
    const p = this.pity.get(b.pityGroup) ?? { pity5: 0, pity4: 0, lost: 0 };
    const next = p.pity5 + 1;
    this.target = b.featured?.targetMode === 'selectable' ? (this.target && b.pools.fiveFeatured.includes(this.target) ? this.target : b.pools.fiveFeatured[0]) : undefined;

    this.text(REF_W / 2, 175, b.title.toUpperCase(), titleStyle(54, T.text)).setOrigin(0.5);
    this.text(REF_W / 2, 235, `${this.idx + 1} / ${this.banners.length}${b.endsAt ? `   ·   ends ${b.endsAt.slice(0, 10)}` : ''}`, { fontSize: 28, color: T.dim }).setOrigin(0.5);
    if (this.banners.length > 1) {
      this.button(330, 190, { label: '‹', ariaLabel: 'Previous banner', w: 140, h: 130, fontSize: 64, onClick: () => { this.idx = (this.idx + this.banners.length - 1) % this.banners.length; this.draw(); } });
      this.button(REF_W - 330, 190, { label: '›', ariaLabel: 'Next banner', w: 140, h: 130, fontSize: 64, onClick: () => { this.idx = (this.idx + 1) % this.banners.length; this.draw(); } });
    }

    this.card(560, 520, 940, 440);
    const feat = b.featured ? `Featured: ${b.pools.fiveFeatured.map((i) => this.name(i)).join(', ')} — ${pct(b.featured.chance, 0)} on a 5★${b.featured.lossesToGuarantee === 1 ? ', guaranteed after a miss' : `, guaranteed after ${b.featured.lossesToGuarantee} misses`}` : `5★ pool: ${b.pools.fiveOther.map((i) => this.name(i)).join(', ')}`;
    const lines = [
      `5★ rate ${pct(b.baseFiveStarRate)}${b.softPity ? `, rising ${pct(b.softPity.increment, 0)} per pull from pull ${b.softPity.startPull}` : ''}, guaranteed by pull ${b.hardPity}`,
      feat,
      `A 4★ or better at least every ${b.minFourStarEvery} pulls. A 10-pull has no bonus rate.`,
      `Average ${b.analysis.expectedPullsPerFiveStar.toFixed(1)} pulls per 5★${b.analysis.expectedPullsPerTarget ? `, ${b.analysis.expectedPullsPerTarget.toFixed(1)} per featured (at most ${b.analysis.worstCasePullsForTarget})` : ''}`
    ];
    this.text(120, 340, lines.join('\n\n'), { fontSize: 31, wordWrap: { width: 880 }, lineSpacing: 2 });

    this.card(1400, 520, 760, 440, 'hot');
    this.text(1400, 350, 'PITY', { fontFamily: F.display, fontSize: 34, fontStyle: '600', color: T.gold }).setOrigin(0.5);
    this.text(1400, 410, `Pull ${next} of ${b.hardPity}`, { fontSize: 52 }).setOrigin(0.5);
    this.bar(1400, 480, 600, 26, () => C.goldHi).set(Math.min(1, p.pity5 / b.hardPity));
    const rateNow = Math.min(1, next >= b.hardPity ? 1 : b.softPity && next >= b.softPity.startPull ? b.baseFiveStarRate + b.softPity.increment * (next - (b.softPity.startPull - 1)) : b.baseFiveStarRate);
    this.text(1400, 545, `5★ chance on the next pull: ${pct(rateNow)}`, { fontSize: 30 }).setOrigin(0.5);
    const guaranteed = b.featured && p.lost >= b.featured.lossesToGuarantee;
    this.text(1400, 600, guaranteed ? 'The next 5★ is the featured one.' : b.featured ? `Misses so far: ${p.lost} / ${b.featured.lossesToGuarantee}` : '', { fontSize: 30, color: guaranteed ? T.heal : T.dim }).setOrigin(0.5);
    this.text(1400, 655, `4★ guaranteed in ${Math.max(1, b.minFourStarEvery - p.pity4)} pull(s)`, { fontSize: 28, color: T.dim }).setOrigin(0.5);
    if (b.featured?.targetMode === 'selectable') {
      this.button(1400, 725, { label: `TARGET: ${this.name(this.target ?? '')}`, w: 640, h: 90, fontSize: 28, onClick: () => { const list = b.pools.fiveFeatured; this.target = list[(list.indexOf(this.target ?? '') + 1) % list.length]; this.draw(); } });
    }

    const one = b.cost.perPull;
    this.button(760, 850, { label: 'PULL ×1', sub: `${one.toLocaleString('en-US')} ${currency.name}`, w: 400, h: 130, fontSize: 42, variant: 'hot', onClick: () => void this.pull(b, 1) }).setEnabled(this.balance >= one);
    this.button(1180, 850, { label: 'PULL ×10', sub: `${(one * 10).toLocaleString('en-US')} ${currency.name}`, w: 400, h: 130, fontSize: 42, variant: 'hot', onClick: () => void this.pull(b, 10) }).setEnabled(this.balance >= one * 10);
    // the same currency pays for upgrades and shop items: show what a pull leaves behind
    this.text(970, 952, `You have ${this.balance.toLocaleString('en-US')} ${currency.name}. The same currency pays for upgrades and the shop: after ×10 you keep ${Math.max(0, this.balance - one * 10).toLocaleString('en-US')}.`, { fontSize: 27, color: T.dim }).setOrigin(0.5);
    this.button(760, 1026, { label: 'POOLS', w: 300, h: 84, fontSize: 28, onClick: () => this.showPools(b) });
    this.button(1180, 1026, { label: 'HISTORY', w: 300, h: 84, fontSize: 28, onClick: () => void this.showHistory() });
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

  /** a dimmed window with a heading and a CLOSE button (Escape closes it too) */
  private window(heading: string, w: number, h: number, closeY: number): DomGroup {
    const m = this.openModal(0.8, 0x000000);
    this.card(REF_W / 2, REF_H / 2, w, h, 'normal', m);
    this.text(REF_W / 2, REF_H / 2 - h / 2 + 64, heading, titleStyle(44, T.gold), m).setOrigin(0.5);
    this.button(REF_W / 2, REF_H / 2 + closeY, { label: 'CLOSE', w: 420, escape: true, onClick: () => this.closeModal() }, m);
    return m;
  }

  private showResults(r: PullResponse): void {
    const m = this.window(r.replayed ? 'RESULT (already rolled)' : 'THE THREAD PULLS TIGHT', 1760, 860, 340);
    const cx = REF_W / 2;
    const cy = REF_H / 2;
    const cols = Math.min(5, r.pulls.length);
    const cw = 300;
    const ch = 200;
    const reveal = !prefs().reducedMotion;
    r.pulls.forEach((p, i) => {
      const x = cx - ((cols - 1) * (cw + 20)) / 2 + (i % cols) * (cw + 20);
      const y = cy - 100 + Math.floor(i / cols) * (ch + 24) - (r.pulls.length > 5 ? 20 : -90);
      const attach = describeCompanionAttachment(p.itemId);
      const group: DomNode[] = [
        this.card(x, y, cw, ch, p.rarity === 5 ? 'hot' : p.rarity === 4 ? 'normal' : 'dim', m),
        this.text(x, y - 48, this.name(p.itemId), { fontFamily: F.display, fontSize: 28, fontStyle: '600', color: RARITY_COLOR[p.rarity] }, m).setOrigin(0.5).fit(cw - 30),
        this.text(x, y - 8, stars(p.rarity), { fontSize: 32, color: RARITY_COLOR[p.rarity] }, m).setOrigin(0.5),
        this.text(x, y + 28, attach.formationSlot.toUpperCase(), { fontSize: 18, color: T.gold }, m).setOrigin(0.5),
        this.text(x, y + 62, p.duplicate ? `+${p.shards} shards` : p.outcome === 'guaranteed' ? 'NEW · guaranteed' : 'NEW', { fontSize: 24, color: p.duplicate ? T.dim : T.heal }, m).setOrigin(0.5)
      ];
      if (!reveal) return;
      // cards turn up one after another
      for (const node of group) {
        node.setAlpha(0);
        node.el.style.transition = `opacity 260ms ease ${140 * i}ms`;
      }
      requestAnimationFrame(() => requestAnimationFrame(() => group.forEach((node) => node.setAlpha(1))));
    });
  }

  private showPools(b: BannerInfo): void {
    const m = this.window('POOLS & RATES', 1500, 840, 340);
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
    this.text(REF_W / 2 - 680, REF_H / 2 - 270, body.join('\n'), { fontSize: 29, wordWrap: { width: 1360 }, lineSpacing: 8 }, m);
  }

  private async showHistory(): Promise<void> {
    try {
      const rows = await Services.api.history();
      if (!this.isCurrentView()) return;
      const m = this.window('YOUR LAST PULLS', 1500, 860, 350);
      const text = rows.length ? rows.slice(0, 14).map((r) => `${stars(r.rarity).padEnd(5, ' ')}  ${this.name(r.item_id)}  ·  ${r.banner_id}  ·  pull ${r.pull_number}${r.duplicate ? '  (duplicate)' : ''}`).join('\n') : 'Nothing yet.';
      this.text(REF_W / 2 - 680, REF_H / 2 - 290, text, { fontSize: 28, lineSpacing: 6 }, m);
    } catch (e) {
      this.say(errText(e));
    }
  }
}

