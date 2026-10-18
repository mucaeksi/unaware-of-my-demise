import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import Phaser from './engine';
import { REF_H, REF_W } from './config';
import { playNode } from './flow';
import { BattleHost } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { AccountScene } from './scenes/AccountScene';
import { CharacterScene } from './scenes/CharacterScene';
import { ChaptersScene } from './scenes/ChaptersScene';
import { FinishScene } from './scenes/FinishScene';
import { GearScene } from './scenes/GearScene';
import { HomeScene } from './scenes/HomeScene';
import { MailScene } from './scenes/MailScene';
import { OperationsScene } from './scenes/OperationsScene';
import { PurchasesScene } from './scenes/PurchasesScene';
import { PatchBarScene } from './scenes/PatchBarScene';
import { PrologueScene } from './scenes/PrologueScene';
import { RosterScene } from './scenes/RosterScene';
import { RecruitScene } from './scenes/RecruitScene';
import { LibraryScene } from './scenes/LibraryScene';
import { ShopScene } from './scenes/ShopScene';
import { SplashScene } from './scenes/SplashScene';
import { StudioScene } from './scenes/StudioScene';
import { ContentPanelScene } from './scenes/ContentPanelScene';
import { StoryScene } from './scenes/StoryScene';
import { SummonScene } from './scenes/SummonScene';
import { TasksScene } from './scenes/TasksScene';
import { TeamScene } from './scenes/TeamScene';
import { TitleScene } from './scenes/TitleScene';
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
    scene: [BootScene, ContentPanelScene, SplashScene, StudioScene, TitleScene, PrologueScene, FinishScene, ChaptersScene, StoryScene, BattleHost, HomeScene, SummonScene, RosterScene, RecruitScene, LibraryScene, MailScene, ShopScene, AccountScene, OperationsScene, PurchasesScene, CharacterScene, GearScene, TasksScene, TeamScene, PatchBarScene]
  });
  game.ready.catch((e: unknown) => fatal(`This device cannot run the game: no WebGL, WebGPU or canvas renderer (${e instanceof Error ? e.message : String(e)})`));
  const contextRecovery = installContextRecovery(game, () => Services.refreshArt().then(() => undefined));
  // test/debug hook (read-only handles; no privileged state is exposed)
  (window as unknown as { __UOMD__: unknown }).__UOMD__ = { game, services: Services, playNode, contextRecovery };
} catch (e) {
  fatal(`This device cannot run the game: ${e instanceof Error ? e.message : String(e)}`);
}
