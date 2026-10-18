import Phaser from '../engine';
import { RATION_COST, type ChapterIndex } from '@uomd/content-schema';
import { REF_H, REF_W } from '../config';
import { loadEntry } from '../entry/state';
import { Progress, Services } from '../services';
import { Button, panel, sceneFadeIn, title, toast, txt } from '../ui/kit';
import { C, F, T } from '../ui/theme';
import { playNode } from '../flow';

type Node = ChapterIndex['chapters'][number]['nodes'][number];

export class ChaptersScene extends Phaser.Scene {
  private dragged = false;
  private generation = 0;

  constructor() {
    super('Chapters');
  }

  async create(): Promise<void> {
    const generation = ++this.generation;
    const api = Services.api;
    const revision = api.authRevision;
    const authChanged = () => this.scene.restart();
    api.addEventListener('auth', authChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { api.removeEventListener('auth', authChanged); this.generation++; });
    const { content, art } = Services.ready();
    this.cameras.main.setBackgroundColor(0x0a0610);
    void art.addBackdrop(this, 'forest_whispering_ash', -20);
    this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x0a0610, 0.72).setDepth(-10).setScrollFactor(0);
    sceneFadeIn(this, 400);
    this.dragged = false;

    const index = await content.chapters();
    const baseIndex = JSON.parse(new TextDecoder().decode(await content.base.read('chapters/chapter_index.json'))) as ChapterIndex;
    const baseNodes = new Set(baseIndex.chapters.flatMap((c) => c.nodes.map((n) => n.node_id)));
    let progress = Progress.load();
    if (api.signedIn) {
      try {
        const authoritative = await api.progress();
        progress = Object.fromEntries(authoritative.nodes.filter((node) => node.clears > 0).map((node) => [node.node_id, { stars: node.stars }]));
      } catch (error) {
        if (generation !== this.generation || revision !== api.authRevision) return;
        title(this, REF_W / 2, REF_H / 2, 'Story progress could not be loaded', 44, T.crimson);
        new Button(this, REF_W / 2, REF_H / 2 + 180, { label: 'RETRY', onClick: () => this.scene.restart() });
        new Button(this, 270, REF_H - 90, { label: 'BACK', onClick: () => this.scene.start('Title') });
        void error;
        return;
      }
    }
    const active = await content.activeReleaseId();
    if (generation !== this.generation || revision !== api.authRevision) return;

