"""Tests of tools/pck_inventory.py on packs written here in the engine's format (INF-027).

    python3 -m unittest discover -s tools -p 'test_*.py'
"""

from __future__ import annotations

import hashlib
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pck_inventory as pck  # noqa: E402

CLASS_CACHE = ".godot/global_script_class_cache.cfg"


def write_pack(path: Path, files: dict[str, bytes], removed: tuple[str, ...] = (), corrupt: str = "") -> Path:
    """A format v4 PCK as Godot 4.7 writes it: header, file data, directory at the end."""

    header_size = 112
    data = b""
    entries = []
    for name, blob in files.items():
        entries.append((name, len(data), blob, 0))
        data += blob
    for name in removed:
        entries.append((name, 0, b"", pck.PACK_FILE_REMOVAL))
    directory = struct.pack("<I", len(entries))
    for name, offset, blob, flags in entries:
        encoded = ("res://" + name).encode("utf-8")
        padded = encoded + b"\0" * (-len(encoded) % 4)
        digest = hashlib.md5(b"broken" if name == corrupt else blob).digest()
        directory += struct.pack("<I", len(padded)) + padded + struct.pack("<QQ", offset, len(blob)) + digest + struct.pack("<I", flags)
    header = b"GDPC" + struct.pack("<5I", 4, 4, 7, 2, pck.PACK_REL_FILEBASE) + struct.pack("<QQ", header_size, header_size + len(data))
    path.write_bytes(header.ljust(header_size, b"\0") + data + directory)
    return path


def classes(*names: str) -> bytes:
    records = ", ".join('{\n"class": &"%s",\n"path": "res://%s.gd"\n}' % (name, name.lower()) for name in names)
    return ("list=[%s]\n" % records).encode()


class PackInventoryTest(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = Path(tempfile.mkdtemp())
        self.base = write_pack(self.dir / "base.pck", {CLASS_CACHE: classes("Alpha", "Beta"), "data/content/a.json": b"{}"})

    def problems(self, files: dict[str, bytes], **kwargs) -> list[str]:
        patch = pck.read_pack(write_pack(self.dir / "patch.pck", files, **kwargs))
        return pck.integrity_problems(patch) + pck.policy_problems(patch, pck.read_pack(self.base))

    def test_reads_the_directory_and_content(self) -> None:
        pack = pck.read_pack(self.base)
        self.assertEqual((pack.format_version, pack.engine), (4, "4.7.2"))
        self.assertEqual(sorted(entry.path for entry in pack.entries), [CLASS_CACHE, "data/content/a.json"])
        entry = next(entry for entry in pack.entries if entry.path == "data/content/a.json")
        self.assertEqual(pack.content(entry), b"{}")
        self.assertEqual(pck.integrity_problems(pack), [])

    def test_a_data_and_art_patch_passes(self) -> None:
        self.assertEqual(self.problems({
            "data/content/economy_part1.json": b"{}",
            "assets/marks/m.svg.import": b"[remap]",
            ".godot/imported/m.svg-0123.ctex": b"GST2",
            ".godot/imported/theme.ogg-4567.oggvorbisstr": b"RSRC",
            ".godot/uid_cache.bin": b"\1",
            CLASS_CACHE: classes("Beta", "Alpha"),
        }), [])

    def test_code_scenes_resources_and_settings_are_refused(self) -> None:
        refused = ["scripts/app/game.gdc", "scripts/app/game.gd", "scripts/x.gd.remap", "scenes/main/main.tscn",
                   "theme/ui.tres", "project.binary", "lib/libgodot.so", "addons/x/x.gdextension", "data/other.json"]
        problems = self.problems({name: b"x" for name in refused})
        for name in refused:
            self.assertTrue(any(problem.startswith(name + ":") for problem in problems), name)

    def test_a_new_script_class_is_a_code_change(self) -> None:
        problems = self.problems({CLASS_CACHE: classes("Alpha", "Beta", "Injected")})
        self.assertEqual(len(problems), 1)
        self.assertIn("script classes", problems[0])

    def test_the_class_cache_needs_the_base_to_be_judged(self) -> None:
        patch = pck.read_pack(write_pack(self.dir / "patch.pck", {CLASS_CACHE: classes("Alpha", "Beta")}))
        self.assertIn("needs --base", pck.policy_problems(patch, None)[0])

    def test_removing_code_is_refused_and_removing_data_is_allowed(self) -> None:
        self.assertEqual(self.problems({}, removed=("data/content/old.json",)), [])
        self.assertTrue(self.problems({}, removed=("scripts/app/game.gdc",)))

    def test_corrupt_data_fails_the_integrity_check(self) -> None:
        problems = self.problems({"data/content/a.json": b"{}"}, corrupt="data/content/a.json")
        self.assertEqual(problems, ["data/content/a.json: data does not match the directory MD5"])

    def test_not_a_pack(self) -> None:
        bogus = self.dir / "bogus.pck"
        bogus.write_bytes(b"PK\3\4")
        with self.assertRaises(pck.PackError):
            pck.read_pack(bogus)

    def test_cli_exit_codes(self) -> None:
        good = write_pack(self.dir / "good.pck", {"data/content/a.json": b"[]"})
        bad = write_pack(self.dir / "bad.pck", {"scripts/a.gdc": b"x"})
        out = self.dir / "inventory.json"
        self.assertEqual(pck.main([str(good), "--patch-policy", "--base", str(self.base), "--json", str(out)]), 0)
        self.assertIn('"sha256"', out.read_text())
        self.assertEqual(pck.main([str(bad), "--patch-policy", "--base", str(self.base), "--json", str(out)]), 1)
        self.assertEqual(pck.main([str(self.dir / "missing.pck")]), 2)


if __name__ == "__main__":
    unittest.main()
