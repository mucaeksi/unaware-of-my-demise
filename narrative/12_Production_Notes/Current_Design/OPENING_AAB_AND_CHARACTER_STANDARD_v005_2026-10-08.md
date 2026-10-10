# Opening AAB and character presentation standard — v005

Status: implemented locally; visual direction awaits the owner's review. Supersedes
v004's rectangular party tray and unfinished bootstrap export split. English story
text and future Japanese voice production are owner requirements. No story canon,
combat balance, source Production files or remote deployments changed in this phase.

## Common visual standard

Fadyme and Mahmut now establish `painted_chibi_v003`: mature anime faces, roughly
2.7-head proportions, readable hands/equipment, layered cloth and armor, restrained
dark-fantasy colors and a consistent soft key light. Enemies use the same painted
detail and edge quality. At battle scale, silhouette, face and equipped weapon take
priority over tiny ornament. This is the baseline for future heroes and species.

New characters must be checked beside BOTH starters at 2v2, 5v5 and boss layouts,
including 360×800. Approve a canon-grounded adult/chibi model sheet, face crop,
all required battle states, novel expressions and a separate Ultimate illustration.
Character identity must survive the change from large novel portrait to small chibi.
Use project canon for costume, facial details and equipment; generated ornament is
a visual proposal, never new lore. Do not add faction emblems or backstory through art.

Keep original references read-only. Preserve previous revisions and select new assets
through the presentation manifest. Favor new creature silhouettes over recolors;
no strength-by-color system or additional enemy species was introduced here.
Tutorial enemies remain Bellbound Dead and Hollow Pilgrim, both existing commons.

## Assets selected for the opening

| Asset | Source dimensions | Use |
|---|---:|---|
| Mahmut model sheet v002 | 1448×1086 | Authoring reference; outside the AAB |
| Fadyme/Mahmut chibi v003 | 1774×887 each | Eight authored key poses per hero |
| Bellbound/Pilgrim v003 | 1254×1254 each | Four authored states per species |
| Fadyme/Mahmut profile v001 | 1254×1254 each | Round face controls |
| Fadyme Ultimate pose v003 | 1254×1254 | Broad gameplay gesture |
| Mahmut Basic/Guard v003 | 1254×1254 each | Uncut sword and separate shield guard |
| Bellbound/Pilgrim attack v003 | 1254×1254 each | Uncut broad attacks |

Selected source files and reproduction briefs are recorded in
[the generation manifest](../../../docs/art/character_reference/generation_manifest_v003.json).
The manifest distinguishes production/reproduction briefs from a verbatim tool log.
All image generation/editing used the built-in ImageGen; source originals remain in
the Codex generated_images directory. No source image was resized or painted in Python.
Python only measured alpha bounds and recorded resource metadata.

Fadyme retains five novel expressions; Mahmut retains three. Both already have
illustrated Ultimate cut-ins. These existing opening assets are included in the base.
The native preview's Character poses page now selects either hero or either common.

## Runtime art and animation contract

`game/data/presentation/battle_art_v001.json` is the selection and pose metadata
contract. `BattleArt` resolves atlases, separate poses, face icons, novel expressions,
Ultimate illustrations and environments. A missing optional face can use an authored
novel face crop; future heroes still require a dedicated approved icon for final art.

The sprites use lossless imported RGBA textures, alpha-border correction and mipmaps.
Actors, portrait buttons, novel busts and Ultimate cut-ins request linear mip filtering.
Alpha bounds define atlas regions; per-state scale preserves head/body size, foot
anchors maintain ground contact and pivots align broad equipment gestures. Wide
attacks are separate transparent sprites to avoid crossing neighboring atlas cells.
No background, labels or baked full-screen VFX belong in gameplay sprite atlases.

The current animation method is authored KEY POSES plus procedural motion, rather
than continuous frame-by-frame clips. Both heroes expose idle, walk, basic, active,
ultimate, hit, defeat and victory. Common enemies reuse their four authored poses
across the shared state interface. Every state resolves and was captured in the
real Godot runtime. Continuous frames, skeleton rigs and final motion polish remain
possible later without changing combat rules or the state contract.

The texture resolver retains at most 24 cached resources; visible nodes retain their
own references. This is a cache retention bound, not proof of a particular Android
VRAM budget. Source atlas dimensions are the actual generated dimensions; there is
no claim of 4K-per-pose detail or measured phone performance.

## Five face controls

The bottom tray always has five fixed formation slots. Occupied slots show a circular
face, character name, Focus meter and two thin Basic/Active cooldown indicators.
Unused slots are muted, decorative, disabled and excluded from keyboard focus.
Slot placement follows party formation. The tutorial uses Mahmut in slot 0 and
Fadyme in slot 2; the other three remain empty. Five duplicates in art review are
layout samples, not newly playable heroes or roster changes.

