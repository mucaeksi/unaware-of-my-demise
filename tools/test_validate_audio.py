"""Audio cue rules of the content validator (docs/design/FIRST_LAUNCH_FLOW.md, owner decision D-08)."""

from __future__ import annotations

import unittest

import validate_part1_content as validator


def errors_of(check, *args) -> list[str]:
    validator.ERRORS.clear()
    check(*args)
    found = list(validator.ERRORS)
    validator.ERRORS.clear()
    return found


def slots(**values) -> dict:
    table = {slot: None for slot in validator.AUDIO_SLOTS}
    table.update({key.replace("__", "."): value for key, value in values.items()})
    return {"slots": table}


class StoryAudioTest(unittest.TestCase):
    def test_scene_and_line_cues_are_optional_and_well_formed(self) -> None:
        self.assertEqual(errors_of(validator.check_story_audio, {"scene_id": "s"}), [])
        self.assertEqual(errors_of(validator.check_story_audio, {"scene_id": "s", "music_cue_id": None, "ambience_cue_id": "amb_rain_shrine"}), [])
        self.assertEqual(errors_of(validator.check_story_audio, {"line_id": "l", "audio": {"sfx": "sfx_bell_distant", "music": "stop", "fade_seconds": 2}}), [])
        self.assertTrue(errors_of(validator.check_story_audio, {"scene_id": "s", "music_cue_id": "Felt piano"}))
        self.assertTrue(errors_of(validator.check_story_audio, {"line_id": "l", "audio": {"volume": 3}}))
        self.assertTrue(errors_of(validator.check_story_audio, {"line_id": "l", "audio": {}}))
        self.assertTrue(errors_of(validator.check_story_audio, {"line_id": "l", "audio": {"fade_seconds": 30}}))
        self.assertTrue(errors_of(validator.check_story_audio, {"line_id": "l", "audio": {"fade_seconds": True}}))


class FlowSlotsTest(unittest.TestCase):
    def test_the_pack_has_exactly_the_client_slots(self) -> None:
        self.assertEqual(errors_of(validator.check_audio_cues, slots()), [])
        self.assertEqual(errors_of(validator.check_audio_cues, slots(flow__title="bgm_title", voice__title_call="fadyme/title_call")), [])
        missing = slots()
        del missing["slots"]["flow.hub"]
        self.assertTrue(errors_of(validator.check_audio_cues, missing))
        extra = slots()
        extra["slots"]["flow.mystery"] = None
        self.assertTrue(errors_of(validator.check_audio_cues, extra))
        self.assertTrue(errors_of(validator.check_audio_cues, None))

    def test_values_are_ids_of_the_right_shape(self) -> None:
        self.assertTrue(errors_of(validator.check_audio_cues, slots(flow__title="Main Theme.ogg")))
        self.assertTrue(errors_of(validator.check_audio_cues, slots(voice__title_call="fadyme")))


if __name__ == "__main__":
    unittest.main()
