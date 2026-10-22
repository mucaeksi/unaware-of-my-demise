import { ApiError, type ArenaState, type EndlessModifier, type EndlessState, type TeamMember } from '../net/api';
import { Services } from '../services';
import { describeAttachments, idLabel } from '../ui/format';
import { errText, HubScreen } from '../ui/hubScreen';
import { F, T } from '../ui/theme';

const ARENA_X = 500;
const ENDLESS_X = 1420;
const COL_W = 820;
const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const signed = (n: number): string => (n >= 0 ? `+${n}` : String(n));

/**
 * Asynchronous Arena and the Endless Corridor. Both battles are resolved by the server from the player's team (auto
 * play); the screen shows the outcome. Ratings, limits, waves and rewards are server state.
 */
export class TrialsScene extends HubScreen {
  protected readonly heading = 'TRIALS';
  private busy = false;
  private releaseId = '';
  private names = new Map<string, string>();
  /** an endless session whose wave was lost: the server keeps it, but the same team replays the same loss */
  private fallenSession: string | null = null;

  protected async build(): Promise<void> {
    this.releaseId = await Services.ready().content.activeReleaseId();
    const [arena, endless, names] = await Promise.all([Services.api.arenaState(this.releaseId), Services.api.endlessState(this.releaseId), Services.api.catalogNames(this.releaseId)]);
    if (!this.isCurrentView()) return;
    this.names = names;
    this.drawArena(arena);
    this.drawEndless(endless);
  }

  private columnHead(x: number, title: string, line: string): void {
    this.text(x, 190, title, { fontFamily: F.display, fontSize: 34, fontStyle: '600', color: T.gold }).setOrigin(0.5);
    this.text(x, 245, line, { fontSize: 24, color: T.dim }).setOrigin(0.5);
  }

  private drawArena(a: ArenaState): void {
    const defCount = a.defense?.length ?? 0;
    this.columnHead(ARENA_X, 'ARENA', `${idLabel(a.tier)} · rating ${a.rating} · matches ${a.dailyUsed}/${a.dailyLimit} · season ends ${day(a.season.endsAtMs)}`);
    if (!a.unlocked) {
      this.text(ARENA_X, 450, 'Clear a campaign battle to enter the Arena.', { fontSize: 30, color: T.dim }).setOrigin(0.5);
      return;
    }
    const canFight = a.dailyUsed < a.dailyLimit;
    a.opponents.forEach((o, i) => {
      const y = 350 + i * 115;
      this.card(ARENA_X, y, COL_W, 100, 'normal');
      this.text(ARENA_X - COL_W / 2 + 30, y - 18, o.displayName, { fontFamily: F.display, fontSize: 28, fontStyle: '600', color: T.text }).setOrigin(0, 0.5);
      this.text(ARENA_X - COL_W / 2 + 30, y + 22, `Lv ${o.level} · rating ${o.rating}`, { fontSize: 22, color: T.dim }).setOrigin(0, 0.5);
      this.button(ARENA_X + COL_W / 2 - 130, y, { label: 'FIGHT', w: 220, h: 80, fontSize: 26, variant: canFight ? 'hot' : 'dim', onClick: () => void this.fight(o.opponentId, o.displayName) }).setEnabled(canFight);
    });
    const claimable = a.wins >= 1 && !a.seasonClaimed;
    this.text(ARENA_X, 720, `Season reward (${idLabel(a.tier)}): ${describeAttachments(a.seasonRewards, this.names)}`, { fontSize: 22, color: T.dim }).setOrigin(0.5);
    this.button(ARENA_X - 210, 810, {
      label: defCount ? 'UPDATE DEFENSE' : 'SET DEFENSE',
      sub: defCount ? `${defCount} guard${defCount === 1 ? '' : 's'} active` : 'Use active team',
      w: 380,
      h: 100,
      fontSize: 24,
      variant: defCount ? 'normal' : 'hot',
      onClick: () => void this.saveDefense()
    });
    this.button(ARENA_X + 210, 810, {
      label: a.seasonClaimed ? 'SEASON CLAIMED' : 'CLAIM SEASON',
      sub: claimable ? undefined : a.seasonClaimed ? undefined : 'Win a match first',
      w: 380,
      h: 100,
      fontSize: 24,
      variant: claimable ? 'hot' : 'dim',
      onClick: () => void this.act(async () => {
        const r = await Services.api.claimArenaSeason(a.season.seasonId, this.releaseId);
        return `Season reward (${idLabel(r.tier)}): ${describeAttachments(r.rewards, this.names)}`;
      })
    }).setEnabled(claimable);
  }

