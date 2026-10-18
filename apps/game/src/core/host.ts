import Phaser from '../engine';
import type { PixiScene } from './PixiScene';

/**
 * Registers a pure-PIXI scene under `key` in the engine's scene manager (D-25 bridge): `scene.start(key, data)` keeps
 * working for every caller, the scene's view is placed through `add.pixi`, and it closes on the engine's shutdown.
 * Removed with the engine in D-25 step 4, when PixiScenes get their own manager.
 */
export function hosted<D>(key: string, make: () => PixiScene<D>): new () => Phaser.Scene {
  return class extends Phaser.Scene {
    /** the running PIXI scene (debug/inspection handle, e.g. the uomd-pixi-live MCP) */
    pixiScene: PixiScene<D> | null = null;

    constructor() {
      super(key);
    }

    create(data: D): void {
      const s = make();
      this.pixiScene = s;
      s.host = this;
      s.data = data;
      this.add.pixi(s.view, (dt) => s.tick(dt));
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => s.close());
      const fail = (e: unknown): void => console.error(`Error in ${key}.create:`, e);
      try {
        void Promise.resolve(s.create(data)).catch(fail);
      } catch (e) {
        fail(e);
      }
    }
  };
}
