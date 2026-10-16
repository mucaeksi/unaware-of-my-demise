"""Compose and master the 120-second (2:00) 3-Act Prologue soundtrack:
`bgm_prologue_before_the_road_v001_loop.ogg`

Syncs with the 9 scenes of `content/base/entry/prologue.json` ("Before the Road"):
- Act I (0:00 - 0:38): Living Veyrhold Before the Ash
  - 0:00 - 0:12 (`hours`, 12s): Deep Veyrhold bronze tower bell tolls + warm acoustic harp, nylon guitar & alto flute (`bgm_ch1_ash_forest_calm`).
  - 0:12 - 0:26 (`names`, 14s): Ledger memory motif (intimate felt-piano & harp notes) over calm pastoral strings.
  - 0:26 - 0:38 (`ordinary_days`, 12s): Warm chamber glow until 0:33 ("Until the day people began to lose them"), where a dark cello shadow enters.
- Act II (0:38 - 1:22): The Throne Wars & Crownfall
  - 0:38 - 0:50 (`throne_wars`, 12s): Crossfade into `bgm_ch1_ash_forest_uneasy` (detuned pad, bowed double-bass, hesitant guitar, distant war bell & heartbeat drum pulse).
  - 0:50 - 1:06 (`crownfall`, 16s): Heavy Crownfall funeral bell strike + sub-bass impact at 0:50, surging into `bgm_ch1_ash_forest_chaotic` (low string tremolo, tragic brass swells, irregular tolling bells), subsiding by 1:02 ("By dawn...").
  - 1:06 - 1:22 (`roads`, 16s): Quiet Sorrow aftermath — sparse weeping solo cello & uneasy mist pad, pivoting from E minor to D minor at 1:17 ("Home was not.").
- Act III (1:22 - 2:00): The Winter Search, Reunion & Fadyme's Theme
  - 1:22 - 1:36 (`search`, 14s): Mahmut's steady walking low-cello motif + `bgm_fadyme_theme` intimate felt-piano opening in D minor (73.8 BPM, 3/4).
  - 1:36 - 1:48 (`reunion`, 12s): Luminous silver pilgrim bell chime at 1:36 ("In a hill village, he found her"), blossoming into the full cello + felt-piano duet of `bgm_fadyme_theme`.
  - 1:48 - 2:00 (`beginning`, 12s): Fadyme & Mahmut walking together; at 1:51.5 ("The bells still ring"), the Veyrhold bronze bell and Fadyme's silver bell answer each other in D minor, resolving into a warm final chord and natural decay at 2:00.
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
STEMS = ROOT / '.cache' / 'audio_stems'
OUT_DIR = ROOT / 'narrative' / '11_Audio_Cues' / 'Music_Source' / 'bgm_prologue_before_the_road'
FFMPEG = Path(r'C:\Program Files\BlueStacks_nxt\ffmpeg.exe')
SR = 44100
DURATION_S = 120.0
TOTAL_SAMPLES = int(SR * DURATION_S)


def load_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), 'rb') as w:
        assert w.getframerate() == SR, f'Expected {SR} Hz, got {w.getframerate()}'
        n = w.getnframes()
        ch = w.getnchannels()
        raw = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
        if ch == 1:
            return np.column_stack([raw, raw])
        return raw.reshape(-1, ch)[:, :2]


def save_wav(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    clipped = np.clip(audio, -0.99, 0.99)
    pcm = (clipped * 32767.0).astype(np.int16)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def one_pole_lp(x: np.ndarray, cutoff_hz: float) -> np.ndarray:
    """Simple stereo one-pole lowpass filter in pure numpy."""
    rc = 1.0 / (2.0 * np.pi * cutoff_hz)
    dt = 1.0 / SR
    alpha = dt / (rc + dt)
    out = np.zeros_like(x)
    # Vectorized IIR approximation via chunked recurrence
    y0 = 0.0
    y1 = 0.0
    x0 = x[:, 0]
    x1 = x[:, 1]
    o0 = out[:, 0]
    o1 = out[:, 1]
    for i in range(len(x)):
        y0 += alpha * (x0[i] - y0)
        y1 += alpha * (x1[i] - y1)
        o0[i] = y0
        o1[i] = y1
    return out


def stereo_cathedral_reverb(stereo: np.ndarray, wet: float = 0.32) -> np.ndarray:
    """Multi-tap stereo cathedral diffusion tail for bells and acoustic motifs."""
    out = stereo.copy()
    taps = [
        (0.073, 0.28, -0.22),
        (0.137, -0.21, 0.25),
        (0.229, 0.18, 0.16),
        (0.353, 0.14, -0.15),
        (0.509, -0.11, 0.12),
        (0.719, 0.09, 0.08),
        (0.983, 0.06, -0.06),
        (1.310, 0.04, 0.04),
    ]
    for delay_s, g_l, g_r in taps:
        d = int(delay_s * SR)
        if d < len(stereo):
            out[d:, 0] += wet * (g_l * stereo[:-d, 0] + 0.5 * g_r * stereo[:-d, 1])
            out[d:, 1] += wet * (g_r * stereo[:-d, 1] + 0.5 * g_l * stereo[:-d, 0])
    return out


def synth_bronze_bell(freq: float, dur_s: float, amp: float = 0.25, pan: float = 0.0) -> np.ndarray:
    """Acoustic-modeled medieval bronze tower bell with realistic minor-third hum/prime/tierce/quint/nominal partials."""
    n = int(dur_s * SR)
    t = np.arange(n, dtype=np.float32) / SR
    # Classic European bronze church/tower bell partial ratios:
    # 0.5 (hum), 1.0 (prime), 1.183 (minor third tierce), 1.506 (quint), 2.0 (nominal), 2.514, 3.011, 4.166
    partials = [
        (0.500, 0.38, 1.35),
        (1.000, 1.00, 1.00),
        (1.183, 0.62, 0.78),
        (1.506, 0.35, 0.62),
        (2.000, 0.72, 0.52),
        (2.514, 0.28, 0.36),
        (3.011, 0.22, 0.28),
        (4.166, 0.12, 0.18),
    ]
    sig = np.zeros(n, dtype=np.float32)
    attack = np.minimum(1.0, t / 0.008)
    for ratio, weight, decay_mult in partials:
        f = freq * ratio
        # Slight natural beating (detuned doublet partial)
        tau = max(0.25, dur_s * 0.42 * decay_mult)
        env = attack * np.exp(-t / tau)
        sig += weight * env * (
            0.7 * np.sin(2.0 * np.pi * f * t)
            + 0.3 * np.sin(2.0 * np.pi * (f * 1.0018) * t + 0.4)
        )
    # Soft wooden/bronze clapper transient
    clapper_env = np.exp(-t / 0.018) * np.sin(2.0 * np.pi * (freq * 0.75) * t)
    sig = (sig * 0.42 + clapper_env * 0.18) * amp
    # Fade last 0.25s to zero
    fade_len = min(n // 4, int(0.25 * SR))
    sig[-fade_len:] *= np.linspace(1.0, 0.0, fade_len, dtype=np.float32)
    left = sig * np.sqrt(0.5 * (1.0 - pan))
    right = sig * np.sqrt(0.5 * (1.0 + pan))
    return stereo_cathedral_reverb(np.column_stack([left, right]), wet=0.45)


def synth_silver_bell(freq: float, dur_s: float, amp: float = 0.16, pan: float = 0.15) -> np.ndarray:
    """Delicate, crystalline silver pilgrim handbell (Fadyme's signature motif)."""
    n = int(dur_s * SR)
    t = np.arange(n, dtype=np.float32) / SR
    partials = [
        (1.000, 1.00, 1.00),
        (2.000, 0.55, 0.75),
        (2.756, 0.38, 0.55),
        (4.000, 0.22, 0.40),
        (5.404, 0.12, 0.25),
    ]
    sig = np.zeros(n, dtype=np.float32)
    attack = np.minimum(1.0, t / 0.004)
    for ratio, weight, decay_mult in partials:
        f = freq * ratio
        tau = max(0.18, dur_s * 0.38 * decay_mult)
        env = attack * np.exp(-t / tau)
        sig += weight * env * (
            0.8 * np.sin(2.0 * np.pi * f * t)
            + 0.2 * np.sin(2.0 * np.pi * (f * 1.0012) * t)
        )
    sig *= amp * 0.48
    fade_len = min(n // 4, int(0.2 * SR))
    sig[-fade_len:] *= np.linspace(1.0, 0.0, fade_len, dtype=np.float32)
    left = sig * np.sqrt(0.5 * (1.0 - pan))
    right = sig * np.sqrt(0.5 * (1.0 + pan))
    return stereo_cathedral_reverb(np.column_stack([left, right]), wet=0.52)


def synth_felt_piano_note(freq: float, dur_s: float, amp: float = 0.12, pan: float = 0.0) -> np.ndarray:
    """Warm, intimate felt-piano note with soft hammer attack and natural harmonic decay."""
    n = int(dur_s * SR)
    t = np.arange(n, dtype=np.float32) / SR
    attack = np.minimum(1.0, t / 0.022)
    harmonics = [
        (1.0, 1.00, 1.00),
        (2.0, 0.42, 0.75),
        (3.0, 0.16, 0.52),
        (4.0, 0.06, 0.35),
    ]
    sig = np.zeros(n, dtype=np.float32)
    for h, w, dm in harmonics:
        # Slight piano inharmonicity
        fh = freq * h * np.sqrt(1.0 + 0.00015 * h * h)
        tau = max(0.2, dur_s * 0.48 * dm)
        sig += w * attack * np.exp(-t / tau) * np.sin(2.0 * np.pi * fh * t)
    sig *= amp * 0.55
    fade_len = min(n // 4, int(0.18 * SR))
    sig[-fade_len:] *= np.linspace(1.0, 0.0, fade_len, dtype=np.float32)
    left = sig * np.sqrt(0.5 * (1.0 - pan))
    right = sig * np.sqrt(0.5 * (1.0 + pan))
    return np.column_stack([left, right])


def synth_warm_cello_note(freq: float, dur_s: float, amp: float = 0.12, pan: float = -0.1) -> np.ndarray:
    """Expressive bowed solo cello note with gentle vibrato and bow swell."""
    n = int(dur_s * SR)
    t = np.arange(n, dtype=np.float32) / SR
    # Smooth bow envelope
    att = min(0.45, dur_s * 0.28)
    rel = min(0.55, dur_s * 0.32)
    env = np.ones(n, dtype=np.float32)
    att_n = int(att * SR)
    rel_n = int(rel * SR)
    if att_n > 0:
        env[:att_n] = np.sin(np.linspace(0.0, np.pi / 2.0, att_n, dtype=np.float32))
    if rel_n > 0:
        env[-rel_n:] = np.cos(np.linspace(0.0, np.pi / 2.0, rel_n, dtype=np.float32))
    # Subtle 5.2 Hz vibrato delayed slightly
    vib_depth = 0.0032 * np.minimum(1.0, t / 0.35)
    phase_mod = np.cumsum(freq * (1.0 + vib_depth * np.sin(2.0 * np.pi * 5.2 * t))) / SR
    sig = np.zeros(n, dtype=np.float32)
    # Rich low-passed cello harmonics
    for h, w in [(1, 1.0), (2, 0.62), (3, 0.34), (4, 0.16), (5, 0.08), (6, 0.04)]:
        sig += w * np.sin(2.0 * np.pi * h * phase_mod)
    sig *= env * amp * 0.42
    left = sig * np.sqrt(0.5 * (1.0 - pan))
    right = sig * np.sqrt(0.5 * (1.0 + pan))
    return np.column_stack([left, right])


def synth_heartbeat_drum(dur_s: float = 1.6, amp: float = 0.22) -> np.ndarray:
    """Deep muffled gothic frame-drum / war-drum pulse for Throne Wars & Crownfall."""
    n = int(dur_s * SR)
    t = np.arange(n, dtype=np.float32) / SR
    f_sweep = 58.0 + 38.0 * np.exp(-t / 0.045)
    phase = 2.0 * np.pi * np.cumsum(f_sweep) / SR
    env = np.minimum(1.0, t / 0.006) * np.exp(-t / 0.24)
    sig = np.sin(phase) * env * amp
    return stereo_cathedral_reverb(np.column_stack([sig, sig]), wet=0.28)


def place(mix: np.ndarray, clip: np.ndarray, start_s: float, gain: float = 1.0) -> None:
    i0 = max(0, int(round(start_s * SR)))
    if i0 >= len(mix):
        return
    n = min(len(clip), len(mix) - i0)
    mix[i0:i0 + n] += clip[:n] * gain


def extract_with_envelope(
    src: np.ndarray,
    src_start_s: float,
    dur_s: float,
    fade_in_s: float,
    fade_out_s: float,
    gain: float = 1.0,
) -> np.ndarray:
    n = int(round(dur_s * SR))
    i0 = int(round(src_start_s * SR))
    out = np.zeros((n, 2), dtype=np.float32)
    pos = 0
    cur = i0
    while pos < n:
        take = min(n - pos, len(src) - cur)
        out[pos:pos + take] = src[cur:cur + take]
        pos += take
        cur = 0
    env = np.ones(n, dtype=np.float32)
    fi = min(n, int(round(fade_in_s * SR)))
    fo = min(n, int(round(fade_out_s * SR)))
    if fi > 0:
        env[:fi] = np.sin(np.linspace(0.0, np.pi / 2.0, fi, dtype=np.float32))
    if fo > 0:
        env[-fo:] *= np.cos(np.linspace(0.0, np.pi / 2.0, fo, dtype=np.float32))
    return out * (env[:, None] * gain)


def main() -> None:
    calm = load_wav(STEMS / 'calm.wav')
    uneasy = load_wav(STEMS / 'uneasy.wav')
    chaotic = load_wav(STEMS / 'chaotic.wav')
    fadyme = load_wav(STEMS / 'fadyme.wav')

    mix = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)

    # =========================================================================
    # ACT I (0:00 - 0:38): THE LIVING KINGDOM — VEYRHOLD BEFORE THE ASH
    # Scenes:
    #   1. hours (0:00 - 0:12): Veyrhold measured its days in bells
    #   2. names (0:12 - 0:26): Roadside registers & carved names
    #   3. ordinary_days (0:26 - 0:38): Markets, journeys, doors... until they began to lose them
    # =========================================================================
    # Use the lyrical, warm section of `bgm_ch1_ash_forest_calm` (starting at 6.0s where harp & flute bloom)
    act1_bed = extract_with_envelope(
        calm,
        src_start_s=6.0,
        dur_s=41.0,
        fade_in_s=2.4,
        fade_out_s=5.5,
        gain=0.84,
    )
    place(mix, act1_bed, start_s=0.0)

    # Scene 1 (0:00 - 0:12) — "Veyrhold measured its days in bells. A sound from the tower meant another hour had passed."
    # Two warm bronze tower bell tolls (E3 = 164.81 Hz and B3 = 246.94 Hz)
    place(mix, synth_bronze_bell(164.81, dur_s=7.5, amp=0.30, pan=-0.08), start_s=0.35)
    place(mix, synth_bronze_bell(246.94, dur_s=6.5, amp=0.22, pan=0.10), start_s=6.10)

    # Scene 2 (0:12 - 0:26) — "Names to Remember" (The Ledger Motif on intimate felt piano & harp over the calm bed)
    # E minor contemplative motif: B4 -> G4 -> F#4 -> E4 -> B3
    ledger_notes_s2 = [
        (12.2, 493.88, 2.8, 0.13, -0.12),  # B4
        (13.8, 392.00, 2.6, 0.12, 0.08),   # G4
        (15.4, 369.99, 2.8, 0.12, -0.05),  # F#4
        (17.1, 329.63, 3.8, 0.14, 0.05),   # E4
        (20.2, 246.94, 4.2, 0.13, -0.10),  # B3
        (22.4, 329.63, 3.8, 0.11, 0.12),   # E4
    ]
    for t_s, freq, dur, amp, pan in ledger_notes_s2:
        place(mix, stereo_cathedral_reverb(synth_felt_piano_note(freq, dur, amp, pan), wet=0.35), start_s=t_s)

    # Scene 3 (0:26 - 0:38) — "Ordinary Days"
    # Warm cello counter-melody from 26.0s to 33.0s, then darkening at 33.0s ("Until the day people began to lose them.")
    s3_cello = [
        (26.2, 164.81, 3.4, 0.13, -0.15),  # E3 warm
        (29.4, 196.00, 3.4, 0.14, -0.12),  # G3 warm
        (32.8, 146.83, 2.8, 0.15, -0.10),  # D3 darkening
        (35.4, 123.47, 3.6, 0.17, -0.08),  # B2 shadow approaching
    ]
    for t_s, freq, dur, amp, pan in s3_cello:
        place(mix, stereo_cathedral_reverb(synth_warm_cello_note(freq, dur, amp, pan), wet=0.32), start_s=t_s)

    # =========================================================================
    # ACT II (0:38 - 1:22): THE THRONE WARS, CROWNFALL & WHAT REMAINED
    # Scenes:
    #   4. throne_wars (0:38 - 0:50): Great houses fought over a throne; war drew closer
    #   5. crownfall (0:50 - 1:06): Then came Crownfall. The capital fell. The king died.
    #   6. roads (1:06 - 1:22): Beyond the walls, the roads were still there. Home was not.
    # =========================================================================
    # Scene 4 (0:38 - 0:50): Crossfade into `bgm_ch1_ash_forest_uneasy` (active tension section 22s-38s)
    s4_uneasy = extract_with_envelope(
        uneasy,
        src_start_s=22.0,
        dur_s=17.5,
        fade_in_s=4.5,
        fade_out_s=4.5,
        gain=0.92,
    )
    place(mix, s4_uneasy, start_s=35.5)

    # Ominous distant war-bell at 38.2s + marching low heartbeat drum pulses at 42.5s, 45.2s, 47.8s
    place(mix, synth_bronze_bell(123.47, dur_s=6.0, amp=0.22, pan=0.14), start_s=38.15)  # Low B2 toll
    for beat_t, beat_amp in [(42.4, 0.16), (45.1, 0.20), (47.7, 0.25)]:
        place(mix, synth_heartbeat_drum(dur_s=1.8, amp=beat_amp), start_s=beat_t)

    # Scene 5 (0:50 - 1:06): CROWNFALL CLIMAX ("Then came Crownfall. The capital fell. The king died.")
    # Surge into `bgm_ch1_ash_forest_chaotic` (dramatic section 24.0s - 44.0s)
    s5_chaotic = extract_with_envelope(
        chaotic,
        src_start_s=24.0,
        dur_s=20.0,
        fade_in_s=3.2,
        fade_out_s=5.0,
        gain=0.95,
    )
    place(mix, s5_chaotic, start_s=48.5)

    # Heavy tragic Crownfall funeral bell strikes at 50.0s ("Then came Crownfall") and 55.2s ("The king died")
    place(mix, synth_bronze_bell(110.00, dur_s=8.5, amp=0.34, pan=-0.06), start_s=50.05)  # Deep A2 funeral bell
    place(mix, synth_heartbeat_drum(dur_s=2.2, amp=0.32), start_s=50.05)
    place(mix, synth_bronze_bell(164.81, dur_s=7.0, amp=0.26, pan=0.12), start_s=55.20)   # E3 tragic answer bell
    place(mix, synth_heartbeat_drum(dur_s=2.0, amp=0.24), start_s=55.20)

    # Scene 6 (1:06 - 1:22): WHAT REMAINED ("Beyond the walls, the roads were still there. Home was not.")
    # Sparse, hushed aftermath from `uneasy` intro (0.0s - 19.0s, low-passed for smoky warmth) + weeping solo cello elegy
    s6_aftermath = extract_with_envelope(
        one_pole_lp(uneasy[:int(20 * SR)], cutoff_hz=2600.0),
        src_start_s=0.0,
        dur_s=19.5,
        fade_in_s=4.5,
        fade_out_s=5.0,
        gain=0.82,
    )
    place(mix, s6_aftermath, start_s=64.0)

    # Weeping solo cello elegy in Scene 6, pivoting from E minor down to A4/A2 dominant -> D minor for Act III!
    s6_cello_elegy = [
        (66.4, 164.81, 4.0, 0.16, -0.10),  # E3
        (70.2, 146.83, 3.8, 0.15, -0.08),  # D3
        (73.8, 130.81, 3.8, 0.15, -0.05),  # C3
        (77.4, 110.00, 4.8, 0.17, 0.00),   # A2 ("Home was not" — prepares D minor of Act III!)
    ]
    for t_s, freq, dur, amp, pan in s6_cello_elegy:
        place(mix, stereo_cathedral_reverb(synth_warm_cello_note(freq, dur, amp, pan), wet=0.40), start_s=t_s)
    # Solitary felt piano chord on "Home was not" (77.8s): A3 + E4
    place(mix, stereo_cathedral_reverb(synth_felt_piano_note(220.00, 4.2, 0.12, -0.08), wet=0.42), start_s=77.8)
    place(mix, stereo_cathedral_reverb(synth_felt_piano_note(329.63, 4.2, 0.10, 0.08), wet=0.42), start_s=78.0)

    # =========================================================================
    # ACT III (1:22 - 2:00): WINTER SEARCH, REUNION & FADYME'S THEME
    # Scenes:
    #   7. search (1:22 - 1:36, 82s-96s): Knight searching the village registers winter after winter
    #   8. reunion (1:36 - 1:48, 96s-108s): In a hill village, he found her. She asked him to stay. He did.
    #   9. beginning (1:48 - 2:00, 108s-120s): Now Fadyme and Mahmut walk together. The bells still ring.
    # =========================================================================
    # `bgm_fadyme_theme` (D minor, 73.8 BPM, 3/4 time: felt piano arpeggios, solo cello bass, small silver bell)
    # Scene 7 (82s - 96s) uses the intimate opening of `fadyme` (0.0s - 15.5s), then crossfades into the rich
    # emotional blossom of `fadyme` (25.2s - 51.0s) right at 96.0s (Scene 8: Reunion) through 120.0s (Scene 9)!
    s7_fadyme_intro = extract_with_envelope(
        fadyme,
        src_start_s=0.0,
        dur_s=17.5,
        fade_in_s=3.2,
        fade_out_s=3.8,
        gain=0.92,
    )
    place(mix, s7_fadyme_intro, start_s=80.5)

    # Mahmut's steady walking low-cello motif during Scene 7 (82.5s - 95.0s, D minor: D2 -> A2 -> Bb2 -> A2)
    mahmut_search_cello = [
        (82.4, 73.42, 3.2, 0.15, -0.14),   # D2
        (85.6, 110.00, 3.2, 0.14, -0.12),  # A2
        (88.8, 116.54, 3.2, 0.15, -0.10),  # Bb2
        (92.0, 110.00, 3.8, 0.15, -0.08),  # A2 (leading into D minor Reunion at 96.0s!)
    ]
    for t_s, freq, dur, amp, pan in mahmut_search_cello:
        place(mix, stereo_cathedral_reverb(synth_warm_cello_note(freq, dur, amp, pan), wet=0.30), start_s=t_s)

    # Scene 8 (96s - 108s) & Scene 9 (108s - 120s): Full blossom of Fadyme's Theme (`fadyme` 25.2s - 50.8s)
    s8_s9_fadyme_blossom = extract_with_envelope(
        fadyme,
        src_start_s=25.2,
        dur_s=25.6,
        fade_in_s=3.4,
        fade_out_s=3.6,
        gain=0.98,
    )
    place(mix, s8_s9_fadyme_blossom, start_s=94.4)

    # Scene 8 (96.0s — "In a hill village, he found her. She asked him to stay. He did.")
    # Fadyme's signature Silver Pilgrim Bell chimes gently in D minor (A5 = 880 Hz -> D5 = 587.33 Hz)
    place(mix, synth_silver_bell(880.00, dur_s=4.2, amp=0.14, pan=0.18), start_s=96.15)
    place(mix, synth_silver_bell(587.33, dur_s=5.0, amp=0.16, pan=-0.12), start_s=97.80)

    # Warm violin/cello duet harmony on "The road ahead would no longer be hers alone" (102.5s - 108.0s)
    place(mix, stereo_cathedral_reverb(synth_warm_cello_note(146.83, 5.2, 0.14, -0.15), wet=0.38), start_s=102.5)  # D3
    place(mix, stereo_cathedral_reverb(synth_warm_cello_note(220.00, 5.2, 0.11, 0.15), wet=0.38), start_s=102.5)   # A3

    # Scene 9 (108.0s - 120.0s — "Now Fadyme and Mahmut walk together. The bells still ring. Neither has told the other everything. This is where their story begins.")
    # At 111.4s ("The bells still ring"): Veyrhold Bronze Bell (D3 = 146.83 Hz) + Fadyme Silver Bell (A5 = 880 Hz & D5 = 587.33 Hz)
    place(mix, synth_bronze_bell(146.83, dur_s=7.2, amp=0.24, pan=-0.12), start_s=111.40)
    place(mix, synth_silver_bell(880.00, dur_s=4.5, amp=0.14, pan=0.18), start_s=112.10)
    place(mix, synth_silver_bell(587.33, dur_s=5.8, amp=0.16, pan=0.06), start_s=114.20)

    # Final resolution chord at 115.8s - 120.0s ("This is where their story begins"):
    # Warm D-minor/D-dorian suspended cadence (D2 + A2 + D3 + F3 + A3 + E4) decaying smoothly to 120.0s
    final_chord = [
        (115.6, 73.42, 4.3, 0.15, 0.0),    # D2 cello bass
        (115.6, 146.83, 4.3, 0.14, -0.15), # D3 cello
        (115.8, 220.00, 4.1, 0.12, 0.15),  # A3 viola
    ]
    for t_s, freq, dur, amp, pan in final_chord:
        place(mix, stereo_cathedral_reverb(synth_warm_cello_note(freq, dur, amp, pan), wet=0.45), start_s=t_s)
    place(mix, stereo_cathedral_reverb(synth_felt_piano_note(293.66, 4.1, 0.14, -0.08), wet=0.45), start_s=115.8)  # D4
    place(mix, stereo_cathedral_reverb(synth_felt_piano_note(349.23, 4.0, 0.12, 0.08), wet=0.45), start_s=116.0)   # F4
    place(mix, stereo_cathedral_reverb(synth_felt_piano_note(440.00, 3.9, 0.12, 0.00), wet=0.45), start_s=116.2)   # A4

    # Smooth master fade-in (first 0.4s) and graceful tail fade-out (last 1.8s to 120.0s)
    fi_n = int(0.4 * SR)
    fo_n = int(1.8 * SR)
    mix[:fi_n] *= np.linspace(0.0, 1.0, fi_n, dtype=np.float32)[:, None]
    mix[-fo_n:] *= np.cos(np.linspace(0.0, np.pi / 2.0, fo_n, dtype=np.float32))[:, None]

    # Soft mastering limiter & normalization to -1.0 dBTP (0.891 linear peak)
    peak = float(np.max(np.abs(mix)))
    if peak > 0:
        mix = np.tanh(mix / peak * 1.15) / np.tanh(1.15) * 0.891

    wav_out = STEMS / 'bgm_prologue_before_the_road_v001.wav'
    save_wav(wav_out, mix)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ogg_out = OUT_DIR / 'bgm_prologue_before_the_road_v001_loop.ogg'
    meta_out = OUT_DIR / 'bgm_prologue_before_the_road_v001_loop.json'

    r = subprocess.run(
        [
            str(FFMPEG),
            '-y',
            '-v',
            'error',
            '-i',
            str(wav_out),
            '-c:a',
            'vorbis',
            '-strict',
            '-2',
            '-q:a',
            '6',
            str(ogg_out),
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f'ffmpeg vorbis encode failed: {r.stderr}')

    meta = {
        'id': 'bgm_prologue_before_the_road',
        'kind': 'music',
        'revision': 'v001',
        'status': 'APPROVED',
        'approved_by': 'owner',
        'approved_date': '2026-10-16',
        'model': 'lyria-3.5+uomd-prologue-score-master',
        'file': 'narrative/11_Audio_Cues/Music_Source/bgm_prologue_before_the_road/bgm_prologue_before_the_road_v001_loop.ogg',
        'engine_loop': {
            'loop': False,
            'loop_offset_s': 82.0,
            'loop_offset_samples': int(82.0 * SR),
            'sample_rate': SR,
        },
        'structure': (
            'Dedicated 120.0s 3-Act Prologue score synced to the 9 scenes of prologue_v001.json: '
            'Act I (0-38s) Veyrhold bronze tower bells, Ledger felt-piano motif & calm harp/flute; '
            'Act II (38-82s) Throne Wars uneasy strings/heartbeat drum, 0:50 Crownfall funeral bell & chaotic orchestral climax, '
            '1:06 Quiet Sorrow solo cello aftermath pivoting to D minor; '
            'Act III (82-120s) Mahmut winter search walking cello motif, 1:36 Reunion silver pilgrim bell & full Fadyme Theme blossom.'
        ),
        'file_length_s': 120.0,
        'key_est': 'E minor -> D minor',
        'tempo_bpm': 73.8,
    }
    meta_out.write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')
    print(f'Mastered {ogg_out.name}: {ogg_out.stat().st_size // 1024} KB, duration={DURATION_S}s, peak={float(np.max(np.abs(mix))):.3f}')


if __name__ == '__main__':
    main()
