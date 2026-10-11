import type Phaser from 'phaser';
import type { Encounter } from '@uomd/content-schema';
import { Services } from '../services';
import { advance } from './flow';
import { markTutorialDone } from './state';
import { recordEntry } from './sync';

/**
 * Plays tutorial stage `index` (1-3): cutscene -> manual turn-based battle -> cutscene, then records it and moves on. The two heroes are
 * fixed by the encounter; nothing is claimed on the server and no reward or clear is granted (presentation checkpoints only).
 * Retreating from the battle returns to the story before it; a lost battle offers Retry (the battle scene's own button).
 */
export async function playTutorialStage(scene: Phaser.Scene, index: 1 | 2 | 3): Promise<void> {
  const { content } = Services.ready();
  const entry = await content.entryIndex();
  const stage = entry.tutorial[index - 1];
  if (!stage) throw new Error(`entry index has no tutorial stage ${index}`);
  const enc: Encounter = await content.encounter(stage.encounter);

  const finishStage = (s: Phaser.Scene): void => {
    recordEntry(Services.api, (st) => markTutorialDone(st, index));
    advance(s);
  };
  const afterBattle = (b: Phaser.Scene): void => {
    if (enc.post_story) b.scene.start('Story', { path: enc.post_story, onDone: finishStage });
    else finishStage(b);
  };
  const battle = (s: Phaser.Scene): void =>
    void s.scene.start('Battle', {
      encounterPath: stage.encounter,
      tutorial: true,
      onBack: (b: Phaser.Scene) => void playTutorialStage(b, index),
      onDone: afterBattle
    });
  if (enc.pre_story) scene.scene.start('Story', { path: enc.pre_story, onDone: battle });
  else battle(scene);
}
