import Phaser from 'phaser';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { ContentService } from '../content/ContentService';
import { loadEntry } from '../entry/state';
import { prefs } from '../platform/prefs';
import { API_BASE } from '../config';
import { loadCurrencyName } from '../net/currency';
import { detectIdentity } from '../net/identity';
import { initConsent, initStoreReconciliation } from '../net/store';
import phaserLogoUrl from '../assets/phaser-pixel-large-shaded.png';
import { Services } from '../services';
import type { SplashInit } from './SplashScene';

const UPDATE_TIMEOUT_MS = 4000;

export class BootScene extends Phaser.Scene {
  private backgroundUpdate = false;
  constructor() {
    super('Boot');
  }

  async create(): Promise<void> {
    try {
      await Promise.all([
        document.fonts.load('600 40px Cinzel'),
        document.fonts.load('700 40px Cinzel'),
        document.fonts.load('500 40px "Cormorant Garamond"'),
        document.fonts.load('italic 500 40px "Cormorant Garamond"')
      ]);
    } catch {
      /* system serif fallback is acceptable */
    }
    this.makeFxTextures();
    await this.loadEngineLogo();
    const wa = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (wa.context) {
      Music.init(this.sound);
      Sfx.init(wa.context, wa.masterVolumeNode ?? wa.context.destination);
    }
    Services.identity = detectIdentity();
    await Services.api.hydrateNativeSession();
    void initConsent(); // Android: UMP consent form where the region requires it, then the ads SDK
    initStoreReconciliation(); // Startup, resume, auth-switch, and async Play purchase reconciliation
    void loadCurrencyName(API_BASE);
    // the engine credit plays while content and menu art load behind it
    const ready = this.loadEverything();
    this.scene.launch('Splash', { ready } satisfies SplashInit); // Boot stays alive: its loader serves the loads above until Splash ends it
    void ready.then((ok) => {
      if (ok) {
        // first install: the download starts after sign-in (PatchService); only returning players check silently at boot
        if (this.backgroundUpdate && loadEntry().phase === 'completed') { this.scene.launch('PatchBar'); void Services.patches.start(); }
        void prefs();
      }
    });
  }

  /** Content service, art library and the menu art. Reports a fatal startup error on the page and resolves false when it fails. */
  private async loadEverything(): Promise<boolean> {
    try {
      Services.content = await ContentService.create();
      // after the first-install flow the downloaded release is switched on here, before any art is loaded (no network involved)
      this.backgroundUpdate = false;
      if (loadEntry().phase === 'completed') {
        await Services.content.activateStaged();
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);
        try { const outcome = await Services.content.checkForUpdates({ signal: controller.signal }); this.backgroundUpdate = outcome.status === 'offline' || outcome.status === 'rejected'; }
        finally { clearTimeout(timer); }
      }
      const art = await Services.refreshArt();
      await art.loadUi(this);
      await art.loadBackground(this, 'forest_whispering_ash');
      return true;
    } catch (e) {
      const fatal = document.getElementById('fatal');
      if (fatal) {
        fatal.style.display = 'grid';
        fatal.textContent = `The game could not start: ${e instanceof Error ? e.message : String(e)}`;
      }
      return false;
    }
  }

  /**
   * The official pixel-art Phaser logo (the logo page offers it for use in games), bundled with the app so the engine credit never waits for
   * the network or the content service. A failure only means the splash falls back to the text wordmark.
   */
  private loadEngineLogo(): Promise<void> {
    return new Promise((resolve) => {
      this.load.image('phaser_logo', phaserLogoUrl);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        this.textures.get('phaser_logo')?.setFilter(Phaser.Textures.FilterMode.NEAREST);
        resolve();
      });
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => resolve());
      this.load.start();
    });
  }

  private makeFxTextures(): void {
    const spark = this.textures.createCanvas('fx_spark', 64, 64);
    if (spark) {
      const ctx = spark.getContext();
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      spark.refresh();
    }
  }
}
