# 03 — Complete Opening Prologue (9 Scenes) & 3-Part Tutorial Scripts (T-1 .. T-3)

## 1. Opening 120-Second Prologue (`content/base/entry/prologue.json`)
```json
{
  "schema": 1,
  "story_id": "entry_before_the_road_v001",
  "title_en": "Before the Road",
  "locale": "en",
  "duration_seconds": 120,
  "voice_status": "unrecorded",
  "visual_presentation": "layered_motion_comic_v002",
  "sources": [
    "narrative/13_Timeline_Factions_Glossary/timeline.md",
    "narrative/13_Timeline_Factions_Glossary/History/crownfall.md",
    "narrative/05_Codex_Lore/world.md",
    "narrative/06_Characters/Playable/mahmut.md",
    "narrative/06_Characters/Playable/fadyme.md"
  ],
  "scenes": [
    {
      "id": "hours",
      "duration_seconds": 12,
      "visual": "village",
      "caption_en": "Before the Road",
      "line_id": "entry_past_001",
      "text_en": "Before the roads filled with ash, Veyrhold measured its days in bells. A sound from the tower meant another hour had passed.",
      "direction": "Fixed bell-tower plate; bronze bell pivots from its axle, rope follows, dust crosses the warm window. Swing settles into a hold.",
      "audio_cue": "prologue_hours"
    },
    {
      "id": "names",
      "duration_seconds": 14,
      "visual": "village",
      "caption_en": "Names to Remember",
      "line_id": "entry_past_002",
      "text_en": "People carved their names on doors and trees, and wrote them in roadside registers. Not for fame. So someone would remember that they had been here.",
      "direction": "Close-up ledger; a separate quill hand traces an indistinct ink stroke, then lifts away. No legible invented name.",
      "audio_cue": "prologue_names"
    },
    {
      "id": "ordinary_days",
      "duration_seconds": 12,
      "visual": "village",
      "caption_en": "Ordinary Days",
      "line_id": "entry_past_003",
      "text_en": "There were markets, journeys, and doors that opened to strangers. Small things, easily forgotten. Until the day people began to lose them.",
      "direction": "Two unnamed market adults approach for a bread offering against the living street; settle into an intimate hold.",
      "audio_cue": "prologue_days"
    },
    {
      "id": "throne_wars",
      "duration_seconds": 12,
      "visual": "crownfall",
      "caption_en": "The Throne Wars",
      "line_id": "entry_past_004",
      "text_en": "The great houses fought over a throne. Fields emptied. Families took to the roads, carrying what they could. The war drew closer to the capital.",
      "direction": "Refugee walk atlas departs across abandoned fields towards the still-standing distant capital. Registered frames; no faction emblems.",
      "audio_cue": "prologue_wars"
    },
    {
      "id": "crownfall",
      "duration_seconds": 16,
      "visual": "crownfall",
      "caption_en": "Six Years Ago",
      "line_id": "entry_past_005",
      "text_en": "Then came Crownfall. The capital fell. The king died. By dawn, survivors were leaving behind streets they had once known by heart.",
      "direction": "A tighter fixed view of the ruined gates, independent smoke and ash layers. Never depict the king's death or its cause.",
      "audio_cue": "prologue_crownfall"
    },
    {
      "id": "roads",
      "duration_seconds": 16,
      "visual": "crownfall",
      "caption_en": "What Remained",
      "line_id": "entry_past_006",
      "text_en": "They carried blankets, tools, and the names of those who had not come with them. Beyond the walls, the roads were still there. Home was not.",
      "direction": "Closer composition on anonymous travelers carrying blankets and tools; slow departure beneath drifting mist. No ritual, seal or villain.",
      "audio_cue": "prologue_aftermath"
    },
    {
      "id": "search",
      "duration_seconds": 14,
      "visual": "village",
      "caption_en": "A Name on the Road",
      "line_id": "entry_past_007",
      "text_en": "Among the travelers was a knight who searched the village registers for one name. Village after village, winter after winter, he kept looking.",
      "direction": "Younger Mahmut arrives at an unnamed winter inn counter and studies its register. No other named character or invented encounter.",
      "audio_cue": "prologue_search"
    },
    {
      "id": "reunion",
      "duration_seconds": 12,
      "visual": "road",
      "caption_en": "Found Again",
      "line_id": "entry_past_008",
      "text_en": "In a hill village, he found her. She asked him to stay. He did. The road ahead would no longer be hers alone.",
      "direction": "Fadyme aged 20 and Mahmut aged 26 face one another in an unnamed hill village. Her inviting hand and his raised gaze stage the documented reunion.",
      "audio_cue": "prologue_reunion"
    },
    {
      "id": "beginning",
      "duration_seconds": 12,
      "visual": "road",
      "caption_en": "The Journey Begins",
      "line_id": "entry_past_009",
      "text_en": "Now Fadyme and Mahmut walk together. The bells still ring. Neither has told the other everything. This is where their story begins.",
      "direction": "Present-day duo walk atlas recedes along the approved forest road, cloth changing with the steps and mist drifting independently. No later revelation.",
      "audio_cue": "prologue_beginning"
    }
  ]
}

```

