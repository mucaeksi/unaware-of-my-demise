"""Catalogue must stay stable when the owner disables Git ignore rules."""
import contextlib
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import project_catalog


class ProjectCatalogTests(unittest.TestCase):
    def test_build_and_check_exclude_their_output_and_generated_private_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            for name in ("game/source.gd", "admin/node_modules/a.js", "admin/.next/a.js",
                         "server/dist/a.js", "build/report.json", ".env.local"):
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("test fixture\n")
            index = root / ".local/project-index.json"
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(project_catalog.main(["build", "--root", str(root)]), 0)
                self.assertEqual(project_catalog.main(["check", "--root", str(root)]), 0)
            paths = {row["path"] for row in json.loads(index.read_text())["files"]}
            self.assertEqual(paths, {"game/source.gd"})
            (root / "game/source.gd").write_text("changed authored source\n")
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(project_catalog.main(["check", "--root", str(root)]), 1)


if __name__ == "__main__":
    unittest.main()
