import Phaser from 'phaser';
import { RATION_COST, type ChapterIndex } from '@uomd/content-schema';
import { REF_H, REF_W } from '../config';
import { loadEntry } from '../entry/state';
import { Progress, Services } from '../services';
import { Button, panel, sceneFadeIn, title, txt } from '../ui/kit';
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
    this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x0a0610, 0.82).setDepth(-10).setScrollFactor(0);
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
    let y = 250;
    let firstOpen = -1;
    for (const ch of index.chapters) {
      const isTutorial = ch.chapter_id === 'tutorial';
      const revealed = (isTutorial && entryDone) || ch.nodes.some((node) => progress[node.node_id] || !node.requires || progress[node.requires]);
      const heading = isTutorial && entryDone ? `${ch.title_en} · Replay` : revealed ? ch.title_en : 'Locked chapter';
      txt(this, 330, y - 20, heading.toUpperCase(), { fontFamily: F.display, fontSize: '34px', fontStyle: '600', color: T.dim }).setOrigin(0, 0.5);
      y += 70;
      for (const node of ch.nodes) {
        const tutorialReplay = isTutorial && entryDone;
        if ((!isTutorial || !hasCampaign) && firstOpen < 0 && !progress[node.node_id] && !(node.requires && !progress[node.requires])) {
          firstOpen = y;
        }
        this.row(node, y, progress, baseNodes.has(node.node_id) ? null : active, tutorialReplay);
        y += 160;
      }
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
    const head = this.add.rectangle(REF_W / 2, 70, REF_W, 150, 0x0a0610, 0.92).setScrollFactor(0).setDepth(50);
    const hd = title(this, REF_W / 2, 100, 'CHAPTERS', 64, T.gold).setScrollFactor(0).setDepth(51);
    const back = new Button(this, 270, REF_H - 90, { label: 'BACK', w: 340, onClick: () => this.scene.start('Title') }).setScrollFactor(0).setDepth(51);
    void head;
    void hd;
    void back;
  }

  private row(node: Node, y: number, progress: Record<string, { stars: number }>, patchedBy: string | null, tutorialReplay = false): void {
    const done = progress[node.node_id];
    const locked = !tutorialReplay && Boolean(node.requires && !progress[node.requires]);
    const bg = panel(this, REF_W / 2, y, 1300, 138, locked ? 'dim' : 'normal');
    const label = locked ? node.kind === 'story' ? 'Locked story' : 'Locked battle' : node.title_en;
    const name = title(this, 0, 0, label.toUpperCase(), 42, locked ? T.dim : T.text).setOrigin(0, 0.5).setPosition(REF_W / 2 - 600, y - 20);
    const cost = node.ration_class ? RATION_COST[node.ration_class] : 0;
    const battleLabel = tutorialReplay ? 'Tutorial replay · no Ration cost' : cost === 0 ? 'Free practice · one-time rewards only' : `Story and battle · ${cost} Ration`;
    const sub = txt(this, REF_W / 2 - 600, y + 28, locked ? 'Finish the previous story step first' : node.kind === 'battle' ? battleLabel : 'Story', { fontSize: '30px', color: T.dim });

    if (patchedBy) {
      const tag = panel(this, REF_W / 2 + 330, y - 28, 270, 56, 'hot');
      txt(this, REF_W / 2 + 330, y - 28, `NEW · ${patchedBy}`, { fontFamily: F.display, fontSize: '22px', fontStyle: '600', color: T.gold }).setOrigin(0.5);
      void tag;
    }
    const stars = this.add.graphics();
    for (let i = 0; i < 3; i++) {
      const on = done && i < done.stars;
      stars.fillStyle(on ? C.goldHi : 0x2a1e32, 1);
      stars.fillCircle(REF_W / 2 + 480 + i * 44 - 44, y + 24, 14);
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