---

## 2. Tutorial Part 1 (`T-1: The First Step`)
### 2.1 Pre-Battle Cutscene (`tutorial_t1_before.json`)
```json
{
  "schema_version": 1,
  "scene_id": "tutorial_t1_before",
  "title_en": "The First Step",
  "location_id": "forest_whispering_ash",
  "presentation": {
    "auto": true,
    "speaker_pause_seconds": 1
  },
  "closing_hold_seconds": 3.5,
  "commands": [
    {
      "op": "background",
      "location_id": "forest_whispering_ash"
    },
    {
      "op": "music",
      "cue_id": "bgm_ch1_ash_forest_calm"
    },
    {
      "op": "fade",
      "direction": "in",
      "seconds": 0.8
    },
    {
      "op": "show",
      "character": "mahmut",
      "side": "left"
    },
    {
      "op": "show",
      "character": "fadyme",
      "side": "right"
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t1_before_001",
      "text": "The last light lay between the trees. Their footsteps had almost found the same rhythm.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_before_002",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Keep to the stones. The mud gets deeper ahead.",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_before_003",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "The stones have already claimed one boot.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_before_004",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Both boots are still with us.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_before_005",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "You have a comforting way of counting disasters.",
      "emotion": "soft_smile",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_before_006",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "That one is loose. Give me your hand.",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_before_007",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "For the stone, or for the whole road?",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_before_008",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "The stone first.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t1_before_009",
      "text": "She took his hand. On the other side, neither let go quite as promptly as the crossing required.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_before_010",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "There. An excellent rescue. Very little applause, unfortunately.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_before_011",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "We can live with that.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t1_before_012",
      "text": "Something scraped across the stones ahead. Mahmut turned before she could make another remark.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_before_013",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Two of them. Stay beside the wall.",
      "emotion": "protective",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_before_014",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Beside it. Not behind you. I know the difference.",
      "emotion": "determined",
      "hold_seconds": 3
    },
    {
      "op": "checkpoint",
      "checkpoint_id": "tutorial_t1_before_done"
    },
    {
      "op": "fade",
      "direction": "out",
      "seconds": 0.6
    },
    {
      "op": "end"
    }
  ],
  "provenance": {
    "source": "narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/tutorial_v001.json#T-1.before",
    "source_sha256": "d5419c8bd76f5c75e4c70e116fa97cdd97dfa8e158c852c7c96a988980bbce81"
  }
}

```

