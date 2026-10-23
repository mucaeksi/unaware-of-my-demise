import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { API_BASE } from '../config';
import { audio } from '../core/assets';
import { PixiScene } from '../core/PixiScene';
import { ContentService } from '../content/ContentService';
import { endReplay, forceResetEntry, isDevServer, isForceFreshEntry, loadEntry, saveEntry } from '../entry/state';
import { loadCurrencyName } from '../net/currency';
import { detectIdentity } from '../net/identity';
import { initConsent, initStoreReconciliation } from '../net/store';
import { prefs } from '../platform/prefs';
import { Services } from '../services';
import type { SplashInit } from './SplashScene';

const UPDATE_TIMEOUT_MS = 90000;
type Done = (s: PixiScene<unknown>) => void;

/** Startup: fonts, audio, identity and store bridges, content and menu art; then the engine credit (or a preview scene). */
export class BootScene extends PixiScene {
  private backgroundUpdate = false;

  async create(): Promise<void> {
    try {
      await Promise.all([document.fonts.load('600 40px Cinzel'), document.fonts.load('700 40px Cinzel'), document.fonts.load('500 40px "Cormorant Garamond"'), document.fonts.load('italic 500 40px "Cormorant Garamond"')]);
    } catch {
      /* system serif fallback is acceptable */
    }
    Music.init();
    Sfx.init(audio.context, audio.master);
    Services.identity = detectIdentity();
    await Services.api.hydrateNativeSession();
    void initConsent(); // Android: UMP consent form where the region requires it, then the ads SDK
    initStoreReconciliation(); // startup, resume, auth-switch and async Play purchase reconciliation
    void loadCurrencyName(API_BASE);
    // a replay of the opening is session-only: a reload returns to the account's own state
    endReplay();
    const params = new URLSearchParams(window.location.search);
    const previewScene = params.get('preview_scene');
    let isPostT3Restart = false;
    try {
      isPostT3Restart = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('uomd.post_t3_restart.v1') === '1';
      if (isPostT3Restart) sessionStorage.removeItem('uomd.post_t3_restart.v1');
    } catch {
      /* ignore */
    }
    if (!isPostT3Restart && (isDevServer() || previewScene === 'fresh_flow' || previewScene === 'title_fresh' || params.get('fresh_entry') === '1')) forceResetEntry();
    // the engine credit plays while content and menu art load behind it
    const ready = this.loadEverything();
    if (previewScene && previewScene !== 'splash' && previewScene !== 'fresh_flow') {
      void ready.then((ok) => {
        if (!ok) return;
        void prefs();
        document.getElementById('boot')?.classList.add('done');
        this.startPreviewScene(previewScene);
      });
      return;
    }
    this.nav.launch('Splash', { ready } satisfies SplashInit);
    void ready.then((ok) => {
      if (!ok) return;
      if (this.backgroundUpdate && loadEntry().phase === 'completed') {
        this.nav.launch('PatchBar');
        void Services.patches.start();
      }
      void prefs();
    });
  }

  private startPreviewScene(target: string): void {
    const title: Done = (s) => s.nav.start('Title');
    const battle = (n: 1 | 2 | 3): Record<string, unknown> => ({ encounterPath: `encounters/tutorial_t${n}.json`, tutorial: true, onDone: title, onBack: title });
    const storyThenBattle = (n: 1 | 2 | 3): Record<string, unknown> => ({ path: `story/tutorial_t${n}_before.json`, onDone: (story: PixiScene<unknown>) => story.nav.start('Battle', battle(n)) });
    switch (target) {
      case 'studio':
        return this.nav.start('Studio');
      case 'title':
        saveEntry({ phase: 'completed', prologue: true, tutorials: 3, updatedAt: new Date().toISOString() });
        return this.nav.start('Title');
      case 'title_fresh':
        return this.nav.start('Title');
      case 'prologue':
        return this.nav.start('Prologue');
      case 'story_t1':
        return this.nav.start('Story', storyThenBattle(1));
      case 'battle_t1':
        return this.nav.start('Battle', battle(1));
      case 'story_t1_after':
        return this.nav.start('Story', { path: 'story/tutorial_t1_after.json', onDone: title });
      case 'story_t2_before':
        return this.nav.start('Story', storyThenBattle(2));
      case 'battle_t2':
        return this.nav.start('Battle', battle(2));
      case 'story_t2_after':
        return this.nav.start('Story', { path: 'story/tutorial_t2_after.json', onDone: title });
      case 'story_t3_before':
        return this.nav.start('Story', storyThenBattle(3));
      case 'battle_t3':
        return this.nav.start('Battle', battle(3));
      case 'story_t3_after':
        return this.nav.start('Story', { path: 'story/tutorial_t3_after.json', onDone: (s: PixiScene<unknown>) => s.nav.start('Finish') });
      case 'finish_wait':
        saveEntry({ phase: 'in_progress', prologue: true, tutorials: 3, updatedAt: new Date().toISOString() });
        return this.nav.start('Finish');
      case 'hub':
        return this.nav.start('Home');
      case 'chapters':
        return this.nav.start('Chapters');
      case 'roster':
        return this.nav.start('Roster');
      case 'character':
        return this.nav.start('Character', { id: 'fadyme' });
      case 'summon':
        return this.nav.start('Summon');
      case 'trials':
        return this.nav.start('Trials');
      case 'deeds':
        return this.nav.start('Deeds');
      default:
        return this.nav.start('Title');
    }
  }

  /** Content service, art library and the menu art. Reports a fatal startup error on the page and resolves false when it fails. */
  private async loadEverything(): Promise<boolean> {
    try {
      Services.content = await ContentService.create();
      // after the first-install flow the downloaded release is switched on here, before any art is loaded (no network involved)
      this.backgroundUpdate = false;
      if (loadEntry().phase === 'completed') {
        await Services.content.activateStaged();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);
        try {
          const outcome = await Services.content.checkForUpdates({ signal: controller.signal });
          this.backgroundUpdate = outcome.status === 'offline' || outcome.status === 'rejected';
        } finally {
          clearTimeout(timer);
        }
      } else if (isForceFreshEntry()) {
        await Services.content.rollback().catch(() => undefined);
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
}
