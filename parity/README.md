# Parity fixtures (Python reference -> Godot port)

Golden data produced by the Python reference (`core/`, `backend/`, `game_logic/`) for the GDScript port. The
port is done when every fixture below passes **100 %** in `game/tests/parity/`. The fixtures are generated, never
edited by hand.

```
python tools/parity/export_fixtures.py --check     # read-only; drift = exit 1 (what CI runs)
python tools/parity/export_fixtures.py --write     # regenerate fixtures + MANIFEST.json
python tools/parity/export_fixtures.py --write --only story loot   # partial run, no manifest
```

Needs only `cryptography` (`requirements-dev.txt`). Output is byte-for-byte deterministic: independent of
`PYTHONHASHSEED`, the working directory and the Python version (identical on Python 3.11, 3.12 and 3.13, checked).

**A drift is either a deliberate change of the reference or a bug in the export.** Changing the Python reference's
behavior is its own commit with a rationale and the owner's approval, followed by `--write` and a review of the
fixture diff. The reference is frozen at tag `python-kivy-reference-2026-09-29` (`MANIFEST.json`
`python_reference`).

## Encoding rules (for the GDScript loader)

* **Integers above 2^53 are decimal strings** (never a JSON number): seeds, `getrandbits`/`randrange` results, loot
  and battle seeds. In `rng.json` *every* integer input and output is a decimal string, except the seeding-state summary
  (32-bit words) and `u53`. Parse strings with `int()`; a value exceeds the signed 64-bit range only for
  `getrandbits(k > 63)` (compare `values_hex` there).
* **Non-integer stat values are exact decimal strings** (`"3.10"`, `"0.05"`): the reference uses `Decimal` with
  half-up rounding there. `random()` results and accessory roll values are plain JSON floats (already rounded to 0.01).
* Do not trust the JSON parser's int/float choice (Godot changed it in 4.4): convert every field by its schema.
* Errors are recorded as the reference's exception class name (`"raises": "ValueError"`). The port must fail the same
  calls with an explicit error result; only the *fact* and the unchanged state are contractual, not the class name
  (`recovery.json` also gives an `error_kind`).
* `validate_loadout` messages are not contractual, their order and count are.
* Compare numbers numerically, report the first difference with its field path and case name.

## Files

| File | Cases | What it pins | Ported in |
|---|---:|---|---|
| `rng.json` | 11 seeds | CPython `random.Random`: seeding (state right after seeding), `random`, `getrandbits`, `randrange`, `randint`, `choice`, `shuffle`, mixed-call scripts | G3.1 |
| `crc32.json` | 144 | `zlib.crc32`, incl. every real story-loan accessory seed string | G3.1 |
| `fernet.json` | 12 + 13 negative + 4 key cases | Fernet tokens (fixed timestamp/IV), rejected tokens, key validation. Godot must also produce tokens the Python side decrypts (`godot_vectors/fernet_godot.json`, below) | G4 (done) |
| `content_registry.json`, `content_errors.json` | 12 record tables / 52 | the whole `ContentRegistry` `load_content` builds (every record, dataclass field names as keys, registry order) and 52 deliberately broken packs with the exact `ContentLoadError` message | G3.2 |
| `stats_characters.json`, `stats_enemies.json`, `stats_equipment.json` | 20 / 81 / 216 | base stats, enemy stats with the difficulty multiplier, weapon/armor bonuses, levels 1..20 | G3.3 |
| `float_repr.json` | 4,030 doubles | `Decimal(repr(x))` for doubles given as IEEE bit patterns: the shortest round-trip decimal the reference's `Decimal(str(value))` sees (0.3 * 1.5 = 0.44999999999999996 decides a half-up tie in enemy stats) | G3.3 |
| `curves.json` | 1 | XP / Silver Crown / ascension / equipment / skill-rank / Memory Node curves and rejected inputs | G3.3 |
| `equipment_rules.json` | 1 | who can equip which weapon, set bonuses, `validate_loadout` variants | G3.3 |
| `loadouts.json` | 1 | `_resolve_equipment` (levels, rolled accessories, set bonus), Memory Node stat application, rejected loadouts | G3.6 |
| `accessories.json` | 1 | accessory rolls for every template and seed, stress rolls, reroll chains, failures, the rounding rule on exact fractions | G3.5 |
| `story_loans.json` | 66 | the deterministic 3-star kit of every story guest | G3.5 |
| `story_flow.json`, `rosters.json`, `persisted_state.json` | 7 / 35 / 1 | the 51-entry story walked once per First Oath choice, roster resolution (valid and invalid), persisted-state format and cursor re-resolution, First Oath rules | G3.4 |
| `quests.json`, `time_source.json` | 1 / 5 | daily/weekly task progress, reset windows, weekly segments, `TrustedClock` | G3.8 |
| `loot.json` | 840 | `resolve_battle_rewards` for every stage x first-clear x 12 seeds, replays, failures, and 78 hand-made drop tables (`synthetic`) that reach every validation branch with the exact messages | G3.7 |
| `battle_<stage>.json` (35 files) | 525 | full Auto battles: 3 squad variants x 5 seeds per stage, complete event log, final units, stars, actions, cycles | G3.6 |
| `saves.json` | 14 scenarios | victory transaction (first clear, replay, defeat, three injected failures), progression, skills, Memory Nodes, equipment, reroll, quest-claim ledger, limits: result + table dump after every step | G4 (done) |
| `recovery.json` | 12 | startup recovery for abstract file states (garbage, wrong key, invalid story, future schema, lost key, backups) | G4 (done) |

