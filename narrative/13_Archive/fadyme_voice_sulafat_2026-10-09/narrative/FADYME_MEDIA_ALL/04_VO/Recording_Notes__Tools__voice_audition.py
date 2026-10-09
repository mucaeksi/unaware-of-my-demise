"""Read one Japanese line with several Gemini TTS voices (voice search / audition).
  python3 tools/voice_audition.py --out audio/voice/audition/<character_id> --text "..." --style "..." --voices Kore Leda ...
Writes <out>/<voice>.wav and <out>/audition.json. Key from .secrets (never printed)."""
import argparse, base64, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_image as G, gen_audio as A

ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True); ap.add_argument("--text", required=True); ap.add_argument("--style", default="")
ap.add_argument("--voices", nargs="+", required=True); ap.add_argument("--model", default="gemini-3.8-flash-tts"); ap.add_argument("--tag", default="")
a = ap.parse_args()
key = G.load_key(); out = os.path.join(G.ROOT, a.out); os.makedirs(out, exist_ok=True)
log_p = os.path.join(out, "audition.json"); log = json.load(open(log_p, encoding="utf-8")) if os.path.exists(log_p) else []
for v in a.voices:
    body = {"model": a.model, "input": [{"type": "user_input", "content": [{"type": "text", "text": a.text,
            "annotations": [{"type": "speech_metadata", "style": a.style}] if a.style else []}]}],
            "response_format": {"type": "audio"}, "generation_config": {"speech_config": [{"voice": v}]}}
    t0 = time.time(); r = A.find_audio(A.post(body, key))
    if not r:
        print(v, "no audio"); continue
    fn = os.path.join(out, f"{v}{('_' + a.tag) if a.tag else ''}.wav"); open(fn, "wb").write(base64.b64decode(r[0]))
    log.append(dict(voice=v, file=os.path.relpath(fn, G.ROOT), text=a.text, style=a.style, model=a.model, mime=r[1], date=time.strftime("%Y-%m-%d")))
    print(v, os.path.getsize(fn) // 1024, "KB", r[1], f"{time.time()-t0:.1f}s")
json.dump(log, open(log_p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