### 2.2 Post-Battle Cutscene (`tutorial_t1_after.json`)
```json
{
  "schema_version": 1,
  "scene_id": "tutorial_t1_after",
  "title_en": "The First Step",
  "location_id": "forest_whispering_ash",
  "presentation": {
    "auto": true,
    "speaker_pause_seconds": 1
  },
  "closing_hold_seconds": 3.5,
  "commands": [
    {
      "op": "background",
      "location_id": "forest_whispering_ash"
    },
    {
      "op": "music",
      "cue_id": "bgm_ch1_ash_forest_calm"
    },
    {
      "op": "fade",
      "direction": "in",
      "seconds": 0.8
    },
    {
      "op": "show",
      "character": "mahmut",
      "side": "left"
    },
    {
      "op": "show",
      "character": "fadyme",
      "side": "right"
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t1_after_001",
      "text": "The road grew quiet again. This time they listened to the silence before moving.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_after_002",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Are you hurt?",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_after_003",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Only my opinion of this road.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_after_004",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Your sleeve.",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_after_005",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "A branch. It has dreadful manners.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t1_after_006",
      "text": "He brushed a torn leaf from her shoulder, then found a reason to check his shield.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_after_007",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "We can rest here.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_after_008",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "In the mud? I was hoping your invitation would improve.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_after_009",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "A dry stone, then.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_after_010",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Tempting. A roof would make it irresistible.",
      "emotion": "soft_smile",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_after_011",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "There should be shelter farther along. We stop if you need to.",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_after_012",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "If either of us needs to. That is the arrangement.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t1_after_013",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Agreed.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t1_after_014",
      "text": "He shortened his stride. She noticed, and chose not to thank him for it aloud.",
      "hold_seconds": 4
    },
    {
      "op": "checkpoint",
      "checkpoint_id": "tutorial_t1_after_done"
    },
    {
      "op": "fade",
      "direction": "out",
      "seconds": 0.6
    },
    {
      "op": "end"
    }
  ],
  "provenance": {
    "source": "narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/tutorial_v001.json#T-1.after",
    "source_sha256": "d5419c8bd76f5c75e4c70e116fa97cdd97dfa8e158c852c7c96a988980bbce81"
  }
}

```

---

## 3. Tutorial Part 2 (`T-2: A Road Forgotten`)
### 3.1 Pre-Battle Cutscene (`tutorial_t2_before.json`)
```json
{
  "schema_version": 1,
  "scene_id": "tutorial_t2_before",
  "title_en": "A Road Forgotten",
  "location_id": "forest_whispering_ash",
  "presentation": {
    "auto": true,
    "speaker_pause_seconds": 1
  },
  "closing_hold_seconds": 3.5,
  "commands": [
    {
      "op": "background",
      "location_id": "forest_whispering_ash"
    },
    {
      "op": "music",
      "cue_id": "bgm_ch1_ash_forest_calm"
    },
    {
      "op": "fade",
      "direction": "in",
      "seconds": 0.8
    },
    {
      "op": "show",
      "character": "mahmut",
      "side": "left"
    },
    {
      "op": "show",
      "character": "fadyme",
      "side": "right"
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t2_before_001",
      "text": "Where the path narrowed, a lone pilgrim dragged one foot around the same worn stones.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_before_002",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "It has crossed this patch three times.",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_before_003",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Perhaps the road used to end here.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_before_004",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "It does not end here now.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_before_005",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "No. Someone ought to tell it.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t2_before_006",
      "text": "For a moment she watched the empty movement without speaking. Mahmut did not hurry her.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_before_007",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Do you ever wonder where they meant to go?",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_before_008",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Sometimes.",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_before_009",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "I would rather we reached somewhere ordinary. With an especially ordinary supper.",
      "emotion": "soft_smile",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_before_010",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "That can be arranged.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t2_before_011",
      "text": "The pilgrim stopped. Its head turned toward them.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_before_012",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "It has seen us. Keep room to move.",
      "emotion": "protective",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_before_013",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "And you keep room for me.",
      "emotion": "determined",
      "hold_seconds": 3
    },
    {
      "op": "checkpoint",
      "checkpoint_id": "tutorial_t2_before_done"
    },
    {
      "op": "fade",
      "direction": "out",
      "seconds": 0.6
    },
    {
      "op": "end"
    }
  ],
  "provenance": {
    "source": "narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/tutorial_v001.json#T-2.before",
    "source_sha256": "d5419c8bd76f5c75e4c70e116fa97cdd97dfa8e158c852c7c96a988980bbce81"
  }
}

```