Total about 15 MB (battles 11.6 MB).

## Godot-made vectors (the other direction)

`godot_vectors/fernet_godot.json` is **not** generated by the Python exporter and is not part of `MANIFEST.json`: it holds Fernet tokens produced by the GDScript
port (`Fernet.encrypt`: random IV, real timestamp, random keys), written by `godot --headless --path game -s tools/export_fernet_vectors.gd`. `tests/test_godot_fernet_vectors.py`
decrypts every one with Python's `cryptography` (Godot -> Python); `game/tests/persistence/test_fernet_parity.gd` reproduces the fixed-IV tokens of `fernet.json` byte for byte
(Python -> Godot) and decrypts the Godot-made ones again. The tokens differ on every run, so this is not a drift check: regenerate only if the format could have changed.
Notes for the save fixtures: `saves.json` keeps canonical (sorted) key order, so the insertion order of a multi-item `add_items` operation is lost; the Godot test compares
the `inventory_items` rows sorted by `item_id` and every other table in insertion order.

## Battle fixtures

`BattleService.run` in Auto mode. `input` holds everything to rebuild the run (owned heroes, roster, levels, equipment,
skill ranks, Memory Nodes); `events` is the **contract between battle logic and presentation**: event types and
fields must be kept as they are. The events contain no floats: every damage, heal and HP value is an integer.

Variants: `auto_recommended` (default-walk story state, auto roster, recommended levels, no gear),
`naked_level1` (same squad at level 1: mostly defeats, exercises that path), `equipped` (recommended levels, signature
weapon L10, armor L10, rolled 4-star necklace + ring with set bonus, skill rank 2, two Memory Nodes). Seeds
`0, 1, 7, 12345, 2^31 - 1`. Results over all 525 runs: `auto_recommended` 173 victories / 2 defeats, `naked_level1` 71 / 104,
`equipped` 175 / 0.

## Save scenarios

Operations are replayed on a fresh account; after each one the fixture stores the result (or the error) and a dump of
every touched table. Dumps show payloads decrypted, drop timestamps and `claim_id`, and use aliases for the random
weapon/armor/accessory instance ids (`w#1`, `a#1`, `x#1`, in order of first appearance; operations refer to
instances by alias). Fault injection points: `wallet_write`, `quest_record`, `story_save` (all inside the victory
transaction). A failed step must leave the dump identical to the previous one.

## Reference behavior the port must reproduce (observed, not endorsed)

These are defects or quirks of the Python reference. They are pinned as-is (rule: parity first, changes are the
owner's decision, after the migration or as a separate approved change with regenerated fixtures).

1. **Accessory set bonuses do nothing.** `BattleService._resolve_equipment` passes the set bonus to
   `apply_equipment` as `{"hp_pct": 0.05}`; the percent key keeps its `_pct` suffix (rolled accessories strip it),
   so the result is a junk stat `"hp_pct": 0` and the real stat is unchanged. Visible in `loadouts.json`
   (`full_set` stats contain `hp_pct`, `def_pct`, ... with value 0). `tests/test_battle_progression_wiring.py::
   test_set_bonus_needs_both_accessories` passes only because of that junk key.
2. `Decimal(str(random()))` in the accessory roll cannot be ported literally. An exact integer formulation
   (value in 1e-4 units, `(2 * (low * 2^53 + range * k) + 100 * 2^53) // (200 * 2^53)`, `k = random() * 2^53`) gave
   **0 differences in 4,386,384 comparisons** against the reference (150,000 random draws and every fraction `k / 2^m`,
   `m <= 14`, over all 24 stat ranges). The intermediate product needs more than 64 bits (two-limb arithmetic in
   GDScript). `accessories.json` -> `roll_values` pins the rounding boundary itself.
3. `random.Random` seeds can be unsigned 64-bit (`AccessoryRoller(seed=rng.getrandbits(64))` in the loot code) and
   `getrandbits(128)` builds accessory instance ids: the port's generator needs unsigned/multiword seeding and
   arbitrary widths.
