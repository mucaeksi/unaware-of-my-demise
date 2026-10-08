#!/usr/bin/env python3
"""List and check what a Godot PCK carries (INF-027): the content-patch gate.

Reads the PCK directory (pack format v2-v4, Godot 4.x; ``core/io/file_access_pack.cpp`` of the pinned engine), verifies
every stored file against the MD5 the directory records, and, with ``--patch-policy``, refuses any path outside the
content-patch allowlist. A content patch may carry data and imported art/audio only: never script (``.gd``/``.gdc``),
native code, scenes or resources that can embed script, or project settings. Google Play forbids an app downloading
executable code from elsewhere, and a script in a patch would bypass the reviewed AAB.

    python3 tools/pck_inventory.py patch.pck                      # inventory as JSON
    python3 tools/pck_inventory.py patch.pck --patch-policy \\
        --base base.pck                                           # exit 1 on a disallowed path

``--base``: a file the policy cannot judge by name (``.godot/global_script_class_cache.cfg``) is allowed only when it
lists the same script classes as the base pack's copy (order aside), i.e. the patch does not change which scripts exist.
"""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import re
import struct
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

MAGIC = b"GDPC"
PACK_DIR_ENCRYPTED = 1 << 0
PACK_REL_FILEBASE = 1 << 1
PACK_SPARSE_BUNDLE = 1 << 2
PACK_FILE_ENCRYPTED = 1 << 0
PACK_FILE_REMOVAL = 1 << 1
PACK_FILE_DELTA = 1 << 2

# Paths a content patch may carry (res:// stripped). Everything else is refused.
PATCH_ALLOWED = (
    "data/content/*.json",
    "assets/*.import",
    ".godot/imported/*.ctex",
    ".godot/imported/*.oggvorbisstr",
    ".godot/imported/*.mp3str",
    ".godot/imported/*.sample",
    ".godot/uid_cache.bin",
)
# Allowed only when it lists the same script classes as the base pack (the export rewrites it in another order).
PATCH_UNCHANGED_ONLY = (".godot/global_script_class_cache.cfg",)
_CLASS_ENTRY = re.compile(r"\{[^{}]*\}")


@dataclass
class Entry:
    path: str
    offset: int
    size: int
    md5: str
    flags: int

    @property
    def removed(self) -> bool:
        return bool(self.flags & PACK_FILE_REMOVAL)


@dataclass
class Pack:
    format_version: int
    engine: str
    pack_flags: int
    entries: list[Entry]
    data: bytes
    file_base: int

    def content(self, entry: Entry) -> bytes:
        return self.data[self.file_base + entry.offset : self.file_base + entry.offset + entry.size]


class PackError(Exception):
    pass


def read_pack(path: Path) -> Pack:
    data = path.read_bytes()
    if data[:4] != MAGIC:
        raise PackError(f"{path}: not a standalone PCK (no GDPC header)")
    version, major, minor, patch, flags = struct.unpack_from("<5I", data, 4)
    if version not in (2, 3, 4):
        raise PackError(f"{path}: pack format {version} is not supported")
    if flags & PACK_DIR_ENCRYPTED:
        raise PackError(f"{path}: the directory is encrypted; content patches are not encrypted")
    file_base = struct.unpack_from("<Q", data, 24)[0]
    if version >= 3:
        cursor = struct.unpack_from("<Q", data, 32)[0]
    else:
        cursor = 32 + 16 * 4
    (count,) = struct.unpack_from("<I", data, cursor)
    cursor += 4
    entries: list[Entry] = []
    for _ in range(count):
        (length,) = struct.unpack_from("<I", data, cursor)
        cursor += 4
        name = data[cursor : cursor + length].rstrip(b"\0").decode("utf-8")
        cursor += length
        offset, size = struct.unpack_from("<QQ", data, cursor)
        cursor += 16
        md5 = data[cursor : cursor + 16].hex()
        cursor += 16
        (file_flags,) = struct.unpack_from("<I", data, cursor)
        cursor += 4
        entries.append(Entry(name.removeprefix("res://"), offset, size, md5, file_flags))
    return Pack(version, f"{major}.{minor}.{patch}", flags, entries, data, file_base)


def script_classes(blob: bytes) -> set[str]:
    """The script class records of a global_script_class_cache.cfg, order-free (each record normalized to one line)."""

    text = blob.decode("utf-8")
    return {" ".join(match.group(0).split()) for match in _CLASS_ENTRY.finditer(text)}


def integrity_problems(pack: Pack) -> list[str]:
    problems = []
    for entry in pack.entries:
        if entry.removed or entry.flags & (PACK_FILE_ENCRYPTED | PACK_FILE_DELTA):
            continue
        blob = pack.content(entry)
        if len(blob) != entry.size:
            problems.append(f"{entry.path}: truncated ({len(blob)} of {entry.size} bytes)")
        elif hashlib.md5(blob).hexdigest() != entry.md5:
            problems.append(f"{entry.path}: data does not match the directory MD5")
    return problems


def policy_problems(pack: Pack, base: Pack | None) -> list[str]:
    problems = []
    base_files = {entry.path: entry for entry in base.entries} if base else {}
    for entry in pack.entries:
        if entry.flags & PACK_FILE_ENCRYPTED:
            problems.append(f"{entry.path}: encrypted entries are not allowed in a content patch")
        # Removals (a patch retiring a file) pass the same allowlist: content may be retired, code may not.
        if any(fnmatch.fnmatchcase(entry.path, pattern) for pattern in PATCH_ALLOWED):
            continue
        if entry.path in PATCH_UNCHANGED_ONLY:
            original = base_files.get(entry.path)
            if base is None:
                problems.append(f"{entry.path}: needs --base to prove it is unchanged")
            elif original is None or entry.removed or script_classes(base.content(original)) != script_classes(pack.content(entry)):
                problems.append(f"{entry.path}: changes the project's script classes (code change: needs an app release)")
            continue
        problems.append(f"{entry.path}: not allowed in a content patch (only data and imported art/audio)")
    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pack", type=Path)
    parser.add_argument("--patch-policy", action="store_true", help="refuse paths outside the content-patch allowlist")
    parser.add_argument("--base", type=Path, help="the base pack the patch applies to")
    parser.add_argument("--json", type=Path, help="also write the inventory to this file")
    args = parser.parse_args(argv)
    try:
        pack = read_pack(args.pack)
        base = read_pack(args.base) if args.base else None
    except (OSError, PackError, struct.error, UnicodeDecodeError) as error:
        print(f"cannot read pack: {error}", file=sys.stderr)
        return 2
    inventory = {
        "format_version": pack.format_version,
        "engine": pack.engine,
        "files": [
            {**asdict(entry), "removed": entry.removed} | {"sha256": hashlib.sha256(pack.content(entry)).hexdigest()}
            for entry in sorted(pack.entries, key=lambda item: item.path)
        ],
    }
    rendered = json.dumps(inventory, indent=2, sort_keys=True) + "\n"
    if args.json:
        args.json.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")
    problems = integrity_problems(pack)
    if args.patch_policy:
        problems += policy_problems(pack, base)
    for problem in problems:
        print(f"::error::{args.pack.name}: {problem}", file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
