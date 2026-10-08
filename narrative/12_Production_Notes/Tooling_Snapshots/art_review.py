"""Move reviewed images between the art review folders, rename them and update their embedded metadata.

Folders:  art/_review/    fresh generations (status REVIEW)
          art/_proposed/  the Director's recommendation, waiting for the owner (status PROPOSED)
          art/_rejected/  eliminated, with the reason (status REJECTED)
          main folders    owner-approved (status APPROVED): art/brand/, art/sheets/, art/production/<id>/,
                          art/production/locations/<id>/, art/production/icons/ (chosen from the metadata)

Usage (run from the narrative folder):
  python3 tools/art_review.py propose <file> [--notes "..."]
  python3 tools/art_review.py reject  <file> --notes "reason"
  python3 tools/art_review.py approve <file> [--notes "..."] [--dest art/brand/brand_logo.png]
The try suffix (_t1, _t2) is dropped on propose/approve; kept on reject. The manifest is rebuilt after every move.
"""
import argparse, os, re, shutil, subprocess, sys, time
from PIL import Image, PngImagePlugin

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))


def meta_of(p):
    im = Image.open(p)
    return im, {k[5:]: v for k, v in im.info.items() if isinstance(k, str) and k.startswith("uomd_")}


def write(im, meta, dst, src_path=""):
    info = PngImagePlugin.PngInfo()
    for k, v in meta.items():
        info.add_text("uomd_" + k, str(v))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(dst) and os.path.abspath(dst) != os.path.abspath(src_path):
        base, ext = os.path.splitext(dst)
        n = 2
        while os.path.exists(f"{base}_{n}{ext}"):
            n += 1
        dst = f"{base}_{n}{ext}"
    im.save(dst, format="PNG", pnginfo=info)
    return dst


def main_folder(m):
    kind, i = m.get("kind", ""), m.get("id", "x")
    if kind in ("brand", "key_art"):
        return "art/brand"
    if kind == "sheet":
        return "art/sheets"
    if kind == "bg":
        return f"art/production/locations/{i}"
    if kind == "icons":
        return "art/production/icons"
    return f"art/production/{i}"


def run(a):
    src = os.path.join(ROOT, a.file) if not os.path.isabs(a.file) else a.file
    im, m = meta_of(src)
    name = os.path.basename(src)
    clean = re.sub(r"_t\d+(?=\.png$)", "", name)
    m["date"] = time.strftime("%Y-%m-%d")
    if a.notes:
        m["notes"] = a.notes
    if a.cmd == "propose":
        m["status"] = "PROPOSED"; dst = os.path.join(ROOT, "art", "_proposed", clean)
    elif a.cmd == "reject":
        m["status"] = "REJECTED"; dst = os.path.join(ROOT, "art", "_rejected", name)
    else:
        m["status"] = "APPROVED"; m["approved_by"] = "owner"
        dst = os.path.join(ROOT, a.dest) if a.dest else os.path.join(ROOT, main_folder(m), clean)
    out = write(im, m, dst, src)
    im.close()
    if os.path.abspath(out) != os.path.abspath(src):
        os.remove(src)
    print(a.cmd, "->", os.path.relpath(out, ROOT))
    subprocess.run([sys.executable, os.path.join(ROOT, "tools", "art_manifest.py")], check=False, stdout=subprocess.DEVNULL)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["propose", "reject", "approve"])
    ap.add_argument("file"); ap.add_argument("--notes"); ap.add_argument("--dest")
    run(ap.parse_args())
