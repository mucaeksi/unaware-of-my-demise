import * as PIXI from 'pixi.js';
import type { PatchOutcome } from '@uomd/patch';
import { CHANNEL, CLIENT_VERSION, PATCH_LAB_ENABLED, PREVIEW_FLOW_ENABLED, REF_H, REF_W } from '../config';
import { PixiScene } from '../core/PixiScene';
import { syncContinuityNow } from '../entry/cloudSync';
import { advance, beginEntry, signInWithGoogle } from '../entry/flow';
import { syncEntry } from '../entry/sync';
import { forceResetEntry, isDevServer, isForceFreshEntry, isInteractiveBrowser, loadEntry, startReplay } from '../entry/state';
import { RANDOM_GAME_QUOTES, S, setActiveLocaleStrings } from '../entry/strings';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { consentState, showPrivacyOptions } from '../net/store';
import { prefs, setPref, type Prefs } from '../platform/prefs';
import { safeInsets } from '../platform/safeArea';
import { Progress, Services } from '../services';
import { playNode, resolveNextCampaignNode } from '../flow';
import { barFill } from '../patch/barFill';
import { DomStage, type DomBox, type DomButton, type DomGroup, type DomText } from '../ui/domKit';
import { formatBytes } from '../ui/format';
import { titleStyle } from '../ui/hubScreen';
import { sceneFadeIn, verticalShade } from '../ui/pixiKit';
import { C, DEPTH, F, T } from '../ui/theme';
import { createCrackedWatchSpinner, createEclipseCorona, createSwingingBellEmblem, triggerWaxSealBurst } from '../vfx/gothicUiVfx';
import { attachLivingBackdrop } from '../vfx/livingBackdrop';
import { vfxTextures } from '../vfx/textures';
import { app } from '../core/app';

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

const rgba = (c: number, a: number): string => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

/**
 * The title: key art, logo and ash on the PIXI stage; every control, the settings, the patch box and the overlays are
 * HTML (R10): real buttons, a modal that traps focus, Escape to close.
 */
export class TitleScene extends PixiScene<{ openSettings?: boolean }> {
  private ui!: DomStage;
  private chipText!: DomText;
  private overlay: DomGroup | null = null;
  private tapBanner: DomGroup | null = null;
  private stagingBox: DomGroup | null = null;
  private authBadgeText: DomText | null = null;
  private quoteTimer: { stop(): void } | null = null;
  private audioStarted = false;
  /** true until the entry flow (prologue, tutorials, patch page) has been completed once on this account/device */
  private firstRun = false;
  private busy = false;
  private settingsRequest = 0;

  async create(data?: { openSettings?: boolean }): Promise<void> {
    this.firstRun = loadEntry().phase !== 'completed';
    const { art, content } = Services.ready();
    void content.locale().then((loc) => setActiveLocaleStrings(loc?.strings)).catch(() => undefined);
    const insets = safeInsets();
    this.ui = new DomStage(app().uiLayer);
    this.attachDom(this.ui.root);
    this.onClose(() => {
      this.quoteTimer?.stop();
      this.ui.destroy();
    });
    this.buildServerBadge();
    this.buildTitleStartMenu();
    this.chipText = this.ui.text(60 + insets.left, REF_H - 36 - insets.bottom, '', { fontSize: 24, color: T.dim }).setOrigin(0, 0.5).setDepth(DEPTH.hud + 2);
    if (PATCH_LAB_ENABLED) this.ui.button(330 + insets.left, REF_H - 36 - insets.bottom, { label: 'CONTENT DETAILS', bare: true, w: 560, h: 60, onClick: () => this.openPatchLab() });
    void this.refreshChip();
    if (data?.openSettings) void this.openSettings();
    // a patch can have replaced the art library while the splash played: make sure it has loaded what this screen draws
    await art.ensureBoot(this).catch((e: unknown) => console.warn('menu art unavailable', e));
    if (!this.live) return;
    const notice = content.storageNotice;
    if (notice) this.ui.toast(notice, 8000);

    // the Main Theme continues from the studio card (or starts when the title is entered directly)
    void this.ensureMainTheme();
    this.buildArt(insets.left);

    // a reinstall or a second device: the account may already be past the entry flow
    if (this.firstRun && Services.api.signedIn && !isForceFreshEntry()) {
      void syncEntry(Services.api).then(({ state }) => {
        if (state.phase === 'completed' && this.live && !this.busy) this.firstRun = false;
      });
    }

    const game = app();
    const changed = (out: PatchOutcome): void => this.onContentChanged(out);
    const checked = (): void => void this.refreshChip();
    game.events.on('content:changed', changed);
    game.events.on('content:checked', checked);
    const firstTouch = (): void => void this.startAudio();
    game.canvas.addEventListener('pointerdown', firstTouch, { once: true });
    this.onClose(() => {
      game.events.off('content:changed', changed);
      game.events.off('content:checked', checked);
      game.canvas.removeEventListener('pointerdown', firstTouch);
    });
    sceneFadeIn(this, 1200);
  }

