#!/usr/bin/env node
/**
 * tools/build_sfx_pack.mjs
 *
 * §4.6 Audio & Video: Generates the canonical 16-cue Ogg Vorbis SFX set (`content/base/sfx/*.ogg`)
 * covering UI, footsteps, blades, shields, bells, statuses, and ultimates, registers them in
 * `content/base/presentation/presentation.json` (`sounds`), and records full source, license,
 * and SHA-256 provenance in `narrative/11_Audio_Cues/SFX_PROVENANCE.json`.
 */

import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { console } from 'node:console';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'content/base/sfx');
const TMP_DIR = join(ROOT, 'content/_tmp_sfx');
const PRESENTATION_PATH = join(ROOT, 'content/base/presentation/presentation.json');
const PROVENANCE_PATH = join(ROOT, 'narrative/11_Audio_Cues/SFX_PROVENANCE.json');

const SAMPLE_RATE = 48000;
const FFMPEG = (() => {
  try {
    return execFileSync(
      'python',
      ['-c', "import sys; sys.path.insert(0, '.cache/py_pkgs'); import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"],
      { encoding: 'utf8' }
    ).trim();
  } catch {
    return 'ffmpeg';
  }
})();

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

function env(t, attack, release) {
  if (t < 0) return 0;
  if (t < attack) return Math.max(0, t / Math.max(0.0005, attack));
  const r = (t - attack) / Math.max(0.001, release);
  return r >= 1 ? 0 : Math.exp(-4.8 * r);
}

function addTone(buf, { freq, sweepTo, type = 'sine', start = 0, attack = 0.004, release = 0.2, gain = 0.25 }) {
  const n0 = Math.floor(start * SAMPLE_RATE);
  const dur = attack + release;
  const n1 = Math.min(buf.length, Math.floor((start + dur) * SAMPLE_RATE));
  let phase = 0;
  for (let i = n0; i < n1; i++) {
    const t = (i - n0) / SAMPLE_RATE;
    const k = Math.min(1, t / Math.max(0.001, dur));
    const f = sweepTo ? freq * Math.pow(sweepTo / freq, k) : freq;
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    let s = 0;
    if (type === 'sine') s = Math.sin(phase);
    else if (type === 'triangle') s = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else if (type === 'sawtooth') s = 2 * ((phase / (2 * Math.PI)) - Math.floor(0.5 + phase / (2 * Math.PI)));
    buf[i] += s * gain * env(t, attack, release);
  }
}

function addNoise(buf, { seed = 1337, start = 0, attack = 0.003, release = 0.15, gain = 0.25, cutoffHz = 2400 }) {
  const rng = makeRng(seed);
  const n0 = Math.floor(start * SAMPLE_RATE);
  const dur = attack + release;
  const n1 = Math.min(buf.length, Math.floor((start + dur) * SAMPLE_RATE));
  const rc = 1 / (2 * Math.PI * Math.max(80, cutoffHz));
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  let y = 0;
  for (let i = n0; i < n1; i++) {
    const t = (i - n0) / SAMPLE_RATE;
    const x = rng();
    y = y + alpha * (x - y);
    buf[i] += y * gain * env(t, attack, release);
  }
}

function writeWav(path, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-0.98, Math.min(0.98, Math.tanh(samples[i] * 1.15)));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  writeFileSync(path, buffer);
}

