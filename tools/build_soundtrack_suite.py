"""
Builds the clean, uncluttered Lyria 3.5 Main Theme (`bgm_main_theme.ogg`)
and removes the redundant per-micro-scene synthetic hybrid tracks so the game
rotates cleanly across the 7 pure Lyria 3.5 studio tracks.

Zero synthetic oscillator clutter: `bgm_main_theme.ogg` is crafted 100% from
pure `lyria-3.5` studio recordings in D minor:
- 0:00 - 0:32: Lonely hesitant acoustic guitar, deep bowed double bass, and
  distant bell (`uneasy.wav` transposed -2 semitones from E minor to D minor
  with warm analog low-shelf mastering).
- 0:30 - 1:40: Smooth 4-second equal-power crossfade into the unlooped late-half
  emotional cello & felt piano climax (`48.0s - 118.0s`) of `fadyme_original.wav`
  (native D minor, stereo-widened and warm-mastered).
"""

import os
import shutil
import subprocess
import wave
import numpy as np

FFMPEG = r"C:\Program Files\BlueStacks_nxt\ffmpeg.exe"
STEM_DIR = os.path.join(".cache", "audio_stems")
OUT_AUDIO_DIR = os.path.join("content", "base", "audio")
OUT_AUDITION_DIR = os.path.join("apps", "game", "public", "audio_audition")

OBSOLETE_TRACKS = [
    "bgm_battle_stone_crossing.ogg",
    "bgm_battle_shelter_climax.ogg",
    "bgm_cutscene_ambush_tension.ogg",
    "bgm_mahmut_road_march.ogg",
    "bgm_aftermath_quiet_relief.ogg",
    "bgm_shelter_hearth_warmth.ogg",
]


def remove_obsolete_tracks():
    for folder in (OUT_AUDIO_DIR, OUT_AUDITION_DIR):
        for fname in OBSOLETE_TRACKS:
            path = os.path.join(folder, fname)
            if os.path.exists(path):
                os.remove(path)
                print(f"Removed obsolete track: {path}")


def load_wav_float(path: str) -> np.ndarray:
    with wave.open(path, "rb") as wf:
        ch = wf.getnchannels()
        frames = wf.readframes(wf.getnframes())
    data = np.frombuffer(frames, dtype=np.int16).astype(np.float64) / 32768.0
    if ch == 2:
        data = data.reshape(-1, 2)
    else:
        data = np.column_stack([data, data])
    return data


def save_wav_int16(path: str, sr: int, pcm: np.ndarray):
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


def build_clean_main_theme():
    os.makedirs(STEM_DIR, exist_ok=True)
    os.makedirs(OUT_AUDIO_DIR, exist_ok=True)
    os.makedirs(OUT_AUDITION_DIR, exist_ok=True)

    uneasy_src = os.path.join(STEM_DIR, "uneasy.wav")
    fadyme_src = os.path.join(STEM_DIR, "fadyme_original.wav")

    uneasy_dm_wav = os.path.join(STEM_DIR, "main_theme_part1_dm.wav")
    fadyme_climax_wav = os.path.join(STEM_DIR, "main_theme_part2_dm.wav")

    # 1. Transpose uneasy.wav (-2 semitones: E minor -> D minor) with warm analog EQ
    # 2^(-2/12) = 0.890898718
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            uneasy_src,
            "-af",
            "asetrate=44100*0.8908987,aresample=44100,atempo=1.07,"
            "equalizer=f=95:t=q:w=1.0:g=3.5,"
            "equalizer=f=240:t=q:w=1.2:g=2.0,"
            "equalizer=f=5500:t=q:w=1.2:g=-2.0",
            "-ar",
            "44100",
            "-ac",
            "2",
            uneasy_dm_wav,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # 2. Master the late-half emotional climax of fadyme_original.wav (46.0s - 118.0s) in D minor
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-ss",
            "46.0",
            "-to",
            "118.0",
            "-i",
            fadyme_src,
            "-af",
            "equalizer=f=90:t=q:w=1.0:g=3.0,"
            "equalizer=f=220:t=q:w=1.1:g=1.8,"
            "extrastereo=m=1.18",
            "-ar",
            "44100",
            "-ac",
            "2",
            fadyme_climax_wav,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    part1 = load_wav_float(uneasy_dm_wav)
    part2 = load_wav_float(fadyme_climax_wav)

    sr = 44100
    # Part 1: 0.0s to 34.0s (lonely D-minor acoustic guitar & bowed double bass)
    p1_len = int(34.0 * sr)
    p1 = part1[:p1_len].copy()

    # Normalize Part 1 gently to match Part 2's warm dynamic contour
    p1_rms = np.sqrt(np.mean(p1**2)) + 1e-9
    p2_rms = np.sqrt(np.mean(part2**2)) + 1e-9
    p1 *= (p2_rms * 0.88) / p1_rms

    # Smooth 4.5s equal-power crossfade between Part 1 (29.5s..34.0s) and Part 2 (0.0s..4.5s)
    xfade_samples = int(4.5 * sr)
    total_samples = p1_len + len(part2) - xfade_samples
    out = np.zeros((total_samples, 2), dtype=np.float64)

    # Before crossfade
    pre_len = p1_len - xfade_samples
    out[:pre_len] = p1[:pre_len]

    # Equal-power crossfade window
    theta = np.linspace(0.0, np.pi / 2.0, xfade_samples)[:, None]
    fade_out = np.cos(theta)
    fade_in = np.sin(theta)
    out[pre_len:p1_len] = p1[pre_len:p1_len] * fade_out + part2[:xfade_samples] * fade_in

    # Remainder of Part 2
    out[p1_len:] = part2[xfade_samples:]

    # Gentle 1.8s fade-in and 3.5s fade-out for seamless looping
    fi = int(1.8 * sr)
    fo = int(3.5 * sr)
    out[:fi] *= np.linspace(0.0, 1.0, fi)[:, None]
    out[-fo:] *= np.linspace(1.0, 0.0, fo)[:, None]

    # Soft studio limiter (no harsh clipping, preserves pure acoustic dynamics)
    peak = np.max(np.abs(out)) + 1e-9
    out = (out / peak) * 0.90

    master_wav = os.path.join(STEM_DIR, "bgm_main_theme_clean_master.wav")
    pcm = np.clip(out * 32767.0, -32768, 32767).astype(np.int16)
    save_wav_int16(master_wav, sr, pcm)

    target_ogg = os.path.join(OUT_AUDIO_DIR, "bgm_main_theme.ogg")
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            master_wav,
            "-c:a",
            "vorbis",
            "-strict",
            "-2",
            "-q:a",
            "6",
            target_ogg,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    dur_sec = round(total_samples / sr, 1)
    size_kb = round(os.path.getsize(target_ogg) / 1024, 1)
    print(f"Built clean Lyria 3.5 bgm_main_theme.ogg ({dur_sec}s, {size_kb} KB)")


if __name__ == "__main__":
    remove_obsolete_tracks()
    build_clean_main_theme()
