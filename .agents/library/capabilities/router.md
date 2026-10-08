# router

Status: ACTIVE: `uomd-router`.

Purpose: Routes any game-development request to the right specialized skill(s): it detects the engine (Godot, Unity, Unreal, Bevy, Phaser, PixiJS, three.js, LÖVE, pygame, Roblox) and the task, then reads the chosen skill before acting. Use to make a game or to decide which skill applies — for players, levels, enemies, shaders, art direction, sprites, tiles, textures, 3D assets, UI/UX, cameras, game feel, physics, input, audio, saving, multiplayer, AI, dialogue, procedural generation, or performance, for genres (platformer, roguelike, RPG, FPS, tower-defense, card game, visual novel, survival-crafting, puzzle), and for shipping (game jam, Steam, itch). Start here when unsure which gamedev skill to use.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Routing algorithm
- 1. Engine detection (project fingerprint)
- 2. Task classification (phrasing → category)
- 3. Routing table (task → category → skill)
- 3a. Engine skills — read the one matching the detected engine + sub-task
- 3b. Disciplines — load **with** the engine skill (concept ↔ engine API)
- 3c. Genres — **compose** engine + disciplines (bind * to the detected engine)
- 3d. Workflows — engine-independent process & shipping
- 4. Read protocol (progressive disclosure)
- 5. Composition rules
- 6. Unknown-engine & no-skill fallback
- Worked examples
- References

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/router/SKILL.md` — SHA-256 `a8b3e2fddc759db8865844cdb82b407eb482a07681cf2d07cd117d998f037ed0`
