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

  constructor() {
    super('Tasks');
  }

  protected async build(): Promise<void> {
    const [t, names] = await Promise.all([Services.api.tasks(), Services.api.catalogNames()]);
    let y = 190;
    const row = (v: TaskView, periodKey: string, note?: string): void => {
      this.card(REF_W / 2 - 100, y, 1500, 108, v.claimed ? 'dim' : v.done ? 'hot' : 'normal');
      this.add_(txt(this, 190, y - 24, `${v.title}   ${v.progress}/${v.objective.count}`, { fontFamily: F.display, fontSize: '28px', fontStyle: '600', color: v.claimed ? T.dim : T.text }).setOrigin(0, 0.5));
      this.add_(txt(this, 190, y + 22, `${describeAttachments(v.rewards, names)}${note ? `   ·   ${note}` : ''}`, { fontSize: '22px', color: T.dim }).setOrigin(0, 0.5));
      this.add_(new Button(this, REF_W - 250, y, { label: v.claimed ? 'CLAIMED' : 'CLAIM', w: 280, h: 90, fontSize: 28, variant: v.done && !v.claimed ? 'hot' : 'dim', onClick: () => void this.claim(periodKey, v.id) }).setEnabled(v.done && !v.claimed));
      y += 120;
    };
    const d = t.daily;
    if (d) {
      this.add_(txt(this, 190, y - 40, `THIS WINDOW · ends in ${left(d.endsAtMs - t.serverTimeMs)}`, { fontFamily: F.display, fontSize: '28px', color: T.gold }).setOrigin(0, 0.5));
      y += 10;
      d.tasks.forEach((v) => row(v, d.periodKey));
      row({ id: '_window_complete', title: 'Window complete', objective: { type: 'bonus', count: 1 }, progress: d.completion.ready ? 1 : 0, done: d.completion.ready, claimed: d.completion.claimed, rewards: d.completion.rewards }, d.periodKey);
    }
    if (t.weekly.length) {
      this.add_(txt(this, 190, y - 40, 'THIS WEEK', { fontFamily: F.display, fontSize: '28px', color: T.gold }).setOrigin(0, 0.5));
      y += 10;
      t.weekly.forEach((w) => row(w, w.periodKey, w.running ? `ends in ${left(w.endsAtMs - t.serverTimeMs)}` : 'claim before it expires'));
    }
    if (!d && t.weekly.length === 0) this.add_(txt(this, REF_W / 2, 400, 'No errands right now.', { fontSize: '40px' }).setOrigin(0.5));
  }

  private async claim(periodKey: string, taskId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await Services.api.claimTask(periodKey, taskId);
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
