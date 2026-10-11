import Phaser from 'phaser';
import type { PatchOutcome } from '@uomd/patch';
import { CHANNEL, CLIENT_VERSION, PATCH_LAB_ENABLED, REF_H, REF_W } from '../config';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { prefs, setPref } from '../platform/prefs';
import { Progress, Services } from '../services';
import { Button, panel, sceneFadeIn, title, toast, txt } from '../ui/kit';
import { C, DEPTH, F, SIZE, T } from '../ui/theme';
import { playNode } from '../flow';

const TITLE_CUE = 'bgm_ch1_ash_forest_calm';

function describe(o: PatchOutcome | null): string {
  if (!o) return 'No check yet';
  switch (o.status) {
    case 'up_to_date':
      return o.releaseId ? `Up to date (${o.releaseId})` : 'Up to date (embedded base)';
    case 'applied':
      return `Applied ${o.releaseId} · ${o.downloadedFiles} files · ${(o.downloadedBytes / 1024).toFixed(0)} KB`;
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
  private audioStarted = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.overlay = null;
    this.audioStarted = false;
    const { art } = Services.ready();
    this.cameras.main.setBackgroundColor(0x0a0610);

    const bg = this.add.image(REF_W / 2, REF_H / 2, art.background('forest_whispering_ash'));
    bg.setScale(Math.max(REF_W / bg.width, REF_H / bg.height) * 1.05);
    if (!prefs().reducedMotion) this.tweens.add({ targets: bg, x: REF_W / 2 - 30, scale: bg.scale * 1.03, duration: 24000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const keyArt = art.ui('key_art');
    if (keyArt) {
      const k = this.add.image(REF_W - 330, REF_H / 2, keyArt);
      k.setScale(REF_H / k.height).setX(REF_W - (k.width * k.scale) / 2);
    }
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x0a0610, 0x0a0610, 0x0a0610, 0x0a0610, 0.92, 0, 0.92, 0);
    shade.fillRect(0, 0, REF_W * 0.7, REF_H);
    try {
      this.cameras.main.filters.external.addVignette(0.5, 0.5, 0.85, 0.35);
    } catch {
      /* cosmetic */
    }

    const logoKey = art.ui('logo');
    if (logoKey) {
      const logo = this.add.image(500, 270, logoKey).setAlpha(0);
      logo.setScale(860 / logo.width);
      this.tweens.add({ targets: logo, alpha: 1, y: 258, duration: 1400, ease: 'Cubic.easeOut' });
      if (!prefs().reducedMotion) this.tweens.add({ targets: logo, y: 266, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1400 });
    }
    txt(this, 500, 478, 'PART I  ·  UNAWARE, I FADE', { fontFamily: F.display, fontSize: '30px', fontStyle: '600', color: '#c9b6e4' }).setOrigin(0.5).setLetterSpacing(4);

    new Button(this, 500, 640, { label: 'BEGIN', sub: 'The First Step', w: 560, h: 128, fontSize: 44, variant: 'hot', onClick: () => void this.begin() });
    new Button(this, 500, 786, { label: 'CHAPTERS', w: 560, h: 120, onClick: () => this.go('Chapters') });
    new Button(this, 500, 920, { label: 'SETTINGS', w: 560, h: 120, onClick: () => this.openSettings() });
    new Button(this, REF_W - 200, 80, { label: 'COMPANY', w: 340, h: 110, fontSize: 30, onClick: () => this.go('Home') });

    this.chipText = txt(this, 60, REF_H - 36, '', { fontSize: '24px', color: T.dim }).setOrigin(0, 0.5).setDepth(DEPTH.hud);
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
    sceneFadeIn(this, 700);
  }

  private async startAudio(): Promise<void> {
    if (this.audioStarted) return;
    this.audioStarted = true;
    const { art } = Services.ready();
    try {
      await art.loadMusic(this, TITLE_CUE);
      const m = art.music(TITLE_CUE);
      if (m) Music.play(this.cache.audio, m.key, m.loopStart, m.duration, 2.2);
    } catch {
      /* music is optional */
    }
    Sfx.bell(330, 0.2, 2.2);
  }

  private go(scene: string): void {
    void this.startAudio();
    this.cameras.main.fadeOut(260, 10, 6, 16);
    this.time.delayedCall(260, () => this.scene.start(scene));
  }

  private async begin(): Promise<void> {
    void this.startAudio();
    const { content } = Services.ready();
    const idx = await content.chapters();
    const first = idx.chapters[0]?.nodes[0];
    if (first) await playNode(this, first);
  }

  private async refreshChip(): Promise<void> {
    const { content } = Services.ready();
    const active = await content.activeReleaseId();
    this.chipText.setText(`CONTENT ${active}${active !== content.base.releaseId ? ' (patch)' : ''}  ·  ${CHANNEL}  ·  v${CLIENT_VERSION}${PATCH_LAB_ENABLED ? '  ·  tap for details' : ''}`);
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

  private openSettings(): void {
    const { items, cx, cy } = this.openOverlay('SETTINGS', 1100, 780);
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
      const y = cy - 190 + i * 130;
      items.push(txt(this, cx - 470, y, r.label, { fontSize: '40px' }).setOrigin(0, 0.5));
      const value = txt(this, cx + 190, y, r.get(), { fontFamily: F.display, fontSize: '36px', fontStyle: '600', color: T.gold }).setOrigin(0.5);
      items.push(value);
      items.push(new Button(this, cx + 30, y, { label: '−', w: 130, h: 100, fontSize: 48, onClick: () => { r.dec(); value.setText(r.get()); } }));
      items.push(new Button(this, cx + 350, y, { label: '+', w: 130, h: 100, fontSize: 48, onClick: () => { r.inc(); value.setText(r.get()); } }));
      items.push(value);
    });
    items.push(new Button(this, cx - 250, cy + 300, { label: 'RESET PROGRESS', w: 430, variant: 'danger', fontSize: 26, onClick: () => { Progress.reset(); toast(this, 'Progress cleared'); } }));
    items.push(new Button(this, cx + 250, cy + 300, { label: 'CLOSE', w: 430, onClick: () => this.closeOverlay() }));
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
