#!/usr/bin/env python3
"""
Generate the official Main Theme (`bgm_main_theme`) for Unaware of My Demise
using Google's flagship Lyria 3.5 model (`lyria-3.5`) via the Gemini Interactions API.

Inspired by the melancholic Anatolian alternative rock ballad spirit and motifs of
'Duman - Haberin Yok Ölüyorum' (descending minor cadence, weeping clean electric guitar
arpeggios, expressive blues-rock bends, warm bass, slow rimshot drums, and gothic chamber cello),
crafted as an original, clean, high-fidelity instrumental main theme for the game's
Title Screen and pivotal emotional scenes.
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
CACHE_DIR = ROOT / ".cache" / "lyria35_main_theme"
OUT_AUDIO_DIR = ROOT / "content" / "base" / "audio"
PUBLIC_AUDITION_DIR = ROOT / "apps" / "game" / "public" / "audition" / "music"
TITLE_ART_PATH = ROOT / "content" / "base" / "art" / "ui_title_bg.webp"
ART_MANIFEST_PATH = ROOT / "content" / "base" / "art" / "art_manifest.json"
RELEASE_JSON_PATH = ROOT / "content" / "base" / "release.json"


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


CANDIDATE_PROMPTS = [
    {
        "id": "main_theme_v3_duman_eclipse_anthem",
        "title": "Varyasyon 1 (Aktif Ana Tema) — Vintage Tube Guitar & Slow Rock Catharsis (72 BPM)",
        "description": "Klasik Duman 'Haberin Yok Ölüyorum' ruhuna en yakın enstrümantal yavaş rock balad: yalnız ve bol reverbli ağlayan elektro gitar arpejleri, inen Anadolu minör yürüyüşü, derin bas, rimshot davul, içli overdrive gitar solosu ve yalnız çello.",
        "prompt": (
            "Instrumental only, strictly no vocals, no singing. "
            "A classic early-2000s Turkish alternative melancholic slow rock ballad in E minor at 72 BPM. "
            "Warm analog studio mix with only four core instruments (clean electric guitar, overdriven lead guitar, warm bass guitar, and slow acoustic drums) plus subtle dark cello:\n"
            "[Intro] A clean vintage tube electric guitar with spring reverb plays a slow, hypnotic, sorrowful descending minor chord progression (Em - D - C - B7) "
            "with expressive crying bends on the G and B strings, joined by a melodic, deep warm bass guitar line.\n"
            "[Verse] A slow, heavy-hearted 4/4 rock drum groove with crisp rimshots and warm kick drum locks in with the bass and clean weeping guitar arpeggios.\n"
            "[Chorus] Pure emotional catharsis: a warm, singing tube-overdriven lead electric guitar plays a heart-wrenching, memorable slow melody full of long crying bends, "
            "slides, and soulful vibrato, backed by mournful cello notes and heavy, spacious rock drums.\n"
            "[Outro] Returns to the lone clean reverb electric guitar and bass, fading out on a sustained E minor chord. "
            "Strictly instrumental only, no vocals."
        ),
        "use_image": False,
        "loop_start_s": 30.2,
    },
    {
        "id": "main_theme_v1_weeping_ballad",
        "title": "Varyasyon 2 — Weeping Electric Guitar & Anatolian Cello Duet (70 BPM)",
        "description": "Temiz, ağlayan elektro gitar arpejleriyle başlayıp içli bir solo çello melodisine ve ardından yükselen overdrive elektro gitar nakaratına bağlanan karanlık-romantik balad.",
        "prompt": (
            "Instrumental only, no vocals, no singing. "
            "A deeply emotional, melancholic Turkish alternative rock and dark gothic cinematic ballad in E minor at 70 BPM, "
            "evoking the soulful, heart-wrenching instrumental spirit of a classic 2000s Anatolian slow rock ballad. "
            "Clean, spacious, uncluttered studio production with high dynamic range and crystal-clear instrument separation:\n"
            "[Intro] A lone, warm, reverb-drenched clean Fender Stratocaster electric guitar plays a slow, weeping descending minor arpeggio motif "
            "(E minor to D major to C major to B7) with expressive, crying bluesy micro-bends and delicate slides, accompanied only by a deep, warm Precision bass.\n"
            "[Verse 1] A mournful solo cello enters with a tender counter-melody alongside the clean weeping electric guitar and gentle acoustic guitar fingerpicking. "
            "A slow, minimal acoustic drum beat enters softly with warm kick and intimate snare rimshots.\n"
            "[Chorus] Emotional, cathartic instrumental chorus: a warm tube-overdriven lead electric guitar sings a soaring, unforgettable, crying melodic hook "
            "with long sustained bends and rich vibrato over lush dark chamber strings (cello and viola ensemble), deep bass, and slow, heavy, heartfelt rock drums.\n"
            "[Bridge] The drums drop out, leaving an intimate dialogue between the weeping clean electric guitar and solo cello with a single distant silver bell chime.\n"
            "[Outro] The descending minor guitar arpeggio returns softly and fades into quiet twilight resonance. "
            "Strictly instrumental only, no vocals, no lyrics."
        ),
        "use_image": True,
        "loop_start_s": 27.0,
    },
    {
        "id": "main_theme_v2_intimate_anatolian_gothic",
        "title": "Varyasyon 3 — Intimate Midnight Guitar & Symphonic Rock Climax (68 BPM)",
        "description": "Yalnız elektro gitar ve akustik gitar parmak arpejleriyle başlayıp geniş yaylılar ve ağlayan solo gitarla büyüyen sinematik versiyon.",
        "prompt": (
            "Instrumental only, no vocals, no lyrics. "
            "A slow, hauntingly beautiful melancholic rock ballad and dark anime main theme in D minor at 68 BPM. "
            "Spacious, crystal-clear, uncrowded arrangement with zero muddiness:\n"
            "[Intro] Solo clean electric guitar with warm spring reverb and subtle tremolo playing a slow, unforgettable melancholic hook "
            "built on a descending minor chord progression (Dm - C - Bb - A7) with soulful Anatolian blues bends.\n"
            "[Verse] Warm acoustic guitar strumming, deep round bass guitar, and a slow, laid-back brushed snare drum groove join the clean electric guitar melody.\n"
            "[Chorus] A weeping, expressive tube-amp lead electric guitar takes the main melody with long, emotional sustained bends, "
            "supported by a warm cello ensemble and slow, resonant rock drums that carry deep unspoken sorrow and quiet devotion.\n"
            "[Outro] Gentle clean electric guitar notes and warm cello fade out peacefully. "
            "Instrumental only, no vocals."
        ),
        "use_image": False,
        "loop_start_s": 17.5,
    },
]


def call_lyria(api_key: str, prompt_text: str, use_image: bool) -> bytes:
    url = "https://generativelanguage.googleapis.com/v1beta/interactions"
    if use_image and TITLE_ART_PATH.exists():
        img_b64 = base64.b64encode(TITLE_ART_PATH.read_bytes()).decode("ascii")
        input_payload = [
            {"type": "text", "text": prompt_text},
            {"type": "image", "mime_type": "image/webp", "data": img_b64},
        ]
    else:
        input_payload = prompt_text

    payload = {
        "model": "lyria-3.5",
        "input": input_payload,
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


def master_to_ogg_and_mp3(raw_audio_bytes: bytes, stem: str) -> dict:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUT_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_AUDITION_DIR.mkdir(parents=True, exist_ok=True)

    raw_path = CACHE_DIR / f"{stem}_raw.mp3"
    if not raw_path.exists() or raw_path.stat().st_size < 10000:
        raw_path.write_bytes(raw_audio_bytes)

    ogg_path = CACHE_DIR / f"{stem}.ogg"
    mp3_path = PUBLIC_AUDITION_DIR / f"{stem}.mp3"

    raw_dur = probe_duration_seconds(raw_path)
    # Keep strictly within the 180s ArtManifest schema cap (max 176.0s)
    capped_dur = min(raw_dur, 176.0)
    fade_out_start = max(1.0, capped_dur - 3.2)

    af_chain = (
        f"atrim=0:{capped_dur:.2f},"
        f"asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d=1.2,"
        f"afade=t=out:st={fade_out_start:.2f}:d=3.0,"
        f"loudnorm=I=-15:TP=-1.2:LRA=11"
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
        "stem": stem,
        "duration_s": round(final_dur, 2),
        "ogg_path": str(ogg_path),
        "mp3_path": str(mp3_path),
    }


def update_art_and_release_manifests(duration_s: float, loop_start_s: float) -> None:
    target_ogg = OUT_AUDIO_DIR / "bgm_main_theme.ogg"
    # Clean up accidental audio/music directory if present
    stray_dir = OUT_AUDIO_DIR / "music"
    if stray_dir.exists():
        shutil.rmtree(stray_dir)

    declared_dur = min(180.0, round(duration_s + 0.15, 2))
    if ART_MANIFEST_PATH.exists():
        art_doc = json.loads(ART_MANIFEST_PATH.read_text(encoding="utf-8"))
        if "music" in art_doc and "bgm_main_theme" in art_doc["music"]:
            art_doc["music"]["bgm_main_theme"] = {
                "file": "audio/bgm_main_theme.ogg",
                "loop_start_s": round(loop_start_s, 2),
                "duration_s": declared_dur,
            }
        ART_MANIFEST_PATH.write_text(json.dumps(art_doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if RELEASE_JSON_PATH.exists():
        rel_doc = json.loads(RELEASE_JSON_PATH.read_text(encoding="utf-8"))
        files = [f for f in rel_doc.get("files", []) if f.get("path") not in ("audio/music/bgm_title_eclipse.ogg", "art/art.json")]
        rel_map = {entry["path"]: entry for entry in files}
        for rel_path, disk_path, media_type, kind in [
            ("audio/bgm_main_theme.ogg", target_ogg, "audio/ogg", "audio"),
            ("art/art_manifest.json", ART_MANIFEST_PATH, "application/json", "art_manifest"),
        ]:
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
    for item in CANDIDATE_PROMPTS:
        stem = item["id"]
        cached_raw = CACHE_DIR / f"{stem}_raw.mp3"
        if cached_raw.exists() and cached_raw.stat().st_size > 10000:
            print(f"[CACHE] Using cached raw Lyria 3.5 audio for {stem} ({cached_raw.stat().st_size} bytes)")
            raw_bytes = cached_raw.read_bytes()
        else:
            print(f"[LYRIA 3.5] Generating {stem} via generativelanguage.googleapis.com/v1beta/interactions ...")
            raw_bytes = call_lyria(api_key, item["prompt"], item["use_image"])
        info = master_to_ogg_and_mp3(raw_bytes, stem)
        info["title"] = item["title"]
        info["description"] = item["description"]
        info["loop_start_s"] = item["loop_start_s"]
        results.append(info)
        print(f"  -> {stem}: {info['duration_s']}s mastered ({info['ogg_path']})")

    # Install Primary Candidate (main_theme_v3_duman_eclipse_anthem) as active bgm_main_theme.ogg
    primary = results[0]
    primary_ogg = Path(primary["ogg_path"])
    target_ogg = OUT_AUDIO_DIR / "bgm_main_theme.ogg"
    target_ogg.write_bytes(primary_ogg.read_bytes())

    update_art_and_release_manifests(primary["duration_s"], primary["loop_start_s"])

    (PUBLIC_AUDITION_DIR / "bgm_main_theme.mp3").write_bytes(Path(primary["mp3_path"]).read_bytes())

    print("\n=== LYRIA 3.5 MAIN THEME INSTALLED TO content/base/audio/bgm_main_theme.ogg ===")
    print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
