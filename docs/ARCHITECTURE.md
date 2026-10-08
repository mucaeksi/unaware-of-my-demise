# Architecture

Current boundary review: 2026-10-08. Runtime structure is preserved; this organization introduces source lookup and a generated review folder, not new gameplay ownership.

```text
Godot Android client (game/)
  UI / StoryDirector / Entry / VN / battle presentation
       -> GameFlow + typed services + pure core models
       -> Online -> HTTPS -> Cloudflare Worker (server/)
                               -> Hyperdrive -> Neon PostgreSQL
                               -> private R2 signed content delivery
  installed-content verifier -> boot-order PCK mount -> confirmation/restart

Admin static Next.js export (admin/) -> separate audited admin Worker

Development source -> tested opening PCK + validated AAB
                   -> exact authored inputs + native build support
                   -> clean source rebuild check -> release/current/
```

`scripts/app/` owns session, release, installation and shared application state. `scripts/core/` holds model/rules code without scene ownership; `scripts/services/` supplies typed interfaces. `scripts/ui/story_director.gd` controls navigation; `app_shell.gd` hosts screens and shared UI. Presentation controllers do not compute online rewards. Server identity, account state, economy and rewards remain server-authoritative; the database persists them.

The opening base is the owner-approved onboarding presentation: Prologue -> Continue -> three tutorial episodes with before/after cutscenes -> verified patch completion confirmation -> fresh process -> normal menu/content handling. Returning players use normal checks/patch installation and resume their state. Shared client code is retained in the base because patches deliver only approved data/imported assets. Chapter story payloads stay outside the opening base. Registry hashes are not rewritten to match a stripped folder.

`game/data/content/MANIFEST.json` is the content registry. `game/data/entry/` contains opening scripts; `data/presentation/` maps stable art IDs. Selected assets carry their own notices. Source/reference masters and generated production logs remain upstream and are excluded from runtime packaging. The public content verification key is required; private signing keys are never package inputs.

`release/current/` is generated, sealed local review output, not a second authoring tree. Source membership comes from actual PCK remaps/imports and explicit native/export support. It is replaced only after integrity, signature, bundletool, exported runtime and clean-source rebuild checks succeed. Source fingerprints identify stale snapshots. Build evidence lives outside current in ignored `build/`; an exclusive lock serializes updates.

[Project map](PROJECT_MAP.md) locates each boundary. [AAB workflow](release/CURRENT_AAB.md) explains generation. [Decisions](DECISIONS.md) retain historical context. The previous Fastify architecture diagram is preserved under `.archive/project-docs-20261008/`; it is not the current server architecture.
