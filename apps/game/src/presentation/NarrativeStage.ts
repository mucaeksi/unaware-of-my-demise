import * as PIXI from 'pixi.js';
import type { ArtManifest, LocalePack, PresentationCommand, PresentationPack } from '@uomd/content-schema';
import type { ContentService } from '../content/ContentService';
import { Music } from '../audio/Music';
import { prefs } from '../platform/prefs';
import { REF_H, REF_W } from '../config';
import { Assets } from '../core/assets';
import type { PixiScene } from '../core/PixiScene';
import { DEPTH } from '../ui/theme';

const own = <T>(rows: Record<string, T>, id: string): T | undefined => Object.hasOwn(rows, id) ? rows[id] : undefined;
interface Layer { image: PIXI.Sprite; owner: object; mask?: PIXI.Graphics }
const EASE = { linear: 'linear', sine: 'sine.inout', quad: 'quad.inout' } as const;
interface AudioClip { element: HTMLAudioElement; owner: object; releaseDuck: () => void; wasPlaying: boolean }

/**
 * The only renderer for the finite presentation commands, drawn with PIXI (D-25). All URLs come from the verified
 * local content service; images still load through the host engine scene until the engine is removed.
 */
export class NarrativeStage {
  private readonly root = new PIXI.Container({ sortableChildren: true });
  private readonly layers = new Map<string, Layer>();
  private readonly audio = new Map<string, AudioClip>();
  private readonly controller = new AbortController();
  private closeVideo: (() => void) | null = null;
  private videoPause: ((pause: boolean) => void) | null = null;
  private alive = true;
  private voiceMuted = false;
  private audioSequence = 0;
  private readonly audioTickets = new Map<string, number>();
  constructor(private readonly scene: PixiScene, private readonly content: ContentService, private readonly art: ArtManifest, readonly pack: PresentationPack, private readonly locale?: LocalePack) {
    scene.add(this.root, DEPTH.world + 30);
    const pause = () => this.pause(true); const resume = () => this.pause(false);
    const visibility = () => this.pause(document.hidden || !scene.live);
    scene.events.on('pause', pause); scene.events.on('resume', resume); document.addEventListener('visibilitychange', visibility);
    scene.onClose(() => { scene.events.off('pause', pause); scene.events.off('resume', resume); document.removeEventListener('visibilitychange', visibility); this.destroy(); });
  }
  text(id: string | undefined, fallback: string): string { return id && this.locale && Object.hasOwn(this.locale.strings, id) ? this.locale.strings[id]! : fallback; }
  hasVoice(lineId: string): boolean { return !!own(this.pack.voices, lineId); }
  voiceDuration(lineId: string): number { return own(this.pack.voices, lineId)?.duration_s ?? 0; }
  isVoicePlaying(): boolean {
    const clip = this.audio.get('voice');
    return Boolean(clip && !clip.element.paused && !clip.element.ended);
  }
  voiceProgress(lineId: string): { playing: boolean; currentTime: number; duration: number; ratio: number } {
    const def = own(this.pack.voices, lineId);
    const dur = def?.duration_s ?? 0;
    const clip = this.audio.get('voice');
    if (!clip || clip.element.paused || clip.element.ended || dur <= 0) {
      return { playing: false, currentTime: clip?.element.currentTime ?? 0, duration: dur, ratio: 0 };
    }
    const ct = Math.max(0, clip.element.currentTime);
    return {
      playing: true,
      currentTime: ct,
      duration: dur,
      ratio: Math.min(1, ct / Math.max(0.1, dur))
    };
  }
  stopVoice(): void { this.stopAudio('voice'); }
  setPaused(paused: boolean): void { this.pause(paused); }
  setVoiceMuted(muted: boolean): void {
    this.voiceMuted = muted;
    const clip = this.audio.get('voice');
    if (clip) clip.element.muted = muted;
  }

