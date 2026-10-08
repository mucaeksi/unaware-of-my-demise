# Free 2D library and opening AAB checkup — 2026-10-08

The owner authorized researching additional free 2D Godot-compatible resources, preserving project-generated characters/chibis, and correcting issues in the opening AAB. This pass installed nine local source groups, reviewed their licenses and provenance, and used only two CC0 textures for a restrained battle impact. The unused library and all development previews are export-excluded.

## Resource collection

`game/assets/third_party/reference/COLLECTION.json` is the exact source inventory: 1,422 files across eight asset selections plus one separate official particle-demo project. Counts include alternate sizes, colors and mask variants; they are not counts of distinct gameplay effects. Original notices remain with every selection. Pinned Git revisions, download URL/ZIP hashes, per-file SHA-256 and icon author directories support future reuse.

| Source | Installed selection | License | Potential role |
| --- | --- | --- | --- |
| https://github.com/Calinou/kenney-particle-pack / https://kenney.nl/assets/particle-pack | 80 PNG textures | CC0 | Impacts, glows, dust, skill accents |
| https://kenney.nl/assets/smoke-particles | 77 PNG files | CC0 | Smoke and puff layers |
| https://kenney.nl/assets/light-masks | 456 PNG masks / variants | CC0 | Local lighting and atmospheric masks |
| https://kenney.nl/assets/ui-pack-adventure | 256 PNG variants | CC0 | UI components as references |
| https://kenney.nl/assets/fantasy-ui-borders | 281 PNG/vector files | CC0 | Decorative frames and border study |
| https://github.com/godotengine/godot-demo-projects/tree/master/2d/sprite_shaders | 9 canvas shaders | MIT | Aura, outline, shadow, dissolve and glow |
| https://github.com/haowg/GODOT-VFX-LIBRARY | 24 canvas shaders and separate original demo | MIT | Status, environmental and portal effects |
| https://github.com/game-icons/icons / https://game-icons.net/about.html | 239 selected weapon/skill SVG icons | CC BY 3.0, author-specific CC0 exceptions | Skill/weapon icons; retain original artist credit on later use |
| https://github.com/godotengine/godot-demo-projects/tree/master/2d/particles | Original 2D particle demo, separate project | MIT | GPUParticles2D process-material reference |

There are no new 3D assets, imported character/chibi packs or enabled plugin/autoload managers in this collection. The original demo architecture stays under Git-ignored `references/free_2d/upstream/`, outside the strict game root. The older GDQuest VFX demo remains a separate reference from the preceding request; none of its NC art enters the opening.

The VFX Library's high-level managers need deliberate adaptation to the existing battle clocks, strong typing and scene cleanup before use. UI pack art must also fit the existing gothic presentation rather than replacing the theme wholesale. The Game-icons SVGs are UI references; they do not supply the game's character drawings or held-weapon animation.

## Changes in the opening

- `SafeAreaContainer` now disconnects its viewport resize signal on exit, reconnects on entry, and ignores callbacks while detached. The native screen-replacement audit exposed a real null-viewport debugger break. A new lifecycle regression test exercises removal, resizing, reattachment and a move to another viewport.
- Compact enemy HUDs use “Bellbound” and “Pilgrim” without changing their canonical names or data. Tooltips retain the full name/level/HP. Bellbound's label size is fitted to the available plaque width. Final bar dimensions preserve the existing geometry budget.
- `battle_hit_fx.gd` adds a short additive hit accent from Kenney's unmodified `spark_01.png` and `light_01.png`. Two sprites are allocated once per actor and reused. Duration is 0.34 simulated seconds; the visual pace follows the actor, including the ultimate's 0.1 background speed. No damage, cooldown, targeting, skill or ultimate rules changed.
- The two selected CC0 textures are copied into `game/assets/vfx/kenney_impacts/`, with mipmaps, original notice and source hashes. The notice is explicitly included in all export presets. The rest of the reference assets remain excluded.
- The development screenshot helper now supports `capture_exit_after = false`, allowing snapshots inside the persistent native preview without quitting its runtime. CLI capture behavior keeps its existing default.

Character sheets, chibis, portraits and ultimate illustrations remain the project's generated assets. Japanese voices, final music/SFX and balancing remain the later passes already chosen by the owner. No story canon, tutorial enemy type, party roster, production setting, renderer or unrelated plugin was added or replaced.

## Validation

- Full GUT run after the safe-area fix: 497 tests / 153,850 assertions passed. This included the two new lifecycle regressions.
- UI run after adding hit feedback and compact names: 183 tests / 105,642 assertions passed.
- Final battle geometry/playback/cooldown run: 27 tests / 95,904 assertions passed. A trial enlargement of HUDs failed short-screen collision bounds; the final implementation preserves the existing bar footprint. Tests were kept intact.
- All 33 new canvas shaders were loaded and bound in isolated 64×64 SubViewports on the main Compatibility runtime, with no shader errors. This establishes compilation on this desktop renderer; visual parameter tuning and Android profiling still precede actual shader integration.
- Native runtime screenshots reviewed title, sign-in, offline, downloading, prologue ending, verification, ready, light novel, tutorial arena, 5v5 and a large-boss sample. The final native source gallery demonstrates particles, bounded smoke, portal, aura, outline and a credited weapon icon.
- The editor remained open. Runtime restarts were used to recover concrete debugger breaks during the lifecycle and live-evaluation checks. Explicitly refreshing a GDScript's source text before reload resolved the stale-source preview issue. Final native validation uses a healthy current run.
- The actual exported base and story patch passed all three tutorial encounters, 32 character-state texture loads, rule-registry readiness and the 1-1 story handoff after mounting the patch. The patch policy rejects executable content; the resulting patch is data-only.
- The rebuilt opening AAB is debug signed for local review, JAR-verified and validated with pinned bundletool 1.18.2. No attached Android device was available; production Play signing and public patch publication are separate release steps. Nothing was pushed or published.

## Evidence and review artifacts

- Native source gallery: `build/free-2d-review-20261008/free-library-final.png`.
- Native entry phases: `build/free-2d-review-20261008/entry-*.png`.
- Final 5v5: `build/free-2d-review-20261008/five-v-five-final.png`; impact and boss studies are alongside it.
- Test logs: `safe-area-tests.log`, `ui-checkup-tests.log`, `battle-final-tests.log` under `build/free-2d-review-20261008/`.
- Exact library hash/export check: `build/free-2d-review-20261008/library-and-bundle-check.json`.
- Rebuilt AAB, base pack, story patch, inventories, signatures and validation logs: `build/opening-aab-checkup-20261008/`.
- `build-report.json` in that output folder contains the final byte sizes and SHA-256 hashes. It supersedes the earlier opening review bundle for these changes.

The reference library is available for later selection. This pass does not claim that every downloaded effect is visually complete or production-profiled, nor that the key-pose/tween characters are hand-drawn frame-by-frame animation sets.
