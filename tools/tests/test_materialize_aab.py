"""Safety and integrity checks for current-only release replacement."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import materialize_aab as m


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.release = self.root / "release"
        self.release.mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def owned(self, name):
        folder = self.release / name
        folder.mkdir()
        (folder / m.MARKER).write_bytes(m.json_bytes({"owner": m.OWNER}))
        return folder

    def sealed(self):
        folder = self.owned(".current-stage-test")
        writer = m.Writer(self.root, folder)
        writer.put(m.MARKER, m.json_bytes({"owner": m.OWNER}), "metadata")
        (self.root / "asset.txt").write_text("source")
        writer.copy("asset.txt", "docs/asset.txt")
        index = m.json_bytes({"files": list(writer.rows.values())})
        (folder / "FILE_INDEX.json").write_bytes(index)
        (folder / "release.json").write_bytes(m.json_bytes({
            "file_index_sha256": m.digest(index), "artifacts": {
                "base": {"sha256": "base"}, "bundle": {"sha256": "bundle"}}}))
        return folder

    def test_unsafe_relative_paths(self):
        for value in ("../a", "/a", "C:/a", "a\\b", "a//b", "a/../b", "a.", "a ", "a:stream", ""):
            with self.subTest(value=value), self.assertRaises(m.SnapshotError):
                m.relative_path(value)

    def test_output_is_exactly_project_current(self):
        self.assertEqual(m.scope_output(self.root, None)[1], self.release / "current")
        for value in (self.root, self.release, self.root.parent / "elsewhere", self.release / "other"):
            with self.subTest(value=value), self.assertRaises(m.SnapshotError):
                m.scope_output(self.root, value)

    def test_secrets_and_deferred_inputs_rejected(self):
        for value in ("game/.mcp.json", "game/.env.local", "game/key.jks", "game/.codex/config.json", "game/data/content/story_script_ch01.json", "game/scripts/art_review/a.gd"):
            with self.subTest(value=value), self.assertRaises(m.SnapshotError):
                m.check_private(value, b"content")
        with self.assertRaises(m.SnapshotError):
            m.check_private("docs/a.md", b"C:/Users/Someone/private")
        with self.assertRaises(m.SnapshotError):
            m.check_private(m.PUBLIC_KEY, b"-----BEGIN PRIVATE KEY-----\na\n-----END PRIVATE KEY-----")
        m.check_private(m.PUBLIC_KEY, b"-----BEGIN PUBLIC KEY-----\nYWJj\n-----END PUBLIC KEY-----\n")

    def test_editor_helpers_removed_without_retargeting(self):
        blob = b'[autoload]\nGame="*res://scripts/app/game.gd"\n_mcp_game_helper="*res://addons/godot_ai/runtime/game_helper.gd"\n[editor_plugins]\nenabled=PackedStringArray("res://addons/godot_ai/plugin.cfg", "res://addons/gut/plugin.cfg", "res://addons/uomd_native/plugin.cfg")\n[debug]\ngdscript/warnings/untyped_declaration=2\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n'
        clean = m.sanitize_project(blob)
        self.assertNotIn(b"_mcp_game_helper", clean)
        self.assertNotIn(b"addons/gut", clean)
        self.assertIn(b"addons/uomd_native", clean)
        self.assertIn(b"gl_compatibility", clean)
        self.assertIn(b"untyped_declaration=2", clean)

    def test_missing_marker_refuses_deletion(self):
        folder = self.release / "current"
        folder.mkdir()
        (folder / "important.txt").write_text("preserve")
        with self.assertRaises(m.SnapshotError):
            m.remove_owned(folder, self.release)
        self.assertTrue((folder / "important.txt").exists())

    def test_promotion_failure_restores_previous(self):
        previous = self.owned("current")
        (previous / "version.txt").write_text("old")
        stage = self.owned(".current-stage-test")
        (stage / "version.txt").write_text("new")
        real_replace = os.replace
        def fail_install(source, target):
            if source == stage:
                raise OSError("simulated install failure")
            return real_replace(source, target)
        with patch.object(m.os, "replace", side_effect=fail_install), self.assertRaises(OSError):
            m.promote(stage, previous)
        self.assertEqual((previous / "version.txt").read_text(), "old")
        self.assertTrue(stage.exists())

    def test_success_keeps_only_current(self):
        previous = self.owned("current")
        stage = self.owned(".current-stage-test")
        (stage / "version.txt").write_text("new")
        m.promote(stage, previous)
        self.assertEqual((previous / "version.txt").read_text(), "new")
        self.assertEqual([p.name for p in self.release.iterdir()], ["current"])

    def test_tamper_extra_and_stale_source_are_detected(self):
        folder = self.sealed()
        self.assertEqual(m.verify_snapshot(folder, self.root)["status"], "verified")
        artifact = folder / "docs/asset.txt"
        artifact.write_text("tampered")
        with self.assertRaisesRegex(m.SnapshotError, "modified"):
            m.verify_snapshot(folder, self.root)
        artifact.write_text("source")
        extra = folder / "extra.txt"
        extra.write_text("extra")
        with self.assertRaisesRegex(m.SnapshotError, "Unexpected"):
            m.verify_snapshot(folder, self.root)
        extra.unlink()
        (self.root / "asset.txt").write_text("changed")
        with self.assertRaisesRegex(m.SnapshotError, "Upstream source changed"):
            m.verify_snapshot(folder, self.root)

    def test_file_index_seal_is_checked(self):
        folder = self.sealed()
        (folder / "FILE_INDEX.json").write_text('{"files":[]}')
        with self.assertRaisesRegex(m.SnapshotError, "seal mismatch"):
            m.verify_snapshot(folder)

    @unittest.skipIf(os.name == "nt", "POSIX executable permissions")
    def test_script_copy_preserves_and_verifies_executable_permission(self):
        folder = self.sealed()
        script = self.root / "build.sh"
        script.write_text("#!/bin/sh\nexit 0\n")
        script.chmod(0o755)
        writer = m.Writer(self.root, folder)
        index = json.loads((folder / "FILE_INDEX.json").read_text())
        writer.rows = {row["path"]: row for row in index["files"]}
        writer.copy("build.sh", "tools/build.sh")
        copied = folder / "tools/build.sh"
        self.assertTrue(copied.stat().st_mode & 0o111)
        index_blob = m.json_bytes({"files": list(writer.rows.values())})
        (folder / "FILE_INDEX.json").write_bytes(index_blob)
        release = json.loads((folder / "release.json").read_text())
        release["file_index_sha256"] = m.digest(index_blob)
        (folder / "release.json").write_bytes(m.json_bytes(release))
        self.assertEqual(m.verify_snapshot(folder, self.root)["status"], "verified")
        copied.chmod(0o644)
        with self.assertRaisesRegex(m.SnapshotError, "executable permission missing"):
            m.verify_snapshot(folder, self.root)


if __name__ == "__main__":
    unittest.main()