  async voice(lineId: string): Promise<void> {
    this.stopAudio('voice'); const definition = own(this.pack.voices, lineId);
    if (!definition || prefs().voiceVolume <= 0) return;
    await this.playAudio('voice', definition.file, prefs().voiceVolume, false, true, definition.duration_s);
  }
  private async playAudio(key: string, path: string, volume: number, loop: boolean, duck: boolean, duration: number): Promise<void> {
    this.stopAudio(key); const ticket = ++this.audioSequence; this.audioTickets.set(key, ticket); if (this.audio.size >= 8) throw new Error('This scene has too many simultaneous audio cues');
    const owner = {}; const ref = await this.content.asset(path, owner);
    if (!this.alive || this.audioTickets.get(key) !== ticket) { this.content.releaseAssets(owner); return; }
    const element = new Audio(ref.url); element.preload = 'auto'; element.volume = volume; element.loop = loop;
    if (key === 'voice' && this.voiceMuted) element.muted = true;
    const clip: AudioClip = { element, owner, releaseDuck: duck ? Music.duck() : () => undefined, wasPlaying: false }; this.audio.set(key, clip);
    await new Promise<void>((resolve) => {
      const done = () => { window.clearTimeout(timer); resolve(); };
      const timer = window.setTimeout(done, 80);
      element.addEventListener('loadeddata', done, { once: true });
      element.addEventListener('error', done, { once: true });
    });
    if (!this.alive || this.audio.get(key) !== clip) return;
    element.onloadedmetadata = () => { if (!Number.isFinite(element.duration) || element.duration > duration + 0.5) this.stopAudio(key); };
    element.ontimeupdate = () => { if (!loop && element.currentTime >= duration) this.stopAudio(key); };
    element.onended = element.onerror = () => { if (this.audio.get(key) === clip) this.stopAudio(key); };
    await element.play().catch(() => {
      if (this.audio.get(key) !== clip) return;
      const unlock = (): void => {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        if (this.alive && this.audio.get(key) === clip) {
          void element.play().catch(() => {
            if (this.audio.get(key) === clip) this.stopAudio(key);
          });
        }
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    });
  }
  private stopAudio(key: string): void {
    this.audioTickets.delete(key); const clip = this.audio.get(key); if (!clip) return; this.audio.delete(key);
    clip.element.pause(); clip.element.onended = clip.element.onerror = clip.element.onloadedmetadata = clip.element.ontimeupdate = null; clip.element.removeAttribute('src'); clip.element.load(); clip.releaseDuck(); this.content.releaseAssets(clip.owner);
  }
  private pause(paused: boolean): void {
    for (const clip of this.audio.values()) { if (paused) { clip.wasPlaying = !clip.element.paused; clip.element.pause(); } else if (clip.wasPlaying) { clip.wasPlaying = false; void clip.element.play().catch(() => undefined); } }
    this.videoPause?.(paused);
  }

  async execute(command: PresentationCommand): Promise<void> {
    if (!this.alive) return;
    switch (command.op) {
      case 'voice': return this.voice(command.line_id);
      case 'sound': {
        const cue = own(this.pack.sounds, command.cue_id); if (!cue) throw new Error('This sound cue is unavailable');
        if (command.action === 'stop') this.stopAudio(command.cue_id); else await this.playAudio(command.cue_id, cue.file, prefs().sfxVolume * cue.volume, cue.loop, false, cue.duration_s);
        return;
      }
      case 'video': return this.video(command.video_id, command.skippable);
      case 'layer': {
        if (!this.layers.has(command.layer_id) && this.layers.size >= 16) throw new Error('This scene exceeds its layer budget');
        const path = own(command.kind === 'still' ? this.art.stills : this.art.ui, command.art_id); if (!path) throw new Error('This illustration is unavailable');
        const owner = {}; const ref = await this.content.asset(path, owner);
        if (!this.alive) { this.content.releaseAssets(owner); return; }
        try {
          await Assets.loadImage(ref.key, ref.url).catch(() => { throw new Error('This illustration could not be loaded'); });
          if (!this.alive) { this.content.releaseAssets(owner); return; }
          this.content.retainAsset(ref.key, owner, () => Assets.removeImage(ref.key));
          this.removeLayer(command.layer_id);
          const image = new PIXI.Sprite(this.scene.tex(ref.key));
          image.anchor.set(0.5); image.position.set(command.x, command.y); image.width = command.width; image.height = command.height; image.alpha = command.alpha; image.zIndex = command.depth;
          this.root.addChild(image); this.layers.set(command.layer_id, { image, owner });
        } catch (error) { this.content.releaseAssets(owner); throw error; }
        return;
      }
      case 'remove_layer': this.removeLayer(command.layer_id); return;
      case 'animate': {
        const layer = this.layers.get(command.layer_id); if (!layer) throw new Error('This stage layer is unavailable');
        const duration = prefs().reducedMotion ? 0 : command.seconds * 1000;
        const to: Record<string, number> = {};
        for (const [k, v] of Object.entries(command.to)) if (v !== undefined) to[k] = v;
        const done = new Promise<void>((resolve) => {
          const finish = () => { this.controller.signal.removeEventListener('abort', finish); resolve(); };
          this.controller.signal.addEventListener('abort', finish, { once: true });
          void this.scene.anim.toAsync(layer.image, to, { duration, ease: EASE[command.ease], skip: !duration }).then(finish);
        });
        if (command.wait) await done; return;
      }
      case 'camera': {
        this.scene.anim.killOf(this.root);
        void this.scene.anim.toAsync(this.root, { x: REF_W / 2 - command.x * command.zoom, y: REF_H / 2 - command.y * command.zoom, scale: command.zoom }, { duration: command.seconds * 1000, ease: 'sine.inout', skip: prefs().reducedMotion }); return;
      }
      case 'mask': {
        const layer = this.layers.get(command.layer_id); if (!layer) throw new Error('This stage layer is unavailable');
        layer.image.mask = null; layer.mask?.destroy(); delete layer.mask;
        if (command.shape === 'none') return;
        if ([...this.layers.values()].filter((l) => l.mask).length >= 2) throw new Error('This scene exceeds its mask framebuffer budget');
        const mask = new PIXI.Graphics();
        if (command.shape === 'rectangle') mask.rect(command.x, command.y, command.width, command.height); else mask.ellipse(command.x, command.y, command.width / 2, command.height / 2);
        mask.fill(0xffffff); this.root.addChild(mask); layer.image.mask = mask; layer.mask = mask; return;
      }

      case 'panel': return new Promise<void>((resolve) => {
        const finish = () => { this.controller.signal.removeEventListener('abort', finish); if (this.alive) this.scene.nav.resume(); resolve(); };
        this.controller.signal.addEventListener('abort', finish, { once: true });
        this.scene.nav.launch('ContentPanel', { panelId: command.panel_id, owner: this, onClose: finish }); this.scene.nav.pause();
      });
    }
  }
  private removeLayer(id: string): void { const layer = this.layers.get(id); if (!layer) return; this.scene.anim.killOf(layer.image); layer.image.mask = null; layer.mask?.destroy(); layer.image.destroy(); this.content.releaseAssets(layer.owner); this.layers.delete(id); }

  async video(id: string, skippable: boolean): Promise<void> {
    const definition = own(this.pack.videos, id); if (!definition) throw new Error('This video is unavailable');
    this.closeVideo?.(); this.stopAudio('voice'); const owner = {}; const previousFocus = document.activeElement;
    let url: string | undefined; let poster: string | undefined; let unavailable = false;
    try { url = (await this.content.asset(definition.file, owner)).url; if (definition.poster_id) { const path = own(this.art.stills, definition.poster_id); if (path) poster = (await this.content.asset(path, owner)).url; } } catch { unavailable = true; }
    if (!this.alive) { this.content.releaseAssets(owner); return; }
    await new Promise<void>((resolve) => {
      const root = document.createElement('div'); root.className = 'uomd-video-dialog'; root.role = 'dialog'; root.ariaModal = 'true'; root.ariaLabel = 'Story video';
      Object.assign(root.style, { position: 'fixed', inset: '0', zIndex: '1000', background: '#0a0610', display: 'flex', alignItems: 'center', justifyContent: 'center' });
      const video = document.createElement('video'); if (poster) video.poster = poster; video.playsInline = true; video.muted = definition.audio === 'none'; video.volume = prefs().voiceVolume; video.preload = 'metadata'; video.setAttribute('aria-label', 'Story video'); Object.assign(video.style, { width: '100%', height: '100%', objectFit: 'contain' });
      const caption = document.createElement('div'); caption.className = 'uomd-video-caption'; Object.assign(caption.style, { position: 'absolute', left: '10%', right: '10%', bottom: '18%', color: '#fff', background: 'rgba(10,6,16,.88)', padding: '12px', font: '24px serif', textAlign: 'center', whiteSpace: 'pre-wrap', maxHeight: '60vh', overflowY: 'auto' });
      const controls = document.createElement('div'); Object.assign(controls.style, { position: 'absolute', bottom: 'max(16px, env(safe-area-inset-bottom))', display: 'flex', gap: '12px' });
      const button = (label: string, action: () => void) => { const b = document.createElement('button'); b.textContent = label; Object.assign(b.style, { minWidth: '120px', minHeight: '48px', color: '#f1e6cf', background: '#190f25', border: '1px solid #bda26b', font: '20px serif' }); b.onclick = action; controls.append(b); return b; };
      const unduck = Music.duck(); let closed = false; let wasPlaying = false; let lastProgress = performance.now(); let lastTime = 0;
      const watchdog = window.setInterval(() => { if (closed || unavailable || document.hidden || video.paused || !this.scene.live) { lastProgress = performance.now(); return; } if (video.currentTime !== lastTime) { lastTime = video.currentTime; lastProgress = performance.now(); } else if (performance.now() - lastProgress > 15000) fallback(); }, 1000);
      let mounted = false;
      const mount = () => { if (closed || mounted) return; mounted = true; document.body.append(root); play.focus(); };
      const close = () => { if (closed) return; closed = true; video.onerror = video.onended = video.onloadedmetadata = video.ontimeupdate = null; window.clearInterval(watchdog); video.pause(); if (!unavailable) { video.removeAttribute('src'); video.load(); } root.remove(); unduck(); this.content.releaseAssets(owner); this.closeVideo = null; this.videoPause = null; if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); resolve(); };
      const play = button('PLAY', () => { if (closed) return; if (unavailable) { close(); return; } if (video.paused) void video.play().then(() => { if (!closed && !unavailable) play.textContent = 'PAUSE'; }).catch(() => { if (!closed && !unavailable) play.textContent = 'PLAY'; }); else { video.pause(); play.textContent = 'PLAY'; } });
      if (skippable) button('SKIP', close);
      const fallback = () => { if (closed) return; unavailable = true; caption.tabIndex = 0; caption.setAttribute('aria-label', 'Subtitle transcript'); video.pause(); caption.textContent = definition.captions.map((c) => this.text(c.line_id, c.text_en)).join('\n'); play.textContent = 'CONTINUE'; mount(); };
      video.onerror = fallback; video.onended = close;
      video.onloadedmetadata = () => { if (!Number.isFinite(video.duration) || Math.abs(video.duration - definition.duration_s) > 0.5) fallback(); else mount(); };
      video.ontimeupdate = () => { if (closed || unavailable) return; const cue = definition.captions.find((c) => c.start_s <= video.currentTime && c.end_s > video.currentTime); caption.textContent = cue ? this.text(cue.line_id, cue.text_en) : ''; if (video.currentTime >= definition.duration_s) close(); };
      root.onkeydown = (event) => { if (event.key === 'Escape' && skippable) close(); if (event.key === 'Tab') { const buttons: HTMLElement[] = [...controls.querySelectorAll('button'), ...(unavailable ? [caption] : [])]; const at = buttons.indexOf(document.activeElement as HTMLElement); event.preventDefault(); buttons[(at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus(); } };
      root.append(video, caption, controls); this.closeVideo = close;
      this.videoPause = (pause) => { if (pause) { wasPlaying = !video.paused; video.pause(); } else if (wasPlaying && !unavailable) { wasPlaying = false; void video.play().catch(() => { if (!closed && !unavailable) play.textContent = 'PLAY'; }); } };
      if (unavailable || !url) { fallback(); } else { window.setTimeout(mount, 120); video.src = url; void video.play().then(() => { if (!closed && !unavailable) { play.textContent = 'PAUSE'; mount(); } }).catch(() => { if (!closed && !unavailable) play.textContent = 'PLAY'; }); }
    });
  }
  destroy(): void {
    if (!this.alive) return; this.alive = false;
    const panel = this.scene.nav.get('ContentPanel') as (PixiScene<unknown> & { owner?: object }) | undefined;
    if (panel?.owner === this) this.scene.nav.stop('ContentPanel');
    this.controller.abort(); this.closeVideo?.();
    for (const key of [...this.audio.keys()]) this.stopAudio(key);
    for (const id of [...this.layers.keys()]) this.removeLayer(id);
    this.scene.anim.killOf(this.root); if (!this.root.destroyed) this.root.destroy({ children: true });
  }
}
