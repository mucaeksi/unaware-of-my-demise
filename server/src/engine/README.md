# Battle engine port (TypeScript)

This is the server's copy of the deterministic game core. Battles are re-simulated from the server's own seed
(DEC-0013), and rewards are decided here.

There are three implementations of the same rules:
- the LEGACY Python reference
- `game/scripts/core/**` (GDScript)
- this directory

All three must reproduce the golden fixtures in `parity/fixtures/`. A rule change lands in all three in the same change,
and the fixtures must stay green.

## Port status

| Module (GDScript source) | TS | Parity gate | Status |
|---|---|---|---|
| `rng/cpython_random.gd` (342 lines) | `random.ts` | `rng.json`, all 11 seeds | DONE |
| `rng/crc32.gd` | `crc32.ts` | `crc32.json` | DONE |
| `battle/frac.gd` | `frac.ts` (BigInt, exact like Python) | unit tests; exercised by `battle_*.json` | DONE |
| `content/content_models.gd` + `content_loader.gd` (1315) | `content.ts` | `content_registry.json` (all 12 tables + catalogs, field by field), `content_errors.json` (every case, exact message) | DONE |
| `progression/progression.gd`, `dec.gd`, `big_nat.gd`, `float_repr.gd` | `progression.ts`, `dec.ts` (BigInt; JS shortest formatting = Python repr) | `curves.json`, `stats_characters/enemies/equipment.json`, `float_repr.json` | DONE |
| `equipment/equipment.gd`, `loot/accessory_roller.gd` | `equipment.ts`, `accessories.ts` | `equipment_rules.json`, `accessories.json` (`loadouts.json` exercises `BattleService` and moves to that row) | DONE |
| `story/story_state.gd` (roster, rewards, persisted form) | `story.ts` (the API's `../story.ts` keeps the route-level cursor rules) | `story_flow.json`, `rosters.json`, `persisted_state.json` (`story_loans.json` is `BattleService.story_loan_loadout`, service row) | DONE |
| `battle/*` (action gauge, units, damage, focus, auto battle, encounter state, effect interpreter 1741, victory stars) | `battle/` (`util`, `rules`, `unit`, `gauge`, `damage`, `state`, `interpreter`, `encounter`, `auto`) | `battle_1-1.json` … `battle_7-5.json` (35 stages × 15 = 525 runs, every event) + the four GDScript unit suites | DONE |
| `battle/battle_service.gd` (orchestration, player loadouts, story loans) | `battle/service.ts` | `battle_*.json`, `loadouts.json`, `story_loans.json` | DONE |
| `quest/quest_progress.gd`, `quest/reset_clock.gd` | `quests.ts` | `quests.json` (tasks, scripts, invalid events, 82 window instants, Character XP items) | DONE |
| `loot/loot_resolver.gd` | `loot.ts` (async first-clear ledger callback, runs in the caller's transaction) | `loot.json` (840 cases, replays, failures, 70+ synthetic tables with exact messages) | DONE |
| `time/trusted_clock.gd`, `device_clock.gd` | not ported: client-only (the Worker uses its own clock) | `time_source.json` (client GUT only) | N/A |

Order of work: content loader, then progression/equipment, then story roster, then the battle core, then the
service. Each step lands with its fixture gate in `server/test/engine/`.

## Determinism notes

- Every `BattleService.run` restarts the shared interpreter RNG (GDScript and TS alike). Anything drawn before
  `runBattle` seeds the state (battle_start hooks) therefore never depends on earlier runs. The server builds its
  own service, and the client reuses one; both must agree on every attempt (DEC-0013). Part I content draws
  nothing there today: all 525 fixtures replay identically with a fresh service per case.
- Paths no fixture exercises, ported line for line but untested in full battles: wave advance, summons,
  copy_buff, remove_shield, intercept, manual providers. Soul link and redirect have unit tests.
