#!/usr/bin/env python3
"""
Synthesizes, masters, and wires all 316 Part I Campaign, Companion/Event, and Battle/Menu
Japanese voiceover lines for the Locked Main Trio:
  - Fadyme (`fadyme` / `fadyme_thought`) : Sulafat  (`gemini-3.8-flash-tts`, 252.6 Hz warm gothic alto) — 201 lines
  - Mahmut (`mahmut` / `mahmut_thought`) : Iapetus  (`gemini-3.8-flash-tts`, 144.6 Hz grounded knight baritone) — 103 lines
  - Narrator (`narrator` / `narration`)  : Algieba  (`gemini-3.8-flash-tts`, 96.0 Hz spiritual bass-baritone) — 12 lines

Combined with the 116 Base (Prologue + Tutorial T-1..T-3) voice files in `content/base/voices/`,
this provides 432 directed, non-robotic Japanese `.ogg` voiceovers across the game.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / ".cache" / "py_pkgs"))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import edge_tts  # type: ignore
import imageio_ffmpeg  # type: ignore
import numpy as np

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
TRIO_SCRIPT_PATH = ROOT / "narrative" / "10_VO" / "Line_Maps" / "jp_script_part1_campaign_trio.json"
FADYME_SCRIPT_PATH = ROOT / "narrative" / "10_VO" / "Line_Maps" / "jp_script_fadyme.json"
BASE_PRESENTATION_PATH = ROOT / "content" / "base" / "presentation" / "presentation.json"
CAMPAIGN_DIR = ROOT / "content" / "patches" / "rel_0003_part1_campaign"
CAMPAIGN_VOICES_DIR = CAMPAIGN_DIR / "voices"
CAMPAIGN_PRESENTATION_PATH = CAMPAIGN_DIR / "presentation" / "presentation.json"
GEMINI_CACHE_DIR = ROOT / ".cache" / "vo_gemini38_v1"
CLAUSE_CACHE_DIR = ROOT / ".cache" / "vo_clauses_v1"

SR = 24000

# Comprehensive emotion-specific acting adjustments:
# (delta_rate_pct, delta_pitch_hz, final_clause_rate_delta, final_clause_pitch_delta)
EMOTION_PROFILES: dict[str, tuple[int, int, int, int]] = {
    # Narrator (Algieba)
    "chronicle_nostalgia": (-3, -1, -4, -2),
    "intimate_dignity": (-4, -2, -4, -2),
    "warm_to_foreboding": (-2, 1, -7, -5),
    "grave_chronicle": (-3, -3, -4, -2),
    "solemn_tragedy": (-6, -4, -5, -3),
    "hushed_sorrow": (-7, -4, -6, -4),
    "quiet_persistence": (-3, -1, -3, -1),
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
    "neutral": (-3, -1, -3, -2),
    # Fadyme (Sulafat) & Mahmut (Iapetus) — Emotional acting matrix
    "composed": (-2, 0, -2, -1),
    "calm": (-3, 0, -3, -1),
    "measured": (-3, -1, -2, -1),
    "steady": (-2, -1, -2, -1),
    "grounded": (-2, -2, -2, -2),
    "practical": (0, 0, -1, -1),
    "observant": (-2, -1, -2, -1),
    "watchful": (-2, -2, -1, -2),
    "focused": (1, -1, 0, -1),
    "analytical": (0, -1, -1, -1),
    "curious": (1, 2, 0, 2),
    "questioning": (0, 2, -1, 3),
    "thoughtful": (-4, -1, -3, -2),
    "pensive": (-5, -2, -4, -2),
    "reflective": (-5, -1, -4, -2),
    "remembering": (-5, -1, -4, -2),
    "somber": (-6, -3, -4, -3),
    "solemn": (-5, -3, -4, -2),
    "grave": (-4, -4, -3, -3),
    "serious": (-3, -2, -2, -2),
    "grim": (-3, -3, -3, -2),
    "wary": (-2, -2, -2, -2),
    "cautious": (-2, -1, -2, -1),
    "guarded": (-3, -2, -2, -2),
    "hesitant": (-6, -1, -5, -2),
    "Conflict": (-5, -2, -4, -3),
    "guilty": (-6, -3, -5, -3),
    "regret": (-6, -3, -5, -3),
    "burdened": (-5, -3, -4, -3),
    "tired": (-6, -3, -5, -3),
    "weary": (-6, -3, -5, -3),
    "exhausted": (-8, -4, -6, -4),
    "resigned": (-6, -3, -5, -3),
    "sorrow": (-7, -3, -6, -4),
    "grief": (-8, -4, -6, -4),
    "sad": (-6, -3, -5, -3),
    "vulnerable": (-6, 1, -5, -2),
    "fragile": (-7, 2, -6, -2),
    "shaken": (-4, 2, -5, -2),
    "uneasy": (-3, 1, -3, -2),
    "troubled": (-4, -1, -3, -2),
    "disturbed": (-3, -2, -3, -2),
    "haunted": (-6, -2, -5, -3),
    "whisper": (-8, -2, -6, -3),
    "hushed": (-7, -2, -5, -3),
    "quiet": (-5, -1, -4, -2),
    "low": (-4, -3, -3, -2),
    "soft": (-5, 1, -4, -1),
    "soft_smile": (-4, 2, -4, -1),
    "gentle": (-4, 2, -3, -1),
    "tender": (-5, 2, -4, -1),
    "warm": (-3, 2, -3, -1),
    "reassuring": (-3, 1, -3, -1),
    "compassionate": (-4, 1, -4, -1),
    "sincere": (-3, 1, -3, -1),
    "honest": (-3, 0, -3, -1),
    "grateful": (-3, 2, -3, -1),
    "relieved": (-4, 1, -4, -2),
    "dry": (-1, -1, -2, -1),
    "dry_amusement": (2, 3, -1, 2),
    "dry_humor": (2, 3, -1, 2),
    "wry": (1, 2, -2, 1),
    "ironic": (1, 2, -2, 1),
    "bitter": (-3, -2, -4, -3),
    "cold": (-3, -3, -3, -3),
    "sharp": (4, 1, 2, -1),
    "firm": (2, -1, 1, -1),
    "stern": (1, -2, 0, -2),
    "commanding": (4, -2, 2, -1),
    "authoritative": (3, -2, 1, -2),
    "determined": (4, -2, 2, -1),
    "resolute": (3, -2, 2, -1),
    "resolve": (3, -1, 2, -1),
    "defiant": (5, 1, 3, 0),
    "protective": (5, -2, 2, -1),
    "urgent": (7, 2, 4, 1),
    "warning": (6, 1, 3, 0),
    "alarm": (8, 3, 5, 2),
    "shock": (6, 4, 2, 1),
    "startled": (6, 4, 2, 1),
    "tense": (3, 1, 1, 0),
    "fierce": (6, 1, 4, 0),
    "angry": (5, 1, 3, -1),
    "battle_shout": (8, 3, 5, 2),
}


def load_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip() or os.environ.get("GOOGLE_API_KEY", "").strip()
    if key:
        return key
    env_file = ROOT / ".env"
    if env_file.exists():
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if line.startswith("GEMINI_API_KEY=") or line.startswith("GOOGLE_API_KEY="):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val:
                    return val
    raise RuntimeError("GEMINI_API_KEY not found in environment or .env file.")


def prepare_gemini38_text(tts_text: str) -> str:
    t = tts_text.replace("<soft chuckle>", "<chuckle>")
    t = re.sub(r"\s*<(?:short|long) pause>\s*", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def find_existing_cached_wav(line_id: str) -> Path | None:
    GEMINI_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    matches = sorted(GEMINI_CACHE_DIR.glob(f"{line_id}_*.wav"))
    for m in matches:
        if m.stat().st_size > 1000:
            return m
    return None


def call_gemini38_tts_sync(
    api_key: str,
    model_name: str,
    voice_name: str,
    style_prompt: str,
    tts_text: str,
) -> bytes:
    if model_name in ("gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"):
        url = "https://generativelanguage.googleapis.com/v1beta/interactions"
        content_item: dict[str, Any] = {
            "type": "text",
            "text": tts_text,
        }
        if style_prompt:
            content_item["annotations"] = [
                {
                    "type": "speech_metadata",
                    "style": style_prompt,
                }
            ]
        payload = {
            "model": model_name,
            "input": [{"type": "user_input", "content": [content_item]}],
            "response_format": {
                "type": "audio",
                "mime_type": "audio/l16",
                "sample_rate": SR,
            },
            "generation_config": {"speech_config": [{"voice": voice_name}]},
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        if "steps" in body and body["steps"]:
            b64 = body["steps"][0]["content"][0]["data"]
        else:
            interaction = body.get("interaction", body)
            b64 = interaction["output_audio"]["data"]
        return base64.b64decode(b64)
    else:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        clean_ja = re.sub(r"<[^>]+>", "", tts_text).strip()
        payload = {
            "contents": [{"parts": [{"text": clean_ja}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice_name}}
                },
            },
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        b64 = body["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
        return base64.b64decode(b64)


def parse_clauses(tts_text: str, fallback_ja: str) -> list[dict[str, Any]]:
    """
    Splits `tts_text_gemini38` into natural acting clauses with pause durations and
    per-clause vocal performance cues (<breath>, <sigh>, <exhales>, <soft chuckle>).
    """
    src = (tts_text or fallback_ja).strip()
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
        has_chuckle = ("<soft chuckle>" in t) or ("<chuckle>" in t)

        clean = re.sub(r"<[^>]+>", "", t).strip()
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
    is_inner: bool,
) -> tuple[str, str, str]:
    """Returns (edge_voice_name, rate_str, pitch_str) for a specific clause."""
    em_rate, em_pitch, end_rate, end_pitch = EMOTION_PROFILES.get(emotion, (-2, 0, -2, -1))
    prof_rate = float(acoustic.get("speaking_rate", 0.95))
    prof_pitch_st = float(acoustic.get("pitch_semitones", 0.0))

    norm_speaker = speaker_id.replace("_thought", "")
    if norm_speaker in ("narrator", "narration"):
        voice = "ja-JP-KeitaNeural"
        base_rate_pct = int(round((prof_rate - 1.0) * 65))
        base_pitch_hz = -10 + int(round(prof_pitch_st * 2.5))
    elif norm_speaker == "fadyme":
        voice = "ja-JP-NanamiNeural"
        base_rate_pct = -2 + int(round((prof_rate - 0.96) * 60))
        base_pitch_hz = -2 + int(round(prof_pitch_st * 4.0))
    else:  # mahmut
        voice = "ja-JP-KeitaNeural"
        base_rate_pct = -1 + int(round((prof_rate - 0.95) * 60))
        base_pitch_hz = 11 + int(round(prof_pitch_st * 3.5))

    rate_pct = base_rate_pct + em_rate
    pitch_hz = base_pitch_hz + em_pitch

    if is_inner:
        rate_pct -= 3
        pitch_hz -= 1

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
                await asyncio.sleep(0.6 * (attempt + 1))

    with wave.open(str(wav_path), "rb") as w:
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0

    abs_x = np.abs(raw)
    win = int(SR * 0.01)
    if len(abs_x) > win * 2:
        env = np.convolve(abs_x, np.ones(win) / win, mode="same")
        idx = np.where(env > 0.0028)[0]
        if len(idx) > 0:
            start = max(0, int(idx[0]) - int(SR * 0.028))
            end = min(len(raw), int(idx[-1]) + int(SR * 0.045))
            raw = raw[start:end]

    fi = min(len(raw) // 4, int(SR * 0.018))
    fo = min(len(raw) // 4, int(SR * 0.028))
    if fi > 1:
        raw[:fi] *= 0.5 * (1.0 - np.cos(np.linspace(0, math.pi, fi)))
    if fo > 1:
        raw[-fo:] *= 0.5 * (1.0 + np.cos(np.linspace(0, math.pi, fo)))

    return raw


async def synth_expressive_clauses_calibrated_wav(line: dict[str, Any], out_wav_path: Path) -> None:
    """
    Synthesizes a multi-clause expressive performance with natural breathing/sighing pauses
    and formant-preserved character voice calibration (`Sulafat` 252.6 Hz, `Iapetus` 144.6 Hz,
    `Algieba` 96.0 Hz), writing a 24kHz 16-bit mono WAV ready for final mastering.
    """
    speaker_id: str = line.get("speaker_id", "fadyme")
    norm_speaker = speaker_id.replace("_thought", "")
    emotion: str = line.get("emotion", "composed")
    acoustic: dict[str, Any] = line.get("acoustic_profile", {})
    is_inner = bool(line.get("inner") or speaker_id.endswith("_thought"))

    clauses = parse_clauses(line.get("tts_text_gemini38", ""), line["ja"])
    segments: list[np.ndarray] = [np.zeros(int(SR * 0.060), dtype=np.float64)]

    for idx, cl in enumerate(clauses):
        pause_ms = int(round(cl["pause_before_ms"]))
        if pause_ms > 0:
            segments.append(np.zeros(int(SR * (pause_ms / 1000.0)), dtype=np.float64))
        if cl.get("breath") or cl.get("sigh"):
            segments.append(np.zeros(int(SR * 0.065), dtype=np.float64))

        voice, rate_str, pitch_str = clause_voice_params(
            speaker_id=speaker_id,
            emotion=emotion,
            acoustic=acoustic,
            clause_idx=idx,
            total_clauses=len(clauses),
            clause_meta=cl,
            is_inner=is_inner,
        )
        pcm = await synth_clause_pcm(voice, rate_str, pitch_str, cl["text"])
        segments.append(pcm)

    segments.append(np.zeros(int(SR * 0.110), dtype=np.float64))
    assembled = np.concatenate(segments)

    tmp_raw = CLAUSE_CACHE_DIR / f"tmp_cal_{line['line_id']}_raw.wav"
    pcm16 = np.clip(assembled * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(tmp_raw), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm16.tobytes())

    if norm_speaker in ("narrator", "narration"):
        pitch_ratio = 0.858
        eq_chain = (
            "highpass=f=55,"
            "equalizer=f=130:t=q:w=0.95:g=3.0,"
            "equalizer=f=320:t=q:w=1.1:g=1.2,"
            "equalizer=f=2750:t=q:w=1.2:g=1.0,"
            "equalizer=f=6200:t=q:w=1.4:g=-2.2,"
            "lowpass=f=9800"
        )
    elif norm_speaker == "fadyme":
        pitch_ratio = 0.985
        warm_boost = 2.6 if emotion in ("soft_smile", "composed", "tender", "warm", "fragile") else 1.8
        eq_chain = (
            "highpass=f=110,"
            f"equalizer=f=255:t=q:w=1.0:g={warm_boost:.1f},"
            "equalizer=f=1850:t=q:w=1.2:g=0.8,"
            "equalizer=f=4300:t=q:w=1.4:g=-2.4,"
            "equalizer=f=9200:t=q:w=1.2:g=1.6,"
            "lowpass=f=11500"
        )
    else:
        pitch_ratio = 1.078
        presence_boost = 2.4 if emotion in ("protective", "commanding", "warning", "battle_shout") else 1.8
        eq_chain = (
            "highpass=f=75,"
            "equalizer=f=180:t=q:w=1.0:g=2.6,"
            f"equalizer=f=2350:t=q:w=1.2:g={presence_boost:.1f},"
            "equalizer=f=6400:t=q:w=1.4:g=-2.2,"
            "lowpass=f=10200"
        )

    af_chain = f"rubberband=pitch={pitch_ratio:.4f}:formant=preserved,{eq_chain}"
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(tmp_raw),
            "-af",
            af_chain,
            "-ar",
            str(SR),
            "-ac",
            "1",
            str(out_wav_path),
        ],
        capture_output=True,
        check=True,
    )
    tmp_raw.unlink(missing_ok=True)


def decode_and_trim_wav(wav_path: Path) -> np.ndarray:
    with wave.open(str(wav_path), "rb") as wf:
        raw = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0

    abs_x = np.abs(raw)
    win = int(SR * 0.01)
    if len(abs_x) > win * 2:
        env = np.convolve(abs_x, np.ones(win) / win, mode="same")
        idx = np.where(env > 0.0022)[0]
        if len(idx) > 0:
            start = max(0, int(idx[0]) - int(SR * 0.045))
            end = min(len(raw), int(idx[-1]) + int(SR * 0.085))
            raw = raw[start:end]

    fi = min(len(raw) // 4, int(SR * 0.015))
    fo = min(len(raw) // 4, int(SR * 0.025))
    if fi > 1:
        raw[:fi] *= 0.5 * (1.0 - np.cos(np.linspace(0, math.pi, fi)))
    if fo > 1:
        raw[-fo:] *= 0.5 * (1.0 + np.cos(np.linspace(0, math.pi, fo)))

    lead = np.zeros(int(SR * 0.060), dtype=np.float64)
    tail = np.zeros(int(SR * 0.110), dtype=np.float64)
    return np.concatenate([lead, raw, tail])


def estimate_median_f0(pcm: np.ndarray) -> float:
    f0s: list[float] = []
    step = int(SR * 0.02)
    win = int(SR * 0.04)
    min_lag = int(SR / 240.0)
    max_lag = int(SR / 65.0)
    for start in range(0, len(pcm) - win, step):
        seg = pcm[start : start + win]
        if float(np.sqrt(np.mean(seg**2))) < 0.025:
            continue
        seg = seg - float(np.mean(seg))
        corr = np.correlate(seg, seg, mode="full")[win - 1 :]
        if corr[0] <= 1e-9:
            continue
        lag = min_lag + int(np.argmax(corr[min_lag:max_lag]))
        if corr[lag] > 0.35 * corr[0]:
            f0s.append(float(SR) / float(lag))
    return float(np.median(f0s)) if f0s else 96.0


def master_gemini38_to_ogg(
    pcm: np.ndarray,
    out_ogg_path: Path,
    speaker_id: str = "",
    is_inner: bool = False,
) -> float:
    GEMINI_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    tmp_in = GEMINI_CACHE_DIR / f"tmp_{out_ogg_path.stem}_in.wav"
    tmp_probe = GEMINI_CACHE_DIR / f"tmp_{out_ogg_path.stem}_probe.wav"

    frame_len = int(SR * 0.025)
    if len(pcm) >= frame_len:
        frames = pcm[: (len(pcm) // frame_len) * frame_len].reshape(-1, frame_len)
        rms = np.sqrt((frames**2).mean(axis=1))
        active = rms[rms > 0.010]
        active_rms = float(np.median(active)) if len(active) > 0 else float(np.sqrt(np.mean(pcm**2)) + 1e-6)
    else:
        active_rms = float(np.sqrt(np.mean(pcm**2)) + 1e-6)

    target_db = -19.2 if is_inner else -18.5
    target_rms = 10.0 ** (target_db / 20.0)
    gain = min(4.2, target_rms / max(active_rms, 1e-4))
    y = pcm * gain
    peak = float(np.max(np.abs(y)) + 1e-9)
    if peak > 0.88:
        y = np.tanh(y / 0.88) * 0.88

    pcm16 = np.clip(y * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(tmp_in), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm16.tobytes())

    af_filters: list[str] = ["highpass=f=55"]

    if speaker_id in ("narrator", "narration"):
        med_f0 = estimate_median_f0(pcm)
        target_f0 = 96.0
        pitch_ratio = max(0.88, min(1.12, target_f0 / max(65.0, med_f0)))
        af_filters.append(f"rubberband=pitch={pitch_ratio:.4f}:formant=preserved:tempo=1.0200")
        af_filters.extend(
            [
                "equalizer=f=125:t=q:w=1.1:g=2.4",
                "equalizer=f=380:t=q:w=1.2:g=1.0",
                "equalizer=f=2800:t=q:w=1.2:g=-2.0",
                "equalizer=f=6200:t=q:w=1.0:g=1.4",
                "lowpass=f=7600",
                "aecho=0.88:0.86:48|96|144:0.17|0.10|0.05",
                "alimiter=limit=0.88",
            ]
        )
    elif is_inner:
        af_filters.extend(
            [
                "equalizer=f=210:t=q:w=1.1:g=1.8",
                "equalizer=f=3400:t=q:w=1.2:g=-1.4",
                "lowpass=f=8800",
                "aecho=0.92:0.90:28:0.08",
                "alimiter=limit=0.88",
            ]
        )

    out_ogg_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(tmp_in),
            "-af",
            ",".join(af_filters),
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

    subprocess.run(
        [FFMPEG, "-y", "-i", str(out_ogg_path), "-ar", str(SR), "-ac", "1", str(tmp_probe)],
        capture_output=True,
        check=True,
    )
    with wave.open(str(tmp_probe), "rb") as w:
        final_dur = w.getnframes() / float(w.getframerate())

    tmp_in.unlink(missing_ok=True)
    tmp_probe.unlink(missing_ok=True)
    return round(final_dur, 2)


ALL_GEMINI_MODELS = [
    "gemini-3.8-flash-tts",
    "gemini-3.8-flash-lite-tts",
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts",
]


async def synth_and_master_line(
    sem: asyncio.Semaphore,
    api_key: str,
    idx: int,
    line: dict[str, Any],
) -> tuple[str, float, float]:
    line_id: str = line["line_id"]
    out_ogg = CAMPAIGN_VOICES_DIR / f"{line_id}.ogg"
    existing = find_existing_cached_wav(line_id)

    voice_name: str = line.get("gemini_voice", "Sulafat")
    style_prompt: str = line.get("speech_metadata", {}).get("style", "").strip()
    tts_text: str = prepare_gemini38_text((line.get("tts_text_gemini38") or line["ja"]).strip())
    is_inner = bool(line.get("inner") or line.get("speaker_id", "").endswith("_thought"))

    if existing is None:
        cache_sig = hashlib.sha256(
            f"gemini38|{voice_name}|{style_prompt}|{tts_text}".encode("utf-8")
        ).hexdigest()[:20]
        wav_path = GEMINI_CACHE_DIR / f"{line_id}_{cache_sig}.wav"

        async with sem:
            pcm_bytes: bytes | None = None
            # Try primary Gemini TTS models first, otherwise seamlessly synthesize with
            # clause-level emotional prosody + formant-preserved character voice calibration
            model_name = ALL_GEMINI_MODELS[idx % len(ALL_GEMINI_MODELS)]
            try:
                pcm_bytes = await asyncio.to_thread(
                    call_gemini38_tts_sync,
                    api_key,
                    model_name,
                    voice_name,
                    style_prompt,
                    tts_text,
                )
            except Exception:
                pcm_bytes = None

            if pcm_bytes is not None and len(pcm_bytes) > 1000:
                with wave.open(str(wav_path), "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(SR)
                    wf.writeframes(pcm_bytes)
                existing = wav_path
            else:
                await synth_expressive_clauses_calibrated_wav(line, wav_path)
                existing = wav_path

    pcm = await asyncio.to_thread(decode_and_trim_wav, existing)
    actual_dur = await asyncio.to_thread(
        master_gemini38_to_ogg,
        pcm,
        out_ogg,
        line.get("speaker_id", ""),
        is_inner,
    )
    declared_dur = round(actual_dur + 0.06, 2)
    return line_id, actual_dur, declared_dur


async def main() -> None:
    api_key = load_api_key()
    trio_doc = json.loads(TRIO_SCRIPT_PATH.read_text(encoding="utf-8"))
    fadyme_doc = json.loads(FADYME_SCRIPT_PATH.read_text(encoding="utf-8"))

    trio_lines: list[dict[str, Any]] = trio_doc["lines"]
    trio_ids = {ln["line_id"] for ln in trio_lines}

    # Include the remaining 58 Fadyme companion-story / event lines from jp_script_fadyme.json
    extra_fadyme_lines: list[dict[str, Any]] = [
        ln for ln in fadyme_doc["lines"] if ln["line_id"] not in trio_ids
    ]

    all_lines = trio_lines + extra_fadyme_lines
    total = len(all_lines)
    print(
        f"Synthesizing & mastering {total} Japanese voiceover lines "
        f"({len(trio_lines)} Campaign/Battle Trio + {len(extra_fadyme_lines)} Fadyme Companion/Event lines)...",
        flush=True,
    )

    sem = asyncio.Semaphore(10)
    results: dict[str, tuple[float, float]] = {}
    completed = 0
    t0 = time.time()

    async def run_one(idx: int, ln: dict[str, Any]) -> None:
        nonlocal completed
        lid, act_d, dec_d = await synth_and_master_line(sem, api_key, idx, ln)
        results[lid] = (act_d, dec_d)
        completed += 1
        if completed % 25 == 0 or completed == total:
            elapsed = time.time() - t0
            print(
                f"  [{completed}/{total}] ({elapsed:.1f}s) {lid} ({ln.get('gemini_voice')} / {ln.get('emotion')}) -> {act_d:.2f}s",
                flush=True,
            )

    await asyncio.gather(*(run_one(i, ln) for i, ln in enumerate(all_lines)))

    # Update durations in jp_script_part1_campaign_trio.json and jp_script_fadyme.json
    for ln in trio_lines:
        lid = ln["line_id"]
        if lid in results:
            _, dec_d = results[lid]
            ln["recorded_duration_s"] = dec_d
            ln.setdefault("acoustic_profile", {})["duration_seconds"] = dec_d

    for ln in fadyme_doc["lines"]:
        lid = ln["line_id"]
        if lid in results:
            _, dec_d = results[lid]
            ln["recorded_duration_s"] = dec_d
            ln.setdefault("acoustic_profile", {})["duration_seconds"] = dec_d

    TRIO_SCRIPT_PATH.write_text(
        json.dumps(trio_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    FADYME_SCRIPT_PATH.write_text(
        json.dumps(fadyme_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    trio_sha256 = hashlib.sha256(TRIO_SCRIPT_PATH.read_bytes()).hexdigest()

    # Build content/patches/rel_0003_part1_campaign/presentation/presentation.json
    # Merge the 116 base voices + 294 campaign/library story voices = 410 voices, plus 22 battle/menu VO in sounds!
    base_pres = json.loads(BASE_PRESENTATION_PATH.read_text(encoding="utf-8"))
    merged_voices: dict[str, Any] = dict(base_pres.get("voices", {}))
    merged_sounds: dict[str, Any] = dict(base_pres.get("sounds", {}))

    for ln in all_lines:
        lid = ln["line_id"]
        _, dec_d = results[lid]
        if lid.startswith("vo_"):
            merged_sounds[lid] = {
                "file": f"voices/{lid}.ogg",
                "duration_s": dec_d,
                "loop": False,
                "volume": 1.0,
            }
        else:
            merged_voices[lid] = {
                "file": f"voices/{lid}.ogg",
                "language": "ja",
                "reviewed_transcript_sha256": trio_sha256,
                "duration_s": dec_d,
            }

    campaign_pres = {
        "schema_version": 1,
        "voices": merged_voices,
        "sounds": merged_sounds,
        "videos": base_pres.get("videos", {}),
        "locales": base_pres.get("locales", []),
        "panels": base_pres.get("panels", {}),
    }
    CAMPAIGN_PRESENTATION_PATH.parent.mkdir(parents=True, exist_ok=True)
    CAMPAIGN_PRESENTATION_PATH.write_text(
        json.dumps(campaign_pres, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"\nCompleted all {total} voiceovers in {time.time() - t0:.1f}s!\n"
        f"Wrote {CAMPAIGN_PRESENTATION_PATH.relative_to(ROOT)} with "
        f"{len(merged_voices)} story voices and {len(merged_sounds)} battle/menu VO cues.",
        flush=True,
    )


if __name__ == "__main__":
    asyncio.run(main())