  private drawEndless(s: EndlessState): void {
    this.columnHead(ENDLESS_X, 'ENDLESS CORRIDOR', `Best wave ${s.bestWave}`);
    if (!s.unlocked) {
      this.text(ENDLESS_X, 450, 'Clear a campaign battle to enter the corridor.', { fontSize: 30, color: T.dim }).setOrigin(0.5);
      return;
    }
    const run = s.activeRun && s.activeRun.releaseId === this.releaseId && s.activeRun.sessionId !== this.fallenSession ? s.activeRun : null;
    if (run) {
      this.text(ENDLESS_X, 330, `Run in progress · ${idLabel(run.modifier)}`, { fontSize: 26, color: T.text }).setOrigin(0.5);
      this.button(ENDLESS_X, 430, { label: `FIGHT WAVE ${run.wave}`, w: 560, h: 110, fontSize: 30, variant: 'hot', onClick: () => void this.wave(run.sessionId, run.wave) });
    } else {
      this.text(ENDLESS_X, 320, 'Start a run with one blessing:', { fontSize: 26, color: T.text }).setOrigin(0.5);
      s.availableModifiers.forEach((m, i) => {
        this.button(ENDLESS_X, 400 + i * 100, { label: idLabel(m.id).toUpperCase(), sub: m.description, w: 600, h: 90, fontSize: 24, onClick: () => void this.start(m.id) });
      });
    }
    s.milestones.forEach((ms, i) => {
      const y = 720 + i * 95;
      this.card(ENDLESS_X, y, COL_W, 82, ms.claimed ? 'dim' : ms.ready ? 'hot' : 'normal');
      this.text(ENDLESS_X - COL_W / 2 + 30, y, `Wave ${ms.wave}: ${describeAttachments(ms.rewards, this.names)}`, { fontSize: 22, color: ms.claimed ? T.dim : T.text }).setOrigin(0, 0.5);
      this.button(ENDLESS_X + COL_W / 2 - 120, y, { label: ms.claimed ? 'CLAIMED' : 'CLAIM', w: 200, h: 70, fontSize: 22, variant: ms.ready && !ms.claimed ? 'hot' : 'dim', onClick: () => void this.act(async () => {
        const r = await Services.api.claimEndlessMilestone(ms.wave, this.releaseId);
        return `Wave ${r.wave} milestone: ${describeAttachments(r.rewards, this.names)}`;
      }) }).setEnabled(ms.ready && !ms.claimed);
    });
  }

  private saveDefense(): Promise<void> {
    return this.act(async () => {
      const [teams, mine, roster] = await Promise.all([
        Services.api.teams(),
        Services.api.characters(this.releaseId),
        Services.api.roster(this.releaseId)
      ]);
      const active = teams.teams.find((t) => t.active);
      let members: TeamMember[] = active?.members?.length ? active.members : [];
      if (members.length === 0) {
        const roleById = new Map(roster.map((c) => [c.id, c.role]));
        const top = [...mine.characters].sort((a, b) => b.level - a.level || a.id.localeCompare(b.id)).slice(0, 5);
        let front = 0;
        let rear = 0;
        members = top.map((c, slot) => {
          const wantFront = /tank|bruiser|vanguard|knight|defender|shield|warden|front/i.test(roleById.get(c.id) ?? '');
          const row: 'front' | 'rear' = wantFront && front < 2 ? (front++, 'front') : rear < 3 ? (rear++, 'rear') : (front++, 'front');
          return { characterId: c.id, slot, row };
        });
      }
      await Services.api.setArenaDefense(members, this.releaseId);
      return `Arena defense set (${members.length} guard${members.length === 1 ? '' : 's'})`;
    });
  }

  private fight(opponentId: string, name: string): Promise<void> {
    return this.act(async () => {
      const r = await Services.api.fightArenaMatch(this.releaseId, opponentId);
      return `${r.won ? 'Victory' : 'Defeat'} against ${name} in ${r.turns} turns · rating ${signed(r.ratingDelta)} → ${r.ratingAfter} · ${describeAttachments(r.rewards, this.names)}`;
    });
  }

  private start(modifier: EndlessModifier): Promise<void> {
    return this.act(async () => {
      this.fallenSession = null;
      await Services.api.startEndless(this.releaseId, modifier);
      return `Run started · ${idLabel(modifier)}`;
    });
  }

  private wave(sessionId: string, wave: number): Promise<void> {
    return this.act(async () => {
      try {
        const r = await Services.api.submitEndlessWave(this.releaseId, sessionId);
        return `Wave ${r.clearedWave} cleared in ${r.turns} turns · ${describeAttachments(r.rewards, this.names)}`;
      } catch (e) {
        if (!(e instanceof ApiError) || e.code !== 'wave_not_won') throw e;
        this.fallenSession = sessionId;
        return `The corridor held at wave ${wave}. Start a new run.`;
      }
    });
  }

  /** one server action at a time; the screen re-reads server state afterwards, success or not */
  private async act(run: () => Promise<string>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      this.say(await run());
      await this.updateWallet();
    } catch (e) {
      this.say(errText(e));
    } finally {
      this.busy = false;
    }
    await this.refresh();
  }
}
