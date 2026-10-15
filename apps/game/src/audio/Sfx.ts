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
  bell(freq = 440, gain = 0.32, long = 1.8): void {
    const c = ready();
    if (!c) return;
    [1, 2.76, 5.4, 8.93].forEach((r, i) => tone(freq * r, 'sine', c.currentTime, 0.003, gain / (1 + i * 1.6), long / (1 + i * 0.7)));
  },
  hit(heavy = false): void {
    const c = ready();
    if (!c) return;
    noise(c.currentTime, heavy ? 0.22 : 0.12, heavy ? 0.5 : 0.32, heavy ? 1800 : 2800);
    tone(heavy ? 130 : 180, 'sine', c.currentTime, 0.002, heavy ? 0.55 : 0.4, 0.16, 48);
  },
  guard(): void {
    const c = ready();
    if (!c) return;
    tone(1250, 'square', c.currentTime, 0.002, 0.08, 0.06);
    tone(1880, 'triangle', c.currentTime + 0.02, 0.002, 0.1, 0.18);
  },
  heal(): void {
    const c = ready();
    if (!c) return;
    [523, 659, 784].forEach((f, i) => tone(f, 'sine', c.currentTime + i * 0.08, 0.01, 0.16, 0.35));
  },
  defeat(): void {
    const c = ready();
    if (!c) return;
    tone(240, 'sawtooth', c.currentTime, 0.01, 0.2, 0.55, 55);
    noise(c.currentTime, 0.3, 0.25, 900);
  },
  cast(): void {
    const c = ready();
    if (!c) return;
    tone(300, 'sine', c.currentTime, 0.04, 0.16, 0.5, 900);
    Sfx.bell(660, 0.14, 1.2);
  },
  ultimate(): void {
    const c = ready();
    if (!c) return;
    tone(110, 'sawtooth', c.currentTime, 0.1, 0.18, 1.1, 660);
    Sfx.bell(220, 0.4, 2.6);
    window.setTimeout(() => Sfx.bell(330, 0.26, 2.2), 180);
  },
  victory(): void {
    [392, 494, 587, 784].forEach((f, i) => window.setTimeout(() => Sfx.bell(f, 0.2, 1.6), i * 140));
  },
  lose(): void {
    Sfx.bell(98, 0.4, 3);
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
