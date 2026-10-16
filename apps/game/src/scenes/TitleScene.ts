import Phaser from 'phaser';
import type { PatchOutcome } from '@uomd/patch';
import { CHANNEL, CLIENT_VERSION, PATCH_LAB_ENABLED, PREVIEW_FLOW_ENABLED, REF_H, REF_W } from '../config';
import { beginEntry, signInWithGoogle } from '../entry/flow';
import { syncEntry } from '../entry/sync';
import { forceResetEntry, loadEntry } from '../entry/state';
import { S, setActiveLocaleStrings } from '../entry/strings';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { consentState, showPrivacyOptions } from '../net/store';
import { prefs, setPref, type Prefs } from '../platform/prefs';
import { safeInsets } from '../platform/safeArea';
import { Progress, Services } from '../services';
import { Button, panel, sceneFadeIn, title, toast, txt } from '../ui/kit';
import { C, DEPTH, F, SIZE, T } from '../ui/theme';
import { playNode, resolveNextCampaignNode } from '../flow';
import { RANDOM_GAME_QUOTES } from '../entry/strings';
import { barFill } from '../patch/barFill';
import { formatBytes } from '../ui/format';

function describe(o: PatchOutcome | null): string {
  if (!o) return 'No check yet';
  switch (o.status) {
    case 'up_to_date':
      return o.releaseId ? `Up to date (${o.releaseId})` : 'Up to date (embedded base)';
    case 'applied':
      return `Applied ${o.releaseId} · ${o.downloadedFiles} files · ${(o.downloadedBytes / 1024).toFixed(0)} KB`;
    case 'staged':
      return `Downloaded ${o.releaseId} · ${o.downloadedFiles} files · ${(o.downloadedBytes / 1024).toFixed(0)} KB (switches on at the next start)`;
    case 'reverted_to_base':
      return 'Reverted to embedded base (kill switch)';
    case 'offline':
      return 'Offline — using installed content';
    case 'rejected':
      return `Rejected: ${o.reason}`;
  }
}

export class TitleScene extends Phaser.Scene {
  private chipText!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.Container | null = null;
  private tapBanner: Phaser.GameObjects.Container | null = null;
  private stagingBox: Phaser.GameObjects.Container | null = null;
  private authBadgeText: Phaser.GameObjects.Text | null = null;
  private quoteTimer: Phaser.Time.TimerEvent | null = null;
  private audioStarted = false;
  /** true until the entry flow (prologue, tutorials, patch page) has been completed once on this account/device */
  private firstRun = false;
  private busy = false;
  private viewRevision = 0;
  private settingsRequest = 0;
  private autoOpenSettings = false;

  constructor() {
    super('Title');
  }

  init(data?: { openSettings?: boolean }): void {
    this.autoOpenSettings = Boolean(data?.openSettings);
  }

