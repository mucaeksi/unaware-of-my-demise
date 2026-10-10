# Bestiary — Kinds of Enemy

Approved 2026-09-29 (world foundation W4, C32). Classification by world rule, not by data faction. Enemy lore lines: `content/lore_text_part1.json`; data: root `content/enemies_part1.json` (technical team).

## Kinds

| Kind | What it is (rule) | Behavior | Who controls it |
|---|---|---|---|
| **Hollow** | Dead whose hours could not be closed because no name witnessed them (world rule 6). | Repeats its last task: pilgrims walk, clerics copy, guards stand at post. Drawn to bells. | No one; bells draw them. |
| **Bellbound** | A Hollow wired to a bell by its own chains. | Never sent alone; acts when the bell acts. | Whoever controls the bell. |
| **Inkbound** | A Hollow wrapped in erased records. | Its ink marks the living for the dead. | Whoever holds the ledger or records. |
| **Wraith** | Dead of a great house held by a portrait or mirror instead of a name. | Borrows the strongest protection it sees; copies faces. | The house itself ("the house still gives orders"). |
| **Ashbound beast** | An animal that ate bell-ash. | Hunts whoever walks apart. A shard inside it keeps its bell's count (rule 7). | No one. |
| **Construct** | A mechanism, not a dead thing. The Eclipse Construct is the Hinge (C20). | Follows the Schedule. | Cael, by design. |
| **Living** | People: cult, Crown Guard remnant, Red Vial ledger wing, mercenaries, Yseldra. | Human motives. | Their faction. |

## Part I enemies

| enemy_id | Name | Kind | Data faction | Element | Chapter |
|---|---|---|---|---|---|
| `ash_wolf` | Ash Wolf | Ashbound beast | `ashbound_beasts` | Ember | ch01 |
| `bellbound_dead` | Bellbound Dead | Bellbound | `hollow_host` | Veil | ch01 |
| `bridge_revenant` | Bridge Revenant | Hollow | `hollow_host` | Veil | ch05 |
| `chain_cultist` | Chain Cultist | Living (First Eclipse Cult) | `first_eclipse_cult` | Veil | ch04 |
| `choir_knight` | Choir Knight | Hollow (oath-armor) | `hollow_host` | Dawn | ch02 |
| `corrupted_crown_guard` | Corrupted Crown Guard | Living (Crown Guard remnant) | `crown_remnant` | Stone | ch05 |
| `corrupted_mercenary` | Corrupted Mercenary | Living (hired by the ledger wing) | `red_vial_guild` | Ember | ch03 |
| `crownless_knight` | Crownless Knight | Living (Crown Guard remnant) | `crown_remnant` | Stone | ch07 |
| `eclipse_sentinel` | Eclipse Sentinel | Living (First Eclipse Cult) | `first_eclipse_cult` | Veil | ch07 |
| `estate_wraith` | Estate Wraith | Wraith | `ashen_estate_dead` | Veil | ch06 |
| `glass_viper` | Glass Viper | Bred creature (Red Vial cisterns) | `red_vial_guild` | Tide | ch04 |
| `hollow_cleric` | Hollow Cleric | Hollow | `hollow_host` | Veil | ch02 |
| `hollow_pilgrim` | Hollow Pilgrim | Hollow | `hollow_host` | Veil | ch01 |
| `inkbound_dead` | Inkbound Dead | Inkbound | `ashen_estate_dead` | Veil | ch02, ch06 |
| `lost_vow_knight` | Lost-Vow Knight | Hollow | `hollow_host` | Stone | ch05 |
| `noble_retainer` | Noble Retainer | Wraith (household) | `crown_remnant` | Dawn | ch06 |
| `orchard_ghoul` | Orchard Ghoul | Hollow | `hollow_host` | Veil | ch03 |
| `red_vial_alchemist` | Red Vial Alchemist | Living (Red Vial ledger wing) | `red_vial_guild` | Ember | ch04 |
| `red_vial_scout` | Red Vial Scout | Living (Red Vial ledger wing) | `red_vial_guild` | Gale | ch03 |
| `royal_hollow` | Royal Hollow | Hollow | `crown_remnant` | Stone | ch07 |
| `boss_ash_maw` | The Ash-Maw | Ashbound beast (carries a Whispering Bell shard) | `ashbound_beasts` | Ember | boss |
| `boss_bell_widow` | The Bell-Widow | Living (former Inquisition) | `villain_boss` | Veil | boss |
| `boss_captain_rusk` | Captain Rusk | Living (mercenary) | `red_vial_guild` | Gale | boss |
| `boss_red_vial_matron` | The Red Vial Matron | Living (Red Vial ledger wing) | `red_vial_guild` | Ember | boss |
| `boss_marshal_oren` | Marshal Oren | Living (Crown Guard remnant) | `crown_remnant` | Stone | boss |
| `boss_ashen_lord_wraith` | The Ashen Lord's Wraith | Wraith | `ashen_estate_dead` | Veil | boss |
| `boss_eclipse_construct` | Eclipse Construct | Construct (the Hinge) | `first_eclipse_cult` | Veil | boss |

Notes: `royal_hollow` is a Hollow of dead guardsmen, so the data faction `crown_remnant` is acceptable. The Ashen Lord's Wraith is Lord Edric Aske (`characters/ashen_lord.md`): a Wraith repeating his last order, "hide them from the Crown"; the estate wraiths and retainers are his household, obeying the same order. `noble_retainer` ("the ghost of a household attendant") belongs with the Ashen estate dead; a data fix is requested (`factions/_registry.md`).