  override notify(message: string, ms = 2600): void {
    if (this.live) this.ui.toast(message, ms);
  }

  private buildArt(insetLeft: number): void {
    const { art } = Services.ready();
    const reduced = prefs().reducedMotion;
    const cover = (s: PIXI.Sprite, k: number): number => Math.max(REF_W / (s.texture.width || REF_W), REF_H / (s.texture.height || REF_H)) * k;
    const titleBgKey = art.ui('title_bg');
    const bg = this.add(new PIXI.Sprite(this.tex(titleBgKey ?? art.background('forest_whispering_ash'))), 0);
    bg.anchor.set(0.5);
    bg.position.set(REF_W / 2, REF_H / 2);
    const k = cover(bg, titleBgKey ? 1.045 : 1.055);
    attachLivingBackdrop(this, bg, { baseScale: k, fxDepth: 1, mood: 'eclipse', intensity: 1.1 });
    const keyArt = titleBgKey ? null : art.ui('key_art');
    if (keyArt) {
      const ka = this.add(new PIXI.Sprite(this.tex(keyArt)), 1);
      ka.anchor.set(0.5);
      ka.scale.set(REF_H / (ka.texture.height || REF_H));
      ka.position.set(REF_W - ka.width / 2, REF_H / 2);
    }
    // light top band behind the utility pills, deep bottom band behind TAP TO START
    this.add(verticalShade(0, 0, REF_W, 110, 0x05030a, 0.32, 0), 2);
    this.add(verticalShade(0, REF_H - 250, REF_W, 250, 0x05030a, 0, 0.82), 2);
    const logoX = 500 + insetLeft;
    const logoY = 284;
    // #1 Approved UI Animation: Rotating Black-Sun Eclipse Corona & Rune Ring behind the emblem
    const corona = createEclipseCorona(this, logoX, logoY - 12, 174, 3, false);
    corona.alpha = 0.72;
    // #2 Approved UI Animation: Swinging Fractured Sanctuary Bell & Acoustic Shockwave Rings
    const bell = createSwingingBellEmblem(this, logoX, logoY - 182, 0.86, 5, 2900);
    bell.container.alpha = 0;
    this.anim.to(bell.container, { alpha: 1 }, { duration: 1400, delay: 300, ease: 'sine.out' });
    const glow = this.add(new PIXI.Sprite(vfxTextures().spark), 3);
    glow.anchor.set(0.5);
    glow.position.set(logoX, logoY);
    glow.scale.set(9.2, 4.0);
    glow.tint = C.plumHi;
    glow.blendMode = 'add';
    glow.alpha = 0.32;
    const logoKey = art.ui('logo');
    if (logoKey) {
      const logo = this.add(new PIXI.Sprite(this.tex(logoKey)), 4);
      logo.anchor.set(0.5);
      logo.scale.set(760 / (logo.texture.width || 760));
      logo.position.set(logoX, logoY + 12);
      logo.alpha = 0;
      this.anim.to(logo, { alpha: 1, y: logoY }, { duration: 1500, ease: 'cubic.out' });
      if (!reduced) this.anim.to(logo, { y: logoY + 7 }, { duration: 3200, yoyo: true, repeat: -1, ease: 'sine.inout', delay: 1500 });
    }
    this.ui.text(logoX, 490, S.menu.tagline, { fontFamily: F.display, fontSize: 27, fontStyle: '600', color: '#e3c37d', stroke: '#0a0610', strokeThickness: 4, letterSpacing: 5 }).setOrigin(0.5);
  }

  /** online realm and Google Play Games status badge (top left) */
  private buildServerBadge(): void {
    const insets = safeInsets();
    const x = 60 + insets.left;
    const y = 58 + insets.top;
    const pill = this.ui.box(x, y - 24, 490, 48, 0x120a18, 0.48).setDepth(DEPTH.hud + 1);
    pill.el.style.borderRadius = '24px';
    pill.el.style.border = `1.5px solid ${rgba(C.gold, 0.52)}`;
    const dot = this.ui.box(x + 18, y - 6, 12, 12, C.hpGood, 1).setDepth(DEPTH.hud + 1);
    dot.el.style.borderRadius = '50%';
    this.ui.text(x + 44, y, 'SANCTUM-01  ·  ONLINE', { fontFamily: F.display, fontSize: 20, fontStyle: '600', color: T.gold, letterSpacing: 2 }).setOrigin(0, 0.5).setDepth(DEPTH.hud + 1);
    this.authBadgeText = this.ui.text(x + 470, y, Services.api.signedIn ? 'PLAY GAMES ✓' : 'PLAY GAMES', { fontFamily: F.display, fontSize: 18, fontStyle: '600', color: Services.api.signedIn ? T.heal : T.dim }).setOrigin(1, 0.5).setDepth(DEPTH.hud + 1);
  }

