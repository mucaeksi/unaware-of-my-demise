"""Legacy kill history must survive retirement and the first economic-authority upgrade."""
import json
from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[2]


class ReleaseAuthorityMigrationTest(unittest.TestCase):
    def test_backfills_retired_kill_without_crossing_channels(self):
        with sqlite3.connect(':memory:') as db:
            for migration in sorted((ROOT / 'apps/api/migrations').glob('*.sql')):
                if migration.name >= '0023_release_economic_authority.sql':
                    break
                db.executescript(migration.read_text())
            for release_id, generation, channel, state, killed in [
                ('kill_dev', 2, 'dev', 'retired', True),
                ('current_dev', 4, 'dev', 'published', False),
                ('current_staging', 1, 'staging', 'published', False),
            ]:
                db.execute("INSERT INTO content_releases (id, generation, channel, state, manifest_json, created_by, published_at) VALUES (?, ?, ?, ?, ?, 'test', '2026-10-13T00:00:00.000Z')",
                           (release_id, generation, channel, state, json.dumps({'rollout': {'kill_switch': killed}})))
            for channel in ['dev', 'staging']:
                db.execute("INSERT INTO channel_pointers (channel, release_id, updated_by) VALUES (?, ?, 'test')", (channel, f'current_{channel}'))
            db.executescript((ROOT / 'apps/api/migrations/0023_release_economic_authority.sql').read_text())
            self.assertEqual(db.execute('SELECT channel, economic_floor FROM channel_pointers ORDER BY channel').fetchall(), [('dev', 2), ('staging', 0)])


if __name__ == '__main__':
    unittest.main()
