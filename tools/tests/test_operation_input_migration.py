"""Existing accepted inputs remain unknown; new journal proofs cannot be rewritten."""
from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[2]


class OperationInputMigrationTest(unittest.TestCase):
    def test_preserves_legacy_results_without_inventing_inputs(self):
        with sqlite3.connect(':memory:') as db:
            for migration in sorted((ROOT / 'apps/api/migrations').glob('*.sql')):
                if migration.name >= '0025_operation_input_binding.sql':
                    break
                db.executescript(migration.read_text())
            db.execute("INSERT INTO players (id) VALUES ('legacy_player')")
            db.execute("INSERT INTO gacha_requests (player_id, request_id, banner_id, pull_count, result_json) VALUES ('legacy_player', 'legacy_gacha', 'old_banner', 1, '{\"old\":1}')")
            db.execute("INSERT INTO progression_requests (player_id, request_id, kind, result_json) VALUES ('legacy_player', 'legacy_upgrade', 'level_up:mahmut', '{\"old\":2}')")
            db.execute("INSERT INTO battle_claims (player_id, request_id, release_id, node_id, result_json) VALUES ('legacy_player', 'legacy_battle', 'old_release', 'old_node', '{\"old\":3}')")
            db.executescript((ROOT / 'apps/api/migrations/0025_operation_input_binding.sql').read_text())
            for index, table in enumerate(['gacha_requests', 'progression_requests', 'battle_claims'], 1):
                self.assertEqual(db.execute(f'SELECT result_json, input_json FROM {table}').fetchone(), (f'{{"old":{index}}}', None))
                with self.assertRaisesRegex(sqlite3.IntegrityError, 'immutable'):
                    db.execute(f"UPDATE {table} SET input_json = '{{}}'")
                with self.assertRaisesRegex(sqlite3.IntegrityError, 'immutable'):
                    db.execute(f"UPDATE {table} SET result_json = '{{}}'")
                db.execute(f'DELETE FROM {table}')
                self.assertEqual(db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0], 0)


if __name__ == '__main__':
    unittest.main()
