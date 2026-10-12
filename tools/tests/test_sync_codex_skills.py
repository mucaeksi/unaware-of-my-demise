"""Adapter integrity and write-boundary regressions; stdlib only."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import sync_codex_skills as skills


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.source = self.root / ".claude/skills/sample"
        self.source.mkdir(parents=True)
        self.skill = self.source / "SKILL.md"
        self.skill.write_text("---\nname: sample\ndescription: >-\n  Read a topic:\n  preserve its resources.\n---\nCanonical body\n")
        (self.source / "data.txt").write_text("pinned resource")
        self.lock = self.root / ".claude/skills-lock.json"
        self.lock.write_text(json.dumps({"skill_file_sha256": {"sample": skills.digest(self.skill.read_bytes())}}))

    def test_generate_check_and_preserve_source_and_extra_skill(self):
        before = {p: p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        extra = self.root / ".agents/skills/uomd-custom/SKILL.md"
        extra.parent.mkdir(parents=True)
        extra.write_text("manual project skill")
        self.assertEqual(skills.sync(self.root, False), 1)
        self.assertEqual(skills.sync(self.root, True), 1)
        self.assertEqual(extra.read_text(), "manual project skill")
        for path, raw in before.items():
            self.assertEqual(path.read_bytes(), raw)
        manifest = json.loads((self.root / ".agents/skills-lock.json").read_text())
        self.assertIn(".claude/skills/sample/data.txt", manifest["adapters"]["sample"]["source_resources_sha256"])

    def test_check_detects_changed_adapter_without_writing(self):
        skills.sync(self.root, False)
        adapter = self.root / ".agents/skills/sample/SKILL.md"
        adapter.write_text("changed")
        with self.assertRaisesRegex(ValueError, "stale/missing"):
            skills.sync(self.root, True)
        self.assertEqual(adapter.read_text(), "changed")

    def test_resource_drift_invalidates_manifest(self):
        skills.sync(self.root, False)
        (self.source / "data.txt").write_text("changed resource")
        with self.assertRaisesRegex(ValueError, "stale/missing"):
            skills.sync(self.root, True)

    def test_lock_mismatch_writes_nothing(self):
        self.skill.write_text(self.skill.read_text() + "unexpected edit")
        with self.assertRaisesRegex(ValueError, "lock mismatch"):
            skills.sync(self.root, False)
        self.assertFalse((self.root / ".agents").exists())

    def test_destination_symlink_refused_before_any_writes(self):
        dest = self.root / ".agents/skills/sample/SKILL.md"
        dest.parent.mkdir(parents=True)
        dest.symlink_to(self.skill)
        before = self.skill.read_bytes()
        with self.assertRaisesRegex(ValueError, "symlink destination"):
            skills.sync(self.root, False)
        self.assertEqual(self.skill.read_bytes(), before)
        self.assertFalse((self.root / ".agents/skills-lock.json").exists())

    def test_directory_destination_refused_before_any_writes(self):
        (self.root / ".agents/skills-lock.json").mkdir(parents=True)
        with self.assertRaisesRegex(ValueError, "not a file"):
            skills.sync(self.root, False)
        self.assertFalse((self.root / ".agents/skills/sample").exists())

    def test_canonical_resource_symlink_refused(self):
        (self.source / "link.txt").symlink_to(self.source / "data.txt")
        with self.assertRaisesRegex(ValueError, "canonical symlink"):
            skills.sync(self.root, False)

    def test_canonical_directory_symlink_refused(self):
        self.source.rename(self.root / "elsewhere")
        self.source.symlink_to(self.root / "elsewhere", target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "Unsafe canonical"):
            skills.sync(self.root, False)

    def test_removed_canonical_skill_requires_explicit_review(self):
        skills.sync(self.root, False)
        manifest_path = self.root / ".agents/skills-lock.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["adapters"]["obsolete"] = {}
        manifest_path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, "removed"):
            skills.sync(self.root, False)

    def test_folded_and_quoted_metadata(self):
        parsed = skills.metadata(self.skill.read_text())
        self.assertEqual(parsed["description"], "Read a topic: preserve its resources.")
        self.assertEqual(skills.metadata('---\nname: sample\ndescription: "Safe: quoted"\n---\n')["description"], "Safe: quoted")
        with self.assertRaisesRegex(ValueError, "Invalid skill"):
            skills.metadata("---\nname: ../../unsafe\ndescription: nope\n---\n")


if __name__ == "__main__":
    unittest.main()