  /** first-run / returning doors, the TAP TO START banner and the top-right utility pills */
  private buildTitleStartMenu(): void {
    const insets = safeInsets();
    const mx = 500 + insets.left;
    this.buildTapToContinueBanner('GOOGLE PLAY GAMES  ·  LIVEOPS', this.firstRun ? S.menu.tapSubFirstRun : S.menu.tapSubReturn, () => void this.onTapToStart());
    const top = DEPTH.hud + 2;
    this.ui.button(REF_W - 375 - insets.right, 58 + insets.top, {
      label: 'REPLAY INTRO',
      w: 210,
      h: 62,
      fontSize: 19,
      onClick: () => {
        if (this.busy) return;
        this.busy = true;
        // a replay of the opening, separate from the account's own entry progress (R09)
        startReplay();
        void this.startAudio();
        advance(this, { kind: 'prologue' });
      }
    }).setDepth(top);
    this.ui.button(REF_W - 145 - insets.right, 58 + insets.top, { label: S.menu.settings, w: 190, h: 62, fontSize: 21, onClick: () => void this.openSettings() }).setDepth(top);

    if (this.firstRun) {
      const signedIn = Services.api.signedIn;
      const canSignIn = Services.identity?.kind === 'native' || Services.identity?.kind === 'web';
      if (signedIn) this.ui.button(mx, 640, { label: S.menu.cont, sub: S.menu.contSub, w: 460, h: 98, fontSize: 30, variant: 'hot', onClick: () => void this.onTapToStart() }).setDepth(top);
      else if (canSignIn) this.ui.button(mx, 640, { label: S.menu.signIn, sub: S.menu.signInSub, w: 480, h: 98, fontSize: 28, variant: 'hot', onClick: () => void this.onTapToStart() }).setDepth(top);
      else if (PREVIEW_FLOW_ENABLED) this.ui.button(mx, 640, { label: S.menu.preview, sub: S.menu.previewSub, w: 480, h: 98, fontSize: 28, variant: 'hot', onClick: () => void this.onTapToStart() }).setDepth(top);
      else {
        this.ui.button(mx, 640, { label: S.menu.signIn, w: 480, h: 98, fontSize: 28, variant: 'dim', onClick: () => undefined }).setEnabled(false).setDepth(top);
        this.ui.text(mx, 730, S.menu.webNote, { fontSize: 26, color: T.dim }).setOrigin(0.5).setDepth(top);
      }
    } else {
      this.ui.button(mx, 620, { label: 'CONTINUE', sub: 'Enter the Road', w: 460, h: 98, fontSize: 32, variant: 'hot', onClick: () => void this.begin() }).setDepth(top);
      this.ui.button(mx, 740, { label: 'CHAPTERS', w: 460, h: 88, fontSize: 28, onClick: () => this.go('Chapters') }).setDepth(top);
      this.ui.button(mx, 850, { label: 'COMPANY', w: 460, h: 88, fontSize: 28, onClick: () => this.go('Home') }).setDepth(top);
    }
  }

  /** a gold rule (horizontal line) inside a group */
  private rule(g: DomGroup, x: number, y: number, w: number, thickness: number, color: number, alpha: number): DomBox {
    return this.ui.box(x, y - thickness / 2, w, thickness, color, alpha, g);
  }

  private diamond(g: DomGroup, x: number, y: number, r: number, color: number, alpha: number): void {
    const d = this.ui.box(x - r, y - r, r * 2, r * 2, color, alpha, g);
    d.el.style.rotate = '45deg';
  }