const CUES = [
  {
    id: 'sfx_ui_tap',
    category: 'ui',
    duration_s: 0.14,
    volume: 0.65,
    recipe: 'Crisp gothic parchment & brass UI tap (720→980 Hz triangle transient)',
    render(buf) {
      addTone(buf, { freq: 720, sweepTo: 980, type: 'triangle', start: 0.005, attack: 0.004, release: 0.085, gain: 0.42 });
      addTone(buf, { freq: 1440, type: 'sine', start: 0.005, attack: 0.003, release: 0.06, gain: 0.18 });
    }
  },
  {
    id: 'sfx_ui_confirm',
    category: 'ui',
    duration_s: 0.28,
    volume: 0.72,
    recipe: 'Two-tone metallic sanctum confirm chime (520 Hz → 780 Hz fifth interval)',
    render(buf) {
      addTone(buf, { freq: 520, type: 'triangle', start: 0.005, attack: 0.004, release: 0.11, gain: 0.38 });
      addTone(buf, { freq: 780, type: 'triangle', start: 0.075, attack: 0.004, release: 0.17, gain: 0.42 });
      addTone(buf, { freq: 1560, type: 'sine', start: 0.075, attack: 0.004, release: 0.14, gain: 0.16 });
    }
  },
  {
    id: 'sfx_ui_wax_seal',
    category: 'ui',
    duration_s: 0.42,
    volume: 0.78,
    recipe: 'Heavy crimson wax-seal stamp thud + warm bronze bell overtone',
    render(buf) {
      addNoise(buf, { seed: 101, start: 0.005, attack: 0.003, release: 0.12, gain: 0.45, cutoffHz: 1400 });
      addTone(buf, { freq: 140, sweepTo: 62, type: 'triangle', start: 0.005, attack: 0.003, release: 0.22, gain: 0.48 });
      addTone(buf, { freq: 587.33, type: 'sine', start: 0.02, attack: 0.005, release: 0.34, gain: 0.24 });
    }
  },
  {
    id: 'sfx_footstep_ash',
    category: 'footsteps',
    duration_s: 0.24,
    volume: 0.58,
    recipe: 'Double-layered boot step on dry Whispering Ash gravel and stone',
    render(buf) {
      addNoise(buf, { seed: 202, start: 0.005, attack: 0.004, release: 0.09, gain: 0.48, cutoffHz: 1850 });
      addTone(buf, { freq: 112, sweepTo: 54, type: 'sine', start: 0.005, attack: 0.003, release: 0.08, gain: 0.32 });
      addNoise(buf, { seed: 203, start: 0.055, attack: 0.005, release: 0.12, gain: 0.28, cutoffHz: 2600 });
    }
  },
  {
    id: 'sfx_footstep_march',
    category: 'footsteps',
    duration_s: 0.36,
    volume: 0.64,
    recipe: 'Armored vanguard stride with subtle greave clink',
    render(buf) {
      addNoise(buf, { seed: 204, start: 0.005, attack: 0.003, release: 0.11, gain: 0.46, cutoffHz: 1600 });
      addTone(buf, { freq: 96, sweepTo: 48, type: 'triangle', start: 0.005, attack: 0.003, release: 0.11, gain: 0.38 });
      addTone(buf, { freq: 1320, sweepTo: 980, type: 'sine', start: 0.025, attack: 0.002, release: 0.09, gain: 0.14 });
    }
  },
  {
    id: 'sfx_blade_slash',
    category: 'blades',
    duration_s: 0.26,
    volume: 0.76,
    recipe: 'Swift steel broadsword slash + air whoosh + flesh/armor bite',
    render(buf) {
      addNoise(buf, { seed: 301, start: 0.004, attack: 0.003, release: 0.14, gain: 0.52, cutoffHz: 3200 });
      addTone(buf, { freq: 195, sweepTo: 52, type: 'sine', start: 0.004, attack: 0.002, release: 0.16, gain: 0.46 });
      addTone(buf, { freq: 920, sweepTo: 340, type: 'triangle', start: 0.008, attack: 0.002, release: 0.11, gain: 0.24 });
    }
  },
  {
    id: 'sfx_blade_heavy',
    category: 'blades',
    duration_s: 0.38,
    volume: 0.84,
    recipe: 'Heavy cleaving weapon impact + low sub-bass shock + steel ring',
    render(buf) {
      addNoise(buf, { seed: 302, start: 0.004, attack: 0.003, release: 0.24, gain: 0.62, cutoffHz: 2100 });
      addTone(buf, { freq: 135, sweepTo: 42, type: 'sine', start: 0.004, attack: 0.002, release: 0.22, gain: 0.56 });
      addTone(buf, { freq: 293.66, sweepTo: 98, type: 'triangle', start: 0.006, attack: 0.003, release: 0.18, gain: 0.34 });
      addTone(buf, { freq: 1174.66, type: 'sine', start: 0.012, attack: 0.003, release: 0.26, gain: 0.15 });
    }
  },
  {
    id: 'sfx_shield_bash',
    category: 'shields',
    duration_s: 0.48,
    volume: 0.8,
    recipe: 'Mahmut iron bulwark slam: low metallic thud + warm brass-iron D-minor ring',
    render(buf) {
      addNoise(buf, { seed: 401, start: 0.004, attack: 0.003, release: 0.16, gain: 0.48, cutoffHz: 1650 });
      addTone(buf, { freq: 146.83, sweepTo: 73.42, type: 'triangle', start: 0.004, attack: 0.003, release: 0.3, gain: 0.46 });
      addTone(buf, { freq: 440, type: 'sine', start: 0.012, attack: 0.003, release: 0.38, gain: 0.22 });
      addTone(buf, { freq: 659.25, type: 'triangle', start: 0.02, attack: 0.004, release: 0.42, gain: 0.16 });
    }
  },
  {
    id: 'sfx_shield_guard',
    category: 'shields',
    duration_s: 0.3,
    volume: 0.72,
    recipe: 'High steel parry & ward deflection chime (1174.66 Hz → 1760 Hz)',
    render(buf) {
      addTone(buf, { freq: 1174.66, type: 'triangle', start: 0.004, attack: 0.002, release: 0.1, gain: 0.32 });
      addTone(buf, { freq: 1760, type: 'sine', start: 0.022, attack: 0.003, release: 0.24, gain: 0.34 });
      addNoise(buf, { seed: 402, start: 0.004, attack: 0.002, release: 0.07, gain: 0.25, cutoffHz: 3600 });
    }
  },
  {
    id: 'sfx_bell_sanctuary',
    category: 'bells',
    duration_s: 1.85,
    volume: 0.82,
    recipe: 'Inharmonic bronze sanctuary bell strike (partials 1 : 2.76 : 5.4 : 8.93)',
    render(buf) {
      const freq = 440;
      [1, 2.76, 5.4, 8.93].forEach((r, i) => {
        addTone(buf, {
          freq: freq * r,
          type: 'sine',
          start: 0.005,
          attack: 0.004,
          release: 1.75 / (1 + i * 0.65),
          gain: 0.38 / (1 + i * 1.45)
        });
      });
    }
  },
  {
    id: 'sfx_bell_silver',
    category: 'bells',
    duration_s: 1.65,
    volume: 0.78,
    recipe: 'Fadyme signature silver warding bell (587.33 Hz D5 detuned crystalline shimmer)',
    render(buf) {
      const freq = 587.33;
      [1, 2.0, 2.756, 4.08, 5.404].forEach((r, i) => {
        addTone(buf, {
          freq: freq * r,
          type: 'sine',
          start: 0.004,
          attack: 0.003,
          release: 1.52 / (1 + i * 0.52),
          gain: 0.32 / (1 + i * 1.4)
        });
        addTone(buf, {
          freq: freq * r * 1.0018,
          type: 'sine',
          start: 0.012,
          attack: 0.005,
          release: 1.58 / (1 + i * 0.58),
          gain: 0.18 / (1 + i * 1.45)
        });
      });
    }
  },
  {
    id: 'sfx_status_buff',
    category: 'statuses',
    duration_s: 0.62,
    volume: 0.74,
    recipe: 'Ascending sanctuary blessing triad (C5 → E5 → G5 → B5 harmonic bloom)',
    render(buf) {
      [523.25, 659.25, 783.99, 987.77].forEach((f, i) => {
        addTone(buf, { freq: f, type: 'sine', start: 0.006 + i * 0.075, attack: 0.01, release: 0.34, gain: 0.26 });
        addTone(buf, { freq: f * 2, type: 'triangle', start: 0.006 + i * 0.075, attack: 0.008, release: 0.22, gain: 0.09 });
      });
    }
  },
  {
    id: 'sfx_status_debuff',
    category: 'statuses',
    duration_s: 0.56,
    volume: 0.74,
    recipe: 'Descending Veil hex / silence dissonance (311.13 Hz → 207.65 Hz → 146.83 Hz)',
    render(buf) {
      [311.13, 233.08, 155.56].forEach((f, i) => {
        addTone(buf, { freq: f, sweepTo: f * 0.88, type: 'sawtooth', start: 0.006 + i * 0.085, attack: 0.008, release: 0.32, gain: 0.22 });
      });
      addNoise(buf, { seed: 601, start: 0.01, attack: 0.01, release: 0.38, gain: 0.22, cutoffHz: 950 });
    }
  },
  {
    id: 'sfx_ultimate_cast',
    category: 'ultimates',
    duration_s: 1.15,
    volume: 0.84,
    recipe: 'Ultimate Beat 1 — Deep sanctuary ritual gong + rising arcane charge sweep',
    render(buf) {
      [1, 2.76, 5.4].forEach((r, i) => {
        addTone(buf, { freq: 196 * r, type: 'sine', start: 0.005, attack: 0.004, release: 1.05 / (1 + i * 0.5), gain: 0.34 / (1 + i * 1.3) });
      });
      addTone(buf, { freq: 98, sweepTo: 293.66, type: 'triangle', start: 0.01, attack: 0.05, release: 0.75, gain: 0.32 });
      addTone(buf, { freq: 293.66, sweepTo: 587.33, type: 'sine', start: 0.08, attack: 0.04, release: 0.72, gain: 0.24 });
    }
  },
  {
    id: 'sfx_ultimate_cutin',
    category: 'ultimates',
    duration_s: 0.68,
    volume: 0.84,
    recipe: 'Ultimate Beat 2 — Razor-sharp diagonal cut-in flash + crystalline A-major triad',
    render(buf) {
      addNoise(buf, { seed: 702, start: 0.004, attack: 0.003, release: 0.11, gain: 0.45, cutoffHz: 4200 });
      addTone(buf, { freq: 880, sweepTo: 1760, type: 'triangle', start: 0.004, attack: 0.004, release: 0.24, gain: 0.34 });
      [440, 554.37, 659.25].forEach((f, i) => {
        addTone(buf, { freq: f, type: 'sine', start: 0.01 + i * 0.045, attack: 0.008, release: 0.52, gain: 0.24 });
      });
    }
  },
  {
    id: 'sfx_ultimate_release',
    category: 'ultimates',
    duration_s: 1.95,
    volume: 0.88,
    recipe: 'Ultimate Beat 3 — Cataclysmic release detonation + dual bronze & silver bell peal',
    render(buf) {
      addNoise(buf, { seed: 703, start: 0.004, attack: 0.004, release: 0.32, gain: 0.56, cutoffHz: 2200 });
      addTone(buf, { freq: 73.42, sweepTo: 36.71, type: 'sawtooth', start: 0.004, attack: 0.005, release: 0.62, gain: 0.46 });
      [1, 2.76, 5.4, 8.93].forEach((r, i) => {
        addTone(buf, { freq: 293.66 * r, type: 'sine', start: 0.01, attack: 0.004, release: 1.85 / (1 + i * 0.6), gain: 0.32 / (1 + i * 1.4) });
        addTone(buf, { freq: 587.33 * r, type: 'sine', start: 0.025, attack: 0.004, release: 1.65 / (1 + i * 0.65), gain: 0.24 / (1 + i * 1.45) });
      });
    }
  }
];

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

