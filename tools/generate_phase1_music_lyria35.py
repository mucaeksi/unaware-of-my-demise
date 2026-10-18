#!/usr/bin/env python3
"""
Generate the 4 cohesive Phase 1 scene & battle music tracks for Unaware of My Demise
using Google's flagship Lyria 3.5 model (`lyria-3.5`) via the Gemini Interactions API:
1. `bgm_prologue_before_the_road.ogg` — Prologue ("Before the Road", 9-scene elegy in D minor, 66 BPM)
2. `bgm_fadyme_theme.ogg` (also linked to `bgm_ch1_ash_forest_calm`) — Calm, wistful, intimate story moments (68 BPM D minor)
3. `bgm_ch1_ash_forest_uneasy.ogg` — Pre-battle mist & ambush tension (74 BPM D minor)
4. `bgm_battle_field.ogg` — Tactical 5v5 battle theme (114 BPM D minor Anatolian gothic rock & chamber strings)

All tracks share the D-minor harmonic DNA and clean, uncluttered analog/chamber palette of `bgm_main_theme.ogg`.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".cache" / "py_pkgs"))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import imageio_ffmpeg  # type: ignore

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
ENV_PATH = ROOT / ".env"
CACHE_DIR = ROOT / ".cache" / "lyria35_phase1"
OUT_AUDIO_DIR = ROOT / "content" / "base" / "audio"
PUBLIC_AUDITION_DIR = ROOT / "apps" / "game" / "public" / "audition" / "music"
ART_MANIFEST_PATH = ROOT / "content" / "base" / "art" / "art_manifest.json"
RELEASE_JSON_PATH = ROOT / "content" / "base" / "release.json"


# every paid request is reserved/settled in content/budget/media_budget.json (README R14)
sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from media_budget import paid_call  # noqa: E402

def load_api_key() -> str:
    for key_name in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        val = os.environ.get(key_name, "").strip()
        if val:
            return val
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                if k.strip() in ("GEMINI_API_KEY", "GOOGLE_API_KEY") and v.strip():
                    return v.strip().strip('"').strip("'")
    raise RuntimeError("GEMINI_API_KEY not found in environment or .env")


TRACK_SPECS = [
    {
        "cue_id": "bgm_prologue_before_the_road",
        "file_name": "bgm_prologue_before_the_road.ogg",
        "title": "1. Prologue — Before the Road (66 BPM D Minor Elegy)",
        "loop_start_s": 16.0,
        "target_lufs": -15.5,
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "A deeply emotional, slow, cinematic Anatolian gothic chamber and melancholic rock elegy in D minor at 66 BPM. "
            "Spacious, crystal-clear, uncluttered studio recording with four core instruments "
            "(warm clean vintage tube electric guitar, mournful solo cello, intimate felt piano, and deep bowed double bass):\n"
            "[Intro] A lone, warm spring-reverb clean electric guitar and delicate felt piano play a slow, sorrowful descending minor arpeggio "
            "(Dm - C - Bb - A7) with expressive micro-bends and a single distant bronze tower bell resonance.\n"
            "[Middle] A mournful, expressive solo cello enters with a heart-wrenching melody over warm bowed double bass and weeping clean guitar notes, "
            "evoking a fallen kingdom buried in silent ash.\n"
            "[Climax & Outro] The felt piano, solo cello, and weeping clean electric guitar unite in a tender, intimate duet of quiet devotion and reunion in the snow, "
            "resolving peacefully on a warm D minor chord. Strictly instrumental only, no vocals."
        ),
    },
    {
        "cue_id": "bgm_fadyme_theme",
        "file_name": "bgm_fadyme_theme.ogg",
        "also_copy_to": [("bgm_ch1_ash_forest_calm", "bgm_ch1_ash_forest_calm.ogg")],
        "title": "2. Dingin & Hüzünlü Hikâye Teması — Quiet Road & Shelter Warmth (68 BPM D Minor)",
        "loop_start_s": 14.5,
        "target_lufs": -16.5,
        "prompt": (
            "Instrumental only, strictly no vocals, no singing. "
            "An intimate, minimalist, nocturnal melancholic slow ballad in D minor at 68 BPM, "
            "inspired by the quiet, tender acoustic and clean-guitar soul of an early-2000s Turkish slow rock ballad and dark anime romance theme. "
            "Very spacious, uncrowded, warm studio mix designed to sit gently beneath dialogue:\n"
            "[Intro] A soft, intimate felt piano and a warm, clean vintage tube electric guitar with spring reverb play a gentle, wistful descending D minor melody "
            "with delicate slides and subtle vibrato.\n"
            "[Verse] A warm solo cello and deep round bass guitar join softly, trading tender phrases with the clean weeping electric guitar "
            "like two quiet companions walking side by side at dusk.\n"
            "[Bridge] A delicate silver bell harmonic shimmers once over warm fingerpicked acoustic guitar and sustained cello notes.\n"
            "[Outro] Returns to the intimate felt piano and clean reverb electric guitar, fading peacefully. Strictly instrumental only, no vocals."
        ),
    },
    {
        "cue_id": "bgm_ch1_ash_forest_uneasy",
        "file_name": "bgm_ch1_ash_forest_uneasy.ogg",
        "title": "3. Savaş Öncesi Gerilim — Mist & Bellbound Shadows (74 BPM D Minor)",
        "loop_start_s": 12.0,
        "target_lufs": -16.0,
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "A taut, atmospheric dark gothic suspense and pre-battle tension theme in D minor at 74 BPM. "
            "Clean, spacious, uncluttered studio mix with zero harsh noise:\n"
            "[Intro] Deep, ominous bowed double bass drone and a slow, muffled heartbeat frame-drum pulse in the mist, "
            "accompanied by a sparse, haunting clean electric guitar playing minor harmonics and distant iron bell overtones.\n"
            "[Development] Low staccato cello and viola ostinatos weave a quiet sense of approaching danger with subtle Anatolian minor intervals (D harmonic minor) "
            "and taut bass guitar notes, building suspense with elegance and restraint.\n"
            "[Outro] Holds on a tense, expectant D minor string and clean guitar cadence ready to transition into battle. Strictly instrumental only, no vocals."
        ),
    },
    {
        "cue_id": "bgm_battle_field",
        "file_name": "bgm_battle_field.ogg",
        "title": "4. Taktiksel Savaş Teması — Iron Shield & Silver Bell (114 BPM D Minor)",
        "loop_start_s": 13.5,
        "target_lufs": -15.0,
        "prompt": (
            "Instrumental only, strictly no vocals, no singing. "
            "A driving, melodic Anatolian gothic rock and dark anime tactical battle theme in D minor at 114 BPM. "
            "Crisp, punchy, uncluttered studio production with high instrument separation:\n"
            "[Intro] Tight rhythmic staccato cello ostinato, deep driving bass guitar, and a punchy rock drum beat lock into a purposeful 114 BPM groove in D minor.\n"
            "[Main Theme] A warm, singing tube-overdriven lead electric guitar enters with a heroic yet melancholic Anatolian minor melody full of expressive bends, "
            "backed by dramatic chamber strings and crisp snare and kick drums.\n"
            "[Bridge] Brief tactical breakdown with clean reverb guitar arpeggios, bass groove, and a resonant silver bell strike before surging back into the soaring lead electric guitar and cello battle chorus.\n"
            "[Outro] Clean, decisive D minor rock and string cadence suitable for seamless looping. Strictly instrumental only, no vocals."
        ),
    },
]


def _call_lyria_unmetered(api_key: str, prompt_text: str) -> bytes:
    url = "https://generativelanguage.googleapis.com/v1beta/interactions"
    payload = {
        "model": "lyria-3.5",
        "input": prompt_text,
        "response_format": {"type": "audio"},
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
    with urllib.request.urlopen(req, timeout=240) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    if "output_audio" in data and isinstance(data["output_audio"], dict) and data["output_audio"].get("data"):
        return base64.b64decode(data["output_audio"]["data"])

    for step in data.get("steps", []):
        if step.get("type") == "model_output":
            for block in step.get("content", []):
                if block.get("type") == "audio" and block.get("data"):
                    return base64.b64decode(block["data"])

    raise RuntimeError(f"No audio block found in Lyria 3.5 response: {json.dumps(data)[:600]}")


def probe_duration_seconds(audio_path: Path) -> float:
    proc = subprocess.run(
        [FFMPEG, "-i", str(audio_path)],
        capture_output=True,
        text=True,
    )
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr)
    if not m:
        return 120.0
    h, mins, secs = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return h * 3600 + mins * 60 + secs


def master_track(raw_audio_bytes: bytes, cue_id: str, file_name: str, target_lufs: float) -> dict:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUT_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_AUDITION_DIR.mkdir(parents=True, exist_ok=True)

    raw_path = CACHE_DIR / f"{cue_id}_raw.mp3"
    if not raw_path.exists() or raw_path.stat().st_size < 10000:
        raw_path.write_bytes(raw_audio_bytes)

    ogg_path = OUT_AUDIO_DIR / file_name
    mp3_path = PUBLIC_AUDITION_DIR / f"{cue_id}.mp3"

    raw_dur = probe_duration_seconds(raw_path)
    capped_dur = min(raw_dur, 176.0)
    fade_out_start = max(1.0, capped_dur - 3.2)

    af_chain = (
        f"atrim=0:{capped_dur:.2f},"
        f"asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d=1.4,"
        f"afade=t=out:st={fade_out_start:.2f}:d=3.0,"
        f"loudnorm=I={target_lufs:.1f}:TP=-1.2:LRA=11"
    )

    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(raw_path),
            "-af",
            af_chain,
            "-ar",
            "48000",
            "-ac",
            "2",
            "-c:a",
            "libvorbis",
            "-q:a",
            "6",
            str(ogg_path),
        ],
        check=True,
        capture_output=True,
    )

    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(raw_path),
            "-af",
            af_chain,
            "-ar",
            "44100",
            "-ac",
            "2",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "192k",
            str(mp3_path),
        ],
        check=True,
        capture_output=True,
    )

    final_dur = probe_duration_seconds(ogg_path)
    return {
        "cue_id": cue_id,
        "file_name": file_name,
        "duration_s": round(final_dur, 2),
        "ogg_path": str(ogg_path),
        "mp3_path": str(mp3_path),
    }


def update_manifests(generated: list[dict]) -> None:
    art_doc = json.loads(ART_MANIFEST_PATH.read_text(encoding="utf-8"))
    music_map = art_doc.setdefault("music", {})

    updated_files: list[tuple[str, Path, str, str]] = []

    for item in generated:
        cue_id = item["cue_id"]
        file_name = item["file_name"]
        loop_start_s = round(min(item["loop_start_s"], max(0.0, item["duration_s"] * 0.4)), 2)
        declared_dur = min(180.0, round(item["duration_s"] + 0.15, 2))
        music_map[cue_id] = {
            "file": f"audio/{file_name}",
            "loop_start_s": loop_start_s,
            "duration_s": declared_dur,
        }
        updated_files.append((f"audio/{file_name}", OUT_AUDIO_DIR / file_name, "audio/ogg", "audio"))

        for alias_cue, alias_file in item.get("also_copy_to", []):
            alias_path = OUT_AUDIO_DIR / alias_file
            shutil.copyfile(OUT_AUDIO_DIR / file_name, alias_path)
            music_map[alias_cue] = {
                "file": f"audio/{alias_file}",
                "loop_start_s": loop_start_s,
                "duration_s": declared_dur,
            }
            updated_files.append((f"audio/{alias_file}", alias_path, "audio/ogg", "audio"))

    ART_MANIFEST_PATH.write_text(json.dumps(art_doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    updated_files.append(("art/art_manifest.json", ART_MANIFEST_PATH, "application/json", "art_manifest"))

    if RELEASE_JSON_PATH.exists():
        rel_doc = json.loads(RELEASE_JSON_PATH.read_text(encoding="utf-8"))
        rel_map = {entry["path"]: entry for entry in rel_doc.get("files", [])}
        for rel_path, disk_path, media_type, kind in updated_files:
            if disk_path.exists():
                raw = disk_path.read_bytes()
                rel_map[rel_path] = {
                    "path": rel_path,
                    "sha256": hashlib.sha256(raw).hexdigest(),
                    "bytes": len(raw),
                    "media_type": media_type,
                    "kind": kind,
                }
        rel_doc["files"] = sorted(rel_map.values(), key=lambda x: x["path"])
        RELEASE_JSON_PATH.write_text(json.dumps(rel_doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    api_key = load_api_key()
    results = []
    for spec in TRACK_SPECS:
        cue_id = spec["cue_id"]
        cached_raw = CACHE_DIR / f"{cue_id}_raw.mp3"
        if cached_raw.exists() and cached_raw.stat().st_size > 10000:
            print(f"[CACHE] Using cached Lyria 3.5 audio for {cue_id} ({cached_raw.stat().st_size} bytes)")
            raw_bytes = cached_raw.read_bytes()
        else:
            print(f"[LYRIA 3.5] Generating {cue_id} ({spec['title']}) ...")
            raw_bytes = call_lyria(api_key, spec["prompt"])
        info = master_track(raw_bytes, cue_id, spec["file_name"], spec["target_lufs"])
        info["title"] = spec["title"]
        info["loop_start_s"] = spec["loop_start_s"]
        info["also_copy_to"] = spec.get("also_copy_to", [])
        results.append(info)
        print(f"  -> {cue_id}: {info['duration_s']}s mastered to {info['ogg_path']}")

    update_manifests(results)
    print("\n=== ALL 4 PHASE 1 LYRIA 3.5 TRACKS GENERATED & MANIFESTS UPDATED ===")
    print(json.dumps(results, indent=2, ensure_ascii=False))



def call_lyria(api_key: str, prompt_text: str) -> bytes:
    with paid_call("LYRIA", "phase-1 music cue", "lyria-3.5", prompt=prompt_text):
        return _call_lyria_unmetered(api_key, prompt_text)

if __name__ == "__main__":
    main()