  /** tap anywhere to start (canvas zone), plus the blinking gothic prompt; the prompt is also a focusable button */
  private buildTapToContinueBanner(modeBadge: string, subLine: string, onTap: () => void): void {
    const insets = safeInsets();
    const cx = this.firstRun ? REF_W / 2 : 1220;
    const cy = REF_H - 148 - insets.bottom;
    const fireTap = (): void => {
      if (this.overlay || this.busy) return;
      Sfx.confirm();
      // #3 Approved UI Animation: Wax-Seal CTA Ignition Burst
      triggerWaxSealBurst(this, cx, cy, DEPTH.hud + 6);
      onTap();
    };
    const zone = this.add(new PIXI.Container(), DEPTH.hud - 2);
    zone.hitArea = new PIXI.Rectangle(0, 0, REF_W, REF_H);
    zone.eventMode = 'static';
    zone.cursor = 'pointer';
    zone.on('pointerup', fireTap);

    const g = this.ui.group().setDepth(DEPTH.hud);
    this.rule(g, cx - 370, cy, 120, 2, C.goldHi, 0.85);
    this.rule(g, cx + 250, cy, 120, 2, C.goldHi, 0.85);
    this.rule(g, cx - 330, cy + 6, 70, 1, C.silver, 0.45);
    this.rule(g, cx + 260, cy + 6, 70, 1, C.silver, 0.45);
    for (const dx of [-236, 236]) this.diamond(g, cx + dx, cy, 5, C.goldHi, 0.95);
    // Crimson & Gold Wax Seal emblem centered above the prompt
    const seal = this.ui.box(cx - 18, cy - 60, 36, 36, 0x9e1b34, 0.95, g);
    seal.el.style.borderRadius = '50%';
    seal.el.style.border = `2px solid ${rgba(C.goldHi, 0.92)}`;
    seal.el.style.boxShadow = '0 0 14px rgba(212,50,92,.65)';
    const prompt = this.ui.text(cx, cy, S.menu.tapToContinue, { fontFamily: F.display, fontSize: 44, fontStyle: '700', color: '#f1ece4', stroke: '#0a0610', strokeThickness: 6, letterSpacing: 10 }, g).setOrigin(0.5);
    if (!prefs().reducedMotion) prompt.el.classList.add('uomd-blink');
    this.ui.text(cx, cy + 50, modeBadge, { fontFamily: F.display, fontSize: 21, fontStyle: '600', color: T.gold, stroke: '#0a0610', strokeThickness: 4, letterSpacing: 4 }, g).setOrigin(0.5);
    this.ui.text(cx, cy + 82, subLine, { fontFamily: F.body, fontSize: 26, fontStyle: 'italic 500', color: T.dim, stroke: '#0a0610', strokeThickness: 3 }, g).setOrigin(0.5);
    this.ui.button(cx, cy + 30, { label: S.menu.tapToContinue, ariaLabel: `${S.menu.tapToContinue}. ${subLine}`, bare: true, w: 760, h: 150, onClick: fireTap }, g);
    this.tapBanner = g;
  }

  private setBannerVisible(on: boolean): void {
    const b = this.tapBanner;
    if (!b) return;
    b.el.style.transition = 'opacity .28s';
    b.setAlpha(on ? 1 : 0);
  }

