import * as PIXI from 'pixi.js';
import { SceneManager } from './scenes';

export type RendererName = 'pending' | 'webgl' | 'webgpu' | 'canvas' | 'failed';

export interface AppConfig {
  parent: string;
  width: number;
  height: number;
  antialias: boolean;
  powerPreference: 'low-power' | 'high-performance';
  /** upper bound for the backing-store resolution (quality tier) */
  maxResolution: number;
  /** 30 renders every other display frame; 60+ follows requestAnimationFrame */
  targetFps: number;
}

/**
 * The game shell: one canvas with a PIXI renderer (WebGL first, WebGPU and canvas as fallbacks), an HTML layer above
 * it fitted to the same letterboxed rectangle, the frame loop and the scene manager. Replaces the Phaser-style engine
 * (D-25 step 4).
 */
export class App {
  readonly canvas = document.createElement('canvas');
  /** HTML layer above the stage (menus, ARIA controls, video dialog); sized to the fitted canvas */
  readonly uiLayer = document.createElement('div');
  readonly events = new PIXI.EventEmitter();
  readonly stage = new PIXI.Container();
  readonly scene: SceneManager;
  /** type 2 = GPU (WebGL/WebGPU), 1 = canvas fallback (diagnostics and automated checks read it) */
  readonly renderer: { type: number; name: RendererName; pixiVersion: string; pixi: PIXI.Renderer | null } = { type: 0, name: 'pending', pixiVersion: PIXI.VERSION, pixi: null };
  /** resolves once a renderer is running; rejects when the device has none */
  readonly ready: Promise<void>;
  private readonly frameIntervalMs: number;
  private lastTime = performance.now();

  constructor(private readonly cfg: AppConfig) {
    const parent = document.getElementById(cfg.parent) ?? document.body;
    this.canvas.width = cfg.width;
    this.canvas.height = cfg.height;
    this.canvas.style.display = 'block';
    parent.appendChild(this.canvas);
    this.uiLayer.id = 'uomd-ui-layer';
    this.uiLayer.className = 'uomd-ui-layer';
    this.uiLayer.style.cssText = 'position:fixed;pointer-events:none;overflow:hidden;z-index:2;user-select:none;-webkit-user-select:none;';
    parent.appendChild(this.uiLayer);
    this.canvas.addEventListener('webglcontextlost', (ev) => ev.preventDefault());
    this.scene = new SceneManager(this.stage);
    this.frameIntervalMs = cfg.targetFps > 0 && cfg.targetFps < 55 ? 1000 / cfg.targetFps : 0;
    this.ready = PIXI.autoDetectRenderer({
      canvas: this.canvas,
      width: cfg.width,
      height: cfg.height,
      resolution: this.displayResolution(),
      autoDensity: false,
      antialias: cfg.antialias,
      roundPixels: false,
      powerPreference: cfg.powerPreference,
      background: 0x05030a,
      // WebGL first: the most mature path on Android System WebView; WebGPU and canvas are fallbacks
      preference: ['webgl', 'webgpu', 'canvas']
    }).then(
      (r) => {
        this.renderer.pixi = r;
        this.renderer.name = r.name as RendererName;
        this.renderer.type = r.name === 'canvas' ? 1 : 2;
        this.uiLayer.setAttribute('data-engine', `pixi-${PIXI.VERSION}-${r.name}`);
        this.fit();
      },
      (err: unknown) => {
        this.renderer.name = 'failed';
        throw err instanceof Error ? err : new Error(String(err));
      }
    );
    this.fit();
    window.addEventListener('resize', () => this.fit());
    const tick = (now: number): void => {
      requestAnimationFrame(tick);
      if (this.frameIntervalMs > 0 && now - this.lastTime < this.frameIntervalMs - 2) return;
      const dt = Math.min(2000, Math.max(1, now - this.lastTime));
      this.lastTime = now;
      this.step(dt);
    };
    requestAnimationFrame(tick);
  }

  /** one frame: update the running scenes, then draw (also callable by automated checks while the page is hidden) */
  step(dtMs: number): void {
    this.scene.update(dtMs);
    this.renderer.pixi?.render(this.stage);
    this.events.emit('postrender');
  }

  /** backing-store scale so the reference stage maps 1:1 onto device pixels (capped by the quality tier) */
  private displayResolution(): number {
    const vw = window.innerWidth || this.cfg.width;
    const vh = window.innerHeight || this.cfg.height;
    const css = Math.min(vw / this.cfg.width, vh / this.cfg.height);
    return Math.min(this.cfg.maxResolution, Math.max(0.5, css * (window.devicePixelRatio || 1)));
  }

  private fit(): void {
    const vw = window.innerWidth || this.cfg.width;
    const vh = window.innerHeight || this.cfg.height;
    const k = Math.min(vw / this.cfg.width, vh / this.cfg.height);
    const cw = Math.round(this.cfg.width * k);
    const ch = Math.round(this.cfg.height * k);
    const left = Math.round((vw - cw) / 2);
    const top = Math.round((vh - ch) / 2);
    this.renderer.pixi?.resize(this.cfg.width, this.cfg.height, this.displayResolution());
    Object.assign(this.canvas.style, { width: `${cw}px`, height: `${ch}px`, marginLeft: `${left}px`, marginTop: `${top}px` });
    Object.assign(this.uiLayer.style, { left: `${left}px`, top: `${top}px`, width: `${cw}px`, height: `${ch}px` });
    this.events.emit('resize');
  }
}

let current: App | null = null;

export function createApp(cfg: AppConfig): App {
  current = new App(cfg);
  return current;
}

/** the running app (scenes only exist inside one) */
export function app(): App {
  if (!current) throw new Error('the app has not started');
  return current;
}
