"""Batch image generation with the Gemini Batch API (50% of the standard price, target turnaround 24 h).

Use it AFTER the reference set is approved, for groups that do not depend on each other inside the batch
(e.g. all remaining busts of one character once the base bust is approved).

Job list (text file, one job per line, '#' = comment):
    <prompt file> | <asset> | <ref1>, <ref2>, ... | [model] | [size]
  e.g.
    prompts/asset_pipeline/mahmut.md | 2 | art/sheets/char-mahmut-uomd.png, art/production/mahmut/vn_bust_mahmut_watchful_v001.png

Commands (run from the narrative folder):
    python3 tools/gen_batch.py submit jobs.txt [--model gemini-3.1-flash-image] [--size 2K]
    python3 tools/gen_batch.py status            # all batches recorded in art/_review/batches.json
    python3 tools/gen_batch.py fetch <batch name> # saves images to art/_review/ with uomd_* metadata (status REVIEW)
"""
import argparse, base64, io, json, os, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_image as G

BASE = "https://generativelanguage.googleapis.com"
REG = os.path.join(G.ROOT, "art", "_review", "batches.json")
CACHE = os.path.join(G.ROOT, "art", "_review", "file_cache.json")


def req(url, key, data=None, headers=None, method=None, raw=False):
    h = {"x-goog-api-key": key}
    h.update(headers or {})
    r = urllib.request.Request(url, data=data, headers=h, method=method or ("POST" if data is not None else "GET"))
    with urllib.request.urlopen(r, timeout=170) as resp:
        body = resp.read()
        return (body, resp.headers) if raw else json.loads(body or b"{}")


