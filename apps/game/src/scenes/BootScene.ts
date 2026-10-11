import Phaser from 'phaser';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { ContentService } from '../content/ContentService';
import { prefs } from '../platform/prefs';
import { API_BASE } from '../config';
import { loadCurrencyName } from '../net/currency';
import { detectIdentity } from '../net/identity';
import { initConsent } from '../net/store';
import { Services } from '../services';

const UPDATE_TIMEOUT_MS = 4000;

export class BootScene extends Phaser.Scene {
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
    const wa = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (wa.context) {
      Music.init(this.sound);
      Sfx.init(wa.context, wa.masterVolumeNode ?? wa.context.destination);
    }
    Services.identity = detectIdentity();
    void initConsent(); // Android: UMP consent form where the region requires it, then the ads SDK (no-op in a browser)
    void loadCurrencyName(API_BASE);
    try {
      Services.content = await ContentService.create();
      const art = await Services.refreshArt();
      await art.loadUi(this);
      await art.loadBackground(this, 'forest_whispering_ash');
    } catch (e) {
      const fatal = document.getElementById('fatal');
      if (fatal) {
        fatal.style.display = 'grid';
        fatal.textContent = `The game could not start: ${e instanceof Error ? e.message : String(e)}`;
      }
      return;
    }
    document.getElementById('boot')?.classList.add('done');
    this.scene.start('Title');
    void this.checkForUpdates();
    void prefs();
  }

  /** Background patch check: never blocks the first frame; offline start is the normal case. */
  private async checkForUpdates(): Promise<void> {
    const content = Services.content;
    if (!content) return;
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), UPDATE_TIMEOUT_MS));
    const out = await Promise.race([content.checkForUpdates(), timeout]);
    if (out !== 'timeout' && (out.status === 'applied' || out.status === 'reverted_to_base')) {
      await Services.refreshArt();
      this.game.events.emit('content:changed', out);
    } else {
      this.game.events.emit('content:checked');
    }
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
