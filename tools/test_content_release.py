"""Tests of tools/content_release.py and tools/sign_content_manifest.sh (INF-028)."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import content_release  # noqa: E402


def openssl(*args: str) -> None:
    subprocess.run(["openssl", *args], check=True, capture_output=True)


class ContentReleaseTest(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = Path(tempfile.mkdtemp())
        (self.dir / "base.pck").write_bytes(b"GDPC base")
        (self.dir / "content-1.pck").write_bytes(b"GDPC patch")

    def manifest(self, *extra: str) -> dict:
        args = ["manifest", "--channel", "test", "--release", "t-1", "--generation", "3", "--min-version-code", "1",
                "--max-version-code", "2", "--base", str(self.dir / "base.pck"), "--key-id", "k-1",
                "--issued-at", "2026-10-04T00:00:00Z", *extra, str(self.dir / "content-1.pck")]
        result = subprocess.run([sys.executable, str(TOOLS / "content_release.py"), *args], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_rules_hash_follows_the_shared_test_vector(self) -> None:
        vector = {"files": {"b.json": {"sha256": "b" * 64}, "a.json": {"sha256": "a" * 64}}}
        expected = hashlib.sha256(f"a.json {'a' * 64}\nb.json {'b' * 64}\n".encode()).hexdigest()
        self.assertEqual(content_release.rules_hash(vector, ["b.json", "a.json"]), expected)

    def test_rules_files_agree_between_server_and_client(self) -> None:
        self.assertIn("battle_rules_part1.json", content_release.rules_files())

    def test_manifest_names_packs_base_range_and_rules(self) -> None:
        manifest = self.manifest()
        self.assertEqual(manifest["schema"], 1)
        self.assertEqual(manifest["generation"], 3)
        self.assertEqual(manifest["app"], {"min_version_code": 1, "max_version_code": 2})
        self.assertEqual(manifest["base_pack_sha256"], hashlib.sha256(b"GDPC base").hexdigest())
        self.assertEqual(manifest["packs"], [{"name": "content-1.pck", "sha256": hashlib.sha256(b"GDPC patch").hexdigest(), "bytes": 10}])
        self.assertRegex(manifest["rules_hash"], "^[0-9a-f]{64}$")

    def test_bad_arguments_are_refused(self) -> None:
        bad = self.dir / "Bad Name.pck"
        bad.write_bytes(b"x")
        for args in (["--generation", "0"], ["--min-version-code", "3"]):
            command = ["manifest", "--channel", "test", "--release", "t", "--generation", "1", "--min-version-code", "1",
                       "--max-version-code", "2", "--base", str(self.dir / "base.pck"), "--key-id", "k", str(self.dir / "content-1.pck")]
            index = command.index(args[0])
            command[index + 1] = args[1]
            result = subprocess.run([sys.executable, str(TOOLS / "content_release.py"), *command], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0, args)
        result = subprocess.run([sys.executable, str(TOOLS / "content_release.py"), "manifest", "--channel", "test", "--release", "t",
                                 "--generation", "1", "--min-version-code", "1", "--max-version-code", "1", "--base",
                                 str(self.dir / "base.pck"), "--key-id", "k", str(bad)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)

    def test_signing_needs_the_matching_shipped_key(self) -> None:
        keys = self.dir / "keys"
        keys.mkdir()
        openssl("genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", str(self.dir / "k.key"))
        openssl("pkey", "-in", str(self.dir / "k.key"), "-pubout", "-out", str(keys / "k-1.pem"))
        manifest_path = self.dir / "manifest.json"
        manifest_path.write_text(content_release.render(self.manifest()), encoding="utf-8")
        env = {**os.environ, "UOMD_KEYS_DIR": str(keys), "CONTENT_SIGNING_KEY": (self.dir / "k.key").read_text()}
        signed = subprocess.run([str(TOOLS / "sign_content_manifest.sh"), str(manifest_path)], env=env, capture_output=True, text=True)
        self.assertEqual(signed.returncode, 0, signed.stderr)
        openssl("dgst", "-sha256", "-verify", str(keys / "k-1.pem"), "-signature", str(manifest_path) + ".sig", str(manifest_path))
        openssl("genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", str(self.dir / "other.key"))
        env["CONTENT_SIGNING_KEY"] = (self.dir / "other.key").read_text()
        wrong = subprocess.run([str(TOOLS / "sign_content_manifest.sh"), str(manifest_path)], env=env, capture_output=True, text=True)
        self.assertNotEqual(wrong.returncode, 0)
        self.assertFalse((self.dir / "manifest.json.sig").exists(), "a signature the app cannot verify is not left behind")
        env["UOMD_KEYS_DIR"] = str(self.dir / "nowhere")
        self.assertNotEqual(subprocess.run([str(TOOLS / "sign_content_manifest.sh"), str(manifest_path)], env=env, capture_output=True).returncode, 0)


if __name__ == "__main__":
    unittest.main()
