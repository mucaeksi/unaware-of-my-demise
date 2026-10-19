# Faction Registry

Approved 2026-09-29 (world foundation W4, C32). **Data IDs are canonical** (the code uses them); lore files map to them. Political factions have a lore file; enemy groupings exist only in data.

## Political factions

| Lore file | Data faction_id | Status |
|---|---|---|
| `council_of_dukes.md` | — (no enemies) | Active |
| `inquisition.md` | — (Yseldra is `villain_boss`) | Broken after Crownfall |
| `crown_guard.md` | `crown_remnant` | Active (Oren's companies) |
| `saint_luthos.md` | — | Active |
| `red_vial_guild.md` | `red_vial_guild` (ledger wing only) | Ledger wing broken at 4-5; archive wing (Kera) remains |
| `first_eclipse_cult.md` | `first_eclipse_cult` | Active |
| `clockless_court.md` | — | Part II |
| `house_veyr.md` | — | Almost extinct |
| House Carrow (no file; `world.md`, `glossary.md`) | — | Throne vacant since King Audren; Fadyme is his only recognized child (by decree) |

## Enemy groupings (data only)

| Data faction_id | Meaning |
|---|---|
| `hollow_host` | Hollows, Bellbound and oath-armor dead (bestiary) |
| `ashen_estate_dead` | Wraiths and Inkbound of the Ashen estate |
| `ashbound_beasts` | Animals that ate bell-ash |
| `villain_boss` | Yseldra (not a faction) |

## Character affiliations (lore; there is no faction field in character data)

| Character | Affiliation |
|---|---|
| Mahmut | Ex-Crown Guard (branded traitor) |
| Fadyme | House Carrow (by decree) and House Veyr bell line; the current Last Bell |
| Kera Voss | Red Vial Guild, archive wing |
| Brin Alder | Forest-road village guard |
| Nixie Vale | Ex-Ochre Wheel caravan; Vale |
| Sister Aveline | Church of Saint Luthos |
| Sable Wren | Ex-Wren Post courier |
| Tilda Fen | Undercity clinic (independent) |
| Rikka Ember | Kiln company (eastern hills) |
| Mirel Quill | Ex-court scribe; Saint Luthos archivist |
| Odelia Pike | Salt-road harbor watchers |
| Pippa Bell | Travelling players (independent) |
| Nara Vell | Vell bridge wardens |
| Clem Marr | Grave-register reader (independent; worked for Undercity alchemists) |
| Vespera Wisp | Independent glass mage |
| Hana Birch | Ashen estate gamekeeper's household |
| Thistle Roe | Church of Saint Luthos, monastery bell garden |
| Iona Mist | River lantern keepers of Glassford |
| Jori Flint | Flint forge, Oakhaven |
| Marek Vane | Ex-Crown herald |
| Garrick Cinder | Ex-Royal Siege Corps pyre-lancer; Oakhaven & eastern hills watch |
| Corbin Locke | Ex-Glassford sluice-warden; Undercity clinic protector |
| Cassian Thorne | Church of Saint Luthos, former Ropeless Bell tower warden |
| Dorian Kesk | Ex-Royal Inquisition novice seal-cutter; Undercity pass-forger |
| Rowan Reed | Church of Saint Luthos, Whispering Ash wayshrine apprentice |
| Yseldra Vale | Former Royal Inquisition |
| Cael Veyr | House Veyr by birth; Clockless Court |
| Marshal Oren | Crown Guard remnant (paid by the Council) |

## Data fix requested

- `noble_retainer`: `faction_id` `crown_remnant` → `ashen_estate_dead` (its lore is a household ghost of the Ashen estate). Request in `docs/NARRATIVE_TECH_HANDOFF_PART1.md` §9.
