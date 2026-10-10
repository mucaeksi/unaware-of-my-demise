"""Generate one image from a prompt block with the Gemini API (Interactions API).

The key is read from the environment (GOOGLE_API_KEY) or from narrative/.secrets/google_api.env.
It is never printed or written anywhere else.

Usage (run from the narrative folder):
  python3 tools/gen_image.py --file prompts/asset_pipeline/pilot_fadyme.md --asset 4 \
      --ref art/sheets/char-fadyme-uomd.png --ref art/sheets/chibi_ref/chibi_ref_fadyme.png
  options: --model gemini-3.1-flash-image (default, C44: the only image model)
           --size (default 2K, C44)   --tries N (default 1)   --dry-run   --list

Output: art/_review/<metadata file name, with _tN suffix> with embedded uomd_* metadata, status REVIEW.
"""
import argparse, base64, io, json, os, re, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
API = "https://generativelanguage.googleapis.com/v1beta/interactions"
API_LEGACY = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def load_key():
    """One Google API key for every service we use (Gemini images, Lyria, TTS, and any other Google Cloud API
    enabled for it). Read from the environment or narrative/.secrets/google_api.env; never printed."""
    for var in ("GOOGLE_API_KEY", "GEMINI_API_KEY"):
        if os.environ.get(var):
            return os.environ[var].strip()
    for name in ("google_api.env", "image_api.env"):  # image_api.env: older name, still accepted
        p = os.path.join(ROOT, ".secrets", name)
        if os.path.exists(p):
            for line in open(p, encoding="utf-8"):
                k, _, v = line.strip().partition("=")
                if k in ("GOOGLE_API_KEY", "GEMINI_API_KEY") and v:
                    return v.strip().strip('"').strip("'")
    sys.exit("No key: create narrative/.secrets/google_api.env with GOOGLE_API_KEY=... (see README.txt there)")


def parse_blocks(path):
    text = open(os.path.join(ROOT, path), encoding="utf-8").read()
    blocks = {}
    for part in re.split(r"(?=^## )", text, flags=re.M):
        m = re.match(r"## (\w+)\. (.+)", part)
        if not m:
            continue
        fences = re.findall(r"```\n(.*?)\n```", part, flags=re.S)
        if len(fences) < 3:
            continue
        meta = {}
        for line in fences[2].splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        blocks[m.group(1)] = dict(title=m.group(2).strip(), prompt=fences[0], negative=fences[1], meta=meta)
    return blocks


def aspect(meta):
    m = re.search(r"(\d+)x(\d+)", meta.get("native size", ""))
    if not m:
        return "2:3"
    w, h = int(m.group(1)), int(m.group(2))
    return {(1, 1): "1:1", (2, 3): "2:3", (3, 2): "3:2", (9, 16): "9:16", (16, 9): "16:9"}.get(
        (w // __import__("math").gcd(w, h), h // __import__("math").gcd(w, h)), "2:3")


def img_part(path):
    data = open(os.path.join(ROOT, path), "rb").read()
    mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    return mime, base64.b64encode(data).decode()


def post(url, body, key):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=170) as r:
        return json.loads(r.read())


def find_image(obj):
    """Return base64 image data from either API's response, wherever it sits."""
    if isinstance(obj, dict):
        for k in ("output_image", "inlineData", "inline_data"):
            v = obj.get(k)
            if isinstance(v, dict) and v.get("data"):
                return v["data"]
        if obj.get("type") == "image" and obj.get("data"):
            return obj["data"]
        for v in obj.values():
            r = find_image(v)
            if r:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = find_image(v)
            if r:
                return r
    return None


def generate(text, refs, model, ar, size, key):
    parts = [{"type": "text", "text": text}]
    for r in refs:
        mime, b64 = img_part(r)
        parts.append({"type": "image", "mime_type": mime, "data": b64})
    body = {"model": model, "input": parts,
            "response_format": {"type": "image", "mime_type": "image/png", "aspect_ratio": ar, "image_size": size}}
    try:
        return find_image(post(API, body, key)), "interactions"
    except urllib.error.HTTPError as e:
        if e.code not in (400, 404):
            raise
        err = e.read().decode(errors="replace")[:300]
    # fallback: classic generateContent
    lparts = [{"text": text}] + [{"inline_data": {"mime_type": img_part(r)[0], "data": img_part(r)[1]}} for r in refs]
    body = {"contents": [{"parts": lparts}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": ar, "imageSize": size}}}
    try:
        return find_image(post(API_LEGACY.format(model=model), body, key)), "generateContent"
    except urllib.error.HTTPError as e2:
        sys.exit(f"API error {e2.code}: {e2.read().decode(errors='replace')[:500]}\n(interactions said: {err})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--asset")
    ap.add_argument("--ref", action="append", default=[])
    ap.add_argument("--model", default="gemini-3.1-flash-image")
    ap.add_argument("--size", default="2K")
    ap.add_argument("--tries", type=int, default=1)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    blocks = parse_blocks(a.file)
    if a.list or not a.asset:
        for k, b in blocks.items():
            print(k, "|", b["title"], "|", b["meta"].get("reference files", ""))
        return
    b = blocks[a.asset]
    for r in a.ref:
        if not os.path.exists(os.path.join(ROOT, r)):
            sys.exit("missing reference: " + r)
    text = b["prompt"] + "\n\nAvoid: " + b["negative"]
    ar = aspect(b["meta"])
    m = b["meta"]
    base = f"{m.get('kind','img')}_{m.get('id','x')}_{m.get('variant','v')}_{m.get('revision','v001')}"
    if a.dry_run:
        print(json.dumps(dict(asset=a.asset, title=b["title"], model=a.model, aspect=ar, size=a.size, refs=a.ref,
                              out=f"art/_review/{base}_tN.png", prompt_chars=len(text)), indent=1))
        return
    key = load_key()
    from PIL import Image, PngImagePlugin
    os.makedirs(os.path.join(ROOT, "art", "_review"), exist_ok=True)
    for t in range(1, a.tries + 1):
        t0 = time.time()
        data, api = generate(text, a.ref, a.model, ar, a.size, key)
        if not data:
            print(f"try {t}: no image returned"); continue
        im = Image.open(io.BytesIO(base64.b64decode(data)))
        info = PngImagePlugin.PngInfo()
        meta = dict(id=m.get("id", ""), kind=m.get("kind", ""), mode=m.get("mode", ""), variant=m.get("variant", ""),
                    revision=m.get("revision", ""), status="REVIEW", reference=" + ".join(a.ref),
                    key_colour=m.get("key colour", ""), native_size=f"{im.width}x{im.height}",
                    date=time.strftime("%Y-%m-%d"), source=f"{a.model} via {api}", prompt_file=a.file, prompt_asset=a.asset)
        for k, v in meta.items():
            info.add_text("uomd_" + k, str(v))
        out = os.path.join("art", "_review", f"{base}_t{t}.png")
        im.save(os.path.join(ROOT, out), pnginfo=info)
        print(f"try {t}: {out} {im.width}x{im.height} ({time.time()-t0:.0f}s, {api})")


if __name__ == "__main__":
    main()