Each face button is 144×144 logical pixels and its face fills 77% of the circle area.
Ready Focus produces concentric pulsing rings in the character's existing element
accent. A defeated hero is dimmed and disabled. During an Ultimate presentation all
Ultimate controls are blocked. Basic/Active remain automatic; Focus being full does
not cast a player Ultimate automatically. The manual click and 0.1 cinematic pace
contract from v004 is retained. The native round-button click restored x1 after the
cut-in; v004 also verified restoring unlocked x2. Global `Engine.time_scale` remains 1.

Combat Skip and novel Skip remain absent. x2 unlocks only after Chapter 3. Next first
reveals unfinished typewriter text and then advances; Auto remains available. Novel
title, dialogue and backlog explicitly select English even on a Turkish device.

## Actual base and patch split

`Android` and `Android AAB` select the `opening_bootstrap` feature. They include
Entry/prologue, both starters' current art, two tutorial enemy species, tutorial
scripts, backgrounds, presentation UI and the full small rules registry. Keeping the
registry preserves the existing deterministic rules hash and strict content loader.
Main-story chapter scripts 01–07 are excluded from the base. Old unselected hero
atlases and superseded isolated sprites are export-excluded while source files remain.
Editor plugins, review tools and tests remain excluded by the existing export policy.

`Content Full` produces the complete narrative payload using the same application
code. `game/tools/build_content_patch.sh` now uses that preset. The produced patch
contains seven chapter JSON files plus allowed UID/script-class cache metadata; the
existing data-only patch policy passed. No scripts/scenes/project settings are patched.
Future content must keep this allowlist; changing application logic requires an app
release. This first patch contains existing narrative, not uncreated future artwork.

`GameFlow` loads the base rules/tutorial registry while chapter files are absent.
`Game.attach` refuses the normal player snapshot until the story payload exists,
even when the server rules hash already matches. Mounting the local story pack
restores a complete `StoryIndex`, including the pre-battle scene for 1-1. Existing
download signature checks, account checkpoints and returning-player behavior remain.
New players retain Prologue → fade → Continue → all three tutorials with a scene
before/after each battle while downloading. Returning players patch and resume.

## Build and evidence

Run `tools/Build-OpeningBundle.ps1 -Godot <4.7.2 console exe> -Python <python exe>`.
It imports, exports the opening PCK, builds the complete story patch, applies the
existing patch policy, runs exported-pack acceptance, creates a review AAB, explicitly
signs it with the existing PUBLIC ANDROID DEBUG KEY and verifies it with jarsigner
and pinned bundletool 1.18.2. It preserves shell settings and uses an ephemeral Gradle
daemon so a Windows exporter pipe closes after the build. Production keys are unused.

Local artifacts under `build/opening-aab-20261008`:

| Artifact | Bytes | Validation |
|---|---:|---|
| opening-review.aab | 129,781,478 | Debug signature verified; bundletool passed |
| opening-base.pck | 96,686,588 | Registry ready; no chapter scripts; all 32 state resolutions |
| story-content.pck | 155,168 | Data-only patch policy; restores full story and 1-1 |

Android manifest: package `io.github.mucaeksi.unawareofmydemise`, version 0.1.0/code 1,
min SDK 28, target SDK 36, arm64 only. These existing version identifiers were kept.
The AAB is a LOCAL REVIEW artifact, not a Play upload release.

Evidence in `build/hero-quality-20261008`: 181 UI tests passed (105,635 assertions),
186 unit tests passed (2,307 assertions), and a final 5-test manual-Ultimate check
passed (215 assertions) after portrait filtering changes. Strict project script
loading is included in the unit suite. Native evidence includes five-slot 2v2/5v5,
360×800 and 600×800, a boss-size sample, 32 pose captures, English novel layout and
round-face Ultimate input. Pack acceptance completes T-1, T-2 and T-3 from the
exported base and verifies the mounted patch; it does not contact an external server.

The Godot Editor and native Local UI Preview remain open. Two review-eval mistakes
(mixed indentation and an incorrect inspection method) caused debugger breaks;
the inspection commands were corrected and the runtime recovered. These were not
game-source failures. Final runtime refresh and selected checks passed.

## Remaining release work

Final Japanese voices, music and SFX remain deferred by the owner. Combat numbers,
individual cooldowns and Focus gains remain a later balancing task. No Android
device was attached, so on-device visual/performance acceptance is pending.
The upload-signed Play AAB, real signed content-manifest publication, distribution
URLs and matching server deployment remain release steps; nothing was pushed or
published. The native download preview is simulated, while the local exported-pack
mount test uses the actual files. This document does not claim public patch delivery.
