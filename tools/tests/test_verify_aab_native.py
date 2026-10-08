import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify_aab_native import CLASSES, METADATA, verify

class NativePackagingTests(unittest.TestCase):
    def bundle(self, folder, classes, metadata, header=b'dex\n'):
        path = Path(folder) / 'review.aab'
        with zipfile.ZipFile(path, 'w') as archive:
            archive.writestr('base/dex/classes.dex', header + '\0'.join(classes).encode())
            archive.writestr('base/manifest/AndroidManifest.xml', '\0'.join(metadata).encode())
        return path

    def test_complete_packaging(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(verify(self.bundle(folder, CLASSES, METADATA))['status'], 'passed')

    def test_bridge_or_registration_missing_is_rejected(self):
        for classes, metadata in ((CLASSES[1:], METADATA), (CLASSES, METADATA[1:])):
            with self.subTest(classes=classes), tempfile.TemporaryDirectory() as folder:
                with self.assertRaisesRegex(ValueError, 'missing'):
                    verify(self.bundle(folder, classes, metadata))

    def test_invalid_dex_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, 'invalid'):
                verify(self.bundle(folder, CLASSES, METADATA, b'invalid'))

if __name__ == '__main__':
    unittest.main()
