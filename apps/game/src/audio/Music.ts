import type Phaser from '../engine';
import { prefs } from '../platform/prefs';

/**
 * Seamless music with an intro and a loop region (Lyria loops ship with loop_start metadata).
 * Uses the Web Audio buffer Phaser decoded, so loopStart/loopEnd are sample accurate and tracks can
 * be cross-faded. Without Web Audio (HTML5 fallback) music is simply skipped.
 */
export class MusicPlayer {
  /** Cohesive Lyria 3.5 soundtrack suite for Phase 1 (Main Theme, Prologue, Calm/Intimate Story, Pre-Battle Tension, Battle). */
  public enabled = true;
  public allowedPrefixes: readonly string[] = [
    'audio/bgm_main_theme.ogg',
    'audio/bgm_prologue_before_the_road.ogg',
    'audio/bgm_fadyme_theme.ogg',
    'audio/bgm_ch1_ash_forest_calm.ogg',
    'audio/bgm_ch1_ash_forest_uneasy.ogg',
    'audio/bgm_ch1_ash_forest_chaotic.ogg',
    'audio/bgm_battle_field.ogg'
  ];
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private current: { key: string; src: AudioBufferSourceNode; gain: GainNode; release: () => void } | null = null;
  private userPaused = false;

  private acquire: ((key: string, owner: object) => () => void) | null = null;
  private readonly ducks = new Set<object>();
  assetOwner(acquire: (key: string, owner: object) => () => void): void { this.acquire = acquire; }
  duck(): () => void {
    const owner = {};
    this.ducks.add(owner);
    this.setVolume(prefs().musicVolume);
    return () => {
      this.ducks.delete(owner);
      this.setVolume(prefs().musicVolume);
    };
  }

  init(sound: Phaser.Sound.BaseSoundManager): void {
    const wa = sound as Phaser.Sound.WebAudioSoundManager;
    if (!wa.context) return;
    this.ctx = wa.context;
    this.out = this.ctx.createGain();
    this.out.gain.value = prefs().musicVolume;
    this.out.connect(wa.masterVolumeNode ?? this.ctx.destination);
    if (typeof window !== 'undefined') {
      const unlock = (): void => {
        if (this.ctx && this.ctx.state === 'suspended' && !this.userPaused) {
          void this.ctx.resume().catch(() => undefined);
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  get currentKey(): string | null {
    return this.current?.key ?? null;
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended' && !this.userPaused) {
      void this.ctx.resume().catch(() => undefined);
    }
  }

  setVolume(v: number): void {
    if (!this.out) return;
    const target = v * (this.ducks.size ? 0.34 : 1);
    if (this.ctx && this.ctx.state === 'running' && typeof this.out.gain.setTargetAtTime === 'function') {
      this.out.gain.cancelScheduledValues(this.ctx.currentTime);
      this.out.gain.setTargetAtTime(target, this.ctx.currentTime, this.ducks.size ? 0.08 : 0.28);
    } else {
      this.out.gain.value = target;
    }
  }

  play(cache: Phaser.Cache.BaseCache, cacheKey: string, loopStart: number, duration: number, fade = 1.4, startOffset = 0): void {
    if (!this.enabled || !this.allowedPrefixes.some((p) => cacheKey.startsWith(p))) {
      this.stop(0.1);
      return;
    }
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out) return;
    if (ctx.state === 'suspended' && !this.userPaused) {
      void ctx.resume().catch(() => undefined);
    }
    if (this.current?.key === cacheKey && startOffset === 0) return;
    const buffer = cache.get(cacheKey) as AudioBuffer | undefined;
    if (!buffer || typeof buffer.getChannelData !== 'function') return;
    this.stop(fade);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = loopStart;
    src.loopEnd = Math.min(duration, buffer.duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + fade);
    src.connect(gain).connect(out);
    const clampedOffset = Math.max(0, Math.min(startOffset, Math.max(0, buffer.duration - 0.1)));
    src.start(0, clampedOffset);
    const release = this.acquire?.(cacheKey, {}) ?? (() => undefined);
    src.onended = () => { release(); gain.disconnect(); src.disconnect(); };
    this.current = { key: cacheKey, src, gain, release };
  }

  setPaused(paused: boolean): void {
    this.userPaused = paused;
    const ctx = this.ctx;
    if (!ctx) return;
    if (paused && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
    else if (!paused && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  }

  stop(fade = 0.8): void {
    const cur = this.current;
    const ctx = this.ctx;
    this.current = null;
    if (!cur || !ctx) return;
    cur.gain.gain.cancelScheduledValues(ctx.currentTime);
    cur.gain.gain.setValueAtTime(Math.max(0.0001, cur.gain.gain.value), ctx.currentTime);
    cur.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
    cur.src.stop(ctx.currentTime + fade + 0.05);
  }
}

export const Music = new MusicPlayer();
