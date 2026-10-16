#!/usr/bin/env python3
"""
Unaware of My Demise — Complete Lyria 3.5 Soundtrack & Main Theme Builder
=========================================================================
1. Supports live `lyria-3.5` API generation via the Google Gemini Interactions API
   (`https://generativelanguage.googleapis.com/v1beta/interactions`, `model: "lyria-3.5"`)
   when `--live-lyria` and `GEMINI_API_KEY` / `GOOGLE_API_KEY` are provided.
2. Uses the authentic `lyria-3.5` stems in `.cache/audio_stems/` together with custom
   instrument synthesis (weeping clean & tube-overdriven electric guitar inspired by
   the melancholic Turkish alt-rock ballad spirit of "Duman - Haberin Yok Oluyorum",
   solo cello, fretless bass, slow vintage ballad drums, and silver/bronze bells) to
   master all playable `.ogg` tracks for:
   - Main Theme (`bgm_main_theme` — "Unaware of My Demise")
   - Battle Tracks (`bgm_battle_field`, `bgm_battle_stone_crossing`, `bgm_battle_shelter_climax`)
   - Pre-Battle & Post-Battle Story Cutscenes (`bgm_ch1_ash_forest_uneasy`,
     `bgm_cutscene_ambush_tension`, `bgm_mahmut_road_march`,
     `bgm_aftermath_quiet_relief`, `bgm_shelter_hearth_warmth`)
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import shutil
import subprocess
import urllib.request
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
STEMS_DIR = ROOT / ".cache" / "audio_stems"
AUDIO_OUT_DIR = ROOT / "content" / "base" / "audio"
MUSIC_SRC_DIR = ROOT / "narrative" / "11_Audio_Cues" / "Music_Source"
FFMPEG_CANDIDATES = [
    shutil.which("ffmpeg"),
    r"C:\Program Files\BlueStacks_nxt\ffmpeg.exe",
]
SR = 44100

LYRIA_3_5_PROMPTS: dict[str, str] = {
    "bgm_main_theme": (
        "Genre: Dark gothic anime alternative-rock ballad meets intimate chamber orchestra "
        "(emotional spirit inspired by melancholic Turkish anatomical rock ballads like Duman, "
        "original composition for Unaware of My Demise).\n"
        "Mood: Heartbreakingly tender, stoic devotion, quiet secret grief hidden behind a warm smile, "
        "weeping nocturnal longing, unforgettable cinematic catharsis.\n"
        "Key: D minor (natural minor with expressive Dorian B-natural and Phrygian-dominant C# leading tone "
        "on A7b9 cadences). Tempo: 73.8 BPM, 4/4.\n"
        "Instruments: Lonely reverb-drenched clean vintage tube electric guitar playing broken D-minor arpeggios, "
        "warm melodic fretless electric bass, felt upright piano, mournful solo cello, lush chamber strings, "
        "slow heavy vintage ballad drums (deep kick heartbeat, cavernous rimshot/snare on beat 3, soft ride shimmer), "
        "crying sustained tube-overdriven electric lead guitar with slow pitch bends and tape delay in the chorus, "
        "and a distant delicate silver pilgrim bell answering a low bronze bell.\n"
        "Structure: 0:00-0:24 intimate lonely clean electric guitar arpeggio, fretless bass, and distant silver bell; "
        "0:24-0:52 weeping low-register electric guitar and solo cello state the main melody over slow ballad drums; "
        "0:52-1:32 full emotional chorus surge where crying overdriven lead guitar and solo cello soar in octave unison "
        "over chamber strings and heavy slow rock-ballad drums; 1:32-1:52 subsides into lonely guitar arpeggio and cello "
        "sigh for a seamless loop.\n"
        "Production: Warm analog tube saturation, wide stereo hall reverb, zero vocals, 44.1 kHz stereo."
    ),
    "bgm_battle_stone_crossing": (
        "Genre: Dark gothic tactical RPG battle score — vanguard skirmish variation.\n"
        "Mood: Urgent, disciplined, metallic, tactical tension.\n"
        "Key: C minor, 129.2 BPM, 4/4.\n"
        "Instruments: Aggressive spiccato cello/viola ostinato, deep war drums, syncopated iron chain and tarnished "
        "bronze bell percussion, low brass stabs, and a bright silver warding-bell & solo violin counter-melody."
    ),
    "bgm_battle_shelter_climax": (
        "Genre: Dark gothic anime climactic battle score fusing chamber orchestra with crying overdriven rock lead guitar.\n"
        "Mood: Desperate protective resolve, fighting through the twilight mist to secure a shelter before nightfall.\n"
        "Key: C minor / D minor modulation, 129.2 BPM, 4/4.\n"
        "Instruments: Driving taiko and frame drums, frantic string ostinatos, low brass, and a soaring overdriven "
        "lead electric guitar + solo cello duet quoting the Unaware of My Demise main theme motif in combat tempo."
    ),
    "bgm_cutscene_ambush_tension": (
        "Genre: Dark gothic anime pre-battle ambush tension cue.\n"
        "Mood: Hushed danger, rusted bells chiming against bone in the ditch, shields raised.\n"
        "Key: E minor, 88 BPM, 4/4.\n"
        "Instruments: Low cello/bass drone, sul ponticello string tremolos, accelerating heartbeat frame drum, "
        "and eerie metallic bone-bell chimes."
    ),
    "bgm_mahmut_road_march": (
        "Genre: Dark gothic anime twilight road march.\n"
        "Mood: Weathered companionship, tired boots on damp stone, quiet resolve as dusk settles.\n"
        "Key: D minor / G minor, 76 BPM, 4/4.\n"
        "Instruments: Walking pizzicato bass and muted frame drum, warm nylon acoustic guitar, noble muted French horn, "
        "and solo viola/cello."
    ),
    "bgm_aftermath_quiet_relief": (
        "Genre: Dark gothic anime post-battle relief and quiet tenderness.\n"
        "Mood: Exhaling after first steel, ash leaves drifting down, quiet care between companions.\n"
        "Key: E minor to G major, 68 BPM, 4/4.\n"
        "Instruments: Fingerpicked acoustic guitar, warm solo cello, breathy alto flute, and soft felt piano."
    ),
    "bgm_shelter_hearth_warmth": (
        "Genre: Intimate anime visual novel chamber warmth.\n"
        "Mood: A dry stone corner out of the wind, sharing half a loaf of bread on a spread red cloak.\n"
        "Key: D minor to F major, 72 BPM, 4/4.\n"
        "Instruments: Intimate nylon guitar arpeggios, felt piano, tender solo violin and cello duet."
    ),
}


def find_ffmpeg() -> str:
    for cand in FFMPEG_CANDIDATES:
        if cand and Path(cand).exists():
            return str(cand)
    raise RuntimeError("No ffmpeg binary found.")


def load_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as wf:
        ch = wf.getnchannels()
        sr = wf.getframerate()
        n = wf.getnframes()
        raw = wf.readframes(n)
    data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if ch == 2:
        data = data.reshape(-1, 2)
    else:
        data = np.column_stack([data, data])
    if sr != SR:
        old_idx = np.linspace(0, 1, len(data))
        new_len = int(len(data) * SR / sr)
        new_idx = np.linspace(0, 1, new_len)
        left = np.interp(new_idx, old_idx, data[:, 0])
        right = np.interp(new_idx, old_idx, data[:, 1])
        data = np.column_stack([left, right]).astype(np.float32)
    return data


def save_wav_and_ogg(stereo: np.ndarray, wav_path: Path, ogg_path: Path) -> None:
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    ogg_path.parent.mkdir(parents=True, exist_ok=True)
    peak = float(np.max(np.abs(stereo)))
    if peak > 1e-6:
        stereo = stereo * (0.91 / peak)
    stereo = np.clip(stereo, -0.98, 0.98)
    pcm = (stereo * 32767.0).astype(np.int16)
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())
    ffmpeg = find_ffmpeg()
    subprocess.run(
        [ffmpeg, "-y", "-v", "error", "-i", str(wav_path), "-c:a", "vorbis", "-strict", "-2", "-q:a", "6", str(ogg_path)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def midi_to_freq(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def apply_stereo_delay_reverb(
    stereo: np.ndarray,
    delay_l_s: float = 0.28,
    delay_r_s: float = 0.41,
    feedback: float = 0.34,
    wet: float = 0.32,
) -> np.ndarray:
    n = len(stereo)
    out = stereo.copy()
    dl = int(delay_l_s * SR)
    dr = int(delay_r_s * SR)
    buf_l = np.zeros(n, dtype=np.float32)
    buf_r = np.zeros(n, dtype=np.float32)
    src_l = stereo[:, 0]
    src_r = stereo[:, 1]
    for k in range(1, 5):
        gain = (feedback ** k)
        shift_l = dl * k
        shift_r = dr * k
        if shift_l < n:
            buf_l[shift_l:] += src_l[: n - shift_l] * gain
        if shift_r < n:
            buf_r[shift_r:] += src_r[: n - shift_r] * gain
    # Cross-feed for lush stereo width
    out[:, 0] = src_l + wet * (buf_l * 0.8 + buf_r * 0.35)
    out[:, 1] = src_r + wet * (buf_r * 0.8 + buf_l * 0.35)
    return out


def add_clean_tube_guitar_note(
    mix: np.ndarray,
    start_s: float,
    dur_s: float,
    midi: float,
    amp: float = 0.12,
    pan: float = 0.0,
    slide_from_midi: float | None = None,
    vibrato_depth: float = 0.12,
) -> None:
    i0 = int(start_s * SR)
    n = int(dur_s * SR)
    if i0 >= len(mix) or n <= 0:
        return
    i1 = min(len(mix), i0 + n)
    n = i1 - i0
    t = np.arange(n, dtype=np.float32) / SR

    if slide_from_midi is not None:
        slide_t = np.clip(t / min(0.14, dur_s * 0.35), 0.0, 1.0)
        cur_midi = slide_from_midi + (midi - slide_from_midi) * (1.0 - (1.0 - slide_t) ** 2)
    else:
        cur_midi = np.full_like(t, midi)

    # Subtle delayed vibrato on sustained notes
    vib_env = np.clip((t - 0.18) / 0.25, 0.0, 1.0)
    cur_midi = cur_midi + vibrato_depth * vib_env * np.sin(2.0 * math.pi * 5.2 * t)
    freqs = 440.0 * (2.0 ** ((cur_midi - 69.0) / 12.0))
    phase = 2.0 * math.pi * np.cumsum(freqs) / SR

    # Plucked warm electric guitar timbre (neck pickup + warm tube saturation)
    sig = (
        1.00 * np.sin(phase)
        + 0.48 * np.sin(2.0 * phase + 0.3) * np.exp(-t * 1.8)
        + 0.24 * np.sin(3.0 * phase + 0.7) * np.exp(-t * 2.9)
        + 0.11 * np.sin(4.0 * phase + 1.1) * np.exp(-t * 4.2)
        + 0.05 * np.sin(5.0 * phase) * np.exp(-t * 6.0)
    )
    # Pick transient warmth
    pick = np.sin(phase * 6.0) * np.exp(-t * 45.0) * 0.18
    sig = np.tanh((sig + pick) * 1.45) / 1.25

    attack = np.clip(t / 0.012, 0.0, 1.0)
    decay = np.exp(-t / max(0.35, dur_s * 0.72))
    rel = np.clip((dur_s - t) / 0.06, 0.0, 1.0)
    env = attack * decay * rel * amp

    gl = math.sqrt(0.5 * (1.0 - pan))
    gr = math.sqrt(0.5 * (1.0 + pan))
    mix[i0:i1, 0] += sig * env * gl
    mix[i0:i1, 1] += sig * env * gr


def add_weeping_lead_guitar_note(
    mix: np.ndarray,
    start_s: float,
    dur_s: float,
    midi: float,
    amp: float = 0.15,
    pan: float = -0.12,
    bend_semitones: float = 0.0,
    bend_peak_ratio: float = 0.28,
    vibrato_semitones: float = 0.22,
) -> None:
    """
    Warm, weeping tube-overdriven lead electric guitar with expressive pitch-bends
    and soulful vibrato (inspired by Turkish melancholic rock ballad lead phrasing).
    """
    i0 = int(start_s * SR)
    n = int(dur_s * SR)
    if i0 >= len(mix) or n <= 0:
        return
    i1 = min(len(mix), i0 + n)
    n = i1 - i0
    t = np.arange(n, dtype=np.float32) / SR

    cur_midi = np.full_like(t, midi)
    if abs(bend_semitones) > 1e-4:
        t_peak = max(0.06, dur_s * bend_peak_ratio)
        up = np.clip(t / t_peak, 0.0, 1.0)
        bend_curve = np.sin(up * (math.pi / 2.0))
        cur_midi = cur_midi - bend_semitones * (1.0 - bend_curve)

    vib_onset = np.clip((t - 0.14) / 0.22, 0.0, 1.0)
    cur_midi = cur_midi + vibrato_semitones * vib_onset * np.sin(2.0 * math.pi * 5.6 * t)

    freqs = 440.0 * (2.0 ** ((cur_midi - 69.0) / 12.0))
    phase = 2.0 * math.pi * np.cumsum(freqs) / SR

    # Singing tube overdrive harmonic structure + cabinet low-pass warmth
    raw = (
        1.00 * np.sin(phase)
        + 0.62 * np.sin(2.0 * phase + 0.2)
        + 0.38 * np.sin(3.0 * phase + 0.5) * np.exp(-t * 0.9)
        + 0.18 * np.sin(4.0 * phase + 0.9) * np.exp(-t * 1.6)
    )
    driven = np.tanh(raw * 2.15) * 0.78
    # Smooth cabinet warmth via 1-pole low-pass around 2.8 kHz
    alpha = 1.0 - math.exp(-2.0 * math.pi * 2700.0 / SR)
    cab = np.zeros_like(driven)
    acc = 0.0
    for idx in range(n):
        acc += alpha * (float(driven[idx]) - acc)
        cab[idx] = acc

    attack = np.clip(t / 0.035, 0.0, 1.0)
    sustain = np.exp(-t / max(0.85, dur_s * 1.15))
    rel = np.clip((dur_s - t) / 0.09, 0.0, 1.0)
    env = attack * sustain * rel * amp

    gl = math.sqrt(0.5 * (1.0 - pan))
    gr = math.sqrt(0.5 * (1.0 + pan))
    mix[i0:i1, 0] += cab * env * gl
    mix[i0:i1, 1] += cab * env * gr


def add_solo_cello_note(
    mix: np.ndarray,
    start_s: float,
    dur_s: float,
    midi: float,
    amp: float = 0.13,
    pan: float = 0.18,
    slide_from_midi: float | None = None,
) -> None:
    i0 = int(start_s * SR)
    n = int(dur_s * SR)
    if i0 >= len(mix) or n <= 0:
        return
    i1 = min(len(mix), i0 + n)
    n = i1 - i0
    t = np.arange(n, dtype=np.float32) / SR

    if slide_from_midi is not None:
        s_env = np.clip(t / min(0.18, dur_s * 0.3), 0.0, 1.0)
        cur_midi = slide_from_midi + (midi - slide_from_midi) * s_env
    else:
        cur_midi = np.full_like(t, midi)

    vib = 0.18 * np.clip((t - 0.12) / 0.25, 0.0, 1.0) * np.sin(2.0 * math.pi * 5.1 * t)
    freqs = 440.0 * (2.0 ** ((cur_midi + vib - 69.0) / 12.0))
    phase = 2.0 * math.pi * np.cumsum(freqs) / SR

    sig = (
        1.00 * np.sin(phase)
        + 0.52 * np.sin(2.0 * phase + 0.4)
        + 0.29 * np.sin(3.0 * phase + 0.8)
        + 0.14 * np.sin(4.0 * phase + 1.2)
        + 0.07 * np.sin(5.0 * phase + 1.7)
    )
    sig = np.tanh(sig * 1.2) * 0.85

    att = np.clip(t / min(0.18, dur_s * 0.25), 0.0, 1.0)
    rel = np.clip((dur_s - t) / min(0.22, dur_s * 0.28), 0.0, 1.0)
    swell = 0.82 + 0.18 * np.sin(math.pi * np.clip(t / dur_s, 0.0, 1.0))
    env = att * rel * swell * amp

    gl = math.sqrt(0.5 * (1.0 - pan))
    gr = math.sqrt(0.5 * (1.0 + pan))
    mix[i0:i1, 0] += sig * env * gl
    mix[i0:i1, 1] += sig * env * gr


def add_fretless_bass_note(
    mix: np.ndarray,
    start_s: float,
    dur_s: float,
    midi: float,
    amp: float = 0.16,
    slide_from_midi: float | None = None,
) -> None:
    i0 = int(start_s * SR)
    n = int(dur_s * SR)
    if i0 >= len(mix) or n <= 0:
        return
    i1 = min(len(mix), i0 + n)
    n = i1 - i0
    t = np.arange(n, dtype=np.float32) / SR

    if slide_from_midi is not None:
        s_env = np.clip(t / min(0.16, dur_s * 0.35), 0.0, 1.0)
        cur_midi = slide_from_midi + (midi - slide_from_midi) * s_env
    else:
        cur_midi = np.full_like(t, midi)

    freqs = 440.0 * (2.0 ** ((cur_midi - 69.0) / 12.0))
    phase = 2.0 * math.pi * np.cumsum(freqs) / SR
    sig = (
        1.00 * np.sin(phase)
        + 0.42 * np.sin(2.0 * phase + 0.2) * np.exp(-t * 1.6)
        + 0.16 * np.sin(3.0 * phase + 0.5) * np.exp(-t * 2.8)
    )
    sig = np.tanh(sig * 1.35) * 0.85
    att = np.clip(t / 0.018, 0.0, 1.0)
    dec = np.exp(-t / max(0.55, dur_s * 0.85))
    rel = np.clip((dur_s - t) / 0.07, 0.0, 1.0)
    env = att * dec * rel * amp
    mix[i0:i1, 0] += sig * env * 0.72
    mix[i0:i1, 1] += sig * env * 0.72


def add_ballad_drum_hit(
    mix: np.ndarray,
    start_s: float,
    kind: str,
    amp: float = 0.14,
    pan: float = 0.0,
) -> None:
    i0 = int(start_s * SR)
    if i0 >= len(mix):
        return
    rng = np.random.default_rng(int(start_s * 1000) + (1 if kind == "kick" else 2))
    if kind == "kick":
        dur = 0.42
        n = min(len(mix) - i0, int(dur * SR))
        t = np.arange(n, dtype=np.float32) / SR
        freq = 46.0 + 78.0 * np.exp(-t * 28.0)
        phase = 2.0 * math.pi * np.cumsum(freq) / SR
        sig = np.sin(phase) * np.exp(-t * 7.8) + 0.18 * np.sin(2.0 * phase) * np.exp(-t * 18.0)
        sig = np.tanh(sig * 1.5) * amp
        mix[i0 : i0 + n, 0] += sig * 0.72
        mix[i0 : i0 + n, 1] += sig * 0.72
    elif kind == "snare" or kind == "rim":
        dur = 0.55 if kind == "snare" else 0.32
        n = min(len(mix) - i0, int(dur * SR))
        t = np.arange(n, dtype=np.float32) / SR
        body_f = 168.0 if kind == "snare" else 390.0
        body = np.sin(2.0 * math.pi * body_f * t) * np.exp(-t * (18.0 if kind == "snare" else 36.0))
        noise = rng.standard_normal(n).astype(np.float32)
        # Band-limited reverb snare tail
        tail = noise * np.exp(-t * (7.5 if kind == "snare" else 16.0)) * (0.55 if kind == "snare" else 0.22)
        sig = (body * 0.65 + tail) * amp
        gl = math.sqrt(0.5 * (1.0 - pan))
        gr = math.sqrt(0.5 * (1.0 + pan))
        mix[i0 : i0 + n, 0] += sig * gl
        mix[i0 : i0 + n, 1] += sig * gr
    elif kind == "ride":
        dur = 0.38
        n = min(len(mix) - i0, int(dur * SR))
        t = np.arange(n, dtype=np.float32) / SR
        metallic = (
            np.sin(2.0 * math.pi * 3120.0 * t)
            + 0.7 * np.sin(2.0 * math.pi * 4680.0 * t)
            + 0.5 * np.sin(2.0 * math.pi * 6950.0 * t)
        ) * 0.35
        sig = metallic * np.exp(-t * 12.0) * amp
        gl = math.sqrt(0.5 * (1.0 - pan))
        gr = math.sqrt(0.5 * (1.0 + pan))
        mix[i0 : i0 + n, 0] += sig * gl
        mix[i0 : i0 + n, 1] += sig * gr


def add_bell_chime(
    mix: np.ndarray,
    start_s: float,
    midi: float,
    dur_s: float = 3.2,
    amp: float = 0.08,
    pan: float = 0.25,
    bronze: bool = False,
) -> None:
    i0 = int(start_s * SR)
    n = int(dur_s * SR)
    if i0 >= len(mix) or n <= 0:
        return
    i1 = min(len(mix), i0 + n)
    n = i1 - i0
    t = np.arange(n, dtype=np.float32) / SR
    f0 = midi_to_freq(midi)
    if bronze:
        sig = (
            1.00 * np.sin(2.0 * math.pi * f0 * t) * np.exp(-t * 0.9)
            + 0.55 * np.sin(2.0 * math.pi * f0 * 1.5 * t) * np.exp(-t * 1.4)
            + 0.40 * np.sin(2.0 * math.pi * f0 * 2.02 * t) * np.exp(-t * 1.9)
            + 0.22 * np.sin(2.0 * math.pi * f0 * 2.98 * t) * np.exp(-t * 2.8)
        )
    else:
        sig = (
            1.00 * np.sin(2.0 * math.pi * f0 * t) * np.exp(-t * 1.3)
            + 0.48 * np.sin(2.0 * math.pi * f0 * 2.0 * t) * np.exp(-t * 2.1)
            + 0.28 * np.sin(2.0 * math.pi * f0 * 3.01 * t) * np.exp(-t * 3.4)
        )
    att = np.clip(t / 0.008, 0.0, 1.0)
    rel = np.clip((dur_s - t) / 0.15, 0.0, 1.0)
    env = att * rel * amp
    gl = math.sqrt(0.5 * (1.0 - pan))
    gr = math.sqrt(0.5 * (1.0 + pan))
    mix[i0:i1, 0] += sig * env * gl
    mix[i0:i1, 1] += sig * env * gr


def fit_stem_length(stem: np.ndarray, target_samples: int, offset_s: float = 0.0) -> np.ndarray:
    start = int(offset_s * SR) % len(stem)
    rolled = np.roll(stem, -start, axis=0)
    if len(rolled) >= target_samples:
        return rolled[:target_samples].copy()
    out = np.zeros((target_samples, 2), dtype=np.float32)
    pos = 0
    while pos < target_samples:
        chunk = min(len(rolled), target_samples - pos)
        out[pos : pos + chunk] = rolled[:chunk]
        pos += chunk
    return out


def make_loop_seamless(stereo: np.ndarray, loop_start_s: float, crossfade_s: float = 2.4) -> np.ndarray:
    out = stereo.copy()
    xf = int(crossfade_s * SR)
    ls = int(loop_start_s * SR)
    if ls + xf >= len(out) or xf <= 0:
        return out
    alpha = np.linspace(0.0, 1.0, xf, dtype=np.float32)[:, None]
    # Blend the end of the file into the region right before loop_start so jumping to loop_start is click-free
    pre_loop = out[max(0, ls - xf) : ls]
    if len(pre_loop) == xf:
        out[-xf:] = out[-xf:] * (1.0 - alpha) + pre_loop * alpha
    return out


def build_main_theme(fadyme_orig: np.ndarray) -> tuple[np.ndarray, float, float]:
    """
    Composes & masters `bgm_main_theme` ("Unaware of My Demise"):
    - 73.8 BPM in D minor (bar = 3.2520325s, beat = 0.813008s)
    - 34 bars = 110.57s, loop_start_s = 13.01s (Bar 4)
    - Built on the untouched Lyria 3.5 D-minor harmonic bed (`fadyme_original.wav`),
      layered with lonely clean tube electric guitar arpeggios, melodic fretless bass,
      slow vintage ballad drums, and a weeping tube-overdriven lead electric guitar +
      solo cello duet inspired by the emotional spirit of "Duman - Haberin Yok Oluyorum".
    """
    bpm = 73.8
    beat = 60.0 / bpm  # 0.813008s
    bar = beat * 4.0   # 3.2520325s
    total_bars = 34
    dur_s = round(total_bars * bar, 2)  # ~110.57s
    loop_start_s = round(4 * bar, 2)    # ~13.01s
    total_samples = int(dur_s * SR)

    bed = fit_stem_length(fadyme_orig, total_samples, offset_s=0.0) * 0.58
    gtr_bus = np.zeros((total_samples, 2), dtype=np.float32)
    lead_bus = np.zeros((total_samples, 2), dtype=np.float32)
    rhythm_bus = np.zeros((total_samples, 2), dtype=np.float32)

    # D minor progression per 8-bar cycle:
    # Bar 0: Dm9        (D3, A3,E4,F4,A4)
    # Bar 1: Dm/C       (C3, A3,D4,F4,A4)
    # Bar 2: Bbmaj7     (Bb2, F3,D4,F4,A4)
    # Bar 3: Gm6 -> A7  (G2/A2, G3,C#4,E4,G4)
    # Bar 4: Dm         (D3, A3,D4,F4,A4)
    # Bar 5: Bb         (Bb2, F3,Bb3,D4,F4)
    # Bar 6: Gm7        (G2, D3,Bb3,D4,G4)
    # Bar 7: A7(b9)     (A2, E3,C#4,E4,Bb4)
    chord_cycle = [
        (38, [50, 57, 62, 65, 69, 65, 62, 57]),  # Dm
        (36, [48, 57, 62, 65, 69, 65, 62, 57]),  # Dm/C
        (34, [46, 53, 58, 62, 65, 62, 58, 53]),  # Bbmaj7
        (33, [45, 52, 57, 61, 64, 67, 64, 61]),  # A7
        (38, [50, 57, 62, 65, 69, 65, 62, 57]),  # Dm
        (34, [46, 53, 58, 62, 65, 62, 58, 53]),  # Bb
        (31, [43, 50, 55, 58, 62, 67, 62, 58]),  # Gm
        (33, [45, 52, 58, 61, 64, 69, 64, 61]),  # A7(b9)
    ]

    for b in range(total_bars):
        b_start = b * bar
        bass_midi, arp_notes = chord_cycle[b % 8]
        is_intro = b < 4
        is_verse1 = 4 <= b < 12
        is_chorus1 = 12 <= b < 20
        is_bridge = 20 <= b < 24
        is_chorus2 = 24 <= b < 32

        # 1. Clean tube electric guitar broken eighth-note arpeggio (Duman-style lonely clean picking)
        arp_amp = 0.115 if (is_intro or is_verse1 or is_bridge) else 0.085
        for step_idx, note_midi in enumerate(arp_notes):
            note_t = b_start + step_idx * (beat * 0.5)
            accent = 1.18 if step_idx in (0, 4) else 0.88
            pan = -0.22 if (step_idx % 2 == 0) else 0.22
            add_clean_tube_guitar_note(
                gtr_bus,
                note_t,
                dur_s=beat * 0.95,
                midi=note_midi,
                amp=arp_amp * accent,
                pan=pan,
                vibrato_depth=0.08 if step_idx in (3, 7) else 0.03,
            )

        # 2. Melodic Fretless Bass (enters at Bar 2 and carries the warm low end)
        if b >= 2:
            prev_bass = chord_cycle[(b - 1) % 8][0] if b > 2 else bass_midi
            add_fretless_bass_note(
                rhythm_bus,
                b_start,
                dur_s=beat * 2.4,
                midi=bass_midi,
                amp=0.14 if (is_chorus1 or is_chorus2) else 0.10,
                slide_from_midi=prev_bass if prev_bass != bass_midi else None,
            )
            # Expressive fifth/octave pickup on beat 3.5
            add_fretless_bass_note(
                rhythm_bus,
                b_start + beat * 2.5,
                dur_s=beat * 1.4,
                midi=bass_midi + 7 if (b % 2 == 0) else bass_midi + 12,
                amp=0.095,
            )

        # 3. Slow Vintage Rock-Ballad Drum Groove
        if is_verse1 or is_bridge:
            add_ballad_drum_hit(rhythm_bus, b_start, "kick", amp=0.11)
            add_ballad_drum_hit(rhythm_bus, b_start + beat * 2.0, "rim", amp=0.09, pan=-0.08)
            add_ballad_drum_hit(rhythm_bus, b_start + beat * 3.5, "kick", amp=0.075)
            for r_step in range(4):
                add_ballad_drum_hit(rhythm_bus, b_start + r_step * beat, "ride", amp=0.035, pan=0.25)
        elif is_chorus1 or is_chorus2:
            add_ballad_drum_hit(rhythm_bus, b_start, "kick", amp=0.15)
            add_ballad_drum_hit(rhythm_bus, b_start + beat * 1.5, "kick", amp=0.10)
            add_ballad_drum_hit(rhythm_bus, b_start + beat * 2.0, "snare", amp=0.135, pan=-0.06)
            add_ballad_drum_hit(rhythm_bus, b_start + beat * 3.5, "kick", amp=0.11)
            for r_step in range(8):
                add_ballad_drum_hit(rhythm_bus, b_start + r_step * beat * 0.5, "ride", amp=0.045, pan=0.28)

    # 4. Expressive Melodic Phrases (Weeping Lead Electric Guitar + Solo Cello)
    # Verse 1 (Bars 4..11): Intimate low-register weeping guitar melody answered by solo cello
    # Notes are tuples: (bar_offset, beat_offset, duration_beats, midi, bend_semi)
    verse_melody = [
        # Bar 4 (Dm): Lonely opening sigh — A4 -> Bb4 (bend) -> A4 -> F4 -> D4
        (4, 0.0, 1.5, 69, 0.0),
        (4, 1.5, 1.0, 70, 1.0),
        (4, 2.5, 1.5, 69, 0.0),
        # Bar 5 (Dm/C): G4 -> F4 -> E4 -> D4
        (5, 0.0, 1.5, 67, 0.0),
        (5, 1.5, 1.0, 65, 0.0),
        (5, 2.5, 1.5, 62, 0.0),
        # Bar 6 (Bbmaj7): F4 -> Bb4 (weeping bend) -> A4 -> G4
        (6, 0.5, 1.5, 65, 0.0),
        (6, 2.0, 1.2, 70, 2.0),
        (6, 3.2, 0.8, 69, 0.0),
        # Bar 7 (A7): G4 -> F4 -> E4 -> C#4
        (7, 0.0, 2.0, 67, 1.0),
        (7, 2.0, 2.0, 61, 0.0),
        # Bar 8 (Dm): A4 -> D5 (soulful bend) -> C5 -> Bb4
        (8, 0.0, 1.5, 69, 0.0),
        (8, 1.5, 1.5, 74, 2.0),
        (8, 3.0, 1.0, 72, 0.0),
        # Bar 9 (Bb): Bb4 -> A4 -> G4 -> F4
        (9, 0.0, 1.5, 70, 0.0),
        (9, 1.5, 1.2, 69, 0.0),
        (9, 2.7, 1.3, 65, 0.0),
        # Bar 10 (Gm): G4 -> Bb4 -> A4 -> G4 -> F4
        (10, 0.0, 1.5, 67, 0.0),
        (10, 1.5, 1.5, 70, 1.0),
        (10, 3.0, 1.0, 67, 0.0),
        # Bar 11 (A7b9): E4 -> F4 -> E4 -> D4 (resolving into Chorus)
        (11, 0.0, 1.5, 64, 0.0),
        (11, 1.5, 1.0, 65, 1.0),
        (11, 2.5, 1.5, 64, 0.0),
    ]
    for b_idx, bt, dur_b, midi, bend in verse_melody:
        t0 = b_idx * bar + bt * beat
        dur = dur_b * beat
        add_weeping_lead_guitar_note(lead_bus, t0, dur, midi, amp=0.115, pan=-0.15, bend_semitones=bend)
        add_solo_cello_note(lead_bus, t0 + 0.02, dur, midi - 12, amp=0.095, pan=0.22)

    # Chorus 1 (Bars 12..19) & Chorus 2 (Bars 24..31):
    # "Unaware of My Demise" soaring crying guitar + cello emotional peak
    chorus_pattern = [
        # Bar +0 (Dm): D5 -> F5 (weeping whole-step bend!) -> E5 -> D5
        (0, 0.0, 1.5, 74, 2.0),
        (0, 1.5, 1.5, 77, 2.0),
        (0, 3.0, 1.0, 76, 0.0),
        # Bar +1 (Dm/C): D5 -> C5 -> A4 -> C5
        (1, 0.0, 1.5, 74, 0.0),
        (1, 1.5, 1.5, 72, 0.0),
        (1, 3.0, 1.0, 69, 0.0),
        # Bar +2 (Bbmaj7): Bb4 -> D5 -> F5 -> E5 -> D5
        (2, 0.0, 1.2, 70, 0.0),
        (2, 1.2, 1.5, 74, 2.0),
        (2, 2.7, 1.3, 77, 1.0),
        # Bar +3 (A7): E5 -> C#5 -> A4 (Anatolian-gothic cadence)
        (3, 0.0, 2.0, 76, 1.0),
        (3, 2.0, 2.0, 73, 0.0),
        # Bar +4 (Dm): D5 -> A5 (climactic cry!) -> G5 -> F5
        (4, 0.0, 1.2, 74, 0.0),
        (4, 1.2, 1.8, 81, 2.0),
        (4, 3.0, 1.0, 79, 0.0),
        # Bar +5 (Bb): F5 -> E5 -> D5 -> C5
        (5, 0.0, 1.5, 77, 0.0),
        (5, 1.5, 1.5, 74, 1.0),
        (5, 3.0, 1.0, 72, 0.0),
        # Bar +6 (Gm): Bb4 -> D5 (bend) -> C5 -> Bb4 -> G4
        (6, 0.0, 1.5, 70, 0.0),
        (6, 1.5, 1.5, 74, 2.0),
        (6, 3.0, 1.0, 70, 0.0),
        # Bar +7 (A7b9 -> Dm): A4 -> Bb4 -> A4 -> G4 -> F4 -> E4 -> D4
        (7, 0.0, 1.5, 69, 1.0),
        (7, 1.5, 1.2, 67, 0.0),
        (7, 2.7, 1.3, 62, 0.0),
    ]
    for chorus_base in (12, 24):
        boost = 1.0 if chorus_base == 12 else 1.14
        for rel_b, bt, dur_b, midi, bend in chorus_pattern:
            t0 = (chorus_base + rel_b) * bar + bt * beat
            dur = dur_b * beat
            add_weeping_lead_guitar_note(
                lead_bus, t0, dur, midi, amp=0.145 * boost, pan=-0.10, bend_semitones=bend, vibrato_semitones=0.26
            )
            add_solo_cello_note(lead_bus, t0 + 0.015, dur, midi - 12, amp=0.115 * boost, pan=0.20)
            # High harmonic shimmer in Chorus 2
            if chorus_base == 24 and rel_b in (0, 2, 4, 6):
                add_solo_cello_note(lead_bus, t0, dur, midi, amp=0.055, pan=0.32)

    # Bridge (Bars 20..23): Intimate cello & clean guitar dialogue + Fadyme's silver bell
    bridge_notes = [
        (20, 0.0, 2.0, 62),
        (20, 2.0, 2.0, 65),
        (21, 0.0, 2.0, 69),
        (21, 2.0, 2.0, 67),
        (22, 0.0, 2.0, 65),
        (22, 2.0, 2.0, 64),
        (23, 0.0, 4.0, 69),
    ]
    for b_idx, bt, dur_b, midi in bridge_notes:
        t0 = b_idx * bar + bt * beat
        add_solo_cello_note(lead_bus, t0, dur_b * beat, midi, amp=0.12, pan=0.10)
        add_clean_tube_guitar_note(lead_bus, t0 + beat * 0.5, dur_b * beat * 0.8, midi + 12, amp=0.08, pan=-0.20)

    # Signature Bell Motifs (Veyrhold bronze bell in D3 + Fadyme's silver thorn-bell in A5/D6)
    for b_bell in (0, 4, 12, 20, 24, 32):
        t_bell = b_bell * bar
        add_bell_chime(lead_bus, t_bell, midi=50, dur_s=4.0, amp=0.055, pan=-0.25, bronze=True)
        add_bell_chime(lead_bus, t_bell + beat * 2.0, midi=81, dur_s=3.0, amp=0.045, pan=0.28, bronze=False)

    gtr_wet = apply_stereo_delay_reverb(gtr_bus, delay_l_s=0.30, delay_r_s=0.45, feedback=0.32, wet=0.35)
    lead_wet = apply_stereo_delay_reverb(lead_bus, delay_l_s=0.40, delay_r_s=0.61, feedback=0.38, wet=0.42)

    master = bed + gtr_wet + lead_wet + rhythm_bus
    master = make_loop_seamless(master, loop_start_s=loop_start_s, crossfade_s=2.8)
    return master, loop_start_s, dur_s


def build_battle_stone_crossing(battle_stem: np.ndarray) -> tuple[np.ndarray, float, float]:
    """
    Stage T-2 Battle (`bgm_battle_stone_crossing` — "Vanguard at the Stone Crossing"):
    129.2 BPM in C minor, 79.93s, loop_start_s = 16.70s.
    Builds on the Lyria 3.5 `battle_field.wav` master with syncopated iron-chain/bell
    percussion, driving bass pulse, and Fadyme's silver warding-bell tactical counter-melody.
    """
    bpm = 129.2
    beat = 60.0 / bpm
    bar = beat * 4.0
    total_samples = len(battle_stem)
    dur_s = round(total_samples / SR, 2)
    loop_start_s = 16.70

    layer = np.zeros_like(battle_stem)
    total_bars = int(dur_s / bar)

    # Tactical C-minor silver bell + violin/guitar counter-motif
    motif = [
        (0.0, 1.0, 72),   # C5
        (1.0, 0.5, 75),   # Eb5
        (1.5, 1.0, 79),   # G5
        (2.5, 0.5, 80),   # Ab5
        (3.0, 1.0, 79),   # G5
    ]
    motif_b = [
        (0.0, 1.0, 77),   # F5
        (1.0, 1.0, 75),   # Eb5
        (2.0, 1.0, 74),   # D5
        (3.0, 1.0, 72),   # C5
    ]

    for b in range(total_bars):
        b_t = b * bar
        # Syncopated metallic chain/rim & low war-drum reinforcement
        add_ballad_drum_hit(layer, b_t, "kick", amp=0.11)
        add_ballad_drum_hit(layer, b_t + beat * 1.5, "rim", amp=0.08, pan=-0.25)
        add_ballad_drum_hit(layer, b_t + beat * 2.0, "snare", amp=0.09, pan=0.18)
        add_ballad_drum_hit(layer, b_t + beat * 3.0, "rim", amp=0.075, pan=0.28)
        if b % 4 == 0:
            add_bell_chime(layer, b_t, midi=60, dur_s=2.2, amp=0.055, pan=-0.22, bronze=True)

        if b >= 9 and (b % 4 in (0, 1)):
            pat = motif if (b % 2 == 0) else motif_b
            for bt, dur_b, midi in pat:
                t0 = b_t + bt * beat
                add_bell_chime(layer, t0, midi=midi, dur_s=dur_b * beat * 1.5, amp=0.042, pan=0.24, bronze=False)
                add_solo_cello_note(layer, t0, dur_b * beat, midi - 12, amp=0.085, pan=-0.18)

    layer = apply_stereo_delay_reverb(layer, delay_l_s=0.23, delay_r_s=0.35, feedback=0.28, wet=0.28)
    master = battle_stem * 0.84 + layer
    master = make_loop_seamless(master, loop_start_s=loop_start_s, crossfade_s=1.8)
    return master, loop_start_s, dur_s


def build_battle_shelter_climax(battle_stem: np.ndarray, chaotic_stem: np.ndarray) -> tuple[np.ndarray, float, float]:
    """
    Stage T-3 Finale Battle (`bgm_battle_shelter_climax` — "Stand Before the Shelter"):
    129.2 BPM, 79.93s, loop_start_s = 16.70s.
    Fuses the Lyria 3.5 battle & chaotic forest stems with a high-urgency tube-overdriven
    lead electric guitar & solo cello quoting the "Unaware of My Demise" Main Theme in
    driving combat tempo!
    """
    bpm = 129.2
    beat = 60.0 / bpm
    bar = beat * 4.0
    total_samples = len(battle_stem)
    dur_s = round(total_samples / SR, 2)
    loop_start_s = 16.70

    chaos_layer = fit_stem_length(chaotic_stem, total_samples, offset_s=18.0) * 0.26
    lead_layer = np.zeros_like(battle_stem)
    total_bars = int(dur_s / bar)

    # Main Theme motif adapted to C minor / G Phrygian dominant battle tempo (129.2 BPM)
    heroic_lead = [
        (0, 0.0, 1.5, 72, 2.0),   # C5 (weeping bend)
        (0, 1.5, 1.5, 75, 1.0),   # Eb5
        (0, 3.0, 1.0, 74, 0.0),   # D5
        (1, 0.0, 1.5, 72, 0.0),   # C5
        (1, 1.5, 1.5, 70, 0.0),   # Bb4
        (1, 3.0, 1.0, 67, 0.0),   # G4
        (2, 0.0, 1.5, 68, 0.0),   # Ab4
        (2, 1.5, 1.5, 72, 2.0),   # C5
        (2, 3.0, 1.0, 75, 0.0),   # Eb5
        (3, 0.0, 2.0, 74, 1.0),   # D5
        (3, 2.0, 2.0, 71, 0.0),   # B4 (leading tone)
        (4, 0.0, 1.5, 72, 0.0),   # C5
        (4, 1.5, 1.5, 79, 2.0),   # G5 (climactic cry!)
        (4, 3.0, 1.0, 77, 0.0),   # F5
        (5, 0.0, 1.5, 75, 0.0),   # Eb5
        (5, 1.5, 1.5, 74, 0.0),   # D5
        (5, 3.0, 1.0, 72, 0.0),   # C5
        (6, 0.0, 1.5, 70, 1.0),   # Bb4
        (6, 1.5, 1.5, 68, 0.0),   # Ab4
        (6, 3.0, 1.0, 67, 0.0),   # G4
        (7, 0.0, 4.0, 72, 2.0),   # C5 sustained
    ]

    for b in range(total_bars):
        b_t = b * bar
        add_ballad_drum_hit(lead_layer, b_t, "kick", amp=0.13)
        add_ballad_drum_hit(lead_layer, b_t + beat * 1.0, "kick", amp=0.09)
        add_ballad_drum_hit(lead_layer, b_t + beat * 2.0, "snare", amp=0.12)
        add_ballad_drum_hit(lead_layer, b_t + beat * 3.0, "kick", amp=0.10)

    for cycle_start in (9, 17, 25, 33):
        for rel_b, bt, dur_b, midi, bend in heroic_lead:
            if cycle_start + rel_b >= total_bars:
                continue
            t0 = (cycle_start + rel_b) * bar + bt * beat
            dur = dur_b * beat
            add_weeping_lead_guitar_note(
                lead_layer, t0, dur, midi, amp=0.135, pan=-0.12, bend_semitones=bend, vibrato_semitones=0.25
            )
            add_solo_cello_note(lead_layer, t0, dur, midi - 12, amp=0.10, pan=0.20)

    lead_layer = apply_stereo_delay_reverb(lead_layer, delay_l_s=0.23, delay_r_s=0.35, feedback=0.34, wet=0.34)
    master = battle_stem * 0.78 + chaos_layer + lead_layer
    master = make_loop_seamless(master, loop_start_s=loop_start_s, crossfade_s=1.8)
    return master, loop_start_s, dur_s


def build_cutscene_ambush_tension(uneasy_stem: np.ndarray, chaotic_stem: np.ndarray) -> tuple[np.ndarray, float, float]:
    """
    Pre-Battle T-2 Ambush Escalation (`bgm_cutscene_ambush_tension` — "Bells in the Ditch"):
    88 BPM, 64.0s, loop_start_s = 10.91s.
    """
    bpm = 88.0
    beat = 60.0 / bpm
    bar = beat * 4.0
    total_bars = 24
    dur_s = round(total_bars * bar, 2)
    loop_start_s = round(4 * bar, 2)
    total_samples = int(dur_s * SR)

    bed = (
        fit_stem_length(uneasy_stem, total_samples, offset_s=26.0) * 0.56
        + fit_stem_length(chaotic_stem, total_samples, offset_s=24.0) * 0.36
    )
    pulse = np.zeros_like(bed)

    for b in range(total_bars):
        b_t = b * bar
        # Heartbeat frame-drum double pulse + low E-minor cello/bass ostinato
        add_ballad_drum_hit(pulse, b_t, "kick", amp=0.12)
        add_ballad_drum_hit(pulse, b_t + beat * 0.75, "kick", amp=0.085)
        add_ballad_drum_hit(pulse, b_t + beat * 2.0, "kick", amp=0.11)
        add_ballad_drum_hit(pulse, b_t + beat * 2.75, "rim", amp=0.075, pan=0.22)
        add_fretless_bass_note(pulse, b_t, dur_s=beat * 1.8, midi=40 if (b % 2 == 0) else 39, amp=0.11)
        # Rusted bone-bell chimes from the ditch
        if b % 2 == 1:
            add_bell_chime(pulse, b_t + beat * 1.5, midi=64, dur_s=2.6, amp=0.06, pan=-0.30, bronze=True)
            add_bell_chime(pulse, b_t + beat * 3.0, midi=70, dur_s=2.4, amp=0.05, pan=0.32, bronze=True)
        if b >= 4:
            add_solo_cello_note(
                pulse, b_t + beat * 1.0, dur_s=beat * 2.5, midi=52 if (b % 4 < 2) else 55, amp=0.09, pan=-0.15
            )

    pulse = apply_stereo_delay_reverb(pulse, delay_l_s=0.34, delay_r_s=0.51, feedback=0.35, wet=0.35)
    master = make_loop_seamless(bed + pulse, loop_start_s=loop_start_s, crossfade_s=2.2)
    return master, loop_start_s, dur_s


def build_mahmut_road_march(calm_stem: np.ndarray, fadyme_orig: np.ndarray) -> tuple[np.ndarray, float, float]:
    """
    Pre-Battle T-3 Twilight Road (`bgm_mahmut_road_march` — "Two Cloaks at Dusk"):
    73.8 BPM, 71.54s, loop_start_s = 13.01s.
    Steady walking road cadence with warm nylon/clean guitar, grounded bass, and
    noble low cello/horn melody representing Mahmut's quiet protective stride.
    """
    bpm = 73.8
    beat = 60.0 / bpm
    bar = beat * 4.0
    total_bars = 22
    dur_s = round(total_bars * bar, 2)
    loop_start_s = round(4 * bar, 2)
    total_samples = int(dur_s * SR)

    bed = (
        fit_stem_length(fadyme_orig, total_samples, offset_s=13.01) * 0.48
        + fit_stem_length(calm_stem, total_samples, offset_s=19.8) * 0.28
    )
    march = np.zeros_like(bed)

    roots = [38, 36, 34, 33, 38, 34, 31, 33]
    melody = [
        (0.0, 2.0, 57),  # A3
        (2.0, 1.5, 62),  # D4
        (3.5, 0.5, 64),  # E4
        (4.0, 2.0, 65),  # F4
        (6.0, 2.0, 62),  # D4
        (8.0, 2.0, 58),  # Bb3
        (10.0, 2.0, 62), # D4
        (12.0, 4.0, 57), # A3
    ]

    for b in range(total_bars):
        b_t = b * bar
        r_midi = roots[b % len(roots)]
        # Walking two-step cadence
        add_fretless_bass_note(march, b_t, dur_s=beat * 1.6, midi=r_midi, amp=0.12)
        add_fretless_bass_note(march, b_t + beat * 2.0, dur_s=beat * 1.6, midi=r_midi + 7, amp=0.095)
        add_ballad_drum_hit(march, b_t, "kick", amp=0.095)
        add_ballad_drum_hit(march, b_t + beat * 2.0, "rim", amp=0.065, pan=-0.12)
        # Warm acoustic/clean guitar chords on beats 2 and 4
        add_clean_tube_guitar_note(march, b_t + beat * 1.0, dur_s=beat * 1.4, midi=r_midi + 24, amp=0.085, pan=-0.20)
        add_clean_tube_guitar_note(march, b_t + beat * 3.0, dur_s=beat * 1.4, midi=r_midi + 28, amp=0.080, pan=0.20)

    for cycle_b in (2, 10, 16):
        for bt, dur_b, midi in melody:
            t0 = cycle_b * bar + bt * beat
            if t0 < dur_s - 2.0:
                add_solo_cello_note(march, t0, dur_s=dur_b * beat, midi=midi, amp=0.115, pan=0.10)

    march = apply_stereo_delay_reverb(march, delay_l_s=0.29, delay_r_s=0.43, feedback=0.28, wet=0.30)
    master = make_loop_seamless(bed + march, loop_start_s=loop_start_s, crossfade_s=2.4)
    return master, loop_start_s, dur_s


def build_aftermath_quiet_relief(calm_stem: np.ndarray, fadyme_stem: np.ndarray) -> tuple[np.ndarray, float, float]:
    """
    Post-Battle T-1 Relief (`bgm_aftermath_quiet_relief` — "Ash Brushed from Her Shoulder"):
    66 BPM in E minor / G major warmth, 72.73s, loop_start_s = 14.55s.
    """
    bpm = 66.0
    beat = 60.0 / bpm
    bar = beat * 4.0
    total_bars = 20
    dur_s = round(total_bars * bar, 2)
    loop_start_s = round(4 * bar, 2)
    total_samples = int(dur_s * SR)

    bed = (
        fit_stem_length(calm_stem, total_samples, offset_s=19.8) * 0.62
        + fit_stem_length(fadyme_stem, total_samples, offset_s=14.4) * 0.22
    )
    layer = np.zeros_like(bed)

    # Gentle E minor -> G major -> C major7 -> B7sus4/Bm fingerpicked guitar & warm cello
    chords = [
        [52, 59, 64, 67, 71, 67, 64, 59],  # Em9
        [55, 59, 62, 67, 71, 67, 62, 59],  # Gmaj7
        [48, 55, 60, 64, 67, 64, 60, 55],  # Cmaj7
        [47, 54, 59, 62, 66, 62, 59, 54],  # Bm7
    ]
    for b in range(total_bars):
        b_t = b * bar
        arp = chords[b % 4]
        for idx, m in enumerate(arp):
            add_clean_tube_guitar_note(
                layer,
                b_t + idx * beat * 0.5,
                dur_s=beat * 1.1,
                midi=m,
                amp=0.085,
                pan=-0.18 if idx % 2 == 0 else 0.18,
            )
        if b >= 2 and b % 2 == 0:
            cello_m = [64, 67, 62, 59][(b // 2) % 4]
            add_solo_cello_note(layer, b_t, dur_s=bar * 1.8, midi=cello_m, amp=0.095, pan=0.14)

    layer = apply_stereo_delay_reverb(layer, delay_l_s=0.35, delay_r_s=0.52, feedback=0.34, wet=0.38)
    master = make_loop_seamless(bed + layer, loop_start_s=loop_start_s, crossfade_s=2.5)
    return master, loop_start_s, dur_s


def build_shelter_hearth_warmth(fadyme_orig: np.ndarray) -> tuple[np.ndarray, float, float]:
    """
    Post-Battle T-3 Shelter & Bread-Sharing (`bgm_shelter_hearth_warmth` — "Half a Loaf by the Door"):
    73.8 BPM, 78.05s, loop_start_s = 13.01s.
    Warm D minor -> F major -> Bbmaj7 -> C -> Dm chamber arrangement with intimate
    fingerpicked guitar, warm cello & violin duet before the scene transitions into
    `bgm_main_theme`.
    """
    bpm = 73.8
    beat = 60.0 / bpm
    bar = beat * 4.0
    total_bars = 24
    dur_s = round(total_bars * bar, 2)
    loop_start_s = round(4 * bar, 2)
    total_samples = int(dur_s * SR)

    bed = fit_stem_length(fadyme_orig, total_samples, offset_s=0.0) * 0.56
    warm = np.zeros_like(bed)

    # Warm F-major / Bbmaj7 / Dm relative-major voicings
    chords = [
        (41, [53, 57, 60, 65, 69, 65, 60, 57]),  # Fmaj7
        (36, [48, 55, 60, 64, 67, 64, 60, 55]),  # Cadd9
        (34, [46, 53, 58, 62, 65, 62, 58, 53]),  # Bbmaj7
        (38, [50, 57, 62, 65, 69, 65, 62, 57]),  # Dm9
    ]
    duet_melody = [
        (0, 0.0, 2.0, 65),  # F4
        (0, 2.0, 2.0, 69),  # A4
        (1, 0.0, 2.5, 67),  # G4
        (1, 2.5, 1.5, 64),  # E4
        (2, 0.0, 2.0, 62),  # D4
        (2, 2.0, 2.0, 65),  # F4
        (3, 0.0, 4.0, 69),  # A4
    ]

    for b in range(total_bars):
        b_t = b * bar
        bass_m, arp = chords[b % 4]
        add_fretless_bass_note(warm, b_t, dur_s=beat * 3.2, midi=bass_m, amp=0.095)
        for idx, m in enumerate(arp):
            add_clean_tube_guitar_note(
                warm,
                b_t + idx * beat * 0.5,
                dur_s=beat * 1.1,
                midi=m,
                amp=0.088,
                pan=-0.20 if idx % 2 == 0 else 0.20,
            )

    for cycle_b in (2, 6, 10, 14, 18):
        for rel_b, bt, dur_b, midi in duet_melody:
            t0 = (cycle_b + rel_b) * bar + bt * beat
            if t0 < dur_s - 2.0:
                add_solo_cello_note(warm, t0, dur_s=dur_b * beat, midi=midi, amp=0.10, pan=-0.12)
                add_solo_cello_note(warm, t0 + 0.02, dur_s=dur_b * beat, midi=midi + 12, amp=0.055, pan=0.22)

    warm = apply_stereo_delay_reverb(warm, delay_l_s=0.32, delay_r_s=0.48, feedback=0.33, wet=0.36)
    master = make_loop_seamless(bed + warm, loop_start_s=loop_start_s, crossfade_s=2.4)
    return master, loop_start_s, dur_s


def try_live_lyria_generation(cue_id: str, prompt: str, out_dir: Path) -> bool:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return False
    url = "https://generativelanguage.googleapis.com/v1beta/interactions"
    payload = {
        "model": "lyria-3.5",
        "input": prompt,
        "config": {"response_modalities": ["AUDIO"]},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        for output in body.get("outputs", []):
            if output.get("type") == "audio" and output.get("data"):
                raw_bytes = base64.b64decode(output["data"])
                out_dir.mkdir(parents=True, exist_ok=True)
                target = out_dir / f"{cue_id}_lyria_3_5_live.mp3"
                target.write_bytes(raw_bytes)
                print(f"[lyria-3.5 LIVE] Saved {target} ({len(raw_bytes)} bytes)")
                return True
    except Exception as exc:
        print(f"[lyria-3.5 LIVE] Skipped live call for {cue_id}: {exc}")
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Build UOMD Lyria 3.5 Soundtrack Suite")
    parser.add_argument("--live-lyria", action="store_true", help="Attempt live lyria-3.5 API call first if key is set")
    args = parser.parse_args()

    AUDIO_OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp_wav_dir = ROOT / ".cache" / "soundtrack_wavs"
    tmp_wav_dir.mkdir(parents=True, exist_ok=True)

    if args.live_lyria:
        for cue_id, prompt in LYRIA_3_5_PROMPTS.items():
            try_live_lyria_generation(cue_id, prompt, MUSIC_SRC_DIR / cue_id)

    print("Loading Lyria 3.5 stems from .cache/audio_stems/ ...")
    fadyme_orig = load_wav(STEMS_DIR / "fadyme_original.wav")
    fadyme_stem = load_wav(STEMS_DIR / "fadyme.wav")
    battle_stem = load_wav(STEMS_DIR / "battle_field.wav")
    calm_stem = load_wav(STEMS_DIR / "calm.wav")
    uneasy_stem = load_wav(STEMS_DIR / "uneasy.wav")
    chaotic_stem = load_wav(STEMS_DIR / "chaotic.wav")

    results: dict[str, dict[str, float | str]] = {}

    # 1. Copy already-mastered Lyria 3.5 loops (`bgm_battle_field` and `bgm_ch1_ash_forest_uneasy`)
    shutil.copy2(
        MUSIC_SRC_DIR / "bgm_battle_field" / "bgm_battle_field_v002_loop.ogg",
        AUDIO_OUT_DIR / "bgm_battle_field.ogg",
    )
    results["bgm_battle_field"] = {
        "file": "audio/bgm_battle_field.ogg",
        "loop_start_s": 16.7,
        "duration_s": 79.93,
    }

    shutil.copy2(
        MUSIC_SRC_DIR / "bgm_ch1_ash_forest" / "bgm_ch1_ash_forest_uneasy_v001_loop.ogg",
        AUDIO_OUT_DIR / "bgm_ch1_ash_forest_uneasy.ogg",
    )
    results["bgm_ch1_ash_forest_uneasy"] = {
        "file": "audio/bgm_ch1_ash_forest_uneasy.ogg",
        "loop_start_s": 25.16,
        "duration_s": 101.26,
    }

    # 2. Compose & Master Flagship Main Theme (`bgm_main_theme` — "Unaware of My Demise")
    print("Mastering bgm_main_theme ('Unaware of My Demise' — Duman-inspired dark gothic rock-orchestral ballad)...")
    main_stereo, main_loop, main_dur = build_main_theme(fadyme_orig)
    save_wav_and_ogg(main_stereo, tmp_wav_dir / "bgm_main_theme.wav", AUDIO_OUT_DIR / "bgm_main_theme.ogg")
    (MUSIC_SRC_DIR / "bgm_main_theme").mkdir(parents=True, exist_ok=True)
    shutil.copy2(AUDIO_OUT_DIR / "bgm_main_theme.ogg", MUSIC_SRC_DIR / "bgm_main_theme" / "bgm_main_theme_v001_loop.ogg")
    results["bgm_main_theme"] = {
        "file": "audio/bgm_main_theme.ogg",
        "loop_start_s": main_loop,
        "duration_s": main_dur,
    }

    # 3. Compose & Master Stage T-2 Battle (`bgm_battle_stone_crossing`)
    print("Mastering bgm_battle_stone_crossing (Stage T-2 Battle)...")
    t2_stereo, t2_loop, t2_dur = build_battle_stone_crossing(battle_stem)
    save_wav_and_ogg(
        t2_stereo, tmp_wav_dir / "bgm_battle_stone_crossing.wav", AUDIO_OUT_DIR / "bgm_battle_stone_crossing.ogg"
    )
    results["bgm_battle_stone_crossing"] = {
        "file": "audio/bgm_battle_stone_crossing.ogg",
        "loop_start_s": t2_loop,
        "duration_s": t2_dur,
    }

    # 4. Compose & Master Stage T-3 Finale Battle (`bgm_battle_shelter_climax`)
    print("Mastering bgm_battle_shelter_climax (Stage T-3 Finale Battle quoting Main Theme)...")
    t3_stereo, t3_loop, t3_dur = build_battle_shelter_climax(battle_stem, chaotic_stem)
    save_wav_and_ogg(
        t3_stereo, tmp_wav_dir / "bgm_battle_shelter_climax.wav", AUDIO_OUT_DIR / "bgm_battle_shelter_climax.ogg"
    )
    results["bgm_battle_shelter_climax"] = {
        "file": "audio/bgm_battle_shelter_climax.ogg",
        "loop_start_s": t3_loop,
        "duration_s": t3_dur,
    }

    # 5. Compose & Master Pre-Battle T-2 Ambush Escalation (`bgm_cutscene_ambush_tension`)
    print("Mastering bgm_cutscene_ambush_tension (Pre-Battle T-2 Ambush)...")
    amb_stereo, amb_loop, amb_dur = build_cutscene_ambush_tension(uneasy_stem, chaotic_stem)
    save_wav_and_ogg(
        amb_stereo, tmp_wav_dir / "bgm_cutscene_ambush_tension.wav", AUDIO_OUT_DIR / "bgm_cutscene_ambush_tension.ogg"
    )
    results["bgm_cutscene_ambush_tension"] = {
        "file": "audio/bgm_cutscene_ambush_tension.ogg",
        "loop_start_s": amb_loop,
        "duration_s": amb_dur,
    }

    # 6. Compose & Master Pre-Battle T-3 Twilight Road (`bgm_mahmut_road_march`)
    print("Mastering bgm_mahmut_road_march (Pre-Battle T-3 Twilight Road)...")
    road_stereo, road_loop, road_dur = build_mahmut_road_march(calm_stem, fadyme_orig)
    save_wav_and_ogg(
        road_stereo, tmp_wav_dir / "bgm_mahmut_road_march.wav", AUDIO_OUT_DIR / "bgm_mahmut_road_march.ogg"
    )
    results["bgm_mahmut_road_march"] = {
        "file": "audio/bgm_mahmut_road_march.ogg",
        "loop_start_s": road_loop,
        "duration_s": road_dur,
    }

    # 7. Compose & Master Post-Battle T-1 Aftermath (`bgm_aftermath_quiet_relief`)
    print("Mastering bgm_aftermath_quiet_relief (Post-Battle T-1 Relief)...")
    rel_stereo, rel_loop, rel_dur = build_aftermath_quiet_relief(calm_stem, fadyme_stem)
    save_wav_and_ogg(
        rel_stereo, tmp_wav_dir / "bgm_aftermath_quiet_relief.wav", AUDIO_OUT_DIR / "bgm_aftermath_quiet_relief.ogg"
    )
    results["bgm_aftermath_quiet_relief"] = {
        "file": "audio/bgm_aftermath_quiet_relief.ogg",
        "loop_start_s": rel_loop,
        "duration_s": rel_dur,
    }

    # 8. Compose & Master Post-Battle T-3 Shelter Warmth (`bgm_shelter_hearth_warmth`)
    print("Mastering bgm_shelter_hearth_warmth (Post-Battle T-3 Shelter & Bread-Sharing)...")
    sh_stereo, sh_loop, sh_dur = build_shelter_hearth_warmth(fadyme_orig)
    save_wav_and_ogg(
        sh_stereo, tmp_wav_dir / "bgm_shelter_hearth_warmth.wav", AUDIO_OUT_DIR / "bgm_shelter_hearth_warmth.ogg"
    )
    results["bgm_shelter_hearth_warmth"] = {
        "file": "audio/bgm_shelter_hearth_warmth.ogg",
        "loop_start_s": sh_loop,
        "duration_s": sh_dur,
    }

    summary_path = ROOT / ".cache" / "soundtrack_manifest_entries.json"
    summary_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print("All 9 soundtrack tracks mastered! Summary:")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