  /**
   * Unified TAP TO START: shows the sign-in + patch check box, signs in (native/web when configured), starts the patch
   * check, then sends a first-run player into the prologue/tutorials (the download continues in the background) and a
   * returning player to where they left off once the check finishes.
   */
  private async onTapToStart(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    void this.startAudio();
    const insets = safeInsets();
    triggerWaxSealBurst(this, 500 + insets.left, 640, DEPTH.hud + 6);

    if (!isInteractiveBrowser()) {
      const canSignIn = Services.identity?.kind === 'native' || Services.identity?.kind === 'web';
      if (!Services.api.signedIn && canSignIn && (await signInWithGoogle(this)) !== 'ok') {
        this.busy = false;
        return;
      }
      if (this.firstRun) {
        await beginEntry(this);
      } else {
        this.busy = false;
        await this.begin();
      }
      return;
    }

    this.setBannerVisible(false);
    const cx = REF_W / 2;
    const cy = REF_H - 180 - insets.bottom;
    this.stagingBox?.destroy();
    const box = this.ui.group().setDepth(DEPTH.hud + 3);
    box.el.style.transition = 'opacity .36s ease-out';
    box.setAlpha(0);
    this.ui.panel(cx, cy - 10, 1180, 196, 'normal', box);
    // #4 Approved UI Animation: Cracked Pocket Watch & Sanctuary Bell Spinner during auth/patch staging
    createCrackedWatchSpinner(this, cx + 455, cy - 42, 0.38, DEPTH.hud + 5);
    // Google Play Games emblem
    const icon = this.ui.box(cx - 540, cy - 64, 44, 44, 0x1f3628, 0.95, box);
    icon.el.style.borderRadius = '10px';
    icon.el.style.border = `1.5px solid ${rgba(C.hpGood, 0.85)}`;
    this.ui.text(cx - 515, cy - 42, '▶', { fontSize: 22, color: '#6fbf73' }, box).setOrigin(0.5);
    const stepHeading = this.ui.text(cx - 480, cy - 42, 'GOOGLE PLAY GAMES  ·  SIGNING IN…', { fontFamily: F.display, fontSize: 25, fontStyle: '700', color: T.gold, stroke: '#0a0610', strokeThickness: 4, letterSpacing: 3 }, box).setOrigin(0, 0.5);
    const patchSub = this.ui.text(cx - 480, cy - 4, 'Authenticating Google Play Games profile and preparing patch manifest…', { fontFamily: F.body, fontSize: 24, color: T.text }, box).setOrigin(0, 0.5);
    const trackW = 1070;
    const track = this.ui.box(cx - trackW / 2, cy + 25, trackW, 14, 0x09050e, 0.95, box);
    track.el.style.border = `1.5px solid ${rgba(C.gold, 0.65)}`;
    const fill = this.ui.box(cx - trackW / 2, cy + 27, 80, 10, C.goldHi, 0.95, box);
    if (!prefs().reducedMotion) fill.el.style.transition = 'width .5s ease-out';
    const setFill = (ratio: number): void => void fill.setSize(Math.round(trackW * ratio), 10);
    const pctTxt = this.ui.text(cx + 535, cy - 42, 'AUTH', { fontFamily: F.display, fontSize: 22, fontStyle: '700', color: T.gold }, box).setOrigin(1, 0.5);
    const fmtQuote = (idx: number): string => {
      const q = RANDOM_GAME_QUOTES[idx];
      return q ? `${q.quote}   — ${q.speaker}` : '';
    };
    let quoteIdx = Math.floor(Math.random() * RANDOM_GAME_QUOTES.length);
    const quoteTxt = this.ui.text(cx, cy + 118, fmtQuote(quoteIdx), { fontFamily: F.body, fontSize: 23, fontStyle: 'italic 500', color: '#d8cce8', stroke: '#05030a', strokeThickness: 4, align: 'center', wordWrap: { width: 1180 } }, box).setOrigin(0.5);
    quoteTxt.el.style.transition = 'opacity .3s';
    this.stagingBox = box;
    requestAnimationFrame(() => box.setAlpha(1));
    this.quoteTimer?.stop();
    const rotate = (): void => {
      this.quoteTimer = this.anim.after(4800, () => {
        if (!quoteTxt.active) return;
        quoteIdx = (quoteIdx + 1) % RANDOM_GAME_QUOTES.length;
        quoteTxt.setAlpha(0);
        this.anim.after(300, () => {
          if (!quoteTxt.active) return;
          quoteTxt.setText(fmtQuote(quoteIdx)).setAlpha(1);
        });
        rotate();
      });
    };
    rotate();

    // step 1: Google Play Games sign-in
    const canRealSignIn = Services.identity?.kind === 'native' || Services.identity?.kind === 'web';
    if (!Services.api.signedIn && canRealSignIn) {
      const res = await signInWithGoogle(this);
      if (!this.live) return;
      if (res !== 'ok' && !PREVIEW_FLOW_ENABLED) {
        this.quoteTimer?.stop();
        this.stagingBox?.destroy();
        this.stagingBox = null;
        this.setBannerVisible(true);
        this.busy = false;
        return;
      }
    } else {
      await this.anim.wait(520);
      if (!this.live) return;
    }
    if (this.authBadgeText?.active) this.authBadgeText.setText('PLAY GAMES ✓').setColor(T.heal);
    if (Services.api.signedIn && !isForceFreshEntry()) {
      await syncEntry(Services.api).catch(() => undefined);
      if (!this.live) return;
      this.firstRun = loadEntry().phase !== 'completed';
    }

    // step 2: patch check
    stepHeading.setText('GOOGLE PLAY GAMES ✓  ·  CHECKING FOR PATCHES…');
    patchSub.setText(this.firstRun ? 'Starting background patch download — Prologue & Tutorial will begin shortly…' : 'Verifying latest live content manifest and checking for game updates…');
    pctTxt.setText('PATCH');
    setFill(0.42);
    void Services.patches.start();
    void this.refreshChip();

    if (this.firstRun) {
      // a returning player who quit mid-tutorial keeps their checkpoints; only the dev server starts over
      if (isDevServer()) forceResetEntry();
      // first-time player: the patch keeps running in the background while the prologue begins
      await this.anim.wait(850);
      if (!this.live) return;
      setFill(1);
      pctTxt.setText('LIVE');
      patchSub.setText('Background patch active · Entering Before the Road…');
      await this.anim.wait(420);
      if (!this.live) return;
      await beginEntry(this);
      return;
    }

    // returning player: wait while the patch is checking/downloading
    while (this.live && Services.patches.get().kind === 'running') {
      const st = Services.patches.get();
      const ratio = Math.min(1, Math.max(0.2, barFill(st) ?? 0.2));
      setFill(ratio);
      pctTxt.setText(`${Math.round(ratio * 100)}%`);
      const p = st.kind === 'running' ? st.progress : null;
      if (p && p.bytesTotal > 0) patchSub.setText(`Downloading patch · ${formatBytes(p.bytesDone)} / ${formatBytes(p.bytesTotal)}`);
      await this.anim.wait(180);
    }
    if (!this.live) return;
    setFill(1);
    pctTxt.setText('100%');
    patchSub.setText('Content up to date · Entering the road…');
    await this.anim.wait(480);
    if (!this.live) return;
    this.busy = false;
    await this.begin();
  }

  private async ensureMainTheme(): Promise<void> {
    const { art } = Services.ready();
    if (!art.music('bgm_main_theme')) await art.loadMusic(this, 'bgm_main_theme').catch(() => undefined);
    if (!this.live) return;
    const m = art.music('bgm_main_theme');
    if (m) Music.play(m.key, m.loopStart, m.duration, 1.6);
  }

  private async startAudio(): Promise<void> {
    if (this.audioStarted) return;
    this.audioStarted = true;
    await this.ensureMainTheme();
    Sfx.bell(330, 0.2, 2.2);
  }

