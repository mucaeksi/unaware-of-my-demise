import { RATION_COST, type ChapterIndex } from '@uomd/content-schema';
import { REF_H, REF_W } from '../config';
import { hosted } from '../core/host';
import { loadEntry } from '../entry/state';
import { playNode } from '../flow';
import { Progress, Services } from '../services';
import type { DomScroll } from '../ui/domKit';
import { HubScreen, titleStyle } from '../ui/hubScreen';
import { F, T } from '../ui/theme';

type Node = ChapterIndex['chapters'][number]['nodes'][number];

/** where the scroll area starts (below the heading); rows are laid out in screen coordinates and shifted by this */
const TOP = 140;

/** The campaign map: chapters, their nodes, stars and star chests. Scrolls natively (touch, wheel, keyboard). */
export class ChaptersScene extends HubScreen {
  protected readonly heading = 'CHAPTERS & STAR REWARDS';
  protected override readonly needsSignIn = false;
  protected override readonly usesWallet = false;
  protected override readonly backTo = 'Title';

  protected async build(): Promise<void> {
    const api = Services.api;
    const { content } = Services.ready();
    const index = await content.chapters();
    const baseIndex = JSON.parse(new TextDecoder().decode(await content.base.read('chapters/chapter_index.json'))) as ChapterIndex;
    const baseNodes = new Set(baseIndex.chapters.flatMap((c) => c.nodes.map((n) => n.node_id)));
    let progress = Progress.load();
    if (api.signedIn) {
      try {
        const authoritative = await api.progress();
        progress = Object.fromEntries(authoritative.nodes.filter((node) => node.clears > 0).map((node) => [node.node_id, { stars: node.stars }]));
      } catch {
        if (!this.isCurrentView()) return;
        this.text(REF_W / 2, REF_H / 2, 'Story progress could not be loaded', titleStyle(44, T.crimson)).setOrigin(0.5);
        this.button(REF_W / 2, REF_H / 2 + 180, { label: 'RETRY', onClick: () => void this.refresh() });
        return;
      }
    }
    const active = await content.activeReleaseId();
    if (!this.isCurrentView()) return;

    const sc = this.scroll(0, TOP, REF_W, REF_H - TOP);
    const entryDone = loadEntry().phase === 'completed';
    const hasCampaign = index.chapters.some((ch) => ch.chapter_id !== 'tutorial');
    let y = 240;
    let firstOpen = -1;
    for (const ch of index.chapters) {
      const isTutorial = ch.chapter_id === 'tutorial';
      const revealed = (isTutorial && entryDone) || ch.nodes.some((node) => progress[node.node_id] || !node.requires || progress[node.requires]);
      const heading = isTutorial && entryDone ? `${ch.title_en} · Replay` : revealed ? ch.title_en : 'Locked chapter';
      this.text(310, y - 16 - TOP, heading.toUpperCase(), { fontFamily: F.display, fontSize: 32, fontStyle: '600', color: T.gold }, sc).setOrigin(0, 0.5);
      // chapter star milestones
      const battleNodes = ch.nodes.filter((n) => n.kind === 'battle');
      const maxStars = Math.max(3, battleNodes.length * 3);
      const earned = battleNodes.reduce((sum, n) => sum + (progress[n.node_id]?.stars ?? 0), 0);
      if (revealed && battleNodes.length > 0) this.starBar(sc, y - 16 - TOP, earned, maxStars);
      y += 82;
      for (const node of ch.nodes) {
        const tutorialReplay = isTutorial && entryDone;
        if ((!isTutorial || !hasCampaign) && firstOpen < 0 && !progress[node.node_id] && !(node.requires && !progress[node.requires])) firstOpen = y;
        this.row(sc, node, y - TOP, progress, baseNodes.has(node.node_id) ? null : active, tutorialReplay);
        y += 160;
      }
      y += 24;
    }
    sc.setContentHeight(y + 160 - TOP);
    sc.scrollTo(Math.max(0, (firstOpen < 0 ? 0 : firstOpen) - 420));
  }

