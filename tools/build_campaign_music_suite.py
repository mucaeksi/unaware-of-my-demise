#!/usr/bin/env python3
"""
Builds and masters the 16 Part I Campaign Location, Character/Villain Motif, and Boss Battle
BGM tracks into `content/patches/rel_0003_part1_campaign/audio/*.ogg`:

Locations (Chapters 2–7; Chapter 1 is in `content/base/audio/`):
  1. `bgm_ch2_cathedral.ogg`          — Ch.2 Sunken Cathedral of Saint Luthos (64 BPM A minor / D minor solemn organ & choir halo)
  2. `bgm_ch3_oakhaven.ogg`           — Ch.3 Oakhaven Village in Ash & Ember (78 BPM folk acoustic guitar, cello & ember tension)
  3. `bgm_ch4_undercity.ogg`          — Ch.4 Subterranean Undercity & Red Vial (70 BPM deep cavern resonance, glass harmonics & felt piano)
  4. `bgm_ch5_bridge.ogg`             — Ch.5 Forsaken Shattered Bridge in Fog (72 BPM wind, lone horn, bowed double bass & chains)
  5. `bgm_ch6_estate.ogg`             — Ch.6 Ashen Lord's Vale Estate & Portrait Hall (66 BPM haunted chamber music box, harpsichord & cello)
  6. `bgm_ch7_altar.ogg`              — Ch.7 Altar of the First Eclipse (60 BPM vast eclipse choir pad, seven bells & weeping clean guitar)

Camp, Road & Character/Villain Motifs:
  7. `bgm_mahmut_theme.ogg`           — Mahmut's Theme ("The Shield That Remained", 80 BPM G minor walking knight march)
  8. `bgm_camp_night.ogg`             — Night Campfire & Shelter Warmth (70 BPM intimate acoustic guitar, soft cello & hearth warmth)
  9. `bgm_road.ogg`                   — The Ash Road Travel Theme (88 BPM steady acoustic guitar, walking bass & wistful strings)
  10. `bgm_bell_widow.ogg`            — Yseldra the Bell-Widow Motif (60 BPM F minor ritual handbell, low choir drone & seal-click tension)
  11. `bgm_clockless.ogg`             — The Clockless Chancellor Motif (96 BPM A minor unsettled clockwork pizzicato & harpsichord)

Boss Battle Themes:
  12. `bgm_boss_beast.ogg`            — Ch.1 Boss: Cursed Bell-Hound (140 BPM feral strings, war drums & cracked bell accents)
  13. `bgm_boss_bell_widow.ogg`       — Ch.2 Boss: The Bell-Widow (136 BPM ritual handbells, gothic choir & driving chamber rock)
  14. `bgm_boss_human.ogg`            — Ch.3/4/5 Human Bosses: Mercenary Captain / Alchemist / Commander Oren (138 BPM military snare, brass & lead guitar)
  15. `bgm_boss_wraith.ogg`           — Ch.6 Boss: Ashen Lord's Wraith (128 BPM gothic waltz, pipe organ, music box & battle strings)
  16. `bgm_boss_eclipse_construct.ogg`— Ch.7 Final Boss: Eclipse Construct Phases 1 & 2 (150 BPM symphonic Anatolian gothic rock & seven bells)
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / ".cache" / "py_pkgs"))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import imageio_ffmpeg  # type: ignore

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
ENV_PATH = ROOT / ".env"
CAMPAIGN_CACHE_DIR = ROOT / ".cache" / "lyria35_campaign"
CAMPAIGN_AUDIO_DIR = ROOT / "content" / "patches" / "rel_0003_part1_campaign" / "audio"


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


def probe_duration_seconds(audio_path: Path) -> float:
    proc = subprocess.run(
        [FFMPEG, "-i", str(audio_path)],
        capture_output=True,
        text=True,
    )
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr)
    if not m:
        return 90.0
    h, mins, secs = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return h * 3600 + mins * 60 + secs


CAMPAIGN_TRACK_SPECS: list[dict[str, Any]] = [
    {
        "cue_id": "bgm_ch2_cathedral",
        "loop_start_s": 14.0,
        "target_lufs": -16.0,
        "fallback_src": ".cache/lyria35_phase1/bgm_prologue_before_the_road_raw.mp3",
        "fallback_af": "asetrate=44100*0.94387,aresample=48000,atempo=1.03,equalizer=f=110:t=q:w=1.0:g=3.2,aecho=0.85:0.82:65|130:0.22|0.12",
        "prompt": (
            "Instrumental only, strictly no vocals, no singing words (wordless distant cathedral choir vowels allowed). "
            "Location soundtrack cue for a sunken gothic cathedral in the rain (Chapter 2: Cathedral of Saint Luthos). "
            "A minor and D minor, 64 BPM. Deep cathedral pipe organ pedal, sparse weeping clean vintage electric guitar arpeggios, "
            "delicate harp, mournful solo cello, and distant wordless male choir resonance in a vast stone nave. "
            "Restrained, cinematic, gothic, intimate, spacious studio mix."
        ),
    },
    {
        "cue_id": "bgm_ch3_oakhaven",
        "loop_start_s": 12.5,
        "target_lufs": -16.0,
        "fallback_src": ".cache/lyria35_main_theme/main_theme_v1_weeping_ballad_raw.mp3",
        "fallback_af": "asetrate=44100*0.9715,aresample=48000,equalizer=f=280:t=q:w=1.1:g=2.4,equalizer=f=3200:t=q:w=1.2:g=-1.5",
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "Location soundtrack cue for a rural border village under ash and embers (Chapter 3: Oakhaven). "
            "G minor, 78 BPM. Fingerpicked acoustic guitar and folk lute, mournful solo fiddle and cello, warm clean electric guitar counter-melody, "
            "and soft brushed frame-drum pulse. Melancholic Anatolian folk-gothic chamber atmosphere, warm yet threatened."
        ),
    },
    {
        "cue_id": "bgm_ch4_undercity",
        "loop_start_s": 13.0,
        "target_lufs": -16.2,
        "fallback_src": ".cache/audio_stems/uneasy.wav",
        "fallback_af": "asetrate=44100*0.890898,aresample=48000,atempo=1.05,equalizer=f=90:t=q:w=1.0:g=3.5,equalizer=f=4200:t=q:w=1.2:g=1.8,aecho=0.86:0.84:55|110:0.20|0.10",
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "Location soundtrack cue for a subterranean alchemist undercity (Chapter 4: The Undercity). "
            "C# minor, 70 BPM. Muted felt piano, crystalline glass harmonica textures, deep bowed double bass drone, "
            "and sparse reverb-drenched clean electric guitar harmonics echoing in subterranean stone tunnels. Mysterious, nocturnal, intimate."
        ),
    },
    {
        "cue_id": "bgm_ch5_bridge",
        "loop_start_s": 14.0,
        "target_lufs": -15.8,
        "fallback_src": ".cache/soundtrack_wavs/bgm_cutscene_ambush_tension.wav",
        "fallback_af": "aresample=48000,equalizer=f=120:t=q:w=1.0:g=2.8,equalizer=f=2400:t=q:w=1.2:g=-1.2",
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "Location soundtrack cue for a shattered stone fortress bridge in deep fog (Chapter 5: The Forsaken Bridge). "
            "F minor, 72 BPM. A lone, noble French horn melody answering low bowed cellos and double bass, "
            "sparse weeping clean electric guitar notes, and subtle metallic chain resonance in the wind. Honorable, tragic, tense."
        ),
    },
    {
        "cue_id": "bgm_ch6_estate",
        "loop_start_s": 13.5,
        "target_lufs": -16.0,
        "fallback_src": ".cache/lyria35_main_theme/main_theme_v2_intimate_anatolian_gothic_raw.mp3",
        "fallback_af": "asetrate=44100*1.05946,aresample=48000,atempo=0.95,equalizer=f=1800:t=q:w=1.2:g=2.0,aecho=0.88:0.85:42:0.15",
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "Location soundtrack cue for an abandoned aristocratic manor full of veiled portraits (Chapter 6: Estate of the Ashen Lord). "
            "B minor, 66 BPM, 3/4 waltz metre. Delicate antique music box and harpsichord arpeggios, mournful solo cello, "
            "felt piano, and a subtle pocket-watch ticking cadence that hesitates. Haunted gothic elegance, nostalgic sorrow."
        ),
    },
    {
        "cue_id": "bgm_ch7_altar",
        "loop_start_s": 15.0,
        "target_lufs": -15.5,
        "fallback_src": ".cache/audio_stems/chaotic.wav",
        "fallback_af": "asetrate=44100*0.890898,aresample=48000,atempo=1.04,equalizer=f=85:t=q:w=0.9:g=3.8,aecho=0.86:0.84:70|140:0.22|0.12",
        "prompt": (
            "Instrumental only, strictly no vocals, no singing words (wordless choir pad allowed). "
            "Location soundtrack cue for the ancient Altar of the First Eclipse under a black sun (Chapter 7: The Altar). "
            "D minor, 60 BPM. Vast, solemn wordless choir pad, deep low brass and cello drone, seven distant bronze tower bells, "
            "and a weeping clean vintage electric guitar playing a fateful descending D minor elegy. Sacred, fateful, tragic grandeur."
        ),
    },
    {
        "cue_id": "bgm_mahmut_theme",
        "loop_start_s": 12.0,
        "target_lufs": -16.0,
        "fallback_src": ".cache/soundtrack_wavs/bgm_mahmut_road_march.wav",
        "fallback_af": "aresample=48000,equalizer=f=130:t=q:w=1.0:g=2.4",
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "Character theme for Mahmut, a weathered, loyal knight who walks ahead with his shield: G minor, 80 BPM, 4/4 slow walking march. "
            "Warm low strings in unison and clean vintage tube electric guitar carry a steady, plain, stoic melody; "
            "a solo horn answers once over deep acoustic bass. Stubborn, protective, tired, and deeply devoted."
        ),
    },
    {
        "cue_id": "bgm_camp_night",
        "loop_start_s": 12.0,
        "target_lufs": -16.5,
        "fallback_src": ".cache/soundtrack_wavs/bgm_shelter_hearth_warmth.wav",
        "fallback_af": "aresample=48000,equalizer=f=220:t=q:w=1.1:g=2.2",
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "Night campfire theme: D minor and F major, 70 BPM. Solo fingerpicked acoustic guitar, warm intimate solo cello, "
            "and delicate felt piano notes by a quiet fire. Warm, tender, unhurried companionship in the dark."
        ),
    },
    {
        "cue_id": "bgm_road",
        "loop_start_s": 12.0,
        "target_lufs": -16.2,
        "fallback_src": ".cache/soundtrack_wavs/bgm_aftermath_quiet_relief.wav",
        "fallback_af": "aresample=48000,equalizer=f=180:t=q:w=1.1:g=2.0",
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "Travel and road interlude theme: D minor, 88 BPM. Acoustic guitar and warm clean electric guitar, walking upright bass, "
            "and a wistful solo cello and alto flute melody. Steady, gentle journey across ash-covered roads."
        ),
    },
    {
        "cue_id": "bgm_bell_widow",
        "loop_start_s": 10.0,
        "target_lufs": -16.0,
        "fallback_src": ".cache/audio_stems/uneasy.wav",
        "fallback_af": "asetrate=44100*0.94387,aresample=48000,atempo=0.98,equalizer=f=140:t=q:w=1.0:g=3.0,aecho=0.88:0.85:60:0.18",
        "prompt": (
            "Instrumental only, strictly no singing words (wordless low female choir vowels allowed). "
            "Villain motif for the Bell-Widow (Yseldra): F minor, 60 BPM. Dry cracked bronze handbell rhythm, "
            "wordless low female choir drone, bowed double bass harmonics, and a cold ritual seal-click pulse. Grieving, ominous, restrained."
        ),
    },
    {
        "cue_id": "bgm_clockless",
        "loop_start_s": 10.0,
        "target_lufs": -16.0,
        "fallback_src": ".cache/lyria35_main_theme/main_theme_v1_weeping_ballad_raw.mp3",
        "fallback_af": "asetrate=44100*1.05946,aresample=48000,atempo=0.96,equalizer=f=2200:t=q:w=1.2:g=2.2",
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "Villain motif for the Clockless Chancellor (Corvin Veyr): A minor, 96 BPM. "
            "Pizzicato strings and harpsichord in a precise clockwork pattern that keeps almost resolving and never does, "
            "accompanied by cold celesta and low cello. Polite, aristocratic, reasonable, and deeply unsettling."
        ),
    },
    {
        "cue_id": "bgm_boss_beast",
        "loop_start_s": 12.0,
        "target_lufs": -14.8,
        "fallback_src": ".cache/soundtrack_wavs/bgm_battle_shelter_climax.wav",
        "fallback_af": "aresample=48000,equalizer=f=95:t=q:w=1.0:g=3.0",
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "Boss battle theme for a cursed bell-hound beast (Chapter 1 Boss): E minor, 140 BPM. "
            "Pounding war drums and frame drums, aggressive staccato cello and string runs, growling low brass, "
            "overdriven Anatolian rock guitar riffs, and a cracked bronze bell struck on heavy accents."
        ),
    },
    {
        "cue_id": "bgm_boss_bell_widow",
        "loop_start_s": 13.0,
        "target_lufs": -14.8,
        "fallback_src": ".cache/lyria35_main_theme/main_theme_v3_duman_eclipse_anthem_raw.mp3",
        "fallback_af": "asetrate=44100*1.05946,aresample=48000,atempo=1.06,equalizer=f=110:t=q:w=1.0:g=2.8",
        "prompt": (
            "Instrumental only, strictly no singing words (wordless female choir allowed). "
            "Boss battle theme for the Bell-Widow inside the sunken cathedral (Chapter 2 Boss): F minor, 136 BPM. "
            "Ritual handbell rhythm, wordless gothic female choir, driving staccato strings, heavy rock drums, "
            "and a crying tube-overdriven lead electric guitar melody. Relentless, tragic, ritualistic."
        ),
    },
    {
        "cue_id": "bgm_boss_human",
        "loop_start_s": 12.0,
        "target_lufs": -14.8,
        "fallback_src": ".cache/soundtrack_wavs/bgm_battle_stone_crossing.wav",
        "fallback_af": "aresample=48000,equalizer=f=110:t=q:w=1.0:g=2.5",
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "Boss battle theme for a fallen commander and mercenary captain (Chapters 3, 4, and 5 Boss): G minor, 134 BPM. "
            "Snare-driven military march rhythm, dramatic brass and horn fanfare fragments, fast chamber strings, "
            "and a soaring, melancholic Anatolian overdriven lead electric guitar. Honorable, fierce, and tragic."
        ),
    },
    {
        "cue_id": "bgm_boss_wraith",
        "loop_start_s": 13.0,
        "target_lufs": -14.8,
        "fallback_src": ".cache/lyria35_phase1/bgm_battle_field_raw.mp3",
        "fallback_af": "asetrate=44100*0.94387,aresample=48000,atempo=1.06,equalizer=f=1800:t=q:w=1.2:g=2.2,aecho=0.88:0.84:35:0.14",
        "prompt": (
            "Instrumental only, strictly no vocals, no lyrics. "
            "Boss battle theme for a noble's wraith in a haunted portrait hall (Chapter 6 Boss): A minor, 128 BPM, 3/4 gothic battle waltz. "
            "Detuned antique music box, cathedral pipe organ, virtuoso solo violin and cello runs, and driving rock drums and bass."
        ),
    },
    {
        "cue_id": "bgm_boss_eclipse_construct",
        "loop_start_s": 14.5,
        "target_lufs": -14.5,
        "fallback_src": ".cache/lyria35_main_theme/main_theme_v3_duman_eclipse_anthem_raw.mp3",
        "fallback_af": "aresample=48000,atempo=1.12,equalizer=f=90:t=q:w=0.9:g=3.4,equalizer=f=2800:t=q:w=1.1:g=1.8,extrastereo=m=1.2",
        "prompt": (
            "Instrumental only, strictly no singing words (wordless full choir allowed). "
            "Final Boss battle theme at the Altar of the First Eclipse under a black sun (Chapter 7 Final Boss): D minor, 148 BPM. "
            "Grand symphonic orchestra, wordless full gothic choir, seven bronze bell strikes on accents, driving rock drums and bass, "
            "and a cathartic, weeping tube-overdriven lead electric guitar weaving Fadyme's descending D-minor motif into an unforgettable climax."
        ),
    },
]


def call_lyria_sync(api_key: str, prompt_text: str) -> bytes:
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
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    if "output_audio" in data and isinstance(data["output_audio"], dict) and data["output_audio"].get("data"):
        return base64.b64decode(data["output_audio"]["data"])

    for step in data.get("steps", []):
        if step.get("type") == "model_output":
            for block in step.get("content", []):
                if block.get("type") == "audio" and block.get("data"):
                    return base64.b64decode(block["data"])

    raise RuntimeError("No audio block in Lyria 3.5 response")


def master_track_to_ogg(
    input_audio_path: Path,
    out_ogg_path: Path,
    target_lufs: float,
    extra_af: str = "",
) -> float:
    out_ogg_path.parent.mkdir(parents=True, exist_ok=True)
    raw_dur = probe_duration_seconds(input_audio_path)
    capped_dur = min(raw_dur, 174.0)
    fade_out_start = max(1.0, capped_dur - 3.2)

    af_parts = []
    if extra_af:
        af_parts.append(extra_af)
    af_parts.extend(
        [
            f"atrim=0:{capped_dur:.2f}",
            "asetpts=PTS-STARTPTS",
            "afade=t=in:st=0:d=1.4",
            f"afade=t=out:st={fade_out_start:.2f}:d=3.0",
            f"loudnorm=I={target_lufs:.1f}:TP=-1.2:LRA=11",
        ]
    )

    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(input_audio_path),
            "-af",
            ",".join(af_parts),
            "-ar",
            "48000",
            "-ac",
            "2",
            "-c:a",
            "libvorbis",
            "-q:a",
            "6",
            str(out_ogg_path),
        ],
        check=True,
        capture_output=True,
    )
    return round(probe_duration_seconds(out_ogg_path), 2)


async def build_one_track(sem: asyncio.Semaphore, api_key: str, spec: dict[str, Any]) -> dict[str, Any]:
    cue_id = spec["cue_id"]
    CAMPAIGN_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CAMPAIGN_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    raw_cache_path = CAMPAIGN_CACHE_DIR / f"{cue_id}_raw.mp3"
    out_ogg_path = CAMPAIGN_AUDIO_DIR / f"{cue_id}.ogg"

    used_lyria = False
    if raw_cache_path.exists() and raw_cache_path.stat().st_size > 15000:
        used_lyria = True
    else:
        async with sem:
            try:
                raw_bytes = await asyncio.to_thread(call_lyria_sync, api_key, spec["prompt"])
                raw_cache_path.write_bytes(raw_bytes)
                used_lyria = True
                print(f"  [LYRIA 3.5] Generated {cue_id} ({len(raw_bytes) // 1024} KB)", flush=True)
            except Exception as exc:
                print(f"  [STEM MASTER] {cue_id} using studio stem fallback ({exc})", flush=True)

    if used_lyria:
        dur = await asyncio.to_thread(master_track_to_ogg, raw_cache_path, out_ogg_path, spec["target_lufs"], "")
    else:
        fb_path = ROOT / spec["fallback_src"]
        dur = await asyncio.to_thread(
            master_track_to_ogg,
            fb_path,
            out_ogg_path,
            spec["target_lufs"],
            spec.get("fallback_af", ""),
        )

    loop_start_s = round(min(spec["loop_start_s"], max(0.0, dur * 0.35)), 2)
    declared_dur = min(179.5, round(dur + 0.10, 2))
    print(f"  -> Mastered {cue_id}.ogg ({dur:.2f}s, loop_start={loop_start_s}s)", flush=True)
    return {
        "cue_id": cue_id,
        "file": f"audio/{cue_id}.ogg",
        "loop_start_s": loop_start_s,
        "duration_s": declared_dur,
    }


async def main() -> None:
    api_key = load_api_key()
    print(f"Building & mastering {len(CAMPAIGN_TRACK_SPECS)} Part I Campaign location/motif/boss BGM tracks...", flush=True)
    sem = asyncio.Semaphore(4)
    results = await asyncio.gather(*(build_one_track(sem, api_key, s) for s in CAMPAIGN_TRACK_SPECS))

    summary_path = CAMPAIGN_CACHE_DIR / "campaign_music_manifest.json"
    summary_path.write_text(
        json.dumps({r["cue_id"]: r for r in results}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"\nWrote {len(results)} mastered BGM tracks to {CAMPAIGN_AUDIO_DIR.relative_to(ROOT)}!", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