def upload(path_abs, mime, key, display):
    size = os.path.getsize(path_abs)
    _, hdr = req(BASE + "/upload/v1beta/files", key, data=json.dumps({"file": {"display_name": display}}).encode(),
                 headers={"X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
                          "X-Goog-Upload-Header-Content-Length": str(size), "X-Goog-Upload-Header-Content-Type": mime,
                          "Content-Type": "application/json"}, raw=True)
    url = hdr.get("x-goog-upload-url")
    body, _ = req(url, key, data=open(path_abs, "rb").read(), raw=True,
                  headers={"Content-Length": str(size), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize"})
    return json.loads(body)["file"]


def ref_uri(rel, key, cache):
    st = os.stat(os.path.join(G.ROOT, rel))
    c = cache.get(rel)
    if c and c["mtime"] == st.st_mtime and time.time() - c["t"] < 40 * 3600:  # files expire after 48 h
        return c["uri"], c["mime"]
    mime = "image/png" if rel.lower().endswith(".png") else "image/jpeg"
    f = upload(os.path.join(G.ROOT, rel), mime, key, os.path.basename(rel))
    cache[rel] = dict(uri=f["uri"], mime=mime, mtime=st.st_mtime, t=time.time())
    return f["uri"], mime


def load(p, default):
    return json.load(open(p)) if os.path.exists(p) else default


def submit(a):
    key = G.load_key()
    cache = load(CACHE, {})
    lines, jobs = [], []
    for raw in open(a.jobs, encoding="utf-8"):
        raw = raw.strip()
        if not raw or raw.startswith("#"):
            continue
        f = [x.strip() for x in raw.split("|")]
        pfile, asset, refs = f[0], f[1], [r.strip() for r in f[2].split(",") if r.strip()]
        model = f[3] if len(f) > 3 and f[3] else a.model
        size = f[4] if len(f) > 4 and f[4] else a.size
        if model != a.model:
            sys.exit("one model per batch: split the job list")
        b = G.parse_blocks(pfile)[asset]
        m = b["meta"]
        parts = [{"text": b["prompt"] + "\n\nAvoid: " + b["negative"]}]
        for r in refs:
            uri, mime = ref_uri(r, key, cache)
            parts.append({"file_data": {"mime_type": mime, "file_uri": uri}})
        k = f"{m.get('kind')}_{m.get('id')}_{m.get('variant')}_{m.get('revision','v001')}"
        lines.append(json.dumps({"key": k, "request": {"contents": [{"parts": parts}], "generation_config": {
            "responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": G.aspect(m), "imageSize": size}}}}))
        jobs.append(dict(key=k, file=pfile, asset=asset, refs=refs, meta=m))
    json.dump(cache, open(CACHE, "w"), indent=1)
    tmp = os.path.join(G.ROOT, "art", "_review", f"batch_input_{int(time.time())}.jsonl")
    open(tmp, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    f = upload(tmp, "application/jsonl", key, os.path.basename(tmp))
    r = req(f"{BASE}/v1beta/models/{a.model}:batchGenerateContent", key, headers={"Content-Type": "application/json"},
            data=json.dumps({"batch": {"display_name": os.path.basename(a.jobs), "input_config": {"file_name": f["name"]}}}).encode())
    name = r.get("name")
    reg = load(REG, {})
    reg[name] = dict(model=a.model, size=a.size, submitted=time.strftime("%Y-%m-%d %H:%M"), jobs=jobs)
    json.dump(reg, open(REG, "w"), indent=1)
    print("submitted", name, len(jobs), "jobs")


def find(o, k):
    if isinstance(o, dict):
        if k in o:
            return o[k]
        for v in o.values():
            r = find(v, k)
            if r is not None:
                return r
    elif isinstance(o, list):
        for v in o:
            r = find(v, k)
            if r is not None:
                return r
    return None


def status(a):
    key = G.load_key()
    for name, info in load(REG, {}).items():
        r = req(f"{BASE}/v1beta/{name}", key)
        print(name, find(r, "state"), info["submitted"], len(info["jobs"]), "jobs", "fetched" if info.get("fetched") else "")


def fetch(a):
    key = G.load_key()
    from PIL import Image, PngImagePlugin
    reg = load(REG, {})
    info = reg[a.name]
    r = req(f"{BASE}/v1beta/{a.name}", key)
    rf = find(r, "responsesFile") or find(r, "responses_file")
    if not rf:
        sys.exit(f"not ready: {find(r, 'state')}")
    body, _ = req(f"{BASE}/download/v1beta/{rf}:download?alt=media", key, raw=True)
    byk = {j["key"]: j for j in info["jobs"]}
    for line in body.decode().splitlines():
        if not line.strip():
            continue
        o = json.loads(line)
        k = o.get("key")
        data = G.find_image(o)
        if not data:
            print(k, "NO IMAGE", json.dumps(find(o, "error") or find(o, "finishReason"))[:200]); continue
        j = byk.get(k, {"meta": {}, "refs": [], "file": "", "asset": ""})
        m = j["meta"]
        im = Image.open(io.BytesIO(base64.b64decode(data)))
        pi = PngImagePlugin.PngInfo()
        for kk, v in dict(id=m.get("id", ""), kind=m.get("kind", ""), mode=m.get("mode", ""), variant=m.get("variant", ""),
                          revision=m.get("revision", ""), status="REVIEW", reference=" + ".join(j["refs"]),
                          key_colour=m.get("key colour", ""), native_size=f"{im.width}x{im.height}",
                          date=time.strftime("%Y-%m-%d"), source=f"{info['model']} via batch {a.name}",
                          prompt_file=j["file"], prompt_asset=j["asset"]).items():
            pi.add_text("uomd_" + kk, str(v))
        out = os.path.join("art", "_review", f"{k}_b.png")
        im.save(os.path.join(G.ROOT, out), pnginfo=pi)
        print(k, "->", out)
    info["fetched"] = True
    json.dump(reg, open(REG, "w"), indent=1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    s = sp.add_parser("submit"); s.add_argument("jobs"); s.add_argument("--model", default="gemini-3.1-flash-image"); s.add_argument("--size", default="2K")
    sp.add_parser("status")
    f = sp.add_parser("fetch"); f.add_argument("name")
    a = ap.parse_args()
    {"submit": submit, "status": status, "fetch": fetch}[a.cmd](a)
