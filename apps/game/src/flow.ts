import type Phaser from './engine';
import type { Encounter } from '@uomd/content-schema';
import {
  clearFlowCheckpoint,
  loadFlowCheckpoint,
  resolveNextCampaignNode,
  saveFlowCheckpoint,
  type CampaignNode
} from './entry/resume';
import { errText } from './ui/hub';
import { Button, toast } from './ui/kit';
import { REF_H, REF_W } from './config';
import { Progress, Services } from './services';

export { resolveNextCampaignNode, type CampaignNode };


/**
 * Starts the Battle scene for a node. Signed-in stages freeze a release session; owned-hero stages also freeze the party
 * (team, gear stats, skill ranks, story loans) and fight with exactly that; a signed-out player is sent to the Account screen.
 * Retrying a lost battle starts a fresh session.
 */
export async function launchBattle(scene: Phaser.Scene, node: CampaignNode, enc: Encounter, onDone: (s: Phaser.Scene) => void): Promise<void> {
  const { content } = Services.ready();
  const toChapters = (s: Phaser.Scene): void => {
    clearFlowCheckpoint(Services.api.accountKey);
    void s.scene.start('Chapters');
  };
  const base = {
    encounterPath: node.encounter,
    nodeId: node.node_id,
    onBack: toChapters,
    onClaimed: (stars: number) => {
      const accountKey = Services.api.accountKey;
      Progress.complete(node.node_id, stars);
      if (enc.post_story) {
        saveFlowCheckpoint(accountKey, { kind: 'campaign', nodeId: node.node_id, step: 'post_story', stars });
      } else {
        clearFlowCheckpoint(accountKey);
      }
    },
    onDone: (b: Phaser.Scene, outcome: { won: boolean; stars: number }) => {
      Progress.complete(node.node_id, outcome.stars);
      onDone(b);
    },
    onRetry: (b: Phaser.Scene) => void launchBattle(b, node, enc, onDone)
  };
  const owned = (enc.party_mode ?? 'fixed') === 'owned';
  const api = Services.api;
  const releaseId = await content.activeReleaseId();
  if (!owned && !api.signedIn) {
    scene.scene.start('Battle', base);
    return;
  }
  if (!api.signedIn) {
    toast(scene, 'Sign in to fight with your own company.', 3200);
    scene.scene.start('Account');
    return;
  }
  try {
    const started = await api.startBattle(releaseId, node.node_id);
    if (!started.sessionId || (owned && !started.party)) throw new Error('the server did not return a battle session');
    scene.scene.start('Battle', { ...base, releaseId, ...(started.party ? { party: started.party } : {}), sessionId: started.sessionId });
  } catch (e) {
    toast(scene, errText(e), 3800);
  }
}

/** Plays a chapter node: pre-story -> battle -> post-story -> progress. Pure data-driven routing with reload-safe step checkpoints. */
export async function playNode(scene: Phaser.Scene, node: CampaignNode, forceRestart = false): Promise<void> {
  const { content } = Services.ready();
  const accountKey = Services.api.accountKey;
  if (node.kind === 'story' && node.story) {
    const api = Services.api;
    const revision = api.authRevision;
    const signedIn = api.signedIn;
    const releaseId = await content.activeReleaseId();
    let saving = false;
    let retry: Button | null = null;
    let back: Button | null = null;
    saveFlowCheckpoint(accountKey, { kind: 'campaign', nodeId: node.node_id, step: 'pre_story' });
    const finish = async (s: Phaser.Scene): Promise<void> => {
      if (saving) return;
      saving = true; retry?.destroy(); retry = null;
      try {
        if (signedIn) await api.completeStory(releaseId, node.node_id, revision);
        if (!s.scene.isActive('Story')) return;
        clearFlowCheckpoint(Services.api.accountKey);
        Progress.complete(node.node_id, 0);
        if (signedIn && (await content.chapters()).recruit_selectors?.some((selector) => selector.scene_node === node.node_id)) {
          if (revision !== api.authRevision || !s.scene.isActive('Story')) return;
          s.scene.start('Recruit', { returnTo: 'Chapters' });
          return;
        }
        s.scene.start('Chapters');
      } catch (error) {
        if (!s.scene.isActive('Story')) return;
        toast(s, `Story progress is not confirmed. ${errText(error)}`, 5000);
        retry = new Button(s, REF_W / 2 + 220, REF_H - 80, { label: 'RETRY SAVE', w: 380, onClick: () => void finish(s) });
        back ??= new Button(s, REF_W / 2 - 220, REF_H - 80, { label: 'BACK', w: 380, onClick: () => s.scene.start('Chapters') });
      } finally { saving = false; }
    };
    scene.scene.start('Story', {
      path: node.story,
      onDone: (s: Phaser.Scene) => void finish(s)
    });
    return;
  }
  if (!node.encounter) return;
  const enc = await content.encounter(node.encounter);
  const toChapters = (s: Phaser.Scene): void => {
    clearFlowCheckpoint(Services.api.accountKey);
    void s.scene.start('Chapters');
  };
  const afterBattle = (b: Phaser.Scene): void => {
    if (enc.post_story) {
      saveFlowCheckpoint(Services.api.accountKey, { kind: 'campaign', nodeId: node.node_id, step: 'post_story' });
      b.scene.start('Story', { path: enc.post_story, onDone: toChapters });
    } else {
      toChapters(b);
    }
  };
  const cp = !forceRestart ? loadFlowCheckpoint(accountKey) : null;
  if (cp?.kind === 'campaign' && cp.nodeId === node.node_id) {
    if (cp.step === 'post_story' && enc.post_story) {
      afterBattle(scene);
      return;
    }
    if (cp.step === 'battle') {
      await launchBattle(scene, node, enc, afterBattle);
      return;
    }
  }
  if (enc.pre_story) {
    saveFlowCheckpoint(accountKey, { kind: 'campaign', nodeId: node.node_id, step: 'pre_story' });
    scene.scene.start('Story', {
      path: enc.pre_story,
      onDone: (s: Phaser.Scene) => {
        saveFlowCheckpoint(Services.api.accountKey, { kind: 'campaign', nodeId: node.node_id, step: 'battle' });
        void launchBattle(s, node, enc, afterBattle);
      }
    });
  } else {
    saveFlowCheckpoint(accountKey, { kind: 'campaign', nodeId: node.node_id, step: 'battle' });
    await launchBattle(scene, node, enc, afterBattle);
  }
}

