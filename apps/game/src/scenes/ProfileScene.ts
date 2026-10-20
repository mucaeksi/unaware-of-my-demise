import { Services } from '../services';
import { idLabel } from '../ui/format';
import { errText, HubScreen } from '../ui/hubScreen';
import { F, T } from '../ui/theme';

type Board = 'campaign_stars' | 'arena' | 'endless';
const BOARDS: { id: Board; label: string; unit: string }[] = [
  { id: 'campaign_stars', label: 'STARS', unit: '★' },
  { id: 'arena', label: 'ARENA', unit: 'rating' },
  { id: 'endless', label: 'ENDLESS', unit: 'waves' }
];
const SUMMARY: [key: string, label: string][] = [
  ['accountLevel', 'Account level'],
  ['totalStars', 'Campaign stars'],
  ['totalClears', 'Stage victories'],
  ['ownedCharacters', 'Companions'],
  ['arenaRating', 'Arena rating'],
  ['endlessBestWave', 'Endless best wave']
];

/** The player's card (title badge from claimed achievements) and the three leaderboards. */
export class ProfileScene extends HubScreen {
  protected readonly heading = 'PROFILE';
  private board: Board = 'campaign_stars';
  private busy = false;

  protected async build(): Promise<void> {
    const releaseId = await Services.ready().content.activeReleaseId();
    const [p, lb] = await Promise.all([Services.api.profile(releaseId), Services.api.leaderboard(this.board, 10)]);
    if (!this.isCurrentView()) return;

    this.card(500, 540, 760, 700, 'normal');
    this.text(500, 250, p.displayName, { fontFamily: F.display, fontSize: 44, fontStyle: '600', color: T.text }).setOrigin(0.5);
    this.text(500, 310, idLabel(p.titleBadge), { fontSize: 30, color: T.gold }).setOrigin(0.5);
    SUMMARY.forEach(([key, label], i) => {
      const y = 400 + i * 62;
      this.text(200, y, label, { fontSize: 28, color: T.dim }).setOrigin(0, 0.5);
      this.text(800, y, String(p.summary[key] ?? 0), { fontFamily: F.display, fontSize: 30, color: T.text }).setOrigin(1, 0.5);
    });
    const badges = p.unlockedBadges;
    const next = badges[(badges.indexOf(p.titleBadge) + 1) % badges.length] ?? p.titleBadge;
    this.button(500, 820, { label: 'CHANGE TITLE', sub: badges.length > 1 ? `Next: ${idLabel(next)}` : 'Claim achievements for more titles', w: 560, h: 110, fontSize: 28, onClick: () => void this.setTitle(next) }).setEnabled(badges.length > 1);

    BOARDS.forEach((b, i) => {
      this.button(1080 + i * 230, 230, { label: b.label, w: 210, h: 80, fontSize: 24, variant: b.id === this.board ? 'hot' : 'dim', onClick: () => { this.board = b.id; void this.refresh(); } });
    });
    const unit = BOARDS.find((b) => b.id === this.board)!.unit;
    if (lb.entries.length === 0) this.text(1310, 500, 'No entries yet.', { fontSize: 32, color: T.dim }).setOrigin(0.5);
    lb.entries.forEach((e, i) => {
      const y = 340 + i * 58;
      const color = e.isMe ? T.gold : T.text;
      this.text(990, y, `#${e.rank}`, { fontFamily: F.display, fontSize: 26, color }).setOrigin(0, 0.5);
      this.text(1090, y, `${e.displayName}  ·  ${e.playerTag}`, { fontSize: 26, color }).setOrigin(0, 0.5);
      this.text(1760, y, `${e.score.toLocaleString('en-US')} ${unit}`, { fontSize: 26, color }).setOrigin(1, 0.5);
    });
  }

  private async setTitle(titleBadge: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await Services.api.updateProfile({ titleBadge });
      this.say(`Title: ${idLabel(titleBadge)}`);
    } catch (e) {
      this.say(errText(e));
    } finally {
      this.busy = false;
    }
    await this.refresh();
  }
}
