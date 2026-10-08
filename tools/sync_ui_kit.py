"""Copy the Production v001 runtime kit, or detect later source changes without writing.

py -3.14 tools/sync_ui_kit.py --source-root "C:/.../Unaware of My Demise - Production" --check
The original production folder is always read-only. PNG pixels are never transformed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
from datetime import datetime

REPO = Path(__file__).resolve().parents[1]
DEST = REPO / "game/assets/ui/production/v001/components"
RECORD = REPO / "docs/ui/production-v001/integration-manifest.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--check", action="store_true", help="Compare only; make no filesystem changes")
    args = parser.parse_args()
    source = args.source_root.resolve() / "02_UI/01_Component_Kit/v001"
    manifest_path = source / "Specs/UOMD_UI_Component_Kit_Manifest_v001.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    if manifest["version"] != "v001" or len(manifest["assets"]) != 18:
        raise ValueError("This integration expects the complete v001 kit (18 assets)")
    records = []
    changes = []
    # Validate the entire input before copying any asset.
    for asset in manifest["assets"]:
        name = asset["filename"]
        if Path(name).name != name:
            raise ValueError(f"Invalid asset filename: {name}")
        original = source / "Runtime" / name
        data = original.read_bytes()
        if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
            raise ValueError(f"Invalid PNG: {original}")
        width, height, depth, color = struct.unpack(">IIBB", data[16:26])
        if [width, height] != asset["size"] or depth != 8 or color != 6:
            raise ValueError(f"Size/RGBA contract differs: {name}")
        left, top, right, bottom = asset["nine_slice"]
        if min(left, top, right, bottom) < 0 or left + right >= width or top + bottom >= height:
            raise ValueError(f"Invalid slices: {name}")
        target = DEST / name
        digest = sha256(original)
        matches = target.exists() and sha256(target) == digest
        if not matches:
            changes.append(name)
        records.append({"source": str(original), "target": "res://" + str(target.relative_to(REPO / "game")).replace("\\", "/"),
                        "action": "copy_unmodified", "transformation": "none; runtime StyleBoxTexture stretches only the center/edges",
                        "sha256": digest, "source_px": [width, height], "format": "PNG RGBA8",
                        "nine_slice": asset["nine_slice"], "variant": asset["variant"], "state": asset["state"],
                        "validation": "PNG header, size, slice bounds and source/target SHA256"})
    if args.check:
        for name in changes:
            print(f"DIFF: {name}")
        if RECORD.exists():
            previous = json.loads(RECORD.read_text(encoding="utf-8"))
            if previous.get("source_manifest_sha256") != sha256(manifest_path):
                print("DIFF: source manifest metadata changed")
                return 1
        print(f"{18 - len(changes)}/18 runtime assets match the production source")
        return int(bool(changes))
    DEST.mkdir(parents=True, exist_ok=True)
    backup = REPO / "build/ui-kit-source-backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    for name in changes:
        target = DEST / name
        if target.exists():
            backup.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, backup / name)
        shutil.copy2(source / "Runtime" / name, target)
        if sha256(target) != sha256(source / "Runtime" / name):
            raise ValueError(f"Copy verification failed: {name}")
    RECORD.parent.mkdir(parents=True, exist_ok=True)
    RECORD.write_text(json.dumps({"schema": 1, "version": "v001", "status": "local_runtime_candidate",
        "source_root": str(args.source_root.resolve()), "source_manifest_sha256": sha256(manifest_path),
        "theme_adapter": "res://theme/production_kit_v001.gd", "assets": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"18/18 assets verified; copied {len(changes)} changed files; provenance recorded")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
