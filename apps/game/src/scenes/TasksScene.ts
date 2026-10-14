import { REF_W } from '../config';
import type { TaskView } from '../net/api';
import { Services } from '../services';
import { errText, HubScene } from '../ui/hub';
import { describeAttachments } from '../ui/format';
import { Button, txt } from '../ui/kit';
import { F, T } from '../ui/theme';

const left = (ms: number): string => {
  const m = Math.max(0, Math.floor(ms / 60000));
  return m >= 60 * 24 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** The 12-hour window tasks and the weekly cycle. Progress is counted by the server; the client only shows and claims. */
export class TasksScene extends HubScene {
  protected readonly heading = 'ERRANDS';
  private busy = false;
  private releaseId: string | undefined;

  constructor() {
    super('Tasks');
  }

  protected async build(): Promise<void> {
    this.releaseId = await Services.ready().content.activeReleaseId();
    const [t, names, afk] = await Promise.all([
      Services.api.tasks(this.releaseId),
      Services.api.catalogNames(this.releaseId),
      Promise.resolve(Services.api.afkStatus?.(this.releaseId)).catch(() => null),
    ]);
    let y = 190;
    if (afk) {
      const elapsedMin = Math.floor(afk.elapsedSeconds / 60);
      const capMin = Math.floor(afk.capSeconds / 60);
      const rewardPreview = afk.unlocked
        ? describeAttachments(afk.rewards, names) || 'Accumulating supplies…'
        : 'Clear Chapter I · 2 to unlock AFK Patrol';
      this.card(REF_W / 2 - 100, y, 1500, 108, afk.claimable ? 'hot' : 'normal');
      this.add_(txt(this, 190, y - 24, `AFK PATROL   (${elapsedMin}m / ${capMin}m cap)`, { fontFamily: F.display, fontSize: '26px', fontStyle: '600', color: T.gold }).setOrigin(0, 0.5));
      this.add_(txt(this, 190, y + 22, rewardPreview, { fontSize: '22px', color: T.dim }).setOrigin(0, 0.5));
      this.add_(new Button(this, REF_W - 250, y, { label: afk.claimable ? 'COLLECT' : 'PATROL', w: 280, h: 90, fontSize: 26, variant: afk.claimable ? 'hot' : 'dim', onClick: () => void this.claimAfkPatrol() }).setEnabled(afk.claimable));
      y += 135;
    }
    const row = (v: TaskView, periodKey: string, note?: string): void => {
      this.card(REF_W / 2 - 100, y, 1500, 108, v.claimed ? 'dim' : v.done ? 'hot' : 'normal');
      this.add_(txt(this, 190, y - 24, `${v.title}   ${v.progress}/${v.objective.count}`, { fontFamily: F.display, fontSize: '28px', fontStyle: '600', color: v.claimed ? T.dim : T.text }).setOrigin(0, 0.5));
      this.add_(txt(this, 190, y + 22, `${describeAttachments(v.rewards, new Map([...names, ...Object.entries(v.rewardNames ?? {})]))}${note ? `   ·   ${note}` : ''}`, { fontSize: '22px', color: T.dim }).setOrigin(0, 0.5));
      this.add_(new Button(this, REF_W - 250, y, { label: v.claimed ? 'CLAIMED' : 'CLAIM', w: 280, h: 90, fontSize: 28, variant: v.done && !v.claimed ? 'hot' : 'dim', onClick: () => void this.claim(periodKey, v.id) }).setEnabled(v.done && !v.claimed));
      y += 120;
    };
    const d = t.daily;
    if (d) {
      this.add_(txt(this, 190, y - 40, `THIS WINDOW · ends in ${left(d.endsAtMs - t.serverTimeMs)}`, { fontFamily: F.display, fontSize: '28px', color: T.gold }).setOrigin(0, 0.5));
      y += 10;
      d.tasks.forEach((v) => row(v, d.periodKey));
      row({ id: '_window_complete', title: 'Window complete', objective: { type: 'bonus', count: 1 }, progress: d.completion.ready ? 1 : 0, done: d.completion.ready, claimed: d.completion.claimed, rewards: d.completion.rewards, rewardNames: d.completion.rewardNames }, d.periodKey);
    }
    if (t.weekly.length) {
      this.add_(txt(this, 190, y - 40, 'THIS WEEK', { fontFamily: F.display, fontSize: '28px', color: T.gold }).setOrigin(0, 0.5));
      y += 10;
      t.weekly.forEach((w) => row(w, w.periodKey, w.running ? `ends in ${left(w.endsAtMs - t.serverTimeMs)}` : 'claim before it expires'));
    }
    if (!d && t.weekly.length === 0) this.add_(txt(this, REF_W / 2, 400, 'No errands right now.', { fontSize: '40px' }).setOrigin(0.5));
  }

  private async claimAfkPatrol(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await Services.api.claimAfk(this.releaseId);
      this.say(`Collected ${res.minutesAccrued}m patrol supplies`);
      await this.updateWallet();
      await this.refresh();
    } catch (e) {
      this.say(errText(e));
      await this.refresh();
    } finally {
      this.busy = false;
    }
  }

  private async claim(periodKey: string, taskId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await Services.api.claimTask(periodKey, taskId, this.releaseId);
      this.say('Reward claimed');
      await this.updateWallet();
      await this.refresh();
    } catch (e) {
      this.say(errText(e));
      await this.refresh();
    } finally {
      this.busy = false;
    }
  }
}
