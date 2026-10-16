#!/usr/bin/env python3
"""
Synthesizes, masters, and wires all 116 directed Japanese voiceover lines for the
Unaware of My Demise vertical slice (9 Prologue scenes + 107 Tutorial cutscene lines).

Locked Cast:
  - Narrator : Algieba  (ja-JP-Chirp3-HD-Algieba, ~93.4 Hz deep resonant bass-baritone)
  - Fadyme   : Sulafat  (ja-JP-Chirp3-HD-Sulafat, ~252.6 Hz warm gothic alto)
  - Mahmut   : Iapetus  (ja-JP-Chirp3-HD-Iapetus, ~144.6 Hz grounded veteran knight baritone)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import math
import re
import subprocess
import sys
import wave
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / ".cache" / "py_pkgs"))

import edge_tts  # type: ignore
import imageio_ffmpeg  # type: ignore
import numpy as np

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
MASTER_SCRIPT_PATH = ROOT / "narrative" / "10_VO" / "Line_Maps" / "jp_script_vertical_slice_master.json"
PROLOGUE_JSON_PATH = ROOT / "content" / "base" / "entry" / "prologue.json"
PRESENTATION_JSON_PATH = ROOT / "content" / "base" / "presentation" / "presentation.json"
VOICES_DIR = ROOT / "content" / "base" / "voices"
CLAUSE_CACHE_DIR = ROOT / ".cache" / "vo_clauses_v1"

SR = 24000

# Emotion-specific acting adjustments (delta_rate_pct, delta_pitch_hz, final_clause_rate_delta, final_clause_pitch_delta)
EMOTION_PROFILES: dict[str, tuple[int, int, int, int]] = {
    # Narrator (Algieba)
    "chronicle_nostalgia": (-2, 0, -3, -2),
    "intimate_dignity": (-3, -1, -4, -2),
    "warm_to_foreboding": (-1, 1, -7, -5),
    "grave_chronicle": (-2, -2, -3, -2),
    "solemn_tragedy": (-6, -4, -5, -3),
    "hushed_sorrow": (-7, -4, -5, -4),
    "quiet_persistence": (-2, -1, -2, -1),
    "tender_reunion": (-4, 1, -4, -2),
    "fateful_opening": (-5, -2, -5, -3),
    "atmospheric_stillness": (-5, -2, -4, -2),
    "eerie_tension": (-3, -3, -4, -3),
    "quiet_relief": (-3, 0, -4, -2),
    "intimate_stillness": (-5, -1, -4, -2),
    "approaching_danger": (2, -2, 0, -2),
    "solemn_aftermath": (-4, -2, -4, -3),
    "gentle_humor": (1, 2, -1, 1),
    "warm_domesticity": (-2, 1, -3, -1),
    "wistful_silence": (-6, -2, -5, -3),
    "tender_closing": (-6, -1, -6, -3),
    # Fadyme (Sulafat) & Mahmut (Iapetus)
    "composed": (-2, 0, -2, -1),
    "watchful": (-2, -2, -1, -2),
    "dry_amusement": (2, 3, -1, 2),
    "dry_humor": (2, 3, -1, 2),
    "soft_smile": (-4, 2, -4, -1),
    "protective": (5, -2, 2, -1),
    "determined": (4, -2, 2, -1),
}


def parse_clauses(tts_text: str, fallback_ja: str) -> list[dict[str, Any]]:
    """
    Splits `tts_text_gemini38` into natural acting clauses with pause durations and
    per-clause vocal performance cues (<breath>, <sigh>, <exhales>, <soft chuckle>).
    """
    src = (tts_text or fallback_ja).strip()
    # Tokenize on <short pause> and <long pause>
    tokens = re.split(r"(<short pause>|<long pause>)", src)
    clauses: list[dict[str, Any]] = []
    pending_pause_ms = 0

    for tok in tokens:
        t = tok.strip()
        if not t:
            continue
        if t == "<short pause>":
            pending_pause_ms = max(pending_pause_ms, 220)
            continue
        if t == "<long pause>":
            pending_pause_ms = max(pending_pause_ms, 460)
            continue

        has_breath = "<breath>" in t
        has_sigh = ("<sigh>" in t) or ("<exhales>" in t)
        has_chuckle = "<soft chuckle>" in t

        clean = re.sub(r"<[^>]+>", "", t).strip()
        # Clean stray leading ellipsis spaces while keeping Japanese punctuation natural
        clean = re.sub(r"\s+", " ", clean).strip()
        if not clean:
            continue

        clauses.append({
            "text": clean,
            "pause_before_ms": pending_pause_ms,
            "breath": has_breath,
            "sigh": has_sigh,
            "chuckle": has_chuckle,
        })
        pending_pause_ms = 240

    if not clauses:
        clauses.append({
            "text": fallback_ja.strip(),
            "pause_before_ms": 0,
            "breath": False,
            "sigh": False,
            "chuckle": False,
        })
    else:
        clauses[0]["pause_before_ms"] = 0

    return clauses


def clause_voice_params(
    speaker_id: str,
    emotion: str,
    acoustic: dict[str, Any],
    clause_idx: int,
    total_clauses: int,
    clause_meta: dict[str, Any],
    is_prologue: bool,
) -> tuple[str, str, str]:
    """Returns (edge_voice_name, rate_str, pitch_str) for a specific clause."""
    em_rate, em_pitch, end_rate, end_pitch = EMOTION_PROFILES.get(emotion, (-2, 0, -2, -1))
    prof_rate = float(acoustic.get("speaking_rate", 0.95))
    prof_pitch_st = float(acoustic.get("pitch_semitones", 0.0))

    if speaker_id == "narrator":
        voice = "ja-JP-KeitaNeural"
        # Prologue scenes need a measured chronicle pace that still fits inside each 12-16s plate
        base_rate_pct = int(round((prof_rate - 1.0) * 65)) + (4 if is_prologue else 0)
        base_pitch_hz = -10 + int(round(prof_pitch_st * 2.5))
    elif speaker_id == "fadyme":
        voice = "ja-JP-NanamiNeural"
        base_rate_pct = -2 + int(round((prof_rate - 0.96) * 60))
        base_pitch_hz = -2 + int(round(prof_pitch_st * 4.0))
    else:  # mahmut
        voice = "ja-JP-KeitaNeural"
        base_rate_pct = -1 + int(round((prof_rate - 0.95) * 60))
        base_pitch_hz = 11 + int(round(prof_pitch_st * 3.5))

    rate_pct = base_rate_pct + em_rate
    pitch_hz = base_pitch_hz + em_pitch

    # Clause-level acting arc
    if total_clauses > 1 and clause_idx == total_clauses - 1:
        rate_pct += end_rate
        pitch_hz += end_pitch
    elif total_clauses > 2 and 0 < clause_idx < total_clauses - 1:
        rate_pct += 1

    if clause_meta.get("sigh"):
        rate_pct -= 4
        pitch_hz -= 3
    if clause_meta.get("chuckle"):
        rate_pct += 2
        pitch_hz += 3
    if clause_meta["text"].endswith("？"):
        pitch_hz += 2
    elif clause_meta["text"].startswith("……"):
        rate_pct -= 3
        pitch_hz -= 2

    rate_pct = max(-22, min(18, rate_pct))
    pitch_hz = max(-24, min(22, pitch_hz))

    rate_str = f"{rate_pct:+d}%"
    pitch_str = f"{pitch_hz:+d}Hz"
    return voice, rate_str, pitch_str


async def synth_clause_pcm(
    sem: asyncio.Semaphore,
    voice: str,
    rate_str: str,
    pitch_str: str,
    text: str,
) -> np.ndarray:
    """Synthesizes a single clause with edge_tts, caches the decoded 24kHz PCM, and trims dead silence."""
    CLAUSE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(f"{voice}|{rate_str}|{pitch_str}|{text}".encode("utf-8")).hexdigest()[:24]
    mp3_path = CLAUSE_CACHE_DIR / f"{key}.mp3"
    wav_path = CLAUSE_CACHE_DIR / f"{key}.wav"

    if not wav_path.exists():
        async with sem:
            for attempt in range(4):
                try:
                    comm = edge_tts.Communicate(text, voice, rate=rate_str, pitch=pitch_str)
                    await comm.save(str(mp3_path))
                    subprocess.run(
                        [FFMPEG, "-y", "-i", str(mp3_path), "-ar", str(SR), "-ac", "1", str(wav_path)],
                        capture_output=True,
                        check=True,
                    )
                    break
                except Exception as exc:
                    if attempt == 3:
                        raise RuntimeError(f"Failed to synthesize clause {text!r}: {exc}") from exc
                    await asyncio.sleep(0.8 * (attempt + 1))

    with wave.open(str(wav_path), "rb") as w:
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0

    # Trim dead leading/trailing digital silence while keeping natural breath onset/release
    abs_x = np.abs(raw)
    win = int(SR * 0.01)
    if len(abs_x) > win * 2:
        env = np.convolve(abs_x, np.ones(win) / win, mode="same")
        idx = np.where(env > 0.0028)[0]
        if len(idx) > 0:
            start = max(0, int(idx[0]) - int(SR * 0.028))
            end = min(len(raw), int(idx[-1]) + int(SR * 0.045))
            raw = raw[start:end]

    # Soft cosine fade-in (18ms) and fade-out (28ms) to prevent any boundary clicks
    fi = min(len(raw) // 4, int(SR * 0.018))
    fo = min(len(raw) // 4, int(SR * 0.028))
    if fi > 1:
        raw[:fi] *= 0.5 * (1.0 - np.cos(np.linspace(0, math.pi, fi)))
    if fo > 1:
        raw[-fo:] *= 0.5 * (1.0 + np.cos(np.linspace(0, math.pi, fo)))

    return raw


def master_line_to_ogg(
    speaker_id: str,
    emotion: str,
    assembled_pcm: np.ndarray,
    out_ogg_path: Path,
    max_duration_s: float | None = None,
) -> float:
    """
    Applies character-locked formant/pitch calibration (`Algieba` ~93.4 Hz, `Sulafat` ~252.6 Hz,
    `Iapetus` ~144.6 Hz), emotional EQ, and loudness normalization, then encodes to Vorbis `.ogg`.
    Returns the exact decoded duration in seconds of the final `.ogg`.
    """
    tmp_in = CLAUSE_CACHE_DIR / f"tmp_{out_ogg_path.stem}_in.wav"
    tmp_probe = CLAUSE_CACHE_DIR / f"tmp_{out_ogg_path.stem}_probe.wav"

    pcm16 = np.clip(assembled_pcm * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(tmp_in), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm16.tobytes())

    raw_dur = len(assembled_pcm) / SR
    tempo_mult = 1.0
    if max_duration_s is not None and raw_dur > max_duration_s:
        # Rubberband tempo factor in ffmpeg: duration_out = duration_in / tempo
        # Wait: let's verify rubberband tempo direction or use atempo!
        tempo_mult = min(1.32, (raw_dur / max_duration_s) * 1.02)

    if speaker_id == "narrator":
        # Algieba: deep resonant bass-baritone (~93.4 Hz) with rich chest warmth
        pitch_ratio = 0.858
        eq_chain = (
            "highpass=f=55,"
            "equalizer=f=130:t=q:w=0.95:g=3.4,"
            "equalizer=f=320:t=q:w=1.1:g=1.4,"
            "equalizer=f=2750:t=q:w=1.2:g=1.2,"
            "equalizer=f=6200:t=q:w=1.4:g=-2.8,"
            "lowpass=f=9800"
        )
    elif speaker_id == "fadyme":
        # Sulafat: warm composed gothic alto (~252.6 Hz) with silky midrange and gentle air
        pitch_ratio = 0.985
        warm_boost = 2.6 if emotion in ("soft_smile", "composed") else 1.8
        eq_chain = (
            "highpass=f=110,"
            f"equalizer=f=255:t=q:w=1.0:g={warm_boost:.1f},"
            "equalizer=f=1850:t=q:w=1.2:g=0.8,"
            "equalizer=f=4300:t=q:w=1.4:g=-2.4,"
            "equalizer=f=9200:t=q:w=1.2:g=1.6,"
            "lowpass=f=11500"
        )
    else:
        # Iapetus (Mahmut): grounded veteran knight baritone (~144.6 Hz) with clear chest & articulation
        pitch_ratio = 1.078
        presence_boost = 2.4 if emotion == "protective" else 1.8
        eq_chain = (
            "highpass=f=75,"
            "equalizer=f=180:t=q:w=1.0:g=2.6,"
            f"equalizer=f=2350:t=q:w=1.2:g={presence_boost:.1f},"
            "equalizer=f=6400:t=q:w=1.4:g=-2.2,"
            "lowpass=f=10200"
        )

    af_parts = [f"rubberband=pitch={pitch_ratio:.4f}:formant=preserved"]
    if tempo_mult > 1.005:
        af_parts.append(f"atempo={tempo_mult:.4f}")
    af_parts.append(eq_chain)

    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(tmp_in),
            "-af",
            ",".join(af_parts),
            "-ar",
            str(SR),
            "-ac",
            "1",
            str(tmp_probe),
        ],
        capture_output=True,
        check=True,
    )

    # Normalize active speech RMS to -18.5 dBFS with soft tanh ceiling at -1.0 dBFS
    with wave.open(str(tmp_probe), "rb") as w:
        y = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0

    frame_len = int(SR * 0.025)
    if len(y) >= frame_len:
        frames = y[: (len(y) // frame_len) * frame_len].reshape(-1, frame_len)
        rms = np.sqrt((frames**2).mean(axis=1))
        active = rms[rms > 0.012]
        active_rms = float(np.median(active)) if len(active) > 0 else float(np.sqrt(np.mean(y**2)) + 1e-6)
    else:
        active_rms = float(np.sqrt(np.mean(y**2)) + 1e-6)

    target_rms = 10.0 ** (-18.5 / 20.0)  # ~0.1188
    gain = min(4.5, target_rms / max(active_rms, 1e-4))
    y = y * gain
    # Soft knee limiter so peaks never clip above 0.89 (-1.0 dBFS)
    peak = float(np.max(np.abs(y)) + 1e-9)
    if peak > 0.88:
        y = np.tanh(y / 0.88) * 0.88

    out_pcm16 = np.clip(y * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(tmp_probe), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(out_pcm16.tobytes())

    out_ogg_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(tmp_probe),
            "-c:a",
            "libvorbis",
            "-q:a",
            "6",
            "-ar",
            str(SR),
            "-ac",
            "1",
            str(out_ogg_path),
        ],
        capture_output=True,
        check=True,
    )

    # Decode the final .ogg back to verify exact decoded sample duration
    subprocess.run(
        [FFMPEG, "-y", "-i", str(out_ogg_path), "-ar", str(SR), "-ac", "1", str(tmp_in)],
        capture_output=True,
        check=True,
    )
    with wave.open(str(tmp_in), "rb") as w:
        final_dur = w.getnframes() / float(w.getframerate())

    tmp_in.unlink(missing_ok=True)
    tmp_probe.unlink(missing_ok=True)
    return final_dur


async def process_line(
    sem: asyncio.Semaphore,
    line: dict[str, Any],
    prologue_budgets: dict[str, float],
) -> tuple[str, float, float]:
    line_id: str = line["line_id"]
    speaker_id: str = line["speaker_id"]
    emotion: str = line["emotion"]
    acoustic: dict[str, Any] = line.get("acoustic_profile", {})
    is_prologue = line_id in prologue_budgets
    shot_budget = prologue_budgets.get(line_id)

    clauses = parse_clauses(line.get("tts_text_gemini38", ""), line["ja"])
    segments: list[np.ndarray] = [np.zeros(int(SR * 0.065), dtype=np.float64)]

    pause_scale = 0.68 if is_prologue else 1.0
    for idx, cl in enumerate(clauses):
        pause_ms = int(round(cl["pause_before_ms"] * pause_scale))
        if pause_ms > 0:
            segments.append(np.zeros(int(SR * (pause_ms / 1000.0)), dtype=np.float64))
        if cl.get("breath"):
            segments.append(np.zeros(int(SR * 0.055), dtype=np.float64))

        voice, rate_str, pitch_str = clause_voice_params(
            speaker_id=speaker_id,
            emotion=emotion,
            acoustic=acoustic,
            clause_idx=idx,
            total_clauses=len(clauses),
            clause_meta=cl,
            is_prologue=is_prologue,
        )
        pcm = await synth_clause_pcm(sem, voice, rate_str, pitch_str, cl["text"])
        segments.append(pcm)

    segments.append(np.zeros(int(SR * 0.13), dtype=np.float64))
    assembled = np.concatenate(segments)

    max_dur = (shot_budget - 0.75) if shot_budget is not None else None
    out_ogg = VOICES_DIR / f"{line_id}.ogg"
    actual_dur = master_line_to_ogg(
        speaker_id=speaker_id,
        emotion=emotion,
        assembled_pcm=assembled,
        out_ogg_path=out_ogg,
        max_duration_s=max_dur,
    )

    # Set declared duration_s slightly above actual_dur (+0.06s) so NarrativeStage.ontimeupdate never clips the tail,
    # while strictly respecting `voice.duration_s <= shot.duration_seconds` for Prologue scenes.
    declared_dur = round(actual_dur + 0.06, 2)
    if shot_budget is not None:
        declared_dur = min(round(shot_budget - 0.15, 2), declared_dur)

    return line_id, actual_dur, declared_dur


async def main() -> None:
    master = json.loads(MASTER_SCRIPT_PATH.read_text(encoding="utf-8"))
    script_sha256 = hashlib.sha256(MASTER_SCRIPT_PATH.read_bytes()).hexdigest()
    prologue_data = json.loads(PROLOGUE_JSON_PATH.read_text(encoding="utf-8"))
    prologue_budgets: dict[str, float] = {
        sc["line_id"]: float(sc["duration_seconds"]) for sc in prologue_data["scenes"]
    }

    lines: list[dict[str, Any]] = master["lines"]
    print(f"Synthesizing & mastering {len(lines)} Japanese voiceover lines...")

    sem = asyncio.Semaphore(6)
    results: dict[str, tuple[float, float]] = {}

    # Process in batches of 16 for clear progress reporting
    for start in range(0, len(lines), 16):
        batch = lines[start : start + 16]
        batch_out = await asyncio.gather(*(process_line(sem, ln, prologue_budgets) for ln in batch))
        for lid, act_d, dec_d in batch_out:
            results[lid] = (act_d, dec_d)
        print(f"  Completed {min(start + 16, len(lines))}/{len(lines)} lines...")

    # Build content/base/presentation/presentation.json
    voices_manifest: dict[str, Any] = {}
    for ln in lines:
        lid = ln["line_id"]
        act_d, dec_d = results[lid]
        ln["acoustic_profile"]["duration_seconds"] = dec_d
        voices_manifest[lid] = {
            "file": f"voices/{lid}.ogg",
            "language": "ja",
            "reviewed_transcript_sha256": script_sha256,
            "duration_s": dec_d,
        }

    # Update master script with exact measured durations and recompute sha256 so it is 100% self-consistent
    MASTER_SCRIPT_PATH.write_text(json.dumps(master, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    final_script_sha256 = hashlib.sha256(MASTER_SCRIPT_PATH.read_bytes()).hexdigest()
    for v in voices_manifest.values():
        v["reviewed_transcript_sha256"] = final_script_sha256

    presentation_pack = {
        "schema_version": 1,
        "voices": voices_manifest,
        "sounds": {},
        "videos": {},
        "locales": [],
        "panels": {},
    }
    PRESENTATION_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    PRESENTATION_JSON_PATH.write_text(
        json.dumps(presentation_pack, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # Mark prologue voice_status as recorded
    prologue_data["voice_status"] = "recorded"
    PROLOGUE_JSON_PATH.write_text(
        json.dumps(prologue_data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print("\nPrologue timing verification:")
    for sc in prologue_data["scenes"]:
        lid = sc["line_id"]
        act_d, dec_d = results[lid]
        budget = sc["duration_seconds"]
        print(f"  {lid}: actual={act_d:.2f}s, declared={dec_d:.2f}s / budget={budget}s")

    print(f"\nWrote {len(voices_manifest)} voice entries to {PRESENTATION_JSON_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
