"""Protect user data during discovery bootstrap and verify relocatable links."""
from pathlib import Path
import tempfile
import unittest
from bootstrap_skills import bootstrap


class BootstrapTests(unittest.TestCase):
    def fixture(self, root):
        for name in ['uomd-one', 'uomd-two']:
            path = root / '.codex/skills' / name
            path.mkdir(parents=True)
            (path / 'SKILL.md').write_text(name)

    def test_idempotent_and_relocatable(self):
        with tempfile.TemporaryDirectory() as directory:
            original = Path(directory) / 'original'
            self.fixture(original)
            self.assertEqual(bootstrap(original)['created_links'], 3)
            self.assertEqual(bootstrap(original)['created_links'], 0)
            moved = Path(directory) / 'moved'
            original.rename(moved)
            self.assertEqual(bootstrap(moved)['created_links'], 0)
            for prefix in ['.agents/skills', '.claude/skills']:
                self.assertEqual((moved / prefix / 'uomd-one/SKILL.md').read_text(), 'uomd-one')

    def test_user_folder_collision_preflight_preserves_all(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            user = root / '.claude/skills/uomd-two'
            user.mkdir(parents=True)
            (user / 'private.md').write_text('retain')
            with self.assertRaisesRegex(RuntimeError, 'Existing user'):
                bootstrap(root)
            self.assertFalse((root / '.agents/skills').exists())
            self.assertFalse((root / '.claude/skills/uomd-one').exists())
            self.assertEqual((user / 'private.md').read_text(), 'retain')

    def test_wrong_and_broken_links_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            (root / '.agents').mkdir()
            link = root / '.agents/skills'
            link.symlink_to('../missing', target_is_directory=True)
            with self.assertRaisesRegex(RuntimeError, 'Conflicting'):
                bootstrap(root)
            self.assertEqual(str(link.readlink()), '../missing')

    def test_external_parent_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'project'
            self.fixture(root)
            outside = Path(directory) / 'outside'
            outside.mkdir()
            (root / '.claude').symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(RuntimeError, 'escapes'):
                bootstrap(root)
            self.assertEqual(list(outside.iterdir()), [])
            self.assertFalse((root / '.agents/skills').exists())

    def test_user_file_parent_prevents_partial_install(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            (root / '.claude').write_text('retain parent file')
            with self.assertRaisesRegex(RuntimeError, 'user file'):
                bootstrap(root)
            self.assertFalse((root / '.agents/skills').exists())
            self.assertEqual((root / '.claude').read_text(), 'retain parent file')


if __name__ == '__main__':
    unittest.main()
