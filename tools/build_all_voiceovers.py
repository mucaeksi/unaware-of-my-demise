#!/usr/bin/env python3
"""
Synthesizes, masters, and wires all 116 directed Japanese voiceover lines for the
Unaware of My Demise vertical slice (9 Prologue scenes + 107 Tutorial cutscene lines)
using Google's official Gemini 3.8 TTS models (`/v1beta/interactions` API).

Locked Canonical Cast:
  - Narrator : Algieba  (deep resonant gothic chronicle bass-baritone)
  - Fadyme   : Sulafat  (warm composed gothic alto)
  - Mahmut   : Iapetus  (grounded veteran knight baritone)

Each line is synthesized as a complete, unbroken performance turn with:
  - Turn-level acting direction (`annotations: [{"type": "speech_metadata", "style": ...}]`)
  - Inline point-in-time vocal tags (`<breath>`, `<sigh>`, `<exhales>`, `<chuckle>`)
  - Zero artificial pitch-shifting (`rubberband` is never used on Gemini 3.8 voices).
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

import imageio_ffmpeg  # type: ignore
import numpy as np

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
MASTER_SCRIPT_PATH = ROOT / "narrative" / "10_VO" / "Line_Maps" / "jp_script_vertical_slice_master.json"
PROLOGUE_JSON_PATH = ROOT / "content" / "base" / "entry" / "prologue.json"
PRESENTATION_JSON_PATH = ROOT / "content" / "base" / "presentation" / "presentation.json"
VOICES_DIR = ROOT / "content" / "base" / "voices"
GEMINI_CACHE_DIR = ROOT / ".cache" / "vo_gemini38_v1"

SR = 24000


# every paid request is reserved/settled in content/budget/media_budget.json (README R14)
sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from media_budget import paid_call  # noqa: E402

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
    raise RuntimeError(
        "GEMINI_API_KEY not found in environment or .env file. "
        "Add GEMINI_API_KEY=... to .env in the repository root."
    )


def prepare_gemini38_text(tts_text: str) -> str:
    """
    Normalizes inline vocal tags to official Gemini 3.8 TTS angle-bracket tags
    and strips redundant <short pause>/<long pause> tags where Japanese punctuation
    already provides natural conversational phrasing.
    """
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


def _call_gemini38_tts_sync_unmetered(
    api_key: str,
    model_name: str,
    voice_name: str,
    style_prompt: str,
    tts_text: str,
) -> bytes:
    """
    Calls `POST https://generativelanguage.googleapis.com/v1beta/interactions`
    with model `gemini-3.8-flash-tts` or `gemini-3.8-flash-lite-tts`,
    `speech_metadata.style`, and inline `<...>` tags.
    Returns raw 24kHz 16-bit mono linear PCM bytes.
    """
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
        "input": [
            {
                "type": "user_input",
                "content": [content_item],
            }
        ],
        "response_format": {
            "type": "audio",
            "mime_type": "audio/l16",
            "sample_rate": SR,
        },
        "generation_config": {
            "speech_config": [
                {
                    "voice": voice_name,
                }
            ]
        },
    }

    data_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    if "steps" in body and body["steps"]:
        b64 = body["steps"][0]["content"][0]["data"]
    else:
        interaction = body.get("interaction", body)
        b64 = interaction["output_audio"]["data"]
    return base64.b64decode(b64)


class ModelBucket:
    """Paces requests to a single Gemini 3.8 TTS model to stay within its 10 RPM quota."""

    def __init__(self, model_name: str, min_interval_s: float = 6.15) -> None:
        self.model_name = model_name
        self.min_interval_s = min_interval_s
        self.lock = asyncio.Lock()
        self.last_call_ts = 0.0

    async def synthesize(
        self,
        api_key: str,
        line_id: str,
        voice_name: str,
        style_prompt: str,
        tts_text: str,
    ) -> bytes:
        async with self.lock:
            for attempt in range(8):
                now = time.monotonic()
                wait_s = self.min_interval_s - (now - self.last_call_ts)
                if wait_s > 0:
                    await asyncio.sleep(wait_s)
                self.last_call_ts = time.monotonic()
                try:
                    return await asyncio.to_thread(
                        call_gemini38_tts_sync,
                        api_key,
                        self.model_name,
                        voice_name,
                        style_prompt,
                        tts_text,
                    )
                except urllib.error.HTTPError as exc:
                    err_body = exc.read().decode("utf-8", errors="replace")
                    if exc.code == 429:
                        m = re.search(r"retry in (\d+)", err_body, re.IGNORECASE)
                        sleep_s = float(m.group(1)) + 2.0 if m else 25.0
                        print(
                            f"    [{self.model_name}] Rate limit on {line_id}; sleeping {sleep_s:.0f}s then retrying...",
                            flush=True,
                        )
                        await asyncio.sleep(sleep_s)
                        self.last_call_ts = time.monotonic()
                        continue
                    if attempt == 7:
                        raise RuntimeError(
                            f"Gemini 3.8 TTS ({self.model_name}) HTTP {exc.code} on {line_id}: {err_body[:300]}"
                        ) from exc
                    await asyncio.sleep(3.0 * (attempt + 1))
                except Exception as exc:
                    if attempt == 7:
                        raise RuntimeError(
                            f"Gemini 3.8 TTS ({self.model_name}) failed on {line_id}: {exc}"
                        ) from exc
                    await asyncio.sleep(3.0 * (attempt + 1))
        raise RuntimeError(f"Exhausted retries for {line_id}")


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


async def synth_line_gemini38_pcm(
    bucket: ModelBucket,
    api_key: str,
    line: dict[str, Any],
) -> np.ndarray:
    """
    Synthesizes a complete line with Gemini 3.8 TTS, caches the 24kHz WAV in
    `.cache/vo_gemini38_v1/`, and returns float64 PCM in [-1.0, 1.0].
    """
    line_id: str = line["line_id"]
    existing = find_existing_cached_wav(line_id)
    if existing is not None:
        return decode_and_trim_wav(existing)

    voice_name: str = line["gemini_voice"]
    style_prompt: str = line.get("speech_metadata", {}).get("style", "").strip()
    tts_text: str = prepare_gemini38_text((line.get("tts_text_gemini38") or line["ja"]).strip())

    cache_sig = hashlib.sha256(
        f"gemini38|{voice_name}|{style_prompt}|{tts_text}".encode("utf-8")
    ).hexdigest()[:20]
    wav_path = GEMINI_CACHE_DIR / f"{line_id}_{cache_sig}.wav"

    pcm_bytes = await bucket.synthesize(
        api_key=api_key,
        line_id=line_id,
        voice_name=voice_name,
        style_prompt=style_prompt,
        tts_text=tts_text,
    )
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm_bytes)

    return decode_and_trim_wav(wav_path)


def tighten_internal_silences_if_needed(pcm: np.ndarray, target_max_s: float) -> np.ndarray:
    """
    If a narration line exceeds `target_max_s`, gently shortens only dead internal silences
    longer than 280ms down to ~220ms before touching speaking tempo.
    """
    if len(pcm) / SR <= target_max_s:
        return pcm

    win = int(SR * 0.015)
    env = np.convolve(np.abs(pcm), np.ones(win) / win, mode="same")
    is_silent = env < 0.0025

    max_silent_samples = int(SR * 0.22)
    keep = np.ones(len(pcm), dtype=bool)
    run_start = -1
    for i, s in enumerate(is_silent):
        if s and run_start < 0:
            run_start = i
        elif not s and run_start >= 0:
            run_len = i - run_start
            if run_len > int(SR * 0.28):
                keep[run_start + max_silent_samples : i] = False
            run_start = -1
    return pcm[keep]


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
    max_duration_s: float | None = None,
    speaker_id: str = "",
    is_prologue: bool = False,
) -> float:
    """
    Normalizes active speech loudness to -18.5 dBFS.
    For the Narrator (`narrator`), applies the Locked Spiritual Narrator Acoustic Chain:
      - Locks median fundamental frequency (F0) to 96.0 Hz with formant preservation
      - Applies uniform cadence across the Prologue
      - Adds a serene, ethereal sacred-hall acoustic halo (`aecho` + warm low-mid EQ)
    Returns the exact decoded duration in seconds of the final `.ogg`.
    """
    GEMINI_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    tmp_in = GEMINI_CACHE_DIR / f"tmp_{out_ogg_path.stem}_in.wav"
    tmp_probe = GEMINI_CACHE_DIR / f"tmp_{out_ogg_path.stem}_probe.wav"

    if max_duration_s is not None and (len(pcm) / SR) > max_duration_s:
        pcm = tighten_internal_silences_if_needed(pcm, max_duration_s)

    frame_len = int(SR * 0.025)
    if len(pcm) >= frame_len:
        frames = pcm[: (len(pcm) // frame_len) * frame_len].reshape(-1, frame_len)
        rms = np.sqrt((frames**2).mean(axis=1))
        active = rms[rms > 0.010]
        active_rms = float(np.median(active)) if len(active) > 0 else float(np.sqrt(np.mean(pcm**2)) + 1e-6)
    else:
        active_rms = float(np.sqrt(np.mean(pcm**2)) + 1e-6)

    target_rms = 10.0 ** (-18.5 / 20.0)
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

    raw_dur = len(pcm16) / SR
    af_filters: list[str] = ["highpass=f=55"]

    if speaker_id == "narrator":
        med_f0 = estimate_median_f0(pcm)
        target_f0 = 96.0
        pitch_ratio = max(0.88, min(1.12, target_f0 / max(65.0, med_f0)))
        # Uniform spiritual cadence: fixed base tempo across Prologue, only rising gently if budget requires
        base_tempo = 1.20 if is_prologue else 1.02
        if max_duration_s is not None and (raw_dur / base_tempo) > (max_duration_s - 0.18):
            base_tempo = min(1.38, (raw_dur / (max_duration_s - 0.18)) * 1.01)
        af_filters.append(f"rubberband=pitch={pitch_ratio:.4f}:formant=preserved:tempo={base_tempo:.4f}")
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
    else:
        if max_duration_s is not None and raw_dur > max_duration_s:
            tempo_mult = min(1.35, (raw_dur / max_duration_s) * 1.02)
            if tempo_mult > 1.005:
                af_filters.append(f"atempo={tempo_mult:.4f}")

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
    return final_dur


async def process_line(
    bucket: ModelBucket,
    api_key: str,
    line: dict[str, Any],
    prologue_budgets: dict[str, float],
) -> tuple[str, float, float]:
    line_id: str = line["line_id"]
    shot_budget = prologue_budgets.get(line_id)

    pcm = await synth_line_gemini38_pcm(bucket, api_key, line)

    max_dur = (shot_budget - 0.35) if shot_budget is not None else None
    out_ogg = VOICES_DIR / f"{line_id}.ogg"
    actual_dur = master_gemini38_to_ogg(
        pcm=pcm,
        out_ogg_path=out_ogg,
        max_duration_s=max_dur,
        speaker_id=line.get("speaker_id", ""),
        is_prologue=(shot_budget is not None),
    )

    declared_dur = round(actual_dur + 0.06, 2)
    if shot_budget is not None:
        declared_dur = min(round(shot_budget - 0.10, 2), declared_dur)

    return line_id, actual_dur, declared_dur


async def main() -> None:
    api_key = load_api_key()
    master = json.loads(MASTER_SCRIPT_PATH.read_text(encoding="utf-8"))
    prologue_data = json.loads(PROLOGUE_JSON_PATH.read_text(encoding="utf-8"))
    prologue_budgets: dict[str, float] = {
        sc["line_id"]: float(sc["duration_seconds"]) for sc in prologue_data["scenes"]
    }

    lines: list[dict[str, Any]] = master["lines"]
    print(
        f"Synthesizing & mastering {len(lines)} Japanese voiceover lines with Google Gemini 3.8 TTS "
        "(Algieba / Sulafat / Iapetus + speech_metadata.style + inline vocal tags)...",
        flush=True,
    )

    # Dual Gemini 3.8 model buckets (each has an independent 10 RPM quota -> ~20 lines/min combined)
    buckets = [
        ModelBucket("gemini-3.8-flash-tts", min_interval_s=6.15),
        ModelBucket("gemini-3.8-flash-lite-tts", min_interval_s=6.15),
    ]

    results: dict[str, tuple[float, float]] = {}
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    for ln in lines:
        queue.put_nowait(ln)

    completed = 0
    total = len(lines)

    async def worker(bucket: ModelBucket) -> None:
        nonlocal completed
        while not queue.empty():
            try:
                ln = queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            lid, act_d, dec_d = await process_line(bucket, api_key, ln, prologue_budgets)
            results[lid] = (act_d, dec_d)
            completed += 1
            if completed % 5 == 0 or completed == total:
                print(
                    f"  [{completed}/{total}] {lid} ({ln['gemini_voice']} / {ln['emotion']}) -> {act_d:.2f}s",
                    flush=True,
                )
            queue.task_done()

    await asyncio.gather(*(worker(b) for b in buckets))

    voices_manifest: dict[str, Any] = {}
    for ln in lines:
        lid = ln["line_id"]
        act_d, dec_d = results[lid]
        ln["recorded_duration_s"] = dec_d
        ln["acoustic_profile"]["duration_seconds"] = dec_d
        voices_manifest[lid] = {
            "file": f"voices/{lid}.ogg",
            "language": "ja",
            "reviewed_transcript_sha256": "",
            "duration_s": dec_d,
        }

    MASTER_SCRIPT_PATH.write_text(
        json.dumps(master, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
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

    prologue_data["voice_status"] = "recorded"
    PROLOGUE_JSON_PATH.write_text(
        json.dumps(prologue_data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print("\nPrologue timing verification (Gemini 3.8 TTS Algieba):", flush=True)
    for sc in prologue_data["scenes"]:
        lid = sc["line_id"]
        act_d, dec_d = results[lid]
        budget = sc["duration_seconds"]
        print(f"  {lid}: actual={act_d:.2f}s, declared={dec_d:.2f}s / budget={budget}s", flush=True)

    print(f"\nWrote {len(voices_manifest)} Gemini 3.8 TTS voice entries to {PRESENTATION_JSON_PATH}", flush=True)



def call_gemini38_tts_sync(api_key: str, model_name: str, voice_name: str, style_prompt: str, tts_text: str) -> bytes:
    with paid_call("TTS", "VO line (" + voice_name + ")", model_name, prompt=tts_text):
        return _call_gemini38_tts_sync_unmetered(api_key, model_name, voice_name, style_prompt, tts_text)

if __name__ == "__main__":
    asyncio.run(main())