### 3.2 Post-Battle Cutscene (`tutorial_t2_after.json` — Shared CG Still: `roadside_rest`)
```json
{
  "schema_version": 1,
  "scene_id": "tutorial_t2_after",
  "title_en": "A Road Forgotten",
  "location_id": "forest_whispering_ash",
  "presentation": {
    "auto": true,
    "speaker_pause_seconds": 1
  },
  "illustration_id": "roadside_rest",
  "closing_hold_seconds": 3.5,
  "commands": [
    {
      "op": "background",
      "location_id": "forest_whispering_ash"
    },
    {
      "op": "music",
      "cue_id": "bgm_ch1_ash_forest_calm"
    },
    {
      "op": "fade",
      "direction": "in",
      "seconds": 0.8
    },
    {
      "op": "show",
      "character": "mahmut",
      "side": "left"
    },
    {
      "op": "show",
      "character": "fadyme",
      "side": "right"
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t2_after_001",
      "text": "Beyond the narrow path, a fallen stone offered a seat. Mahmut checked the trees before he sat.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_002",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Sit. The trees have survived your inspection.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_003",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "This strap needs tightening.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_004",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Then hold still. Even your armour is asking for a rest.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t2_after_005",
      "text": "She drew his wrist toward her and threaded the loose leather through its buckle.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_006",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "I can do that.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_007",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "I know. You can also let me.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t2_after_008",
      "text": "He watched her fingers instead of the trees. She kept her eyes on the strap a little longer than necessary.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_009",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Too tight?",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_010",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "You are supposed to answer that.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_011",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "No.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_012",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "A wonderfully detailed report.",
      "emotion": "soft_smile",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_013",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "The buckle is sound. The work is good.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_014",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Careful. Another sentence and I might mistake that for a compliment.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_015",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "It was one.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t2_after_016",
      "text": "She smiled down at the finished knot. He looked away first, but not quickly.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_017",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "There. Your turn to be looked after.",
      "emotion": "soft_smile",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t2_after_018",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "We should do that more evenly.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "checkpoint",
      "checkpoint_id": "tutorial_t2_after_done"
    },
    {
      "op": "fade",
      "direction": "out",
      "seconds": 0.6
    },
    {
      "op": "end"
    }
  ],
  "provenance": {
    "source": "narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/tutorial_v001.json#T-2.after",
    "source_sha256": "d5419c8bd76f5c75e4c70e116fa97cdd97dfa8e158c852c7c96a988980bbce81"
  }
}

```

---

## 4. Tutorial Part 3 (`T-3: A Roof Before Dawn`)
### 4.1 Pre-Battle Cutscene (`tutorial_t3_before.json`)
```json
{
  "schema_version": 1,
  "scene_id": "tutorial_t3_before",
  "title_en": "A Roof Before Dawn",
  "location_id": "forest_whispering_ash",
  "presentation": {
    "auto": true,
    "speaker_pause_seconds": 1
  },
  "closing_hold_seconds": 3.5,
  "commands": [
    {
      "op": "background",
      "location_id": "forest_whispering_ash"
    },
    {
      "op": "music",
      "cue_id": "bgm_ch1_ash_forest_calm"
    },
    {
      "op": "fade",
      "direction": "in",
      "seconds": 0.8
    },
    {
      "op": "show",
      "character": "mahmut",
      "side": "left"
    },
    {
      "op": "show",
      "character": "fadyme",
      "side": "right"
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t3_before_001",
      "text": "A broken roof appeared through the branches. There was still enough of it to promise a dry corner.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_before_002",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "A roof. We stop there.",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_before_003",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "You make it sound as though you ordered it specially.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_before_004",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "I would have asked for fewer holes.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_before_005",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "No view of the stars? A severe oversight.",
      "emotion": "soft_smile",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_before_006",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "I can see the stars outside. I would rather keep the rain there too.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t3_before_007",
      "text": "She laughed softly. He was still listening when a shape moved beneath the eaves.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_before_008",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "The doorway. Two more by the steps.",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_before_009",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "The previous tenants seem reluctant to leave.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_before_010",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Wait for my shield. Do not let them separate us.",
      "emotion": "protective",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_before_011",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "You were very quick to decide we are a pair.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_before_012",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "We have been walking the same road.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_before_013",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Then keep your place. I intend to keep mine.",
      "emotion": "determined",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t3_before_014",
      "text": "This time they stepped forward together.",
      "hold_seconds": 4
    },
    {
      "op": "checkpoint",
      "checkpoint_id": "tutorial_t3_before_done"
    },
    {
      "op": "fade",
      "direction": "out",
      "seconds": 0.6
    },
    {
      "op": "end"
    }
  ],
  "provenance": {
    "source": "narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/tutorial_v001.json#T-3.before",
    "source_sha256": "d5419c8bd76f5c75e4c70e116fa97cdd97dfa8e158c852c7c96a988980bbce81"
  }
}

```

