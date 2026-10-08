#!/usr/bin/env python3
"""Builds the manifest of a content release (INF-028, DEC-0029); tools/sign_content_manifest.sh signs it.

    python3 tools/content_release.py rules-hash
    python3 tools/content_release.py manifest --channel production --release c2026.10.05-1 --generation 3 \\
        --min-version-code 1 --max-version-code 1 --base base.pck --key-id uomd-content-1 patch1.pck [patch2.pck ...]

The manifest names every pack (in mount order) with its SHA-256 and size, the base pack it applies to, the app
versionCode range it is for, the rules hash its content implies (the same algorithm and file list as the server's
``rulesHash`` and the client's ``ClientRelease.rules_hash``), the signing key id and a generation that only ever grows
(the client refuses a generation that is not newer than the installed one; a rollback is a new generation).
Output is canonical JSON (sorted keys, two-space indent, trailing newline): the signature covers these exact bytes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT_MANIFEST = ROOT / "game" / "data" / "content" / "MANIFEST.json"
SERVER_RELEASE = ROOT / "server" / "src" / "release.ts"
CLIENT_RELEASE = ROOT / "game" / "scripts" / "app" / "client_release.gd"
SCHEMA = 1


def rules_files() -> list[str]:
    """RULES_FILES as the server declares it; the client's copy must be the same list."""

    def listed(path: Path, start: str, end: str) -> list[str]:
        text = path.read_text(encoding="utf-8")
        body = text[text.index(start) + len(start) : text.index(end, text.index(start))]
        return re.findall(r'"([^"]+)"', body)

    server = listed(SERVER_RELEASE, "RULES_FILES: readonly string[] = [", "];")
    client = listed(CLIENT_RELEASE, "const RULES_FILES: Array[String] = [", "]\n")
    if sorted(server) != sorted(client) or not server:
        raise SystemExit(f"RULES_FILES differ between {SERVER_RELEASE.name} and {CLIENT_RELEASE.name}")
    return server


def rules_hash(manifest: dict, files: list[str]) -> str:
    lines = []
    for name in sorted(files):
        digest = manifest.get("files", {}).get(name, {}).get("sha256")
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise SystemExit(f"content manifest has no sha256 for {name}")
        lines.append(f"{name} {digest}\n")
    return hashlib.sha256("".join(lines).encode("utf-8")).hexdigest()


def file_digest(path: Path) -> tuple[str, int]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)


def build_manifest(args: argparse.Namespace) -> dict:
    if args.generation < 1:
        raise SystemExit("--generation must be positive")
    if args.min_version_code > args.max_version_code:
        raise SystemExit("--min-version-code must not exceed --max-version-code")
    packs = []
    for pack in args.packs:
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*\.pck", pack.name):
            raise SystemExit(f"{pack.name}: pack file names are lowercase letters, digits, '.', '_', '-' and end in .pck")
        digest, size = file_digest(pack)
        packs.append({"name": pack.name, "sha256": digest, "bytes": size})
    if len({pack["name"] for pack in packs}) != len(packs):
        raise SystemExit("a pack is listed twice")
    content = json.loads(args.content_manifest.read_text(encoding="utf-8"))
    return {
        "schema": SCHEMA,
        "channel": args.channel,
        "content_release": args.release,
        "generation": args.generation,
        "app": {"min_version_code": args.min_version_code, "max_version_code": args.max_version_code},
        "base_pack_sha256": file_digest(args.base)[0],
        "rules_hash": rules_hash(content, rules_files()),
        "key_id": args.key_id,
        "issued_at_utc": args.issued_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "packs": packs,
    }


def render(manifest: dict) -> str:
    return json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("rules-hash", help="print the rules hash of game/data/content")
    build = commands.add_parser("manifest", help="print the manifest of a content release")
    build.add_argument("--channel", required=True, choices=["production", "staging", "test"])
    build.add_argument("--release", required=True, help="content release id, e.g. c2026.10.05-1")
    build.add_argument("--generation", required=True, type=int)
    build.add_argument("--min-version-code", required=True, type=int)
    build.add_argument("--max-version-code", required=True, type=int)
    build.add_argument("--base", required=True, type=Path, help="the base pack of the app release")
    build.add_argument("--key-id", required=True)
    build.add_argument("--issued-at", help="UTC timestamp (default: now)")
    build.add_argument("--content-manifest", type=Path, default=CONTENT_MANIFEST)
    build.add_argument("packs", nargs="+", type=Path)
    args = parser.parse_args(argv)
    if args.command == "rules-hash":
        print(rules_hash(json.loads(CONTENT_MANIFEST.read_text(encoding="utf-8")), rules_files()))
        return 0
    sys.stdout.write(render(build_manifest(args)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
