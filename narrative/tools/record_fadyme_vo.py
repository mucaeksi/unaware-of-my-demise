"""Record Fadyme's JP lines with her approved voice (casting.json), one call per scene group and
track (spoken / inner), N takes each. Raw takes -> audio/voice/fadyme/_takes/. Resumable (skips
existing takes). Split + take selection happens afterwards (tools/split_select_vo.py).
  python3 tools/record_fadyme_vo.py [--takes 2] [--only GROUP]"""
import argparse, base64, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_image as G, gen_audio as A
ap = argparse.ArgumentParser(); ap.add_argument("--takes", type=int, default=2); ap.add_argument("--only"); ap.add_argument("--grouping", default="chapter", choices=["chapter", "scene"]); ap.add_argument("--budget", type=float, default=0, help="stop starting new takes after N seconds")
a = ap.parse_args()
R = G.ROOT
S = json.load(open(os.path.join(R, "audio/voice/jp_script_fadyme.json"), encoding="utf-8"))
C = json.load(open(os.path.join(R, "audio/voice/casting.json"), encoding="utf-8"))["fadyme"]
OUT = os.path.join(R, "audio/voice/fadyme/_takes"); os.makedirs(OUT, exist_ok=True)
KEEP = " Keep exactly the same voice, pitch and microphone distance for every line; only the feeling changes. Leave a clear pause of about one second between lines."
# Grouping: "chapter" (default, fewer requests: TTS Tier 1 allows 100 requests/day) or "scene".
# Scene groups that already have all takes on disk are kept as they are.
def super_group(l):
    src = os.path.basename(l["source"])
    if src.startswith("story_script_"): return src[len("story_script_"):-5]            # ch01..ch07
    if src.startswith("character_stories"):
        return "cs_inner" if l["inner"] else "cs_" + l["group"].rsplit("_", 1)[0][3:]    # cs_<character>
    if src.startswith("events"): return "events"
    return l["group"]                                                                  # vo_battle / vo_menu
def done(g, tr): return all(os.path.exists(os.path.join(OUT, f"{g}__{tr}_t{t}.wav")) for t in range(1, a.takes + 1))
groups = {}
for l in S["lines"]:
    tr = "inner" if l["inner"] else "spoken"
    g = l["group"] if (a.grouping == "scene" or done(l["group"], tr)) else super_group(l)
    groups.setdefault((g, tr), []).append(l)
key = G.load_key(); n = 0; T0 = time.time()
for (g, tr), ls in groups.items():
    if a.only and g != a.only: continue
    style = C["style"] + (" " + C["inner_voice_style"] if tr == "inner" else "") + KEEP
    text = "\n\n".join(l.get("tts_text") or l["ja"] for l in ls)
    for t in range(1, a.takes + 1):
        base = os.path.join(OUT, f"{g}__{tr}_t{t}")
        if os.path.exists(base + ".wav"): continue
        if a.budget and time.time() - T0 > a.budget: print("budget reached", flush=True); sys.exit(0)
        body = {"model": "gemini-3.8-flash-tts", "input": [{"type": "user_input", "content": [{"type": "text", "text": text,
                "annotations": [{"type": "speech_metadata", "style": style}]}]}],
                "response_format": {"type": "audio"}, "generation_config": {"speech_config": [{"voice": C["voice"]}]}}
        r = A.find_audio(A.post(body, key))
        if not r: print("NO AUDIO", g, tr, t, flush=True); continue
        open(base + ".wav", "wb").write(base64.b64decode(r[0]))
        json.dump(dict(group=g, track=tr, take=t, voice=C["voice"], style=style, text=text, line_ids=[l["line_id"] for l in ls],
                       model="gemini-3.8-flash-tts", date=time.strftime("%Y-%m-%d")), open(base + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        n += 1; print(g, tr, t, os.path.getsize(base + ".wav") // 1024, "KB", flush=True)
print("done, new takes:", n, "groups:", len(groups), flush=True)