    const entryDone = loadEntry().phase === 'completed';
    const hasCampaign = index.chapters.some((ch) => ch.chapter_id !== 'tutorial');
    let y = 240;
    let firstOpen = -1;
    for (const ch of index.chapters) {
      const isTutorial = ch.chapter_id === 'tutorial';
      const revealed = (isTutorial && entryDone) || ch.nodes.some((node) => progress[node.node_id] || !node.requires || progress[node.requires]);
      const heading = isTutorial && entryDone ? `${ch.title_en} · Replay` : revealed ? ch.title_en : 'Locked chapter';
      txt(this, 310, y - 16, heading.toUpperCase(), { fontFamily: F.display, fontSize: '32px', fontStyle: '600', color: T.gold }).setOrigin(0, 0.5);

      // Chapter-by-Chapter Star Milestone Reward Bar
      const battleNodes = ch.nodes.filter((n) => n.kind === 'battle');
      const maxStars = Math.max(3, battleNodes.length * 3);
      const earnedStars = battleNodes.reduce((sum, n) => sum + (progress[n.node_id]?.stars ?? 0), 0);
      if (revealed && battleNodes.length > 0) {
        this.renderChapterStarBar(ch.chapter_id, y - 16, earnedStars, maxStars);
      }

      y += 82;
      for (const node of ch.nodes) {
        const tutorialReplay = isTutorial && entryDone;
        if ((!isTutorial || !hasCampaign) && firstOpen < 0 && !progress[node.node_id] && !(node.requires && !progress[node.requires])) {
          firstOpen = y;
        }
        this.row(node, y, progress, baseNodes.has(node.node_id) ? null : active, tutorialReplay);
        y += 160;
      }
      y += 24;
    }
    // the campaign is longer than the screen: drag or wheel to scroll, the heading and BACK stay put
    const height = y + 160;
    const cam = this.cameras.main;
    cam.setBounds(0, 0, REF_W, Math.max(REF_H, height));
    cam.scrollY = Phaser.Math.Clamp((firstOpen < 0 ? 0 : firstOpen) - 420, 0, Math.max(0, height - REF_H));
    let startY = 0;
    let startScroll = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      startY = p.y;
      startScroll = cam.scrollY;
      this.dragged = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const dy = startY - p.y;
      if (Math.abs(dy) > 14) this.dragged = true;
      if (this.dragged) cam.scrollY = Phaser.Math.Clamp(startScroll + dy, 0, Math.max(0, height - REF_H));
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, Math.max(0, height - REF_H));
    });
    const head = this.add.rectangle(REF_W / 2, 70, REF_W, 140, 0x0a0610, 0.78).setScrollFactor(0).setDepth(50);
    const hd = title(this, REF_W / 2, 86, 'CHAPTERS & STAR REWARDS', 54, T.gold).setScrollFactor(0).setDepth(51);
    const back = new Button(this, 240, REF_H - 84, { label: 'BACK', w: 280, h: 72, fontSize: 26, onClick: () => this.scene.start('Title') }).setScrollFactor(0).setDepth(51);
    void head;
    void hd;
    void back;
  }

  private renderChapterStarBar(chapterId: string, y: number, earned: number, max: number): void {
    const t1 = Math.max(1, Math.ceil(max / 3));
    const t2 = Math.max(2, Math.ceil((max * 2) / 3));
    const t3 = max;
    const tiers = [
      { stars: t1, reward: '150 Silver' },
      { stars: t2, reward: '300 Silver' },
      { stars: t3, reward: '1 Calling Ember' }
    ];
    const barX = REF_W / 2 + 230;
    const barW = 740;
    const barH = 50;
    const g = this.add.graphics();
    g.fillStyle(0x140b1e, 0.52);
    g.lineStyle(1.5, C.gold, 0.48);
    g.fillRoundedRect(barX - barW / 2, y - barH / 2, barW, barH, 25);
    g.strokeRoundedRect(barX - barW / 2, y - barH / 2, barW, barH, 25);

    const tierStr = tiers
      .map((t, idx) => {
        const unlocked = earned >= t.stars;
        return `${unlocked ? '★' : '☆'}${t.stars} Tier ${idx + 1} (${t.reward})`;
      })
      .join('   ·   ');

    txt(this, barX, y, `CHAPTER STARS: ${earned}/${max}★   |   ${tierStr}`, {
      fontFamily: F.display,
      fontSize: '16px',
      fontStyle: '600',
      color: earned > 0 ? T.gold : T.dim
    }).setOrigin(0.5);

    const hit = this.add.zone(barX, y, barW, barH).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      if (this.dragged) return;
      toast(this, `${chapterId.toUpperCase()} Star Chests (${earned}/${max}★): ${t1}★ 150 Silver · ${t2}★ 300 Silver · ${t3}★ 1 Calling Ember`);
    });
  }

  private drawStarPolygon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, outerR: number, innerR: number, filled: boolean): void {
    g.fillStyle(filled ? C.goldHi : 0x22162b, filled ? 1 : 0.7);
    g.lineStyle(2, C.gold, filled ? 0.95 : 0.35);
    const pts: Phaser.Math.Vector2[] = [];
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? outerR : innerR;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
    g.fillPoints(pts, true);
    g.strokePoints(pts, true);
  }

  private row(node: Node, y: number, progress: Record<string, { stars: number }>, patchedBy: string | null, tutorialReplay = false): void {
    const done = progress[node.node_id];
    const locked = !tutorialReplay && Boolean(node.requires && !progress[node.requires]);
    const bg = panel(this, REF_W / 2, y, 1300, 138, locked ? 'dim' : 'normal');
    const label = locked ? node.kind === 'story' ? 'Locked story' : 'Locked battle' : node.title_en;
    const name = title(this, 0, 0, label.toUpperCase(), 38, locked ? T.dim : T.text).setOrigin(0, 0.5).setPosition(REF_W / 2 - 600, y - 20);
    const cost = node.ration_class ? RATION_COST[node.ration_class] : 0;
    const battleLabel = cost === 0 ? 'Free practice · one-time rewards only' : `Story and battle · ${cost} Ration`;
    const sub = txt(this, REF_W / 2 - 600, y + 28, locked ? 'Finish the previous story step first' : node.kind === 'battle' ? battleLabel : 'Story', { fontSize: '28px', color: T.dim });

    if (patchedBy) {
      const tag = panel(this, REF_W / 2 + 330, y - 28, 250, 52, 'hot');
      txt(this, REF_W / 2 + 330, y - 28, `NEW · ${patchedBy}`, { fontFamily: F.display, fontSize: '20px', fontStyle: '600', color: T.gold }).setOrigin(0.5);
      void tag;
    }
    const stars = this.add.graphics();
    for (let i = 0; i < 3; i++) {
      const on = Boolean(done && i < done.stars);
      this.drawStarPolygon(stars, REF_W / 2 + 445 + i * 48, y + 22, 16, 7, on);
    }
    if (!locked && !tutorialReplay && node.kind === 'battle' && cost > 0 && done && done.stars >= 3 && Services.api.signedIn) {
      new Button(this, REF_W / 2 + 220, y + 24, {
        label: `SWEEP (${cost}R)`,
        w: 210,
        h: 56,
        fontSize: 21,
        onClick: () => {
          void (async () => {
            try {
              const relId = await Services.ready().content.activeReleaseId();
              await Services.api.sweepStage(relId, node.node_id, 1);
              this.scene.restart();
            } catch {
              this.scene.restart();
            }
          })();
        }
      });
    }
    // a card only fires for a press that began on it: the tap that closed the previous scene must not fall through
    let pressed = false;
    bg.setInteractive({ useHandCursor: !locked })
      .on('pointerdown', () => (pressed = true))
      .on('pointerout', () => (pressed = false))
      .on('pointerup', () => {
        if (!locked && pressed && !this.dragged) void playNode(this, node);
        pressed = false;
      });
    void name;
    void sub;
  }
}
