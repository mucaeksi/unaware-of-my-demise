import type Phaser from 'phaser';
import type { Encounter } from '@uomd/content-schema';
import { restartGame } from '../platform/native';
import { Services } from '../services';
import { advance } from './flow';
import { clearFlowCheckpoint, clearStoryCheckpoint, loadFlowCheckpoint, saveFlowCheckpoint } from './resume';
import { isForceFreshEntry, markTutorialDone } from './state';
import { confirmEntryComplete, recordEntry } from './sync';

/**
 * Plays tutorial stage `index` (1-3): cutscene -> manual turn-based battle -> cutscene, then records it and moves on. The two heroes are
 * fixed by the encounter; nothing is claimed on the server and no reward or clear is granted (presentation checkpoints only).
 * When stage 3 finishes: if the background patch is already ready, the screen fades slowly to black and restarts the client directly;
 * if the patch is still downloading, it opens the FinishScene patch screen with Main Theme music and rotating game quotes.
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
    if (enc.pre_story) clearStoryCheckpoint(accountKey, enc.pre_story);
    if (enc.post_story) clearStoryCheckpoint(accountKey, enc.post_story);
    recordEntry(Services.api, (st) => markTutorialDone(st, index));
    if (index === 3 && Services.patches.get().kind === 'ready') {
      // Background patch already completed during the tutorial: fade to black and restart immediately
      s.cameras.main.fadeOut(1600, 0, 0, 0);
      s.time.delayedCall(1650, () => {
        void (async () => {
          try {
            await confirmEntryComplete(Services.api);
            await restartGame();
          } catch {
            s.scene.start('Finish');
          }
        })();
      });
      return;
    }
    advance(s);
  };
  const afterBattle = (b: Phaser.Scene): void => {
    if (enc.post_story) {
      if (forceRestart || isForceFreshEntry()) clearStoryCheckpoint(accountKey, enc.post_story);
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

  const flowCp = !forceRestart && !isForceFreshEntry() ? loadFlowCheckpoint(accountKey) : null;
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
    if (forceRestart || isForceFreshEntry()) clearStoryCheckpoint(accountKey, enc.pre_story);
    saveFlowCheckpoint(accountKey, { kind: 'tutorial', index, step: 'pre_story' });
    scene.scene.start('Story', { path: enc.pre_story, onDone: battle });
  } else {
    battle(scene);
  }
}

