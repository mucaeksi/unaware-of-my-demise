"""Split grouped Fadyme takes into lines, verify each line with Whisper (JP), pick the best take per line.
Selection: text match (kana similarity) first, then pitch closeness to the reference (spoken lines).
Needs faster-whisper, pykakasi, librosa, soundfile, ffmpeg. UP/OUT are the cloud staging paths used on 2026-09-30; edit for your env.
  python3 split_select_vo.py <takes_dir> [group ...]"""
import json, os, sys, glob, difflib, re, numpy as np, librosa, soundfile as sf, subprocess
from faster_whisper import WhisperModel
import pykakasi
KK = pykakasi.kakasi()
UP = "/mnt/user-data/uploads/Unaware of My Demise/narrative/audio/voice"
OUT = "/mnt/user-data/outputs/vo_fadyme"; os.makedirs(OUT, exist_ok=True)
REF_HZ = 197.0; SR = 24000
S = json.load(open(f"{UP}/jp_script_fadyme.json", encoding="utf-8"))
LINES = {l["line_id"]: l for l in S["lines"]}
model = WhisperModel("small", device="cpu", compute_type="int8")
def W16(y): return librosa.resample(y, orig_sr=SR, target_sr=16000)
def kana(s):
    s = re.sub(r"[、。！？…—『』「」（）\s・,.!?\-]", "", s)
    return "".join(x["hira"] for x in KK.convert(s))
def sim(a, b): return difflib.SequenceMatcher(None, kana(a), kana(b)).ratio()
def f0med(y):
    f, v, _ = librosa.pyin(y, fmin=120, fmax=500, sr=SR, frame_length=1024)
    f = f[v] if v is not None else f
    f = f[~np.isnan(f)] if len(f) else f
    return float(np.median(f)) if len(f) else 0.0
def silences(y):
    iv = librosa.effects.split(y, top_db=38, frame_length=1024, hop_length=256)
    return iv, [((iv[i][1] + iv[i+1][0]) // 2, iv[i+1][0] - iv[i][1]) for i in range(len(iv) - 1)]
def split(y, texts):
    """Align expected lines to a word-timestamped transcript, then snap each boundary to the widest nearby silence."""
    iv, gaps = silences(y); n = len(texts)
    if n == 1: return [(iv[0][0], iv[-1][1])]
    segs_w, _ = model.transcribe(W16(y), language="ja", beam_size=1, word_timestamps=True)
    chars, times = [], []
    for sg in segs_w:
        for w in (sg.words or []):
            k = kana(w.word)
            for i, ch in enumerate(k):
                chars.append(ch); times.append(w.start + (w.end - w.start) * (i + 0.5) / max(1, len(k)))
    T = "".join(chars); E = [kana(t) for t in texts]; Ecat = "".join(E)
    if not T: return None
    sm = difflib.SequenceMatcher(None, Ecat, T, autojunk=False)
    emap = {}
    for a, b, size in sm.get_matching_blocks():
        for k in range(size): emap[a + k] = b + k
    bounds, acc = [], 0
    for e in E[:-1]:
        acc += len(e)
        lo = max([k for k in emap if k < acc], default=None); hi = min([k for k in emap if k >= acc], default=None)
        if lo is None or hi is None: return None
        t = (times[emap[lo]] + times[emap[hi]]) / 2 * SR
        near = [g for g in gaps if abs(g[0] - t) < 1.2 * SR]
        if not near: return None
        bounds.append(max(near, key=lambda g: g[1] - abs(g[0] - t) * 0.15)[0])
    if len(set(bounds)) != len(bounds) or bounds != sorted(bounds): return None
    edges = [iv[0][0]] + bounds + [iv[-1][1]]
    segs = []
    for i in range(n):
        a, b = edges[i], edges[i + 1]
        inside = [x for x in iv if x[1] > a and x[0] < b]
        segs.append((max(a, inside[0][0]), min(b, inside[-1][1])) if inside else (a, b))
    return segs
def process(takes_dir, groups=None):
    res = {}
    metas = sorted(glob.glob(f"{takes_dir}/*.json"))
    by = {}
    for m in metas:
        j = json.load(open(m, encoding="utf-8"))
        if groups and j["group"] not in groups: continue
        by.setdefault((j["group"], j["track"]), []).append((j, m[:-5] + ".wav"))
    for (g, tr), takes in by.items():
        for j, wav in takes:
            if not os.path.exists(wav): continue
            y, _ = librosa.load(wav, sr=SR)
            segs = split(y, [LINES[x].get("tts_text") or LINES[x]["ja"] for x in j["line_ids"]])
            if not segs:
                print("SPLIT FAIL", os.path.basename(wav), flush=True); continue
            for lid, (s, e) in zip(j["line_ids"], segs):
                pad = int(0.08 * SR); seg = y[max(0, s - pad):min(len(y), e + pad)]
                txt = "".join(x.text for x in model.transcribe(W16(seg), language="ja", beam_size=1)[0])
                L = LINES[lid]; sc = sim(txt, L.get("tts_text") or L["ja"])
                hz = f0med(seg)
                res.setdefault(lid, []).append(dict(take=j["take"], wav=wav, s=int(s), e=int(e), asr=txt, match=round(sc, 3), f0=round(hz, 1), dur=round(len(seg)/SR, 2)))
    return res
def choose(cands, inner):
    ok = [c for c in cands if c["match"] >= 0.6] or sorted(cands, key=lambda c: -c["match"])[:1]
    best_m = max(c["match"] for c in ok)
    ok = [c for c in ok if c["match"] >= best_m - 0.15]
    return min(ok, key=lambda c: abs(np.log2(max(c["f0"], 1) / REF_HZ)))
def export(lid, c):
    y, _ = librosa.load(c["wav"], sr=SR); pad = int(0.08 * SR)
    seg = y[max(0, c["s"] - pad):min(len(y), c["e"] + pad)].copy()
    f = int(0.02 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    r = librosa.feature.rms(y=seg)[0]; act = r[r > 0.25 * r.max()]
    seg = np.clip(seg * 10 ** ((-20 - 20 * np.log10(np.sqrt((act ** 2).mean()))) / 20), -0.95, 0.95)
    sp = LINES[lid]["speaker_id"]; d = f"{OUT}/{sp}"; os.makedirs(d, exist_ok=True)
    tmp = f"/tmp/{lid}.wav"; sf.write(tmp, seg.astype(np.float32), SR, subtype="PCM_16")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-c:a", "libvorbis", "-q:a", "5", f"{d}/{lid}.ogg"], check=True)
    return len(seg) / SR
if __name__ == "__main__":
    groups = set(sys.argv[2:]) or None
    res = process(sys.argv[1], groups)
    rep = {}
    for lid, cands in res.items():
        c = choose(cands, LINES[lid]["inner"]); dur = export(lid, c)
        rep[lid] = dict(chosen_take=c["take"], match=c["match"], f0=c["f0"], dur=round(dur, 2), asr=c["asr"],
                        candidates=[{k: v for k, v in x.items() if k not in ("wav", "s", "e")} for x in cands])
    old = json.load(open(f"{OUT}/selection.json")) if os.path.exists(f"{OUT}/selection.json") else {}
    old.update(rep); json.dump(old, open(f"{OUT}/selection.json", "w"), ensure_ascii=False, indent=1)
    for lid, r in rep.items(): print(lid, r["chosen_take"], r["match"], r["f0"], r["dur"], "|", r["asr"])