### 4.2 Post-Battle Cutscene (`tutorial_t3_after.json` — Shared CG Still: `shelter_evening`)
```json
{
  "schema_version": 1,
  "scene_id": "tutorial_t3_after",
  "title_en": "A Roof Before Dawn",
  "location_id": "forest_whispering_ash",
  "presentation": {
    "auto": true,
    "speaker_pause_seconds": 1
  },
  "illustration_id": "shelter_evening",
  "closing_hold_seconds": 5,
  "commands": [
    {
      "op": "background",
      "location_id": "forest_whispering_ash"
    },
    {
      "op": "music",
      "cue_id": "bgm_ch1_ash_forest_calm"
    },
    {
      "op": "fade",
      "direction": "in",
      "seconds": 0.8
    },
    {
      "op": "show",
      "character": "mahmut",
      "side": "left"
    },
    {
      "op": "show",
      "character": "fadyme",
      "side": "right"
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t3_after_001",
      "text": "Inside, the wind softened to a sound in the rafters. For the first time that evening, neither of them had to walk.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_002",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Dry enough here. The far corner is better.",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_003",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "You have inspected the entire house in one breath.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_004",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "It is not a large house.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t3_after_005",
      "text": "He laid his cloak over the cold stone. She sat on one edge and left the other unmistakably free.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_006",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "This seat appears to be available.",
      "emotion": "soft_smile",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_007",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "I will check the doorway.",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_008",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "You checked it on the way in.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_009",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "From the other side.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_010",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "An important distinction. Sit before you discover a third side.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t3_after_011",
      "text": "He sat. His shield rested within reach; her shoulder rested almost within reach of his.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_012",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "We have enough bread for tonight.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_013",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Actual bread, or another of your possibilities?",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_014",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Actual bread.",
      "emotion": "dry_humor",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_015",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "A roof and a supper. You should announce your successes more often.",
      "emotion": "soft_smile",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t3_after_016",
      "text": "She broke the loaf in two, considered the pieces, and put the larger one in his hand.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_017",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "You gave me more.",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_018",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "A flaw in the architecture of the loaf. Quite beyond my control.",
      "emotion": "dry_amusement",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_019",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Tomorrow we find a better one.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t3_after_020",
      "text": "She looked toward the doorway. For a moment her answer did not come.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_021",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Tomorrow. Yes.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_022",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "What is it?",
      "emotion": "watchful",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_023",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Nothing that needs solving tonight.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_024",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "It does not have to need solving.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t3_after_025",
      "text": "That made her turn back to him. The small joke she had prepared went unused.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_026",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Stay a little while. Before you stand watch.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_027",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "I am here.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_028",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "I know. That was why I asked.",
      "emotion": "soft_smile",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t3_after_029",
      "text": "He stayed. Outside, the last light left the road; inside, the silence no longer felt empty.",
      "hold_seconds": 4
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_030",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "We leave when there is light. No hurry.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_031",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "And no walking two steps ahead.",
      "emotion": "soft_smile",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_032",
      "speaker": "mahmut",
      "speaker_display": "Mahmut",
      "text": "Beside you, then.",
      "emotion": "composed",
      "hold_seconds": 3
    },
    {
      "op": "say",
      "line_id": "tutorial_t3_after_033",
      "speaker": "fadyme",
      "speaker_display": "Fadyme",
      "text": "Then.",
      "emotion": "soft_smile",
      "hold_seconds": 3
    },
    {
      "op": "narrate",
      "line_id": "tutorial_t3_after_034",
      "text": "For tonight, a dry corner, half a loaf, and a place beside each other were enough.",
      "hold_seconds": 4
    },
    {
      "op": "checkpoint",
      "checkpoint_id": "tutorial_t3_after_done"
    },
    {
      "op": "fade",
      "direction": "out",
      "seconds": 0.6
    },
    {
      "op": "end"
    }
  ],
  "provenance": {
    "source": "narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/tutorial_v001.json#T-3.after",
    "source_sha256": "d5419c8bd76f5c75e4c70e116fa97cdd97dfa8e158c852c7c96a988980bbce81"
  }
}

```
