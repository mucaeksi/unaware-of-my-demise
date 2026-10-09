# Unaware of My Demise

Dark-fantasy online mobile RPG. Develop locally in `game/`; Android portrait, Godot 4.7.2, typed GDScript, Compatibility renderer. UI and subtitles are English; voice is Japanese.

Owner-selected workspace: `F:/unaware-of-my-demise`. **Codex: character/environment art. Claude: coding/integration. Owner: GitHub push/publication.** Start with [Art and code handoff](docs/ART_AND_CODE_HANDOFF.md), [Art workbench](narrative/15_Art_Workbench/README.md) and [Copy verification](docs/release/WORKSPACE_COPY_2026-10-08_TR.md). Existing resource paths were preserved; new art stays outside runtime exports until approved and handed off.

Start with [Project map](docs/PROJECT_MAP.md), [Current state](docs/CURRENT_STATE.md), [Architecture](docs/ARCHITECTURE.md) and [Toolchain](GAME_TOOLCHAIN.md).

The latest opening test version is generated in `release/current/`; test `release/current/artifacts/game.aab`. [Current AAB workflow](docs/release/CURRENT_AAB.md) explains rebuilding, integrity checks and publication boundaries. Only one verified current version is kept there. Edit the development source, then refresh current after accepted changes.

The implemented opening covers Prologue, Continue, three tutorial fights with before/after cutscenes, patch confirmation and restart. [Latest opening revision](docs/design/OPENING_TUTORIAL_REVISION_v006_2026-10-08.md) records the visual and narrative changes. This is local review work; final voice/music, balance, polish, Android device acceptance and production signing remain pending.

Active project skills, agents, standards and workflows live in `.codex/`. Root `AGENTS.md` and [.codex authority](.codex/standards/authority.md) resolve conflicts. `.agents/skills/` links to the same skills; `.agents/library/` indexes provenance and deferred capabilities. Root `CLAUDE.md` is the current coding handoff. Former Claude/framework instructions under `.agents/archive/` are historical; their old active `.claude/` copy is omitted. No GitHub push, deployment or publication is authorized by local preparation.

Use `python tools/project_catalog.py build` and `python tools/project_catalog.py find <words> --scope active` for fast file lookup. `--scope aab` restricts results to current source membership. Use Graphify queries first for code relationships. Existing Godot Editor/runtime and native Local UI Preview stay open for visual review.

Server: TypeScript Cloudflare Worker, Hyperdrive and Neon PostgreSQL; private R2 signed content patches. Admin: static Next.js export with a separate Worker. Client presentation is local; account state, economy and rewards remain server-owned. Content patches cannot deliver new executable code.

Reference/source art remains in `narrative/`; approved current direction takes precedence over historical art locks. Production and Drive LEGACY originals are read-only. Original documents replaced during this organization are preserved in `.archive/project-docs-20261008/`.

Current first-AAB repair and audio/design sequence: [FIRST_AAB_PLAN.md](docs/release/FIRST_AAB_PLAN.md).