  private go(scene: string): void {
    void this.startAudio();
    const fadeMs = isInteractiveBrowser() ? 600 : 260;
    void this.fadeOut(fadeMs);
    this.anim.after(fadeMs, () => this.nav.start(scene));
  }

  private async begin(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    void this.startAudio();
    try {
      const { content } = Services.ready();
      const idx = await content.chapters();
      const campaignChapters = idx.chapters.filter((ch) => ch.chapter_id !== 'tutorial');
      let progress = Progress.load();
      if (Services.api.signedIn) {
        try {
          const authoritative = await Services.api.progress();
          progress = Object.fromEntries(authoritative.nodes.filter((n) => n.clears > 0).map((n) => [n.node_id, { stars: n.stars }]));
        } catch {
          /* local progress when offline */
        }
      }
      if (isInteractiveBrowser() && campaignChapters.length === 0 && Boolean(progress['t3'])) {
        this.quoteTimer?.stop();
        this.stagingBox?.destroy();
        this.stagingBox = null;
        this.openPartOneBeginningModal();
        return;
      }
      // the cloud copy of where this account stopped may be newer than this device's (another device, reinstall)
      await syncContinuityNow();
      if (!this.live) return;
      const next = resolveNextCampaignNode(idx, progress, Services.api.accountKey);
      if (next) {
        if (isInteractiveBrowser()) await this.fadeOut(600);
        await playNode(this, next);
      }
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------ overlays

  private closeOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
    this.ui.setModal(null);
  }

  private openOverlay(heading: string, w: number, h: number): { m: DomGroup; cx: number; cy: number } {
    this.closeOverlay();
    const m = this.ui.group().setDepth(DEPTH.modal);
    this.ui.blocker(0.72, m);
    this.ui.panel(REF_W / 2, REF_H / 2, w, h, 'normal', m);
    this.ui.text(REF_W / 2, REF_H / 2 - h / 2 + 70, heading, titleStyle(46, T.gold), m).setOrigin(0.5);
    this.overlay = m;
    this.ui.setModal(m.el);
    return { m, cx: REF_W / 2, cy: REF_H / 2 };
  }

  /** for players who finished the base AAB (prologue, tutorial, restart) before Part I arrives by patch */
  private openPartOneBeginningModal(): void {
    const { m, cx, cy } = this.openOverlay('PART I  ·  UNAWARE, I FADE', 1380, 720);
    this.ui.text(cx, cy - 190, 'PROLOGUE & TUTORIAL COMPLETED  ·  ACCOUNT SYNCHRONIZED', { fontFamily: F.display, fontSize: 24, fontStyle: '600', color: T.heal, letterSpacing: 4 }, m).setOrigin(0.5);
    this.ui.text(
      cx,
      cy - 55,
      'Fadyme and Mahmut step out from the wayside shelter into the pale dawn of the Whispering Ash.\n\n' +
        'Part I — "Unaware, I Fade" and subsequent chapters are delivered dynamically via LiveOps Content Patches.\n' +
        'Your tutorial completion and Google Play profile are saved. You may visit the Company Sanctum or check for the Part I patch below.',
      { fontFamily: F.body, fontSize: 32, color: T.text, align: 'center', lineSpacing: 12, wordWrap: { width: 1180 } },
      m
    ).setOrigin(0.5);
    this.ui.text(cx, cy + 125, '“Two names still uncalled. And a road that had only just begun.”', { fontFamily: F.body, fontSize: 28, fontStyle: 'italic 500', color: T.gold }, m).setOrigin(0.5);
    this.ui.button(cx - 390, cy + 245, { label: 'COMPANY SANCTUM', w: 360, h: 96, fontSize: 24, variant: 'hot', onClick: () => { this.closeOverlay(); this.go('Home'); } }, m);
    const check: DomButton = this.ui.button(cx, cy + 245, {
      label: 'CHECK PATCH',
      w: 340,
      h: 96,
      fontSize: 24,
      onClick: () =>
        void (async () => {
          check.setLabel('CHECKING…').setEnabled(false);
          const out = await Services.ready().content.checkForUpdates();
          if (out.status === 'applied' || out.status === 'reverted_to_base') await Services.refreshArt();
          void this.refreshChip();
          this.ui.toast(describe(out));
          if (check.active) check.setLabel('CHECK PATCH').setEnabled(true);
        })()
    }, m);
    this.ui.button(cx + 390, cy + 245, { label: 'RETURN TO TITLE', w: 360, h: 96, fontSize: 24, escape: true, onClick: () => { this.closeOverlay(); this.setBannerVisible(true); } }, m);
  }

  private async refreshChip(): Promise<void> {
    const { content } = Services.ready();
    const chip = this.chipText;
    const active = await content.activeReleaseId();
    if (!this.live || !chip?.active || this.chipText !== chip) return;
    chip.setText(`CONTENT ${active}${active !== content.base.releaseId ? ' (patch)' : ''}  ·  ${CHANNEL}  ·  v${CLIENT_VERSION}${PATCH_LAB_ENABLED ? '  ·  tap for details' : ''}`);
  }

  private onContentChanged(out: PatchOutcome): void {
    void this.refreshChip();
    this.ui.toast(out.status === 'applied' ? `New content downloaded: ${out.releaseId}` : 'Content returned to the installed base');
  }

  private async openSettings(): Promise<void> {
    const request = ++this.settingsRequest;
    const profile = await Services.ready().content.presentation().catch(() => null);
    if (!this.live || request !== this.settingsRequest) return;
    const locales = ['en', ...(profile?.locales ?? []).filter((l) => l !== 'en')];
    const shiftLocale = (delta: number): void => {
      setPref('locale', locales[(Math.max(0, locales.indexOf(prefs().locale)) + delta + locales.length) % locales.length]!);
      void Services.ready().content.locale().then((loc) => setActiveLocaleStrings(loc?.strings)).catch(() => undefined);
    };
    const { m, cx, cy } = this.openOverlay('SETTINGS', 1720, 1000);
    const step = (key: 'musicVolume' | 'sfxVolume' | 'voiceVolume', d: number): void => setPref(key, Math.min(1, Math.max(0, +(prefs()[key] + d).toFixed(1))));
    const rows: { label: string; get: () => string; dec: () => void; inc: () => void }[] = [
      { label: 'Music', get: () => `${Math.round(prefs().musicVolume * 100)}%`, dec: () => { step('musicVolume', -0.1); Music.setVolume(prefs().musicVolume); }, inc: () => { step('musicVolume', 0.1); Music.setVolume(prefs().musicVolume); } },
      { label: 'Effects', get: () => `${Math.round(prefs().sfxVolume * 100)}%`, dec: () => { step('sfxVolume', -0.1); Sfx.setVolume(prefs().sfxVolume); Sfx.tap(); }, inc: () => { step('sfxVolume', 0.1); Sfx.setVolume(prefs().sfxVolume); Sfx.tap(); } },
      { label: 'Voice', get: () => `${Math.round(prefs().voiceVolume * 100)}%`, dec: () => step('voiceVolume', -0.1), inc: () => step('voiceVolume', 0.1) },
      { label: 'Language', get: () => prefs().locale.toUpperCase(), dec: () => shiftLocale(-1), inc: () => shiftLocale(1) },
      {
        label: 'Text speed',
        get: () => prefs().textSpeed.toUpperCase(),
        dec: () => setPref('textSpeed', ({ slow: 'fast', normal: 'slow', fast: 'normal' } as const)[prefs().textSpeed]),
        inc: () => setPref('textSpeed', ({ slow: 'normal', normal: 'fast', fast: 'slow' } as const)[prefs().textSpeed])
      },
      { label: 'Reduced motion', get: () => (prefs().reducedMotion ? 'ON' : 'OFF'), dec: () => setPref('reducedMotion', !prefs().reducedMotion), inc: () => setPref('reducedMotion', !prefs().reducedMotion) }
    ];
    rows.forEach((r, i) => {
      const y = cy - 300 + i * 110;
      this.ui.text(cx - 470, y, r.label, { fontSize: 40 }, m).setOrigin(0, 0.5);
      const value = this.ui.text(cx + 190, y, r.get(), { fontFamily: F.display, fontSize: 36, fontStyle: '600', color: T.gold }, m).setOrigin(0.5);
      value.el.setAttribute('aria-live', 'polite');
      this.ui.button(cx + 30, y, { label: '−', ariaLabel: `Lower ${r.label}`, w: 130, h: 100, fontSize: 48, onClick: () => { r.dec(); value.setText(r.get()); } }, m);
      this.ui.button(cx + 350, y, { label: '+', ariaLabel: `Raise ${r.label}`, w: 130, h: 100, fontSize: 48, onClick: () => { r.inc(); value.setText(r.get()); } }, m);
    });

    const tiers: Prefs['qualityTier'][] = ['auto', 'low', 'medium', 'high'];
    const layouts: Prefs['battleLayout'][] = ['afk_faithful', 'current', 'arena_lite'];
    const layoutTag = (l: Prefs['battleLayout']): string => (l === 'afk_faithful' ? 'AFK' : l === 'arena_lite' ? 'ARENA' : 'CURRENT');
    const adsLabel = (st: string | undefined): string => (st === 'withdrawn' || st === 'denied' ? 'ADS: WITHDRAWN' : st === 'OBTAINED' ? 'ADS: CONSENTED' : 'PRIVACY OPTIONS');
    const toggles: { label: () => string; sub: string; active: () => boolean; onClick: (btn: DomButton) => void }[] = [
      { label: () => `TEXT: ${prefs().textSize.toUpperCase()}`, sub: 'Text Size', active: () => prefs().textSize === 'large', onClick: (btn) => { setPref('textSize', prefs().textSize === 'normal' ? 'large' : 'normal'); btn.setLabel(`TEXT: ${prefs().textSize.toUpperCase()}`).setVariant(prefs().textSize === 'large' ? 'active' : 'normal'); } },
      { label: () => `CONTRAST: ${prefs().highContrast ? 'HIGH' : 'STD'}`, sub: 'Contrast Mode', active: () => prefs().highContrast, onClick: (btn) => { setPref('highContrast', !prefs().highContrast); btn.setLabel(`CONTRAST: ${prefs().highContrast ? 'HIGH' : 'STD'}`).setVariant(prefs().highContrast ? 'active' : 'normal'); } },
      { label: () => `FLASH: ${prefs().reduceFlash ? 'REDUCED' : 'NORMAL'}`, sub: 'Reduce Flash', active: () => prefs().reduceFlash, onClick: (btn) => { setPref('reduceFlash', !prefs().reduceFlash); btn.setLabel(`FLASH: ${prefs().reduceFlash ? 'REDUCED' : 'NORMAL'}`).setVariant(prefs().reduceFlash ? 'active' : 'normal'); } },
      { label: () => `QUALITY: ${prefs().qualityTier.toUpperCase()}`, sub: 'Graphics Tier', active: () => prefs().qualityTier === 'high', onClick: (btn) => { const next = tiers[(tiers.indexOf(prefs().qualityTier) + 1) % tiers.length]!; setPref('qualityTier', next); btn.setLabel(`QUALITY: ${next.toUpperCase()}`).setVariant(next === 'high' ? 'active' : 'normal'); } },
      { label: () => `LAYOUT: ${layoutTag(prefs().battleLayout)}`, sub: 'Battle Layout', active: () => prefs().battleLayout === 'afk_faithful', onClick: (btn) => { const next = layouts[(layouts.indexOf(prefs().battleLayout) + 1) % layouts.length]!; setPref('battleLayout', next); btn.setLabel(`LAYOUT: ${layoutTag(next)}`).setVariant(next === 'afk_faithful' ? 'active' : 'normal'); } },
      {
        label: () => adsLabel(consentState()?.status),
        sub: 'Ad Consent',
        active: () => false,
        onClick: (btn) =>
          void showPrivacyOptions()
            .then((next) => {
              btn.setLabel(adsLabel(next?.status));
              this.ui.toast(`Privacy choice updated (${next?.status ?? 'saved'})`);
            })
            .catch((e: unknown) => this.ui.toast(String(e instanceof Error ? e.message : e)))
      }
    ];
    toggles.forEach((t, i) => {
      const btn: DomButton = this.ui.button(1600, cy - 300 + i * 110, { label: t.label(), sub: t.sub, w: 340, h: 96, fontSize: 22, variant: t.active() ? 'active' : 'normal', onClick: () => t.onClick(btn) }, m);
    });

    if (this.firstRun) {
      this.ui.button(cx, cy + 400, { label: 'CLOSE', w: 560, escape: true, onClick: () => this.closeOverlay() }, m);
    } else {
      this.ui.button(cx - 250, cy + 400, { label: 'RESET PROGRESS', w: 430, variant: 'danger', fontSize: 26, onClick: () => { Progress.reset(); this.ui.toast('Progress cleared'); } }, m);
      this.ui.button(cx + 250, cy + 400, { label: 'CLOSE', w: 430, escape: true, onClick: () => this.closeOverlay() }, m);
    }
  }

  /** Opens the content-update panel (also used by automated tests). */
  openPatchLab(): void {
    if (!PATCH_LAB_ENABLED) return;
    const { content } = Services.ready();
    const { m, cx, cy } = this.openOverlay('CONTENT UPDATES', 1300, 820);
    const body = this.ui.text(cx - 580, cy - 190, 'Reading state…', { fontSize: 34, color: T.text, lineSpacing: 10, wordWrap: { width: 1160 } }, m);
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
    this.ui.button(cx - 410, cy + 250, {
      label: 'CHECK NOW',
      w: 380,
      onClick: () =>
        void (async () => {
          body.setText('Checking for content updates…');
          const out = await content.checkForUpdates();
          if (out.status === 'applied' || out.status === 'reverted_to_base') await Services.refreshArt();
          await render();
          void this.refreshChip();
          this.ui.toast(describe(out));
        })()
    }, m);
    this.ui.button(cx, cy + 250, {
      label: 'ROLL BACK',
      w: 380,
      variant: 'danger',
      onClick: () =>
        void (async () => {
          const changed = await content.rollback();
          if (changed) await Services.refreshArt();
          await render();
          void this.refreshChip();
          this.ui.toast(changed ? 'Rolled back' : 'Already on the embedded base');
        })()
    }, m);
    this.ui.button(cx + 410, cy + 250, { label: 'CLOSE', w: 380, escape: true, onClick: () => this.closeOverlay() }, m);
  }
}

