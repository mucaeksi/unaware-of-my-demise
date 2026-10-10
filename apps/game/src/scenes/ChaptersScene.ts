import Phaser from 'phaser';
import type { ChapterIndex } from '@uomd/content-schema';
import { REF_H, REF_W } from '../config';
import { Progress, Services } from '../services';
import { Button, panel, sceneFadeIn, title, txt } from '../ui/kit';
import { C, F, T } from '../ui/theme';
import { playNode } from '../flow';

type Node = ChapterIndex['chapters'][number]['nodes'][number];

export class ChaptersScene extends Phaser.Scene {
  constructor() {
    super('Chapters');
  }

  async create(): Promise<void> {
    const { content, art } = Services.ready();
    this.cameras.main.setBackgroundColor(0x0a0610);
    const bg = this.add.image(REF_W / 2, REF_H / 2, art.background('forest_whispering_ash'));
    bg.setScale(Math.max(REF_W / bg.width, REF_H / bg.height));
    this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x0a0610, 0.82);
    sceneFadeIn(this, 400);
    title(this, REF_W / 2, 100, 'CHAPTERS', 64, T.gold);

    const index = await content.chapters();
    const baseIndex = JSON.parse(new TextDecoder().decode(await content.base.read('chapters/chapter_index.json'))) as ChapterIndex;
    const baseNodes = new Set(baseIndex.chapters.flatMap((c) => c.nodes.map((n) => n.node_id)));
    const progress = Progress.load();
    const active = await content.activeReleaseId();
    const titles = new Map(index.chapters.flatMap((c) => c.nodes.map((n): [string, string] => [n.node_id, n.title_en])));

    let y = 250;
    for (const ch of index.chapters) {
      txt(this, 330, y - 20, ch.title_en.toUpperCase(), { fontFamily: F.display, fontSize: '34px', fontStyle: '600', color: T.dim }).setOrigin(0, 0.5);
      y += 70;
      for (const node of ch.nodes) {
        this.row(node, y, progress, titles, baseNodes.has(node.node_id) ? null : active);
        y += 160;
      }
    }
    new Button(this, 270, REF_H - 90, { label: 'BACK', w: 340, onClick: () => this.scene.start('Title') });
  }

  private row(node: Node, y: number, progress: Record<string, { stars: number }>, titles: Map<string, string>, patchedBy: string | null): void {
    const done = progress[node.node_id];
    const locked = Boolean(node.requires && !progress[node.requires]);
    const bg = panel(this, REF_W / 2, y, 1300, 138, locked ? 'dim' : 'normal');
    const name = title(this, 0, 0, node.title_en.toUpperCase(), 42, locked ? T.dim : T.text).setOrigin(0, 0.5).setPosition(REF_W / 2 - 600, y - 20);
    const sub = txt(this, REF_W / 2 - 600, y + 28, locked ? `Locked — finish "${titles.get(node.requires ?? '') ?? node.requires}" first` : node.kind === 'battle' ? 'Story and battle' : 'Story', { fontSize: '30px', color: T.dim });
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
        if (!locked && pressed) void playNode(this, node);
        pressed = false;
      });
    void name;
    void sub;
  }
}
