import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import Phaser from './engine';
import { REF_H, REF_W } from './config';
import { playNode } from './flow';
import { BattleHost } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { AccountHost } from './scenes/AccountScene';
import { CharacterHost } from './scenes/CharacterScene';
import { ChaptersHost } from './scenes/ChaptersScene';
import { FinishHost } from './scenes/FinishScene';
import { GearHost } from './scenes/GearScene';
import { HomeHost } from './scenes/HomeScene';
import { MailHost } from './scenes/MailScene';
import { OperationsHost } from './scenes/OperationsScene';
import { PurchasesHost } from './scenes/PurchasesScene';
import { PatchBarHost } from './scenes/PatchBarScene';
import { PrologueHost } from './scenes/PrologueScene';
import { RosterHost } from './scenes/RosterScene';
import { RecruitHost } from './scenes/RecruitScene';
import { LibraryHost } from './scenes/LibraryScene';
import { ShopHost } from './scenes/ShopScene';
import { SplashHost } from './scenes/SplashScene';
import { StudioHost } from './scenes/StudioScene';
import { ContentPanelHost } from './scenes/ContentPanelScene';
import { StoryHost } from './scenes/StoryScene';
import { SummonHost } from './scenes/SummonScene';
import { TasksHost } from './scenes/TasksScene';
import { TeamHost } from './scenes/TeamScene';
import { TitleHost } from './scenes/TitleScene';
import { installContinuitySync } from './entry/cloudSync';
import { installContextRecovery, qualityProfile } from './platform/graphics';
import { Services } from './services';

function fatal(message: string): void {
  const el = document.getElementById('fatal');
  if (el) {
    el.style.display = 'grid';
    el.textContent = message;
  }
}

// #boot sits above the stage; once marked done it must leave the screen and the accessibility tree even when the
// CSS fade never runs (paused/throttled WebViews freeze the transition and left the title over every scene)
const bootEl = document.getElementById('boot');
if (bootEl) {
  new MutationObserver((_, obs) => {
    if (!bootEl.classList.contains('done')) return;
    obs.disconnect();
    setTimeout(() => (bootEl.style.display = 'none'), 700);
  }).observe(bootEl, { attributes: true, attributeFilter: ['class'] });
}

try {
  const qp = qualityProfile();
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: '#0a0610',
    width: REF_W,
    height: REF_H,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: qp.tier !== 'low', powerPreference: qp.tier === 'low' ? 'low-power' : 'high-performance', roundPixels: false, resolution: qp.textResolution },
    fps: { target: qp.targetFps },
    input: { touch: { capture: true }, activePointers: 2 },
    banner: false,
    scene: [BootScene, ContentPanelHost, SplashHost, StudioHost, TitleHost, PrologueHost, FinishHost, ChaptersHost, StoryHost, BattleHost, HomeHost, SummonHost, RosterHost, RecruitHost, LibraryHost, MailHost, ShopHost, AccountHost, OperationsHost, PurchasesHost, CharacterHost, GearHost, TasksHost, TeamHost, PatchBarHost]
  });
  game.ready.catch((e: unknown) => fatal(`This device cannot run the game: no WebGL, WebGPU or canvas renderer (${e instanceof Error ? e.message : String(e)})`));
  const contextRecovery = installContextRecovery(game, () => Services.refreshArt().then(() => undefined));
  installContinuitySync();
  // test/debug hook (read-only handles; no privileged state is exposed)
  (window as unknown as { __UOMD__: unknown }).__UOMD__ = { game, services: Services, playNode, contextRecovery };
} catch (e) {
  fatal(`This device cannot run the game: ${e instanceof Error ? e.message : String(e)}`);
}
