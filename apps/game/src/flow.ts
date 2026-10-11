import type Phaser from 'phaser';
import type { ChapterIndex } from '@uomd/content-schema';
import { Progress, Services } from './services';

type Node = ChapterIndex['chapters'][number]['nodes'][number];

/** Plays a chapter node: pre-story -> battle -> post-story -> progress. Pure data-driven routing. */
export async function playNode(scene: Phaser.Scene, node: Node): Promise<void> {
  const { content } = Services.ready();
  if (node.kind === 'story' && node.story) {
    scene.scene.start('Story', {
      path: node.story,
      onDone: (s: Phaser.Scene) => {
        Progress.complete(node.node_id, 0);
        s.scene.start('Chapters');
      }
    });
    return;
  }
  if (!node.encounter) return;
  const enc = await content.encounter(node.encounter);
  const toChapters = (s: Phaser.Scene): void => void s.scene.start('Chapters');
  const startBattle = (s: Phaser.Scene): void =>
    void s.scene.start('Battle', {
      encounterPath: node.encounter,
      nodeId: node.node_id,
      onBack: toChapters,
      onDone: (b: Phaser.Scene, outcome: { won: boolean; stars: number }) => {
        Progress.complete(node.node_id, outcome.stars);
        if (enc.post_story) b.scene.start('Story', { path: enc.post_story, onDone: toChapters });
        else toChapters(b);
      }
    });
  if (enc.pre_story) scene.scene.start('Story', { path: enc.pre_story, onDone: startBattle });
  else startBattle(scene);
}
