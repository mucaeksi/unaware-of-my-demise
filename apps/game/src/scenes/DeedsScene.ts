import { REF_H, REF_W } from '../config';
import type { Attachment } from '../net/api';
import { Services } from '../services';
import type { DomScroll } from '../ui/domKit';
import { describeAttachments, idLabel } from '../ui/format';
import { errText, HubScreen } from '../ui/hubScreen';
import { F, T } from '../ui/theme';

const TOP = 130;
const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

interface DeedRow {
  title: string;
  detail: string;
  progress: number;
  target: number;
  done: boolean;
  claimed: boolean;
  rewards: Attachment[];
  claim: () => Promise<unknown>;
}

/** Seasonal event objectives and one-time achievements. Progress is counted by the server; the client only shows and claims. */
export class DeedsScene extends HubScreen {
  protected readonly heading = 'DEEDS';
  private busy = false;
  /** kept across the re-render after a claim, so the list does not jump back to the top */
  private scrollTop = 0;

  protected async build(): Promise<void> {
    const releaseId = await Services.ready().content.activeReleaseId();
    const [ach, ev, names] = await Promise.all([Services.api.achievements(releaseId), Services.api.events(releaseId), Services.api.catalogNames(releaseId)]);
    if (!this.isCurrentView()) return;
    const sc = this.scroll(0, TOP, REF_W, REF_H - TOP - 170);
    let y = 50;
    const heading = (s: string): void => {
      this.text(190, y, s, { fontFamily: F.display, fontSize: 28, color: T.gold }, sc).setOrigin(0, 0.5);
      y += 80;
    };
    const row = (r: DeedRow): void => {
      this.card(REF_W / 2 - 100, y, 1500, 108, r.claimed ? 'dim' : r.done ? 'hot' : 'normal', sc);
      this.text(190, y - 24, `${r.title}   ${r.progress}/${r.target}`, { fontFamily: F.display, fontSize: 28, fontStyle: '600', color: r.claimed ? T.dim : T.text }, sc).setOrigin(0, 0.5);
      this.text(190, y + 22, `${r.detail}${r.detail ? '   ·   ' : ''}${describeAttachments(r.rewards, names)}`, { fontSize: 22, color: T.dim }, sc).setOrigin(0, 0.5);
      this.button(REF_W - 250, y, { label: r.claimed ? 'CLAIMED' : 'CLAIM', w: 280, h: 90, fontSize: 28, variant: r.done && !r.claimed ? 'hot' : 'dim', onClick: () => void this.claim(r, sc) }, sc).setEnabled(r.done && !r.claimed);
      y += 120;
    };
    for (const e of ev.events.filter((x) => x.state !== 'ended')) {
      const when = e.state === 'scheduled' ? `starts ${day(e.startsAtMs)}` : e.state === 'active' ? `ends ${day(e.endsAtMs)}` : `claim before ${day(e.claimEndsAtMs)}`;
      heading(`${e.title.toUpperCase()}   ·   ${when}`);
      e.objectives.forEach((o) => row({ ...o, detail: '', done: o.done && e.state !== 'scheduled', claim: () => Services.api.claimEvent(e.eventId, o.id, releaseId) }));
      y += 20;
    }
    heading('ACHIEVEMENTS');
    ach.achievements.forEach((a) => row({ ...a, detail: `${a.description} Title: ${idLabel(a.badgeTitle)}`, claim: () => Services.api.claimAchievement(a.id, releaseId) }));
    sc.setContentHeight(y + 20);
    sc.scrollTo(this.scrollTop);
  }

  private async claim(r: DeedRow, sc: DomScroll): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.scrollTop = sc.el.scrollTop;
    try {
      await r.claim();
      this.say(`Claimed: ${r.title}`);
      await this.updateWallet();
    } catch (e) {
      this.say(errText(e));
    } finally {
      this.busy = false;
    }
    await this.refresh();
  }
}
