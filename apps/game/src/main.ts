import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import Phaser from 'phaser';
import { REF_H, REF_W } from './config';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { ChaptersScene } from './scenes/ChaptersScene';
import { StoryScene } from './scenes/StoryScene';
import { TitleScene } from './scenes/TitleScene';
import { Services } from './services';

function fatal(message: string): void {
  const el = document.getElementById('fatal');
  if (el) {
    el.style.display = 'grid';
    el.textContent = message;
  }
}

try {
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: '#0a0610',
    width: REF_W,
    height: REF_H,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, powerPreference: 'high-performance', roundPixels: false },
    fps: { target: 60 },
    input: { touch: { capture: true }, activePointers: 2 },
    banner: false,
    scene: [BootScene, TitleScene, ChaptersScene, StoryScene, BattleScene]
  });
  game.canvas?.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    fatal('The graphics context was lost. Reload to continue.');
  });
  // test/debug hook (read-only handles; no privileged state is exposed)
  (window as unknown as { __UOMD__: unknown }).__UOMD__ = { game, services: Services };
} catch (e) {
  fatal(`This device cannot run the game: ${e instanceof Error ? e.message : String(e)}`);
}
