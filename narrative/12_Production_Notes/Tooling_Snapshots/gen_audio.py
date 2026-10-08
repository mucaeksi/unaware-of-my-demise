"""Music (Lyria) and voice (Gemini TTS) generation. Key: narrative/.secrets/google_api.env (never printed).

Music:  python3 tools/gen_audio.py music --asset <n> [--file prompts/music/music_part1.md] [--tries 1] [--dry-run]
        -> audio/_review/<id>_v001_tN.(wav|mp3) + .json sidecar (prompt, model, status REVIEW)
Voice:  python3 tools/gen_audio.py voice --script audio/voice/jp_script_<ch>.json --line <line_id> [--tries 1] [--dry-run]
        casting (voice + style per speaker) comes from audio/voice/casting.json
        -> audio/_review/vo_<line_id>_tN.wav + .json sidecar
"""
import argparse, base64, json, os, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_image as G

API = "https://generativelanguage.googleapis.com/v1beta/interactions"
OUT = os.path.join(G.ROOT, "audio", "_review")


def post(body, key, retries=6):
    """POST with retry on 429 (Tier 1 TTS limit is 10 requests/minute) and 503."""
    for attempt in range(retries):
        r = urllib.request.Request(API, data=json.dumps(body).encode(), method="POST",
                                   headers={"Content-Type": "application/json", "x-goog-api-key": key})
        try:
            with urllib.request.urlopen(r, timeout=178) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:600]
            if e.code in (429, 503) and attempt < retries - 1:
                time.sleep(10 + 5 * attempt); continue
            sys.exit(f"API error {e.code}: {msg}")


def find_audio(o):
    if isinstance(o, dict):
        if o.get("data") and (o.get("type") == "audio" or str(o.get("mime_type", o.get("mimeType", ""))).startswith("audio")):
            return o["data"], o.get("mime_type") or o.get("mimeType") or ""
        for v in o.values():
            r = find_audio(v)
            if r:
                return r
    elif isinstance(o, list):
        for v in o:
            r = find_audio(v)
            if r:
                return r
    return None


def save(base, t, data, mime, sidecar):
    ext = ".wav" if "wav" in mime or "l16" in mime or not mime else ".mp3"
    os.makedirs(OUT, exist_ok=True)
    fn = os.path.join(OUT, f"{base}_t{t}{ext}")
    open(fn, "wb").write(base64.b64decode(data))
    sidecar.update(file=os.path.relpath(fn, G.ROOT), status="REVIEW", date=time.strftime("%Y-%m-%d"))
    json.dump(sidecar, open(fn.rsplit(".", 1)[0] + ".json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"try {t}: {os.path.relpath(fn, G.ROOT)} ({len(data)*3//4//1024} KB)")


def music(a):
    b = G.parse_blocks(a.file)[a.asset]
    m = b["meta"]
    model = "lyria-3.5"  # C44: one music model for everything
    text = b["prompt"] + "\nAvoid: " + b["negative"]
    body = {"model": model, "input": text}
    if model == "lyria-3.5":
        body["response_format"] = {"type": "audio"}  # WAV
    if a.dry_run:
        print(json.dumps(dict(id=m["id"], model=model, chars=len(text)), indent=1)); return
    key = G.load_key()
    for t in range(1, a.tries + 1):
        r = find_audio(post(body, key))
        if not r:
            print(f"try {t}: no audio returned"); continue
        save(f"{m['id']}_{m.get('revision','v001')}", t, r[0], r[1], dict(id=m["id"], kind="music", model=model, prompt_file=a.file, prompt_asset=a.asset, wave=m.get("wave")))


def voice(a):
    script = json.load(open(os.path.join(G.ROOT, a.script), encoding="utf-8"))
    cast = json.load(open(os.path.join(G.ROOT, "audio", "voice", "casting.json"), encoding="utf-8"))
    line = next(l for l in script["lines"] if l["line_id"] == a.line)
    c = cast[line["speaker_id"]]
    style = "; ".join(x for x in (c.get("style"), line.get("direction")) if x)
    body = {"model": a.model, "input": [{"type": "user_input", "content": [{"type": "text", "text": line["ja"],
            "annotations": [{"type": "speech_metadata", "style": style}]}]}],
            "response_format": {"type": "audio"}, "generation_config": {"speech_config": [{"voice": c["voice"]}]}}
    if a.dry_run:
        print(json.dumps(dict(line=a.line, speaker=line["speaker_id"], voice=c["voice"], style=style, ja=line["ja"]), indent=1, ensure_ascii=False)); return
    key = G.load_key()
    for t in range(1, a.tries + 1):
        r = find_audio(post(body, key))
        if not r:
            print(f"try {t}: no audio returned"); continue
        save(f"vo_{a.line}", t, r[0], r[1], dict(line_id=a.line, speaker=line["speaker_id"], voice=c["voice"], style=style, model=a.model, ja=line["ja"], en=line.get("en")))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    m = sp.add_parser("music"); m.add_argument("--file", default="prompts/music/music_part1.md"); m.add_argument("--asset", required=True)
    m.add_argument("--tries", type=int, default=1); m.add_argument("--dry-run", action="store_true")
    v = sp.add_parser("voice"); v.add_argument("--script", required=True); v.add_argument("--line", required=True)
    v.add_argument("--model", default="gemini-3.8-flash-tts"); v.add_argument("--tries", type=int, default=1); v.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    {"music": music, "voice": voice}[a.cmd](a)