  async create(): Promise<void> {
    this.viewRevision++;
    this.events.once('shutdown', () => {
      this.viewRevision++;
      this.quoteTimer?.remove(false);
      this.quoteTimer = null;
    });
    this.overlay = null;
    this.tapBanner = null;
    this.stagingBox = null;
    this.authBadgeText = null;
    this.audioStarted = false;
    this.busy = false;
    this.firstRun = loadEntry().phase !== 'completed';
    const { art, content } = Services.ready();
    void content.locale().then((loc) => setActiveLocaleStrings(loc?.strings)).catch(() => undefined);
    // a patch can have replaced the art library while the splash played: make sure it has loaded what this screen draws
    await art.ensureBoot(this).catch((e: unknown) => console.warn('menu art unavailable', e));
    if (!this.sys.isActive()) return;
    this.cameras.main.setBackgroundColor(0x0a0610);
    const notice = Services.ready().content.storageNotice;
    if (notice) toast(this, notice, 8000);

    // Ensure Main Theme continues seamlessly from StudioScene (or starts if entering Title directly)
    void this.ensureMainTheme();

    const titleBgKey = art.ui('title_bg');
    if (titleBgKey) {
      const bg = this.add.image(REF_W / 2, REF_H / 2, titleBgKey);
      bg.setScale(Math.max(REF_W / bg.width, REF_H / bg.height) * 1.04);
      if (!prefs().reducedMotion) {
        this.tweens.add({
          targets: bg,
          x: REF_W / 2 - 22,
          scale: bg.scale * 1.028,
          duration: 22000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    } else {
      const bg = this.add.image(REF_W / 2, REF_H / 2, art.background('forest_whispering_ash'));
      bg.setScale(Math.max(REF_W / bg.width, REF_H / bg.height) * 1.05);
      if (!prefs().reducedMotion) {
        this.tweens.add({ targets: bg, x: REF_W / 2 - 30, scale: bg.scale * 1.03, duration: 24000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      const keyArt = art.ui('key_art');
      if (keyArt) {
        const k = this.add.image(REF_W - 330, REF_H / 2, keyArt);
        k.setScale(REF_H / k.height).setX(REF_W - (k.width * k.scale) / 2);
      }
    }

    const shade = this.add.graphics();
    // Light top bar gradient for utility pills and bottom gradient behind TAP TO START
    shade.fillGradientStyle(0x05030a, 0x05030a, 0x05030a, 0x05030a, 0.32, 0.32, 0, 0);
    shade.fillRect(0, 0, REF_W, 110);
    shade.fillGradientStyle(0x05030a, 0x05030a, 0x05030a, 0x05030a, 0, 0, 0.82, 0.82);
    shade.fillRect(0, REF_H - 250, REF_W, 250);

    if (!prefs().reducedMotion && this.textures.exists('fx_spark')) {
      this.addTitleAtmosphere();
    }

    const insets = safeInsets(this);
    const logoX = 520 + insets.left;
    const logoY = 262;
    if (this.textures.exists('fx_spark')) {
      this.add
        .image(logoX, logoY, 'fx_spark')
        .setScale(9.5, 4.2)
        .setTint(C.plumHi)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.32);
    }
    const logoKey = art.ui('logo');
    if (logoKey) {
      const logo = this.add.image(logoX, logoY + 12, logoKey).setAlpha(0);
      logo.setScale(820 / logo.width);
      this.tweens.add({ targets: logo, alpha: 1, y: logoY, duration: 1500, ease: 'Cubic.easeOut' });
      if (!prefs().reducedMotion) {
        this.tweens.add({ targets: logo, y: logoY + 8, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1500 });
      }
    }
    txt(this, logoX, 462, S.menu.tagline, {
      fontFamily: F.display,
      fontSize: '28px',
      fontStyle: '600',
      color: '#e3c37d',
      stroke: '#0a0610',
      strokeThickness: 4
    })
      .setOrigin(0.5)
      .setLetterSpacing(5);

    this.buildServerBadge();
    this.buildTitleStartMenu();

    // a reinstall or a second device: the account may already be past the entry flow
    if (this.firstRun && Services.api.signedIn) {
      void syncEntry(Services.api).then(({ state }) => {
        if (state.phase === 'completed' && this.scene.isActive() && !this.busy) {
          this.firstRun = false;
        }
      });
    }

    this.chipText = txt(this, 60 + insets.left, REF_H - 36 - insets.bottom, '', { fontSize: '24px', color: T.dim }).setOrigin(0, 0.5).setDepth(DEPTH.hud + 2);
    if (PATCH_LAB_ENABLED) {
      this.chipText.setInteractive({ useHandCursor: true }).on('pointerup', () => this.openPatchLab());
    }
    void this.refreshChip();
    this.game.events.on('content:changed', this.onContentChanged, this);
    this.game.events.on('content:checked', this.onChecked, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('content:changed', this.onContentChanged, this);
      this.game.events.off('content:checked', this.onChecked, this);
    });
    this.input.once('pointerdown', () => void this.startAudio());
    sceneFadeIn(this, 1200);
    if (this.autoOpenSettings) {
      this.autoOpenSettings = false;
      void this.openSettings();
    }
  }

  /** Online gacha server & Google Play Games account status badge in the top-left corner. */
  private buildServerBadge(): void {
    const insets = safeInsets(this);
    const x = 60 + insets.left;
    const y = 58 + insets.top;
    const g = this.add.graphics();
    g.fillStyle(0x120a18, 0.48);
    g.fillRoundedRect(0, -24, 490, 48, 24);
    g.lineStyle(1.5, C.gold, 0.52);
    g.strokeRoundedRect(0, -24, 490, 48, 24);
    g.fillStyle(C.hpGood, 1);
    g.fillCircle(24, 0, 6);
    const realm = txt(this, 44, 0, 'SANCTUM-01  ·  ONLINE', {
      fontFamily: F.display,
      fontSize: '20px',
      fontStyle: '600',
      color: T.gold
    })
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    this.authBadgeText = txt(this, 470, 0, Services.api.signedIn ? 'PLAY GAMES ✓' : 'PLAY GAMES', {
      fontFamily: F.display,
      fontSize: '18px',
      fontStyle: '600',
      color: Services.api.signedIn ? T.heal : T.dim
    }).setOrigin(1, 0.5);
    this.add.container(x, y, [g, realm, this.authBadgeText]).setDepth(DEPTH.hud + 1);
  }

  /** Rising ash and warm ember particles across the widescreen title illustration. */
  private addTitleAtmosphere(): void {
    this.add
      .particles(0, 0, 'fx_spark', {
        x: { min: 0, max: REF_W },
        y: REF_H + 20,
        lifespan: 10500,
        speedY: { min: -58, max: -24 },
        speedX: { min: -18, max: 14 },
        scale: { min: 0.04, max: 0.16 },
        alpha: { start: 0.36, end: 0 },
        frequency: 300,
        tint: [0xc9b6e4, 0xe3c37d, 0xd4325c],
        blendMode: 'ADD'
      })
      .setDepth(DEPTH.world);
  }

  /** Clean Title Screen menu: blinking TAP TO START banner + discrete top-right SETTINGS & REPLAY INTRO utility pills. */
  private buildTitleStartMenu(): void {
    const insets = safeInsets(this);
    const subLine = this.firstRun ? S.menu.tapSubFirstRun : S.menu.tapSubReturn;
    this.buildTapToContinueBanner('GOOGLE PLAY GAMES  ·  LIVEOPS', subLine, true, () => void this.onTapToStart());
    new Button(this, REF_W - 340 - insets.right, 58 + insets.top, {
      label: 'REPLAY INTRO',
      w: 224,
      h: 62,
      fontSize: 20,
      onClick: () => {
        forceResetEntry();
        this.firstRun = true;
        void this.onTapToStart();
      }
    }).setDepth(DEPTH.hud + 2);
    new Button(this, REF_W - 126 - insets.right, 58 + insets.top, {
      label: S.menu.settings,
      w: 176,
      h: 62,
      fontSize: 21,
      onClick: () => void this.openSettings()
    }).setDepth(DEPTH.hud + 2);
  }

  /** Shared full-screen tap-to-start zone and blinking gothic prompt banner at the bottom center. */
  private buildTapToContinueBanner(modeBadge: string, subLine: string, enabled: boolean, onTap: () => void): void {
    const insets = safeInsets(this);
    const cx = REF_W / 2;
    const cy = REF_H - 165 - insets.bottom;

    if (enabled) {
      const tapZone = this.add
        .zone(REF_W / 2, REF_H / 2, REF_W, REF_H)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTH.hud - 2);
      tapZone.on('pointerup', () => {
        if (this.overlay || this.busy) return;
        Sfx.confirm();
        onTap();
      });
    }

    const wings = this.add.graphics();
    wings.lineStyle(2, C.goldHi, 0.85);
    wings.lineBetween(-540, 0, -350, 0);
    wings.lineBetween(350, 0, 540, 0);
    wings.lineStyle(1, C.silver, 0.45);
    wings.lineBetween(-470, 6, -360, 6);
    wings.lineBetween(360, 6, 470, 6);
    wings.fillStyle(C.goldHi, 0.95);
    for (const dx of [-336, 336]) {
      wings.fillPoints(
        [
          new Phaser.Math.Vector2(dx, -8),
          new Phaser.Math.Vector2(dx + 8, 0),
          new Phaser.Math.Vector2(dx, 8),
          new Phaser.Math.Vector2(dx - 8, 0)
        ],
        true
      );
    }

    const mainPrompt = txt(this, 0, 0, S.menu.tapToContinue, {
      fontFamily: F.display,
      fontSize: '44px',
      fontStyle: '700',
      color: enabled ? '#f1ece4' : T.dim,
      stroke: '#0a0610',
      strokeThickness: 6
    })
      .setOrigin(0.5)
      .setLetterSpacing(10);

    const badgeTxt = txt(this, 0, 50, modeBadge, {
      fontFamily: F.display,
      fontSize: '21px',
      fontStyle: '600',
      color: T.gold,
      stroke: '#0a0610',
      strokeThickness: 4
    })
      .setOrigin(0.5)
      .setLetterSpacing(4);

    const subTxt = txt(this, 0, 82, subLine, {
      fontFamily: F.body,
      fontSize: '26px',
      fontStyle: 'italic 500',
      color: T.dim,
      stroke: '#0a0610',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.tapBanner = this.add.container(cx, cy, [wings, mainPrompt, badgeTxt, subTxt]).setDepth(DEPTH.hud);

    if (enabled && !prefs().reducedMotion) {
      this.tweens.add({
        targets: mainPrompt,
        alpha: { from: 1, to: 0.24 },
        scale: { from: 1.02, to: 0.98 },
        duration: 1150,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  /**
   * Unified TAP TO START handler:
   * 1. Shows the Google Play Games Sign-In & Patch Check Area in the bottom-center.
   * 2. Authenticates Google Play Games (native/web when configured, or verifies session).
   * 3. Starts Patch Check (`Services.patches.start()`).
   * 4. For first-time players: keeps patching in the background (`ensurePatchBar`) and transitions slowly into the 2-minute Prologue & Tutorials.
   * 5. For returning/post-tutorial players: finishes patch check on screen, then resumes where the player left off (or shows Part I Beginning if Part I patch is not yet installed).
   */
  private async onTapToStart(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    void this.startAudio();

    const insets = safeInsets(this);
    if (this.tapBanner) {
      this.tweens.add({ targets: this.tapBanner, alpha: 0, duration: 280 });
    }

    // Build the Google Play Sign-In + Patch Check / Patch Area panel at the bottom center
    const cx = REF_W / 2;
    const cy = REF_H - 180 - insets.bottom;
    const boxBg = panel(this, 0, -10, 1180, 196, 'normal');

    // Google Play Games badge emblem
    const gpIcon = this.add.graphics();
    gpIcon.fillStyle(0x1f3628, 0.95);
    gpIcon.fillRoundedRect(-540, -64, 44, 44, 10);
    gpIcon.lineStyle(1.5, C.hpGood, 0.85);
    gpIcon.strokeRoundedRect(-540, -64, 44, 44, 10);
    gpIcon.fillStyle(C.hpGood, 1);
    gpIcon.fillTriangle(-525, -54, -525, -30, -505, -42);

    const stepHeading = txt(this, -480, -42, 'GOOGLE PLAY GAMES  ·  SIGNING IN…', {
      fontFamily: F.display,
      fontSize: '25px',
      fontStyle: '700',
      color: T.gold,
      stroke: '#0a0610',
      strokeThickness: 4
    })
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);

    const patchSub = txt(this, -480, -4, 'Authenticating Google Play Games profile and preparing patch manifest…', {
      fontFamily: F.body,
      fontSize: '24px',
      color: T.text
    }).setOrigin(0, 0.5);

    const trackW = 1070;
    const track = this.add.rectangle(0, 32, trackW, 14, 0x09050e, 0.95).setStrokeStyle(1.5, C.gold, 0.65);
    const fill = this.add.rectangle(-trackW / 2, 32, 80, 10, C.goldHi, 0.95).setOrigin(0, 0.5);
    const pctTxt = txt(this, 535, -42, 'AUTH', {
      fontFamily: F.display,
      fontSize: '22px',
      fontStyle: '700',
      color: T.gold
    }).setOrigin(1, 0.5);

    const fmtQuote = (idx: number): string => {
      const q = RANDOM_GAME_QUOTES[idx];
      return q ? `${q.quote}   — ${q.speaker}` : '';
    };

    // Random quote underneath the patch box
    let quoteIdx = Math.floor(Math.random() * RANDOM_GAME_QUOTES.length);
    const quoteTxt = txt(this, 0, 118, fmtQuote(quoteIdx), {
      fontFamily: F.body,
      fontSize: '23px',
      fontStyle: 'italic 500',
      color: '#d8cce8',
      stroke: '#05030a',
      strokeThickness: 4,
      align: 'center',
      wordWrap: { width: 1180 }
    }).setOrigin(0.5);

    this.stagingBox?.destroy();
    this.stagingBox = this.add
      .container(cx, cy, [boxBg, gpIcon, stepHeading, patchSub, track, fill, pctTxt, quoteTxt])
      .setDepth(DEPTH.hud + 3)
      .setAlpha(0);
    this.tweens.add({ targets: this.stagingBox, alpha: 1, duration: 360, ease: 'Sine.easeOut' });

    this.quoteTimer?.remove(false);
    this.quoteTimer = this.time.addEvent({
      delay: 4800,
      loop: true,
      callback: () => {
        if (!quoteTxt.active) return;
        quoteIdx = (quoteIdx + 1) % RANDOM_GAME_QUOTES.length;
        this.tweens.add({
          targets: quoteTxt,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            if (!quoteTxt.active) return;
            quoteTxt.setText(fmtQuote(quoteIdx));
            this.tweens.add({ targets: quoteTxt, alpha: 1, duration: 400 });
          }
        });
      }
    });

    // Step 1: Google Play Games Sign-In
    const canRealSignIn = Services.identity?.kind === 'native' || Services.identity?.kind === 'web';
    if (!Services.api.signedIn && canRealSignIn) {
      const res = await signInWithGoogle(this);
      if (!this.sys.isActive()) return;
      if (res !== 'ok' && !PREVIEW_FLOW_ENABLED) {
        this.quoteTimer?.remove(false);
        this.stagingBox?.destroy();
        this.stagingBox = null;
        if (this.tapBanner) this.tweens.add({ targets: this.tapBanner, alpha: 1, duration: 280 });
        this.busy = false;
        return;
      }
    } else {
      await this.waitMs(520);
      if (!this.sys.isActive()) return;
    }

    if (this.authBadgeText?.active) {
      this.authBadgeText.setText('PLAY GAMES ✓').setColor(T.heal);
    }
    if (Services.api.signedIn) {
      await syncEntry(Services.api).catch(() => undefined);
      if (!this.sys.isActive()) return;
      this.firstRun = loadEntry().phase !== 'completed';
    }

    // Step 2: Patch Check & Patch Area
    stepHeading.setText('GOOGLE PLAY GAMES ✓  ·  CHECKING FOR PATCHES…');
    patchSub.setText(
      this.firstRun
        ? 'Starting background patch download — Prologue & Tutorial will begin shortly…'
        : 'Verifying latest live content manifest and checking for game updates…'
    );
    pctTxt.setText('PATCH');
    this.tweens.add({ targets: fill, width: Math.round(trackW * 0.42), duration: 550, ease: 'Sine.easeOut' });

    void Services.patches.start();
    void this.refreshChip();

    if (this.firstRun) {
      // First-time player: keep patch running in background and transition slowly into Prologue / Tutorial
      await this.waitMs(850);
      if (!this.sys.isActive()) return;
      this.tweens.add({ targets: fill, width: trackW, duration: 420, ease: 'Sine.easeOut' });
      pctTxt.setText('LIVE');
      patchSub.setText('Background patch active · Entering Before the Road…');
      await this.waitMs(420);
      if (!this.sys.isActive()) return;
      await beginEntry(this);
      return;
    }

    // Post-tutorial / Returning player: wait if patch is currently checking/downloading
    while (this.sys.isActive() && Services.patches.get().kind === 'running') {
      const st = Services.patches.get();
      const ratio = Math.min(1, Math.max(0.2, barFill(st) ?? 0.2));
      fill.width = Math.round(trackW * ratio);
      pctTxt.setText(`${Math.round(ratio * 100)}%`);
      const p = st.kind === 'running' ? st.progress : null;
      if (p && p.bytesTotal > 0) {
        patchSub.setText(`Downloading patch · ${formatBytes(p.bytesDone)} / ${formatBytes(p.bytesTotal)}`);
      }
      await this.waitMs(180);
    }
    if (!this.sys.isActive()) return;

    this.tweens.add({ targets: fill, width: trackW, duration: 360, ease: 'Sine.easeOut' });
    pctTxt.setText('100%');
    patchSub.setText('Content up to date · Entering the road…');
    await this.waitMs(480);
    if (!this.sys.isActive()) return;
    await this.begin();
  }

  private waitMs(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.sys.isActive()) return resolve();
      this.time.delayedCall(ms, () => resolve());
    });
  }

  private async ensureMainTheme(): Promise<void> {
    Music.stop(0.1);
  }

  private async startAudio(): Promise<void> {
    if (this.audioStarted) return;
    this.audioStarted = true;
    await this.ensureMainTheme();
    Sfx.bell(330, 0.2, 2.2);
  }

  private go(scene: string): void {
    void this.startAudio();
    this.cameras.main.fadeOut(900, 10, 6, 16);
    this.time.delayedCall(900, () => this.scene.start(scene));
  }

  private async begin(): Promise<void> {
    try {
      const { content } = Services.ready();
      const idx = await content.chapters();
      const campaignChapters = idx.chapters.filter((ch) => ch.chapter_id !== 'tutorial');

      // If only the base AAB tutorial is installed (Part I patch not yet applied),
      // show the Part I Beginning screen instead of looping back into Tutorial T-1!
      if (campaignChapters.length === 0) {
        this.quoteTimer?.remove(false);
        this.stagingBox?.destroy();
        this.stagingBox = null;
        this.openPartOneBeginningModal();
        this.busy = false;
        return;
      }

      let progress = Progress.load();
      if (Services.api.signedIn) {
        try {
          const authoritative = await Services.api.progress();
          progress = Object.fromEntries(authoritative.nodes.filter((n) => n.clears > 0).map((n) => [n.node_id, { stars: n.stars }]));
        } catch {
          /* fall back to local progress when offline */
        }
      }
      const next = resolveNextCampaignNode(idx, progress, Services.api.accountKey);
      if (next) {
        this.cameras.main.fadeOut(1100, 10, 6, 16);
        await this.waitMs(1100);
        await playNode(this, next);
      }
    } finally {
      this.busy = false;
    }
  }

  /**
   * Shown to players who have graduated from the base AAB (Prologue + 3-Part Tutorial + Client Restart)
   * when Part I has not yet been delivered via LiveOps patch.
   */
  private openPartOneBeginningModal(): void {
    const { items, cx, cy } = this.openOverlay('PART I  ·  UNAWARE, I FADE', 1380, 720);
    const sub = txt(this, cx, cy - 190, 'PROLOGUE & TUTORIAL COMPLETED  ·  ACCOUNT SYNCHRONIZED', {
      fontFamily: F.display,
      fontSize: '24px',
      fontStyle: '600',
      color: T.heal,
      letterSpacing: 4
    }).setOrigin(0.5);
    const body = txt(
      this,
      cx,
      cy - 55,
      'Fadyme and Mahmut step out from the wayside shelter into the pale dawn of the Whispering Ash.\n\n' +
        'Part I — "Unaware, I Fade" and subsequent chapters are delivered dynamically via LiveOps Content Patches.\n' +
        'Your tutorial completion and Google Play profile are saved. You may visit the Company Sanctum or check for the Part I patch below.',
      {
        fontFamily: F.body,
        fontSize: '32px',
        color: T.text,
        align: 'center',
        lineSpacing: 12,
        wordWrap: { width: 1180 }
      }
    ).setOrigin(0.5);
    const quote = txt(this, cx, cy + 125, '“Two names still uncalled. And a road that had only just begun.”', {
      fontFamily: F.body,
      fontSize: '28px',
      fontStyle: 'italic 500',
      color: T.gold
    }).setOrigin(0.5);
    const companyBtn = new Button(this, cx - 390, cy + 245, {
      label: 'COMPANY SANCTUM',
      w: 360,
      h: 96,
      fontSize: 24,
      variant: 'hot',
      onClick: () => {
        this.closeOverlay();
        this.go('Home');
      }
    });
    const checkBtn = new Button(this, cx, cy + 245, {
      label: 'CHECK PATCH',
      w: 340,
      h: 96,
      fontSize: 24,
      onClick: async () => {
        checkBtn.setLabel('CHECKING…').setEnabled(false);
        const out = await Services.ready().content.checkForUpdates();
        if (out.status === 'applied' || out.status === 'reverted_to_base') await Services.refreshArt();
        void this.refreshChip();
        toast(this, describe(out));
        if (checkBtn.active) checkBtn.setLabel('CHECK PATCH').setEnabled(true);
      }
    });
    const closeBtn = new Button(this, cx + 390, cy + 245, {
      label: 'RETURN TO TITLE',
      w: 360,
      h: 96,
      fontSize: 24,
      onClick: () => {
        this.closeOverlay();
        if (this.tapBanner) this.tweens.add({ targets: this.tapBanner, alpha: 1, duration: 300 });
      }
    });
    items.push(sub, body, quote, companyBtn, checkBtn, closeBtn);
    this.overlay = this.add.container(0, 0, items).setDepth(DEPTH.modal);
  }



  private async refreshChip(): Promise<void> {
    const { content } = Services.ready();
    const chip = this.chipText;
    const active = await content.activeReleaseId();
    if (!this.sys.isActive() || !chip?.active || this.chipText !== chip) return;
    chip.setText(`CONTENT ${active}${active !== content.base.releaseId ? ' (patch)' : ''}  ·  ${CHANNEL}  ·  v${CLIENT_VERSION}${PATCH_LAB_ENABLED ? '  ·  tap for details' : ''}`);
  }

  private onContentChanged(out: PatchOutcome): void {
    void this.refreshChip();
    if (out.status === 'applied') toast(this, `New content downloaded: ${out.releaseId}`);
    else toast(this, 'Content returned to the installed base');
  }

  private onChecked(): void {
    void this.refreshChip();
  }

  // ------------------------------------------------------------------ overlays

  private closeOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }

  private openOverlay(heading: string, w: number, h: number): { items: Phaser.GameObjects.GameObject[]; cx: number; cy: number } {
    this.closeOverlay();
    const dim = this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x000000, 0.72).setInteractive();
    const box = panel(this, REF_W / 2, REF_H / 2, w, h, 'normal');
    const head = title(this, REF_W / 2, REF_H / 2 - h / 2 + 70, heading, 46, T.gold);
    return { items: [dim, box, head], cx: REF_W / 2, cy: REF_H / 2 };
  }

  private async openSettings(): Promise<void> {
    const revision = this.viewRevision; const request = ++this.settingsRequest;
    const profile = await Services.ready().content.presentation().catch(() => null);
    if (!this.sys.isActive() || revision !== this.viewRevision || request !== this.settingsRequest) return;
    const locales = ['en', ...(profile?.locales ?? []).filter((l) => l !== 'en')];
    const shiftLocale = (delta: number): void => {
      setPref('locale', locales[(Math.max(0, locales.indexOf(prefs().locale)) + delta + locales.length) % locales.length]!);
      void Services.ready().content.locale().then((loc) => setActiveLocaleStrings(loc?.strings)).catch(() => undefined);
    };
    const { items, cx, cy } = this.openOverlay('SETTINGS', 1720, 1000);
    const rows: { label: string; get: () => string; dec: () => void; inc: () => void }[] = [
      {
        label: 'Music',
        get: () => `${Math.round(prefs().musicVolume * 100)}%`,
        dec: () => { setPref('musicVolume', Math.max(0, +(prefs().musicVolume - 0.1).toFixed(1))); Music.setVolume(prefs().musicVolume); },
        inc: () => { setPref('musicVolume', Math.min(1, +(prefs().musicVolume + 0.1).toFixed(1))); Music.setVolume(prefs().musicVolume); }
      },
      {
        label: 'Effects',
        get: () => `${Math.round(prefs().sfxVolume * 100)}%`,
        dec: () => { setPref('sfxVolume', Math.max(0, +(prefs().sfxVolume - 0.1).toFixed(1))); Sfx.setVolume(prefs().sfxVolume); Sfx.tap(); },
        inc: () => { setPref('sfxVolume', Math.min(1, +(prefs().sfxVolume + 0.1).toFixed(1))); Sfx.setVolume(prefs().sfxVolume); Sfx.tap(); }
      },
      { label: 'Voice', get: () => `${Math.round(prefs().voiceVolume * 100)}%`, dec: () => setPref('voiceVolume', Math.max(0, +(prefs().voiceVolume - 0.1).toFixed(1))), inc: () => setPref('voiceVolume', Math.min(1, +(prefs().voiceVolume + 0.1).toFixed(1))) },
      { label: 'Language', get: () => prefs().locale.toUpperCase(), dec: () => shiftLocale(-1), inc: () => shiftLocale(1) },
      {
        label: 'Text speed',
        get: () => prefs().textSpeed.toUpperCase(),
        dec: () => setPref('textSpeed', ({ slow: 'fast', normal: 'slow', fast: 'normal' } as const)[prefs().textSpeed]),
        inc: () => setPref('textSpeed', ({ slow: 'normal', normal: 'fast', fast: 'slow' } as const)[prefs().textSpeed])
      },
      {
        label: 'Reduced motion',
        get: () => (prefs().reducedMotion ? 'ON' : 'OFF'),
        dec: () => setPref('reducedMotion', !prefs().reducedMotion),
        inc: () => setPref('reducedMotion', !prefs().reducedMotion)
      }
    ];
    rows.forEach((r, i) => {
      const y = cy - 300 + i * 110;
      items.push(txt(this, cx - 470, y, r.label, { fontSize: '40px' }).setOrigin(0, 0.5));
      const value = txt(this, cx + 190, y, r.get(), { fontFamily: F.display, fontSize: '36px', fontStyle: '600', color: T.gold }).setOrigin(0.5);
      items.push(value);
      items.push(new Button(this, cx + 30, y, { label: '−', w: 130, h: 100, fontSize: 48, onClick: () => { r.dec(); value.setText(r.get()); } }));
      items.push(new Button(this, cx + 350, y, { label: '+', w: 130, h: 100, fontSize: 48, onClick: () => { r.inc(); value.setText(r.get()); } }));
      items.push(value);
    });

    const tiers: Prefs['qualityTier'][] = ['auto', 'low', 'medium', 'high'];
    const layouts: Prefs['battleLayout'][] = ['afk_faithful', 'current', 'arena_lite'];
    const layoutTag = (l: Prefs['battleLayout']): string => (l === 'afk_faithful' ? 'AFK' : l === 'arena_lite' ? 'ARENA' : 'CURRENT');
    const a11yToggles: { getLabel: () => string; sub: string; onClick: (btn: Button) => void }[] = [
      {
        getLabel: () => `TEXT: ${prefs().textSize.toUpperCase()}`,
        sub: 'Text Size',
        onClick: (btn) => { setPref('textSize', prefs().textSize === 'normal' ? 'large' : 'normal'); btn.setLabel(`TEXT: ${prefs().textSize.toUpperCase()}`); }
      },
      {
        getLabel: () => `CONTRAST: ${prefs().highContrast ? 'HIGH' : 'STD'}`,
        sub: 'Contrast Mode',
        onClick: (btn) => { setPref('highContrast', !prefs().highContrast); btn.setLabel(`CONTRAST: ${prefs().highContrast ? 'HIGH' : 'STD'}`); }
      },
      {
        getLabel: () => `FLASH: ${prefs().reduceFlash ? 'REDUCED' : 'NORMAL'}`,
        sub: 'Reduce Flash',
        onClick: (btn) => { setPref('reduceFlash', !prefs().reduceFlash); btn.setLabel(`FLASH: ${prefs().reduceFlash ? 'REDUCED' : 'NORMAL'}`); }
      },
      {
        getLabel: () => `QUALITY: ${prefs().qualityTier.toUpperCase()}`,
        sub: 'Graphics Tier',
        onClick: (btn) => {
          const next = tiers[(tiers.indexOf(prefs().qualityTier) + 1) % tiers.length]!;
          setPref('qualityTier', next);
          btn.setLabel(`QUALITY: ${next.toUpperCase()}`);
        }
      },
      {
        getLabel: () => `LAYOUT: ${layoutTag(prefs().battleLayout)}`,
        sub: 'Battle Layout',
        onClick: (btn) => {
          const next = layouts[(layouts.indexOf(prefs().battleLayout) + 1) % layouts.length]!;
          setPref('battleLayout', next);
          btn.setLabel(`LAYOUT: ${layoutTag(next)}`);
        }
      },
      {
        getLabel: () => {
          const st = consentState()?.status;
          return st === 'withdrawn' || st === 'denied' ? 'ADS: WITHDRAWN' : st === 'OBTAINED' ? 'ADS: CONSENTED' : 'PRIVACY OPTIONS';
        },
        sub: 'Ad Consent',
        onClick: (btn) => {
          void showPrivacyOptions()
            .then((next) => {
              const st = next?.status;
              btn.setLabel(st === 'withdrawn' || st === 'denied' ? 'ADS: WITHDRAWN' : st === 'OBTAINED' ? 'ADS: CONSENTED' : 'PRIVACY OPTIONS');
              toast(this, `Privacy choice updated (${st ?? 'saved'})`);
            })
            .catch((e: unknown) => toast(this, String(e instanceof Error ? e.message : e)));
        }
      }
    ];
    a11yToggles.forEach((t, i) => {
      const y = cy - 300 + i * 110;
      const btn = new Button(this, 1600, y, { label: t.getLabel(), sub: t.sub, w: 340, h: 96, fontSize: 22, onClick: () => t.onClick(btn) });
      items.push(btn);
    });

    if (this.firstRun) {
      items.push(new Button(this, cx, cy + 400, { label: 'CLOSE', w: 560, onClick: () => this.closeOverlay() }));
    } else {
      items.push(new Button(this, cx - 250, cy + 400, { label: 'RESET PROGRESS', w: 430, variant: 'danger', fontSize: 26, onClick: () => { Progress.reset(); toast(this, 'Progress cleared'); } }));
      items.push(new Button(this, cx + 250, cy + 400, { label: 'CLOSE', w: 430, onClick: () => this.closeOverlay() }));
    }
    this.overlay = this.add.container(0, 0, items).setDepth(DEPTH.modal);
  }

  /** Opens the content-update panel (also used by automated tests). */
  openPatchLab(): void {
    if (!PATCH_LAB_ENABLED) return;
    const { content } = Services.ready();
    const { items, cx, cy } = this.openOverlay('CONTENT UPDATES', 1300, 820);
    const body = txt(this, cx - 580, cy - 190, 'Reading state…', { fontSize: '34px', color: T.text, lineSpacing: 10, wordWrap: { width: 1160 } });
    items.push(body);
    const render = async (): Promise<void> => {
      const st = await content.state();
      const lines = [
        `Embedded base:  ${content.base.releaseId}  (generation ${content.base.generation})`,
        `Active patch:   ${st.active ? `${st.active.releaseId}  (generation ${st.active.generation}, ${st.active.manifest.files.length} files)` : 'none'}`,
        `Rollback target:  ${st.previous ? st.previous.releaseId : st.active ? 'embedded base' : '—'}`,
        `Denied on this device:  ${st.denied.length ? st.denied.join(', ') : 'none'}`,
        `Channel: ${CHANNEL}   ·   client v${CLIENT_VERSION}   ·   storage: ${content.persistent ? 'IndexedDB' : 'memory (not persistent)'}`,
        `Last check:  ${describe(content.lastCheck.outcome)}`
      ];
      if (body.active) body.setText(lines.join('\n'));
    };
    void render();
    items.push(
      new Button(this, cx - 410, cy + 250, {
        label: 'CHECK NOW',
        w: 380,
        onClick: async () => {
          body.setText('Checking for content updates…');
          const out = await content.checkForUpdates();
          if (out.status === 'applied' || out.status === 'reverted_to_base') await Services.refreshArt();
          await render();
          void this.refreshChip();
          toast(this, describe(out));
        }
      }),
      new Button(this, cx, cy + 250, {
        label: 'ROLL BACK',
        w: 380,
        variant: 'danger',
        onClick: async () => {
          const changed = await content.rollback();
          if (changed) await Services.refreshArt();
          await render();
          void this.refreshChip();
          toast(this, changed ? 'Rolled back' : 'Already on the embedded base');
        }
      }),
      new Button(this, cx + 410, cy + 250, { label: 'CLOSE', w: 380, onClick: () => this.closeOverlay() })
    );
    this.overlay = this.add.container(0, 0, items).setDepth(DEPTH.modal);
    void C;
    void SIZE;
  }
}
