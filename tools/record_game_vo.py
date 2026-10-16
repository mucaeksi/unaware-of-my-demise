#!/usr/bin/env python3
"""
Production Japanese Voice-Over Synthesis & Manifest Builder for Unaware of My Demise.

Locked Canonical Cast:
  - Narrator (`narrator`) : Algieba  (`ja-JP-Chirp3-HD-Algieba`)
  - Fadyme   (`fadyme`)   : Sulafat  (`ja-JP-Chirp3-HD-Sulafat`)
  - Mahmut   (`mahmut`)   : Iapetus  (`ja-JP-Chirp3-HD-Iapetus`)

Reads `narrative/10_VO/Line_Maps/jp_script_vertical_slice_master.json` (all 116 lines of
the active vertical-slice AAB build) and synthesizes natural, non-robotic Japanese voice
performances using either:
  1. `gemini-3.8-flash-tts` (with `speech_metadata.style` + inline `<...>` vocal tags)
  2. `chirp3-hd` (with clause-level `ssml_chirp3` `<prosody>` and `<break>` tags)

Also updates `content/base/story/presentation.json` (`voices` map) for any rendered VO files.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import urllib.request
import wave
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


ROOT = Path(__file__).resolve().parents[1]
MASTER_SCRIPT_PATH = ROOT / "narrative" / "10_VO" / "Line_Maps" / "jp_script_vertical_slice_master.json"
PRESENTATION_PATH = ROOT / "content" / "base" / "presentation" / "presentation.json"
VO_OUT_ROOT = ROOT / "content" / "base" / "voices"


def load_env_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return key
    env_file = ROOT / ".env"
    if env_file.exists():
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def load_master_script() -> dict[str, Any]:
    return json.loads(MASTER_SCRIPT_PATH.read_text(encoding="utf-8"))


def write_wav_pcm16(path: Path, pcm: bytes, sample_rate: int = 24000) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)


def transcode_and_normalize_ogg(wav_path: Path, ogg_path: Path) -> float:
    """Normalizes speech to -20 LUFS / -1.5 dBTP and encodes to 24kHz Vorbis OGG without any artificial pitch shifting."""
    import imageio_ffmpeg  # type: ignore

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    ogg_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg_exe,
        "-y",
        "-i",
        str(wav_path),
        "-af",
        "loudnorm=I=-20:TP=-1.5:LRA=11",
        "-ar",
        "24000",
        "-ac",
        "1",
        "-c:a",
        "libvorbis",
        "-q:a",
        "6",
        str(ogg_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with wave.open(str(wav_path), "rb") as wf:
        return round(wf.getnframes() / float(wf.getframerate()), 2)


def normalize_inline_tags(tts_text: str) -> str:
    """Normalizes inline vocal tags to official Gemini 3.8 TTS angle-bracket tags."""
    return tts_text.replace("<soft chuckle>", "<chuckle>")


def synthesize_gemini38(entry: dict[str, Any], api_key: str) -> bytes:
    """
    Calls the official Gemini 3.8 Flash TTS Interactions API (`v1beta/interactions`)
    with turn-level `speech_metadata.style` acting direction and inline `<...>` vocal tags.
    """
    url = "https://generativelanguage.googleapis.com/v1beta/interactions"
    style_prompt = entry.get("speech_metadata", {}).get("style", "").strip()
    tts_text = normalize_inline_tags(entry.get("tts_text_gemini38") or entry["ja"])

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
        "model": "gemini-3.8-flash-tts",
        "input": [
            {
                "type": "user_input",
                "content": [content_item],
            }
        ],
        "response_format": {
            "type": "audio",
            "mime_type": "audio/l16",
            "sample_rate": 24000,
        },
        "generation_config": {
            "speech_config": [
                {
                    "voice": entry["gemini_voice"],
                }
            ]
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
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


def synthesize_chirp3_ssml(entry: dict[str, Any], token: str, project_id: str) -> bytes:
    """Calls Google Cloud Text-to-Speech Chirp3-HD with clause-level SSML prosody and breaks."""
    url = "https://texttospeech.googleapis.com/v1/text:synthesize"
    payload = {
        "input": {"ssml": entry["ssml_chirp3"]},
        "voice": {
            "languageCode": "ja-JP",
            "name": entry["chirp3_voice_id"],
        },
        "audioConfig": {
            "audioEncoding": "LINEAR16",
            "sampleRateHertz": 24000,
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "x-goog-user-project": project_id,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return base64.b64decode(body["audioContent"])


def sync_presentation_manifest(lines: list[dict[str, Any]]) -> int:
    """Updates `content/base/presentation/presentation.json` for any recorded VO audio files present on disk."""
    import hashlib

    script_sha256 = hashlib.sha256(MASTER_SCRIPT_PATH.read_bytes()).hexdigest()
    if PRESENTATION_PATH.exists():
        pres = json.loads(PRESENTATION_PATH.read_text(encoding="utf-8"))
    else:
        pres = {
            "schema_version": 1,
            "voices": {},
            "sounds": {},
            "videos": {},
            "locales": [],
            "panels": {},
        }
    voices = pres.setdefault("voices", {})
    registered = 0
    for entry in lines:
        line_id = entry["line_id"]
        rel_path = entry["output_ogg"]
        abs_path = ROOT / "content" / "base" / rel_path
        if abs_path.exists():
            voices[line_id] = {
                "file": rel_path,
                "language": "ja",
                "reviewed_transcript_sha256": script_sha256,
                "duration_s": entry.get("recorded_duration_s", entry["acoustic_profile"]["duration_seconds"]),
            }
            registered += 1
    PRESENTATION_PATH.parent.mkdir(parents=True, exist_ok=True)
    PRESENTATION_PATH.write_text(json.dumps(pres, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return registered


def main() -> None:
    parser = argparse.ArgumentParser(description="Synthesize and verify non-robotic Japanese VO for UOMD.")
    parser.add_argument("--engine", choices=["gemini-3.8-flash-tts", "chirp3-hd"], default="gemini-3.8-flash-tts")
    parser.add_argument("--scene", help="Filter by scene_id (e.g. prologue_hours, tutorial_t1_before)")
    parser.add_argument("--speaker", choices=["narrator", "fadyme", "mahmut"], help="Filter by speaker_id")
    parser.add_argument("--line-id", help="Filter by a single line_id")
    parser.add_argument("--dry-run", action="store_true", help="Inspect prompts & payloads without calling paid TTS APIs")
    parser.add_argument("--sync-manifest", action="store_true", help="Sync existing voices/* files into presentation.json")
    args = parser.parse_args()

    master = load_master_script()
    lines: list[dict[str, Any]] = master["lines"]
    if args.scene:
        lines = [l for l in lines if l["scene_id"] == args.scene or l["scene_id"].startswith(args.scene)]
    if args.speaker:
        lines = [l for l in lines if l["speaker_id"] == args.speaker]
    if args.line_id:
        lines = [l for l in lines if l["line_id"] == args.line_id]

    if args.sync_manifest:
        count = sync_presentation_manifest(master["lines"])
        print(f"Synced {count} recorded VO files into {PRESENTATION_PATH.relative_to(ROOT)}")
        return

    if args.dry_run:
        print(f"=== DRY RUN: {len(lines)} lines selected (Engine: {args.engine}) ===")
        for entry in lines[:5]:
            print(f"\n[{entry['line_id']}] {entry['speaker_id'].upper()} -> {entry['gemini_voice']} ({entry['emotion']})")
            print(f"  WHEN  : {entry['when_cue']}")
            print(f"  SUBTXT: {entry['subtext_tr']}")
            print(f"  STYLE : {entry['speech_metadata']['style']}")
            print(f"  TAGS  : {entry['tts_text_gemini38']}")
            print(f"  SSML  : {entry['ssml_chirp3']}")
        if len(lines) > 5:
            print(f"\n... and {len(lines) - 5} more lines ready in {MASTER_SCRIPT_PATH.relative_to(ROOT)}.")
        return

    api_key = load_env_key()
    for entry in lines:
        line_id = entry["line_id"]
        ogg_path = ROOT / "content" / "base" / entry["output_ogg"]
        wav_path = ROOT / ".cache" / "vo_wav" / f"{line_id}.wav"
        if args.engine == "gemini-3.8-flash-tts":
            if not api_key:
                raise RuntimeError("Set GEMINI_API_KEY in environment or .env to synthesize with gemini-3.8-flash-tts (or run with --dry-run).")
            pcm = synthesize_gemini38(entry, api_key)
        else:
            token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
            project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "gen-lang-client-0420587209")
            pcm = synthesize_chirp3_ssml(entry, token, project_id)
        write_wav_pcm16(wav_path, pcm, 24000)
        dur = transcode_and_normalize_ogg(wav_path, ogg_path)
        entry["recorded_duration_s"] = dur
        entry["acoustic_profile"]["duration_seconds"] = dur
        print(f"Recorded {line_id} ({entry['gemini_voice']} / {entry['emotion']}) -> {ogg_path.relative_to(ROOT)} ({dur:.2f}s)")

    MASTER_SCRIPT_PATH.write_text(json.dumps(master, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sync_presentation_manifest(master["lines"])


if __name__ == "__main__":
    main()
