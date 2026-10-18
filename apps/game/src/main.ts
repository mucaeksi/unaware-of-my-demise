import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import { REF_H, REF_W } from './config';
import { createApp } from './core/app';
import type { AnyScene } from './core/scenes';
import { installContinuitySync } from './entry/cloudSync';
import { playNode } from './flow';
import { installContextRecovery, qualityProfile } from './platform/graphics';
import { AccountScene } from './scenes/AccountScene';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { ChaptersScene } from './scenes/ChaptersScene';
import { CharacterScene } from './scenes/CharacterScene';
import { ContentPanelScene } from './scenes/ContentPanelScene';
import { FinishScene } from './scenes/FinishScene';
import { GearScene } from './scenes/GearScene';
import { HomeScene } from './scenes/HomeScene';
import { LibraryScene } from './scenes/LibraryScene';
import { MailScene } from './scenes/MailScene';
import { OperationsScene } from './scenes/OperationsScene';
import { PatchBarScene } from './scenes/PatchBarScene';
import { PrologueScene } from './scenes/PrologueScene';
import { PurchasesScene } from './scenes/PurchasesScene';
import { RecruitScene } from './scenes/RecruitScene';
import { RosterScene } from './scenes/RosterScene';
import { ShopScene } from './scenes/ShopScene';
import { SplashScene } from './scenes/SplashScene';
import { StoryScene } from './scenes/StoryScene';
import { StudioScene } from './scenes/StudioScene';
import { SummonScene } from './scenes/SummonScene';
import { TasksScene } from './scenes/TasksScene';
import { TeamScene } from './scenes/TeamScene';
import { TitleScene } from './scenes/TitleScene';
import { installA11y } from './platform/a11y';
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

const SCENES: Record<string, () => AnyScene> = {
  Boot: () => new BootScene(),
  Splash: () => new SplashScene(),
  Studio: () => new StudioScene(),
  Title: () => new TitleScene(),
  Prologue: () => new PrologueScene(),
  Finish: () => new FinishScene(),
  Chapters: () => new ChaptersScene(),
  Story: () => new StoryScene(),
  Battle: () => new BattleScene(),
  ContentPanel: () => new ContentPanelScene(),
  Home: () => new HomeScene(),
  Summon: () => new SummonScene(),
  Roster: () => new RosterScene(),
  Recruit: () => new RecruitScene(),
  Library: () => new LibraryScene(),
  Mail: () => new MailScene(),
  Shop: () => new ShopScene(),
  Account: () => new AccountScene(),
  Operations: () => new OperationsScene(),
  Purchases: () => new PurchasesScene(),
  Character: () => new CharacterScene(),
  Gear: () => new GearScene(),
  Tasks: () => new TasksScene(),
  Team: () => new TeamScene(),
  PatchBar: () => new PatchBarScene()
};

try {
  const qp = qualityProfile();
  const app = createApp({
    parent: 'game',
    width: REF_W,
    height: REF_H,
    antialias: qp.tier !== 'low',
    powerPreference: qp.tier === 'low' ? 'low-power' : 'high-performance',
    maxResolution: Math.max(0.5, qp.textResolution),
    targetFps: qp.targetFps
  });
  for (const [key, make] of Object.entries(SCENES)) app.scene.register(key, make);
  app.ready.then(
    () => app.scene.launch('Boot'),
    (e: unknown) => fatal(`This device cannot run the game: no WebGL, WebGPU or canvas renderer (${e instanceof Error ? e.message : String(e)})`)
  );
  const contextRecovery = installContextRecovery(app, () => Services.refreshArt().then(() => undefined));
  installContinuitySync();
  installA11y();
  // test/debug hook (read-only handles; no privileged state is exposed)
  (window as unknown as { __UOMD__: unknown }).__UOMD__ = { game: app, services: Services, playNode, contextRecovery };
} catch (e) {
  fatal(`This device cannot run the game: ${e instanceof Error ? e.message : String(e)}`);
}