  private starBar(sc: DomScroll, y: number, earned: number, max: number): void {
    const t1 = Math.max(1, Math.ceil(max / 3));
    const t2 = Math.max(2, Math.ceil((max * 2) / 3));
    const tiers = [
      { stars: t1, reward: '150 Silver' },
      { stars: t2, reward: '300 Silver' },
      { stars: max, reward: '1 Calling Ember' }
    ];
    const x = REF_W / 2 + 230;
    const pill = this.box(x - 370, y - 25, 740, 50, 0x140b1e, 0.52, sc);
    pill.el.style.borderRadius = '25px';
    pill.el.style.border = '1.5px solid rgba(184,151,90,.48)';
    const tierStr = tiers.map((t, idx) => `${earned >= t.stars ? '★' : '☆'}${t.stars} Tier ${idx + 1} (${t.reward})`).join('   ·   ');
    this.text(x, y, `CHAPTER STARS: ${earned}/${max}★   |   ${tierStr}`, { fontFamily: F.display, fontSize: 16, fontStyle: '600', color: earned > 0 ? T.gold : T.dim }, sc).setOrigin(0.5);
  }

  private row(sc: DomScroll, node: Node, y: number, progress: Record<string, { stars: number }>, patchedBy: string | null, tutorialReplay: boolean): void {
    const done = progress[node.node_id];
    const locked = !tutorialReplay && Boolean(node.requires && !progress[node.requires]);
    const label = locked ? (node.kind === 'story' ? 'Locked story' : 'Locked battle') : node.title_en;
    const cost = node.ration_class ? RATION_COST[node.ration_class] : 0;
    const battleLabel = cost === 0 ? 'Free practice · one-time rewards only' : `Story and battle · ${cost} Ration`;
    const sub = locked ? 'Finish the previous story step first' : node.kind === 'battle' ? battleLabel : 'Story';
    const stars = done ? done.stars : 0;
    const card = this.card(REF_W / 2, y, 1300, 138, locked ? 'dim' : 'normal', sc);
    if (!locked) card.onTap(() => void playNode(this.host, node), `${label}. ${sub}.${done ? ` ${stars} of 3 stars.` : ''}`);
    this.text(REF_W / 2 - 600, y - 20, label.toUpperCase(), titleStyle(38, locked ? T.dim : T.text), sc).setOrigin(0, 0.5);
    this.text(REF_W / 2 - 600, y + 28, sub, { fontSize: 28, color: T.dim }, sc);
    if (patchedBy) {
      this.card(REF_W / 2 + 330, y - 28, 250, 52, 'hot', sc);
      this.text(REF_W / 2 + 330, y - 28, `NEW · ${patchedBy}`, { fontFamily: F.display, fontSize: 20, fontStyle: '600', color: T.gold }, sc).setOrigin(0.5);
    }
    this.text(REF_W / 2 + 493, y + 22, '★★★'.slice(0, stars) + '☆☆☆'.slice(stars), { fontSize: 38, color: stars > 0 ? '#e3c37d' : '#5a4a66', letterSpacing: 6 }, sc).setOrigin(0.5);
    if (!locked && !tutorialReplay && node.kind === 'battle' && cost > 0 && done && done.stars >= 3 && Services.api.signedIn) {
      this.button(REF_W / 2 + 220, y + 24, {
        label: `SWEEP (${cost}R)`,
        w: 210,
        h: 56,
        fontSize: 21,
        onClick: () =>
          void (async () => {
            try {
              await Services.api.sweepStage(await Services.ready().content.activeReleaseId(), node.node_id, 1);
            } catch (e) {
              this.say(e instanceof Error ? e.message : String(e));
            }
            await this.refresh();
          })()
      }, sc);
    }
  }
}

export const ChaptersHost = hosted('Chapters', () => new ChaptersScene());
