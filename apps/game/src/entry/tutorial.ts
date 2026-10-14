import type Phaser from 'phaser';
import type { Encounter } from '@uomd/content-schema';
import { Services } from '../services';
import { advance } from './flow';
import { clearFlowCheckpoint, clearStoryCheckpoint, loadFlowCheckpoint, saveFlowCheckpoint } from './resume';
import { markTutorialDone } from './state';
import { recordEntry } from './sync';

/**
 * Plays tutorial stage `index` (1-3): cutscene -> manual turn-based battle -> cutscene, then records it and moves on. The two heroes are
 * fixed by the encounter; nothing is claimed on the server and no reward or clear is granted (presentation checkpoints only).
 * Retreating from the battle returns to the story before it; a lost battle offers Retry (the battle scene's own button).
 */
export async function playTutorialStage(scene: Phaser.Scene, index: 1 | 2 | 3, forceRestart = false): Promise<void> {
  const { content } = Services.ready();
  const entry = await content.entryIndex();
  const stage = entry.tutorial[index - 1];
  if (!stage) throw new Error(`entry index has no tutorial stage ${index}`);
  const enc: Encounter = await content.encounter(stage.encounter);
  const accountKey = Services.api.accountKey;

  const finishStage = (s: Phaser.Scene): void => {
    clearFlowCheckpoint(accountKey);
    recordEntry(Services.api, (st) => markTutorialDone(st, index));
    advance(s);
  };
  const afterBattle = (b: Phaser.Scene): void => {
    if (enc.post_story) {
      saveFlowCheckpoint(accountKey, { kind: 'tutorial', index, step: 'post_story' });
      b.scene.start('Story', { path: enc.post_story, onDone: finishStage });
    } else {
      finishStage(b);
    }
  };
  const battle = (s: Phaser.Scene): void => {
    saveFlowCheckpoint(accountKey, { kind: 'tutorial', index, step: 'battle' });
    void s.scene.start('Battle', {
      encounterPath: stage.encounter,
      tutorial: true,
      onBack: (b: Phaser.Scene) => {
        if (enc.pre_story) clearStoryCheckpoint(Services.api.accountKey, enc.pre_story);
        void playTutorialStage(b, index, true);
      },
      onDone: afterBattle
    });
  };

  const flowCp = !forceRestart ? loadFlowCheckpoint(accountKey) : null;
  if (flowCp?.kind === 'tutorial' && flowCp.index === index) {
    if (flowCp.step === 'post_story' && enc.post_story) {
      afterBattle(scene);
      return;
    }
    if (flowCp.step === 'battle') {
      battle(scene);
      return;
    }
  }

  if (enc.pre_story) {
    saveFlowCheckpoint(accountKey, { kind: 'tutorial', index, step: 'pre_story' });
    scene.scene.start('Story', { path: enc.pre_story, onDone: battle });
  } else {
    battle(scene);
  }
}

