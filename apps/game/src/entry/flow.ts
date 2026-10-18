import type { PixiScene } from '../core/PixiScene';
import { PREVIEW_FLOW_ENABLED } from '../config';
import { errText } from '../ui/hubScreen';
import { Services } from '../services';
import { notify } from '../ui/pixiKit';
import { S } from './strings';
import { endReplay, isReplaying, loadEntry, nextStep, type EntryStep } from './state';
import { playTutorialStage } from './tutorial';
import { syncContinuityNow } from './cloudSync';
import { syncEntry } from './sync';

export type SignInResult = 'ok' | 'unavailable' | 'failed';

/** Google sign-in (Android Credential Manager or Web Google Identity Services) -> the Worker verifies the ID token. */
export async function signInWithGoogle(scene: PixiScene<unknown>): Promise<SignInResult> {
  const identity = Services.identity;
  if (!identity || (identity.kind !== 'native' && identity.kind !== 'web')) return 'unavailable';
  try {
    const token = await identity.getIdToken();
    await Services.api.signInWithIdToken(token);
    return 'ok';
  } catch (e) {
    notify(scene, `${S.menu.signInFailed} ${errText(e)}`, 4200);
    return 'failed';
  }
}

/** Whether the first-run menu may continue: signed in, or the preview build explicitly running without an account. */
export const mayContinue = (): boolean => Services.api.signedIn || PREVIEW_FLOW_ENABLED;

/** Routes the player to the first unfinished entry step (fades out slowly, then starts the step's scene or runner). */
export function advance(scene: PixiScene<unknown>, step: EntryStep = nextStep(loadEntry())): void {
  const dur = 1100;
  void scene.fadeOut(dur, 0x000000);
  scene.anim.after(dur + 40, () => {
    switch (step.kind) {
      case 'prologue':
        scene.nav.start('Prologue');
        return;
      case 'tutorial':
        void playTutorialStage(scene, step.index).catch((e: unknown) => {
          notify(scene, `The tutorial could not start: ${errText(e)}`, 4200);
          scene.nav.start('Title');
        });
        return;
      case 'finish':
        // a title replay of the opening ends where it began, not on the first-install restart page
        if (isReplaying()) {
          endReplay();
          scene.nav.start('Title');
          return;
        }
        scene.nav.start('Finish');
        return;
      case 'menu':
        scene.nav.start('Title');
        return;
    }
  });
}

/**
 * First-run door (after Google sign-in, or Continue): reconcile with the account checkpoint, start the background patch download with
 * its bottom bar, then go to the first unfinished step. The download never blocks the story.
 */
export async function beginEntry(scene: PixiScene<unknown>): Promise<void> {
  const { state } = await syncEntry(Services.api);
  await syncContinuityNow();
  if (state.phase !== 'completed') {
    if (!scene.nav.isActive('PatchBar')) scene.nav.launch('PatchBar');
    void Services.patches.start();
  }
  advance(scene, nextStep(state));
}
