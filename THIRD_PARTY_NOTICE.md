# Third-Party Notice

The `.claude/` project tooling pack is derived from **Claude Code Game Studios 1.1.2**
by Donchitos and is distributed under the MIT License in
`THIRD_PARTY_LICENSES/claude-code-game-studios-MIT.txt`. That license covers the
CCGS-derived tooling only, not the game (see `LICENSE`).

The UOMD-specific files in this package are custom project configuration and
workflow material for Unaware of My Demise.

Godot addons under `game/addons/` (for example GUT) keep the license files in
their own folders. Server dependencies keep the licenses in their npm packages.

Two unmodified textures from Kenney's Particle Pack (`spark_01.png` and
`light_01.png`) are used for the opening's bounded hit feedback. They are by
Kenney Vleugels (Kenney.nl), licensed CC0; their license and provenance are in
`game/assets/vfx/kenney_impacts/`. The character and chibi art is separately
generated project art.

Additional 2D reference collections under `game/assets/third_party/reference/`
and the GDQuest shader reference folder are excluded from exports. Their own
license notices, source revisions and per-file hashes are retained locally.
Game-icons.net icons require their author credit under CC BY 3.0 when selected
for later use; no Game-icons.net icon is included in the current opening export.

## Fadyme production workbench v002

`narrative/15_Art_Workbench/characters/fadyme/production_v002/vfx/` stages GDQuest MIT swirl code (revision `f6034a88877f6ea144ae487694cc8fde82d4da7f`) with its MIT notice and unmodified Kenney CC0 spark/light textures (revision `ab7086639ee73be31abd87feb21bf1402d4e8144`). Original GDQuest CC BY-NC-SA artwork is not redistributed in that production package. The owner-requested full-game review promoted selected derivatives to `game/assets/characters/fadyme/production_v002/vfx/`. The existing BattleField instantiates six bounded shader scenes; no upstream VFX manager or plugin was installed. Runtime provenance and exact licenses remain beside those scenes. Exportable copies of the MIT/CC0 notices are in `game/data/legal/gdquest-vfx-mit.txt` and `game/data/legal/kenney-particles-cc0.txt`, covered by every existing preset’s `data/legal/*` include filter. The sealed `release/current` artifacts were not rebuilt. See the local `SOURCE.json` and `licenses/` for exact reuse.
