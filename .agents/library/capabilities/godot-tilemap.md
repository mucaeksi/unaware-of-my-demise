# godot-tilemap

Status: ACTIVE: `uomd-godot-tilemap`.

Purpose: Build and edit tile-based 2D levels in Godot 4.7 with TileMapLayer and TileSet: paint layers, set up collision/navigation/custom-data on tiles, autotile with terrain sets, and read/write cells from code (set_cell, get_cell_tile_data, local_to_map). Use when working with TileMapLayer nodes, .tres TileSets, autotiling, or migrating a deprecated TileMap node to TileMapLayer.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Core workflow
- Patterns
- 1. Convert mouse position to a cell and read its custom data
- 2. Place and erase tiles at runtime
- 3. Autotiling a region with a terrain set
- 4. Iterate placed tiles (e.g. find all spawn tiles)
- Pitfalls
- References
- Related skills

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/godot-tilemap/SKILL.md` — SHA-256 `1c860e5fb0b1fbec25dcc9a1907cc4d7ae924ffe59f815141b929e4a466ca167`
