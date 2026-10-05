# Spoiler and Unlock Policy — Part I

Approved 2026-09-30 (Part I story pass, step 3, decision C37). Narrative requirement for the technical team; the implementation is theirs. Rule: **no text may show the player something the main story has not yet shown.** Unlocks use the same shape as companion stories: `{"after_stage": "X-Y"}` = the stage is in `completed_stage_ids`.

## 1. Voice relationship lines (`content/character_voice_lines_part1.json`)

Each `relationship_1` / `relationship_2` line now carries `"unlock": {"after_stage": ...}`. Before it unlocks, the profile shows nothing (or a locked placeholder), and the line is never played. Other triggers (first meeting, team join, idle, attacks, victory, defeat, low HP) have no unlock: they reveal nothing.

| Character | relationship_1 | relationship_2 |
|---|---|---|
| Mahmut | 1-5 | 5-5 |
| Fadyme | 6-5 | 7-5 |
| Kera | 4-4 | 4-2 |
| Brin | 1-2 | 3-4 |
| Nixie | 3-4 | 4-1 |
| Aveline | 7-5 | 7-3 |
| Sable | 7-4 | 5-3 |
| Tilda | 4-2 | 4-2 |
| Rikka | 7-2 | 5-3 |
| Mirel | 7-3 | 7-3 |
| Odelia | 7-5 | 4-1 |
| Pippa | 3-4 | 7-3 (says "Veyr") |
| Nara | 7-5 | 5-2 |
| Clem | 7-5 | 6-1 |
| Vespera | 6-3 | 7-5 |
| Hana | 7-4 | 6-1 |
| Thistle | 7-5 | 7-4 |
| Iona | 7-5 | 4-2 |
| Jori | 3-4 | 7-5 |
| Marek | 6-5 | 5-2 |

## 2. Codex (`content/lore_text_part1.json` → `codex[].unlock`)

`"always"` stays for premise entries; the others now use `{"after_stage": ...}`.

| Codex | Unlock | Why |
|---|---|---|
| Law of Hours, Names as Witnesses, Crownfall | always | Premise |
| Hollows | 1-1 | First Hollow |
| Vale Children | 1-4 | Nixie |
| Seven Bells, Saint Luthos | 2-1 | First ropeless bell |
| Seven-Notched Seal | 2-5 | Yseldra revealed as Inquisitor |
| Red Vial Guild | 4-5 | "A ledger of people" is the Matron reveal |
| Council of Dukes | 6-5 | "The throne empty" matches the Council Herald event |
| First Eclipse | 7-1 | "Fixed with an heir's hours" |
| Clockless Court | 7-5 | Named only in Cael's offer |

## 3. Enemy lore (`content/lore_text_part1.json` → `enemies`)

- The **intent panel** before and during a fight shows mechanics only, never the lore line.
- The lore line appears in the bestiary **after the first defeat** of that enemy.
- Boss lore lines (Rusk, Matron, Oren, the Ashen Lord's Wraith, the Construct, the Bell-Widow) state their stage's reveal; they must never show before that stage is cleared.

## 4. Companion stories and events

Already gated by `unlock.after_stage` (and ownership). Order was re-checked on 2026-09-30: no part shows a character before their first main-story scene.
