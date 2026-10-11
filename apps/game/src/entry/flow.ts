import type Phaser from 'phaser';
import { PREVIEW_FLOW_ENABLED } from '../config';
import { errText } from '../ui/hub';
import { Services } from '../services';
import { toast } from '../ui/kit';
import { S } from './strings';
import { loadEntry, nextStep, type EntryStep } from './state';

/** The scene that plays each entry step. A step whose scene is not registered yet is reported instead of silently skipped. */
const SCENE_OF: Record<EntryStep['kind'], string> = {
  prologue: 'Prologue',
  tutorial: 'Tutorial',
  finish: 'EntryFinish',
  menu: 'Title'
};

export type SignInResult = 'ok' | 'unavailable' | 'failed';

/** Native Google sign-in (Credential Manager) -> the Worker verifies the ID token. A browser has no verified Google identity. */
export async function signInWithGoogle(scene: Phaser.Scene): Promise<SignInResult> {
  const identity = Services.identity;
  if (!identity || identity.kind !== 'native') return 'unavailable';
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

/** Routes the player to the first unfinished entry step. */
export function advance(scene: Phaser.Scene, step: EntryStep = nextStep(loadEntry())): void {
  const key = SCENE_OF[step.kind];
  if (!scene.scene.get(key)) {
    toast(scene, `The road ahead is not ready yet (${step.kind}).`, 3200);
    return;
  }
  scene.cameras.main.fadeOut(420, 0, 0, 0);
  scene.time.delayedCall(430, () => scene.scene.start(key, step));
}
