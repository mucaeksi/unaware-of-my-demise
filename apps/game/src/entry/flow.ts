import type Phaser from 'phaser';
import { PREVIEW_FLOW_ENABLED } from '../config';
import { errText } from '../ui/hub';
import { Services } from '../services';
import { toast } from '../ui/kit';
import { S } from './strings';
import { loadEntry, nextStep, type EntryStep } from './state';
import { playTutorialStage } from './tutorial';
import { syncEntry } from './sync';

export type SignInResult = 'ok' | 'unavailable' | 'failed';

/** Google sign-in (Android Credential Manager or Web Google Identity Services) -> the Worker verifies the ID token. */
export async function signInWithGoogle(scene: Phaser.Scene): Promise<SignInResult> {
  const identity = Services.identity;
  if (!identity || (identity.kind !== 'native' && identity.kind !== 'web')) return 'unavailable';
  try {
    const token = await identity.getIdToken();
    await Services.api.signInWithIdToken(token);
    return 'ok';
  } catch (e) {
    toast(scene, `${S.menu.signInFailed} ${errText(e)}`, 4200);
    return 'failed';
  }
}

/** Whether the first-run menu may continue: signed in, or the preview build explicitly running without an account. */
export const mayContinue = (): boolean => Services.api.signedIn || PREVIEW_FLOW_ENABLED;

/** Routes the player to the first unfinished entry step (fades out, then starts the step's scene or runner). */
export function advance(scene: Phaser.Scene, step: EntryStep = nextStep(loadEntry())): void {
  scene.cameras.main.fadeOut(420, 0, 0, 0);
  scene.time.delayedCall(430, () => {
    switch (step.kind) {
      case 'prologue':
        scene.scene.start('Prologue');
        return;
      case 'tutorial':
        void playTutorialStage(scene, step.index).catch((e: unknown) => {
          toast(scene, `The tutorial could not start: ${errText(e)}`, 4200);
          scene.scene.start('Title');
        });
        return;
      case 'finish':
        scene.scene.start('Finish');
        return;
      case 'menu':
        scene.scene.start('Title');
        return;
    }
  });
}

/**
 * First-run door (after Google sign-in, or Continue): reconcile with the account checkpoint, start the background patch download with
 * its bottom bar, then go to the first unfinished step. The download never blocks the story.
 */
export async function beginEntry(scene: Phaser.Scene): Promise<void> {
  const { state } = await syncEntry(Services.api);
  if (state.phase !== 'completed') {
    if (!scene.scene.isActive('PatchBar')) scene.scene.launch('PatchBar');
    void Services.patches.start();
  }
  advance(scene, nextStep(state));
}
