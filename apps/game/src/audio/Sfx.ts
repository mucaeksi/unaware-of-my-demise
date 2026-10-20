import { prefs } from '../platform/prefs';

/**
 * Procedural interim sound effects (Web Audio synthesis). They keep the UI and combat readable until
 * the real SFX set exists (README: SFX need a verified Google-based workflow - Lyria is music only).
 */
let ctx: AudioContext | null = null;
let out: GainNode | null = null;

function ready(): AudioContext | null {
  if (!ctx || !out) return null;
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function env(c: AudioContext, g: GainNode, t0: number, attack: number, peak: number, release: number): void {
  g.gain.cancelScheduledValues(t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
  void c;
}

function tone(freq: number, type: OscillatorType, t0: number, attack: number, peak: number, release: number, sweepTo?: number): void {
  const c = ready();
  if (!c || !out) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t0 + attack + release);
  env(c, g, t0, attack, peak, release);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + attack + release + 0.05);
}

function noise(t0: number, dur: number, peak: number, lowpass: number): void {
  const c = ready();
  if (!c || !out) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = c.createGain();
  env(c, g, t0, 0.005, peak, dur);
  src.connect(f).connect(g).connect(out);
  src.start(t0);
}

export const Sfx = {
  init(context: AudioContext, master: AudioNode): void {
    ctx = context;
    out = context.createGain();
    out.gain.value = prefs().sfxVolume;
    out.connect(master);
  },
  setVolume(v: number): void {
    if (out) out.gain.value = v;
  },
  resume(): void {
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
  },
  tap(): void {
    const c = ready();
    if (c) tone(720, 'triangle', c.currentTime, 0.004, 0.18, 0.07, 980);
  },
  confirm(): void {
    const c = ready();
    if (!c) return;
    tone(520, 'triangle', c.currentTime, 0.004, 0.2, 0.09);
    tone(780, 'triangle', c.currentTime + 0.07, 0.004, 0.2, 0.14);
  },
  /** Bell strike: inharmonic partials with long decay (the game's sonic motif). */
  bell(freq = 440, gain = 0.28, long = 1.8): void {
    const c = ready();
    if (!c) return;
    [1, 2.76, 5.4, 8.93].forEach((r, i) => tone(freq * r, 'sine', c.currentTime, 0.004, gain / (1 + i * 1.6), long / (1 + i * 0.7)));
  },
  /** Fadyme's signature silver warding bell: crystalline D-minor harmonic shimmer with gentle stereo-like detuned overtones. */
  silverBell(freq = 587.33, gain = 0.24): void {
    const c = ready();
    if (!c) return;
    const t0 = c.currentTime;
    [1, 2.0, 2.756, 4.08, 5.404].forEach((r, i) => {
      tone(freq * r, 'sine', t0, 0.003, gain / (1 + i * 1.45), 1.65 / (1 + i * 0.55));
      tone(freq * r * 1.0018, 'sine', t0 + 0.008, 0.005, (gain * 0.55) / (1 + i * 1.5), 1.8 / (1 + i * 0.6));
    });
  },
  /** Mahmut's iron shield & broadsword bulwark resonance: low metallic thud + warm brass-iron ring. */
  shieldBash(): void {
    const c = ready();
    if (!c) return;
    const t0 = c.currentTime;
    noise(t0, 0.14, 0.28, 1600);
    tone(146.83, 'triangle', t0, 0.003, 0.36, 0.28, 73.42);
    tone(440, 'sine', t0 + 0.01, 0.003, 0.14, 0.38);
    tone(659.25, 'triangle', t0 + 0.02, 0.004, 0.1, 0.45);
  },
  hit(heavy = false): void {
    const c = ready();
    if (!c) return;
    noise(c.currentTime, heavy ? 0.22 : 0.12, heavy ? 0.44 : 0.28, heavy ? 1900 : 2900);
    tone(heavy ? 130 : 185, 'sine', c.currentTime, 0.002, heavy ? 0.48 : 0.35, 0.16, 48);
    if (heavy) tone(293.66, 'triangle', c.currentTime, 0.003, 0.22, 0.14, 98);
  },
  guard(): void {
    const c = ready();
    if (!c) return;
    tone(1174.66, 'triangle', c.currentTime, 0.002, 0.11, 0.08);
    tone(1760, 'sine', c.currentTime + 0.02, 0.003, 0.12, 0.22);
  },
  heal(): void {
    const c = ready();
    if (!c) return;
    [523.25, 659.25, 783.99].forEach((f, i) => tone(f, 'sine', c.currentTime + i * 0.08, 0.01, 0.16, 0.38));
  },
  defeat(): void {
    const c = ready();
    if (!c) return;
    tone(220, 'sawtooth', c.currentTime, 0.01, 0.18, 0.55, 55);
    noise(c.currentTime, 0.28, 0.22, 900);
  },
  cast(): void {
    const c = ready();
    if (!c) return;
    tone(293.66, 'sine', c.currentTime, 0.035, 0.14, 0.48, 880);
    Sfx.silverBell(587.33, 0.2);
  },
  ultimate(): void {
    const c = ready();
    if (!c) return;
    tone(110, 'sawtooth', c.currentTime, 0.08, 0.16, 1.0, 587.33);
    Sfx.bell(220, 0.34, 2.4);
    window.setTimeout(() => Sfx.silverBell(587.33, 0.26), 160);
  },
  /** 3-beat Japanese Ultimate chant audio cues: [1] Cast Ritual Charge, [2] Diagonal Cut-In Slash, [3] Final Release Detonation */
  ultimateBeat(beat: 1 | 2 | 3): void {
    const c = ready();
    if (!c) return;
    const t0 = c.currentTime;
    if (beat === 1) {
      // Beat 1: Deep sanctuary ritual gong + rising arcane charge sweep
      Sfx.bell(196, 0.32, 2.0);
      tone(98, 'triangle', t0, 0.05, 0.28, 0.72, 293.66);
      tone(293.66, 'sine', t0 + 0.08, 0.04, 0.18, 0.65, 587.33);
    } else if (beat === 2) {
      // Beat 2: Razor-sharp cut-in flash + crystalline harmonic triad
      noise(t0, 0.09, 0.34, 4200);
      tone(880, 'triangle', t0, 0.004, 0.26, 0.22, 1760);
      [440, 554.37, 659.25].forEach((f, i) => tone(f, 'sine', t0 + i * 0.045, 0.008, 0.19, 0.55));
    } else {
      // Beat 3: Cataclysmic release impact + dual sanctuary bell peal
      noise(t0, 0.26, 0.45, 2200);
      tone(73.42, 'sawtooth', t0, 0.005, 0.42, 0.58, 36.71);
      Sfx.silverBell(587.33, 0.32);
      Sfx.bell(293.66, 0.34, 2.2);
    }
  },
  victory(): void {
    [293.66, 349.23, 440.0, 587.33].forEach((f, i) => window.setTimeout(() => Sfx.bell(f, 0.2, 1.7), i * 140));
  },
  lose(): void {
    Sfx.bell(98, 0.36, 3);
  },
  /** Phaser engine splash chime: retro-futuristic ascending prism synth arpeggio + laser sweep + warm bass pad. */
  phaserLogo(): void {
    const c = ready();
    if (!c) return;
    const t0 = c.currentTime + 0.04;
    // Warm sub-bass foundation
    tone(130.81, 'triangle', t0, 0.12, 0.22, 1.85);
    // Prism laser beam sweep
    tone(220, 'sine', t0 + 0.06, 0.04, 0.12, 0.55, 1320);
    // Ascending Cmaj9 retro-synth arpeggio (C4 -> E4 -> G4 -> B4 -> D5 -> E5)
    [261.63, 329.63, 392.0, 493.88, 587.33, 659.25].forEach((f, i) => {
      tone(f, 'triangle', t0 + 0.1 + i * 0.085, 0.015, 0.16, 0.95 - i * 0.06);
      tone(f * 2, 'sine', t0 + 0.1 + i * 0.085, 0.01, 0.06, 0.75);
    });
  }
};
