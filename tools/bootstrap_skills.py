#!/usr/bin/env python3
"""Install reviewed, pinned project skills only. Does not execute ZIP content or enable hooks."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
from urllib.request import Request, urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / "skill-sources"
TARGET = ROOT / ".claude" / "skills"
LICENSES = ROOT / ".claude" / "third-party-licenses"
PHASER_SHA = "02d8931b626d9764c133cbb3fbf99966c03c757c"
PINNED = {
    "Cloudflare_Security_Audit_Skill_2026-10-10.zip": "f62b7cbc0c9a8358f68bf486e9d68220d9897c573f5f099d61ff4a9063f0ef01",
    
    "UOMD_Claude_Phaser_Toolkit_2026-10-10.zip": "b0d0143222a5040371ce763398ebc60d592631929eef284f1a750ca65973e0b0",
    "awesome-gamedev-agent-skills-1.1.0.zip": "9c37ba03278bbbe8ca74facb8f45227ba1b5d9bcf9be483afebd410cba8251ee",
    "chrome-devtools-mcp-chrome-devtools-mcp-v1.10.1.zip": "64b334194c8ea0ee1afcc5aacdb4e2f0f6c4de1c84ad89d2dbeb390c8c6beec4",
    "context7--upstash-context7-mcp-4.3.0.zip": "d32e5f631666ba63617c5c40aa6990a0df2f625c7aeed9d01df339d5099fdafe",
    "graphify-0.9.84.zip": "4c811563bcf67404e6e0db0a3456fe632800c92a242d81e314938406211478d0",
    "ponytail-5.1.0.zip": "8fa83a6a1f5f0ca980445f789d3a747ee9999959bbc4176ea6f73e4f3dbcb8bd",
    "ui-ux-pro-max-skill-2.15.0.zip": "99cadc867d71f4c77d29441ad15e5b47490e5998c0f926e5d16da185fb4eb455"
}
GAMEDEV = ("audio-design", "camera-systems", "dialogue-systems", "game-ai", "game-feel", "game-ui-ux", "performance-optimization", "save-systems", "rpg", "visual-novel")
PHASER = ("actions-and-utilities", "animations", "audio-and-sound", "cameras", "curves-and-paths", "data-manager", "events-system", "filters-and-postfx", "game-object-components", "game-setup-and-config", "geometry-and-math", "graphics-and-shapes", "groups-and-containers", "input-keyboard-mouse-touch", "loading-assets", "particles", "physics-arcade", "physics-matter", "render-textures", "scale-and-responsive", "scenes", "sprites-and-images", "text-and-bitmaptext", "tilemaps", "time-and-timers", "tweens", "v3-to-v4-migration", "v4-new-features")

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def write_safe(dest: Path, data: bytes) -> None:
    if not dest.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError("Unsafe destination: " + str(dest))
    if len(data) > 2_000_000:
        raise ValueError("Unexpectedly large selected file: " + str(dest))
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)

def copy_entries(archive: Path, pick) -> int:
    count = 0
    with ZipFile(archive) as z:
        for item in z.infolist():
            raw = item.filename
            parts = PurePosixPath(raw)
            if item.is_dir() or raw.startswith("/") or ".." in parts.parts or "\\" in raw:
                continue
            # No symbolic links, devices or other special entries.
            kind = (item.external_attr >> 16) & 0o170000
            if kind not in (0, 0o100000):
                continue
            out = pick(raw)
            if out is None:
                continue
            if not raw.endswith((".md", ".json", ".txt", ".csv", ".py", ".yaml", ".yml", ".toml", ".js", ".cjs", ".sh", ".ps1", ".svg")):
                continue
            write_safe(ROOT / out, z.read(item))
            count += 1
    return count

def install_cloudflare_security_skill(archive: Path) -> int:
    """Download the 20-source-file official Cloudflare skill at a pinned commit.
    The uploaded ZIP contains only a manifest and installer; verify it before using
    the manifest. Never run downloaded code during installation.
    """
    with ZipFile(archive) as z:
        prefix = "cloudflare-security-audit-installer/"
        manifest = json.loads(z.read(prefix + "manifest.json"))
        license_text = z.read(prefix + "LICENSE")
    approved_commit = "c1c8a8c1471069fb0e188eeaff69b8e8db6564a8"
    files = manifest.get("files", {})
    if manifest.get("commit") != approved_commit or len(files) != 20:
        raise RuntimeError("Cloudflare security skill manifest mismatch")
    target = TARGET / "security-audit"
    for name, meta in files.items():
        if name.startswith(".") or "/" in name or "\\\\" in name:
            raise ValueError("Invalid Cloudflare security skill path")
        if not isinstance(meta.get("size"), int) or not (0 < meta["size"] < 200000):
            raise ValueError("Invalid Cloudflare security skill size")
        url = ("https://raw.githubusercontent.com/cloudflare/security-audit-skill/"
               + approved_commit + "/skills/security-audit/" + name)
        with urlopen(Request(url, headers={"User-Agent":"UOMD-locked-bootstrap"}),timeout=35) as response:
            data = response.read(meta["size"] + 1)
        blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        if len(data) != meta["size"] or blob != meta["git_blob_sha1"]:
            raise RuntimeError("Cloudflare security-audit integrity mismatch: " + name)
        write_safe(target / name, data)
    write_safe(LICENSES / "cloudflare-security-audit/LICENSE", license_text)
    return len(files)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="Do not fetch official Phaser skills")
    parser.add_argument("--verify", action="store_true", help="Validate already installed skills only")
    args = parser.parse_args()
    if args.verify:
        expected = ["ponytail", "graphify", "ui-ux-pro-max", "phaser4-engine", "phaser4-battle", "game-ui-ux", "sprites-and-images", "scenes", "security-audit"]
        missing = [name for name in expected if not (TARGET / name / "SKILL.md").is_file()]
        print("Installed skill files:", len(list(TARGET.glob("*/SKILL.md"))))
        if missing: raise SystemExit("Missing skills: " + ", ".join(missing))
        json.loads((ROOT / ".mcp.json").read_text(encoding="utf-8"))
        print("PASS: required skill files and MCP JSON present (runtime MCP calls not tested)")
        return
    archives = sorted(INBOX.glob("*.zip"))
    if not archives:
        raise SystemExit("Add the 2 required pinned ZIPs to skill-sources/ first.")
    for a in archives:
        expected = PINNED.get(a.name)
        if not expected or sha256(a.read_bytes()) != expected:
            raise SystemExit("Unknown or modified ZIP: " + a.name)
    supplied = {a.name: a for a in archives}
    need = ["UOMD_Claude_Phaser_Toolkit_2026-10-10.zip", "awesome-gamedev-agent-skills-1.1.0.zip"]
    if any(k not in supplied for k in need):
        raise SystemExit("Missing required ZIP: " + ", ".join(k for k in need if k not in supplied))
    copied = copy_entries(supplied[need[0]], lambda p: p if p.startswith((".claude/skills/", ".claude/third-party-licenses/")) and not p.startswith(".claude/skills/cloudflare-neon-liveops/") else None)
    def gamedev_map(p):
        mark = "/skills/"
        if mark not in p: return None
        rel = p.split(mark, 1)[1].split("/")
        if len(rel) < 3: return None
        category, name = rel[0], rel[1]
        if (category == "disciplines" and name in GAMEDEV) or (category == "genres" and name in GAMEDEV):
            return ".claude/skills/" + name + "/" + "/".join(rel[2:])
        return None
    copied += copy_entries(supplied[need[1]], gamedev_map)
    if "Cloudflare_Security_Audit_Skill_2026-10-10.zip" in supplied:
        copied += install_cloudflare_security_skill(supplied["Cloudflare_Security_Audit_Skill_2026-10-10.zip"])
    # Retain license for the copied game-dev skills.
    with ZipFile(supplied[need[1]]) as z:
        lic = next(x for x in z.namelist() if x.endswith("/LICENSE"))
        write_safe(LICENSES / "awesome-gamedev-agent-skills/LICENSE", z.read(lic))
    downloaded = 0
    if not args.offline:
        for name in PHASER:
            url = "https://raw.githubusercontent.com/phaserjs/phaser/" + PHASER_SHA + "/skills/" + name + "/SKILL.md"
            with urlopen(Request(url, headers={"User-Agent": "UOMD-pinned-skill-bootstrap"}), timeout=25) as response:
                data = response.read(250_001)
            if not data.startswith(b"---") or b"name:" not in data[:700]:
                raise RuntimeError("Unexpected official Phaser skill: " + name)
            write_safe(TARGET / name / "SKILL.md", data)
            downloaded += 1
    lock = {
        "installed_by": "tools/bootstrap_skills.py",
        "phaser_repository": "https://github.com/phaserjs/phaser",
        "phaser_commit": PHASER_SHA,
        "official_phaser_skills": downloaded,
        "pinned_archive_sha256": {p.name: PINNED[p.name] for p in archives},
        "skill_file_sha256": {p.parent.name: sha256(p.read_bytes()) for p in sorted(TARGET.glob("*/SKILL.md"))},
        "executable_hooks_enabled": False,
    }
    write_safe(ROOT / ".claude" / "skills-lock.json", (json.dumps(lock, indent=2, sort_keys=True) + "\n").encode())
    print("PASS: copied", copied, "archive files; downloaded", downloaded, "official Phaser skills; installed", len(lock["skill_file_sha256"]), "skills.")
    if not args.offline: main_verify = [name for name in ("ponytail", "graphify", "ui-ux-pro-max", "phaser4-engine", "game-ui-ux", "sprites-and-images", "security-audit") if not (TARGET / name / "SKILL.md").exists()]
    else: main_verify = []
    if main_verify: raise SystemExit("Unexpected missing skills: " + ", ".join(main_verify))

if __name__ == "__main__":
    main()
