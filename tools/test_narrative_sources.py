"""Protect canon-to-runtime promotion without depending on archived snapshots."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "game/data/content"
SCRIPTS = ROOT / "narrative/09_VN_Scripts"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def records(value, key):
    if isinstance(value, dict):
        if key in value:
            yield value
        for child in value.values():
            yield from records(child, key)
    elif isinstance(value, list):
        for child in value:
            yield from records(child, key)


class NarrativeSourceTests(unittest.TestCase):
    def test_main_story_line_order_and_scene_direction_match_canon(self):
        for source in sorted((SCRIPTS / "Main_Story").glob("story_script_ch*.json")):
            canon = load(source)
            runtime = load(RUNTIME / source.name)
            self.assertEqual([x["scene_id"] for x in runtime["scenes"]],
                             [x["scene_id"] for x in canon["scenes"]], source.name)
            for expected, actual in zip(canon["scenes"], runtime["scenes"]):
                with self.subTest(file=source.name, scene=expected["scene_id"]):
                    for key in ("direction_en", "story_guests", "music_cue"):
                        if key in expected:
                            self.assertEqual(actual.get(key), expected[key], key)
                    for key, lines in expected.items():
                        if isinstance(lines, list) and lines and all(isinstance(x, dict) and "line_id" in x for x in lines):
                            self.assertEqual([x["line_id"] for x in actual.get(key, [])],
                                             [x["line_id"] for x in lines], key)

    def test_promoted_dialogue_keeps_canonical_words_and_speakers(self):
        for folder in ("Main_Story", "Companion_Stories", "Events", "Voice_Lines"):
            for source in sorted((SCRIPTS / folder).glob("*.json")):
                expected = {x["line_id"]: x for x in records(load(source), "line_id")}
                actual = {x["line_id"]: x for x in records(load(RUNTIME / source.name), "line_id")}
                self.assertEqual(set(actual), set(expected), source.name)
                for line_id, line in expected.items():
                    with self.subTest(file=source.name, line=line_id):
                        for key in ("text_en", "speaker_id", "voice_track"):
                            if key in line:
                                self.assertEqual(actual[line_id].get(key), line[key], key)

    def test_codex_spoilers_retain_canonical_stage_gates(self):
        source = load(ROOT / "narrative/05_Codex_Lore/lore_text_part1.json")
        runtime = {x["codex_id"]: x for x in records(load(RUNTIME / "lore_text_part1.json"), "codex_id")}
        for row in records(source, "codex_id"):
            self.assertEqual(runtime[row["codex_id"]].get("unlock"), row.get("unlock"), row["codex_id"])

    def test_relationship_voice_retain_canonical_unlock_conditions(self):
        source = load(SCRIPTS / "Voice_Lines/character_voice_lines_part1.json")
        runtime = {x["line_id"]: x for x in records(load(RUNTIME / "character_voice_lines_part1.json"), "line_id")}
        for row in records(source, "line_id"):
            if "unlock" in row:
                self.assertEqual(runtime[row["line_id"]].get("unlock"), row["unlock"], row["line_id"])


if __name__ == "__main__":
    unittest.main()