const soundsManifest = {};
const provenanceEntries = [];

for (const cue of CUES) {
  const numSamples = Math.ceil(cue.duration_s * SAMPLE_RATE);
  const samples = new Float64Array(numSamples);
  cue.render(samples);

  const wavPath = join(TMP_DIR, `${cue.id}.wav`);
  const relOgg = `sfx/${cue.id}.ogg`;
  const oggPath = join(OUT_DIR, `${cue.id}.ogg`);
  writeWav(wavPath, samples);

  execFileSync(
    FFMPEG,
    [
      '-y',
      '-v',
      'error',
      '-i',
      wavPath,
      '-c:a',
      'libvorbis',
      '-q:a',
      '4',
      '-ar',
      String(SAMPLE_RATE),
      '-ac',
      '1',
      '-map_metadata',
      '-1',
      '-bitexact',
      oggPath
    ],
    { stdio: 'inherit' }
  );

  const oggBytes = readFileSync(oggPath);
  const sha256 = createHash('sha256').update(oggBytes).digest('hex');

  soundsManifest[cue.id] = {
    file: relOgg,
    duration_s: cue.duration_s,
    loop: false,
    volume: cue.volume
  };

  provenanceEntries.push({
    cue_id: cue.id,
    category: cue.category,
    file: `content/base/${relOgg}`,
    duration_s: cue.duration_s,
    volume: cue.volume,
    bytes: oggBytes.byteLength,
    sha256,
    source: 'tools/build_sfx_pack.mjs (deterministic physical/modal synthesis + FFmpeg libvorbis -bitexact)',
    license: 'First-Party Owned / CC0-1.0 (ŞovTaym Studios)',
    recipe: cue.recipe
  });
}

rmSync(TMP_DIR, { recursive: true, force: true });

const presentation = JSON.parse(readFileSync(PRESENTATION_PATH, 'utf8'));
presentation.sounds = soundsManifest;
writeFileSync(PRESENTATION_PATH, `${JSON.stringify(presentation, null, 2)}\n`);

writeFileSync(
  PROVENANCE_PATH,
  `${JSON.stringify(
    {
      schema_version: 1,
      generator: 'tools/build_sfx_pack.mjs',
      license: 'First-Party Owned / CC0-1.0 (ŞovTaym Studios)',
      total_cues: provenanceEntries.length,
      categories: ['ui', 'footsteps', 'blades', 'shields', 'bells', 'statuses', 'ultimates'],
      cues: provenanceEntries
    },
    null,
    2
  )}\n`
);

console.log(`Built ${provenanceEntries.length} canonical SFX cues in content/base/sfx/ and registered in presentation.sounds.`);
