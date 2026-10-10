# Bootstrap content and pre-Part-I story audit

Date: 2026-10-07. Source inspection only; no runtime/export/content changes or release qualification in this audit.

## Accepted distribution direction

The owner selected a small Play AAB plus a mandatory first gameplay content pack and later supported content patches.
Client capability changes continue through Play AAB updates. See DEC-0043.

The AAB needs client gameplay logic and its renderers, but no playable stage has to be available before the first content
download. A first playable release can be limited to three tutorial encounters; shipping the full seven-chapter campaign
is not technically necessary. Tutorial stage definitions, enemies, character data, images and audio can be in the first
mandatory pack. A tutorial playable before that download would need its own complete assets/data in the AAB.

The first-download presentation needs a small locally available asset set and renderer, so it can play while the required
gameplay pack is still downloading. It must not reuse gameplay completion callbacks that award or advance story progress.

## Current implementation evidence

- `game/export_presets.cfg`: Android AAB preset exists, but exports `all_resources`.
- `game/scripts/ui/story_director.gd`, `start()` / `_on_flow_loaded()`: full GameFlow content is loaded before Entry creation.
  A content-free cold boot requires separating bootstrap from gameplay initialization.
- `game/scripts/app/content_installer.gd`, `inspect_release()`: currently accepts exactly one cumulative pack.
  Resume reuses partial bytes of that same pack; this is not per-feature or cross-release delta patching.
- `tools/pck_inventory.py`: current content-only allowlist accepts data and imported art/audio, excludes scripts.
- The existing signed manifest, pack hash checks and install marker remain the basis for the readiness gate.

## Tutorial source boundary

Owner proposal: three tutorial encounters with Fadyme and Mahmut as the only playable heroes.

Current source has one two-hero, free tutorial at 1-1. At 1-2 Brin, Nixie and Kera fill the guided five-person encounter,
Brin joins permanently, and First Oath follows. 1-3 also uses Kera. Therefore 1-1/1-2/1-3 cannot simply be treated as an
existing three-stage, two-hero tutorial. A separate onboarding sequence or an explicit source revision needs design;
neither was implemented by this audit.

Sources: `narrative/02_Main_Story/PART1_FULL_SCRIPT.md`, Chapter 1 opening and 1-1 through 1-3;
`narrative/01_Story_Bible/STORY_BIBLE_PART1.md`, party/loan rules;
`narrative/02_Main_Story/story_script_part1_manifest.json`, `guided_tutorial_exception`.

## Existing history (internal reference, not player-facing copy)

| Period | Documented information | Source |
|---|---|---|
| Ancient world | House Veyr binds seven bells; the Law of Hours and names as witnesses shape daily life | `narrative/13_Timeline_Factions_Glossary/timeline.md`; `narrative/05_Codex_Lore/world_rules.md` |
| Before Part I | Succession wars; Silent Bell fell silent at least fifteen years earlier; who and why remain unknown | `timeline.md`; `History/seven_bells.md` |
| Fadyme's childhood | Estate nursery, mother died when she was seven, guarded hunting lodge, brought to court at thirteen | `narrative/06_Characters/Playable/fadyme.md`, Backstory |
| Mahmut's early life | Farrier's son; entered Crown Guard at fifteen; assigned to Fadyme at nineteen, when she was thirteen | `narrative/06_Characters/Playable/mahmut.md`, Backstory |
| Six years before Part I | Crownfall, death of King Audren, sealing and delivery orders, Mahmut's refusal and flight | `narrative/13_Timeline_Factions_Glossary/History/crownfall.md` |
| Following years | Separated during flight; four years apart, reunited two years before Part I | Character Backstory sections; `timeline.md` |

These are documented events and background notes, not an already authored standalone download cinematic. The existing
`opening_sad_scene` takes place at the start of Part I; it is not the requested historical prelude.

## Suggested presentation (proposal, not new canon)

A brief illustrated prelude can move from the kingdom's daily bell/name rituals to the succession wars and the public
catastrophe of Crownfall, ending with the image of the two leads on the road. English text, slow illustrated movement,
visible download progress and skip/replay can fit the current Entry direction.

The source spoiler policy permits premise entries Law of Hours, Names as Witnesses and Crownfall from the start.
It gates later mechanisms, kinship reveals and secrets. An opening adaptation should preserve that reveal order unless
the owner explicitly chooses a revised order. Cael's identity/motives, the detailed sealing mechanism, Fadyme's mother's
hidden history and the contents of the letter should not automatically be exposed just because they happened earlier.
Sources: `narrative/00_Canon/SPOILER_UNLOCK_POLICY.md`; `narrative/00_Canon/canon.md`; character/source scripts.

The king's killer and the cause/agent of the Silent Bell's silence are explicitly UNKNOWN in the sources. The prelude
must not invent answers or depict an unrecorded hour's unknown events as confirmed history.

## Verification and remaining work

This audit checked local source statements and the official Godot resource-pack and Android asset-delivery documentation.
No gameplay or UI phase was changed, so no runtime test result is claimed. The selected distribution has not yet been
implemented/exported. Bootstrap separation, pack boundaries, cold-install/recovery validation and Play-installed release
QA remain work. Narrative dialogue, timing, storyboard and approved art remain uncreated.

Official references:
- https://docs.godotengine.org/en/stable/tutorials/export/exporting_pcks.html
- https://developer.android.com/guide/playcore/asset-delivery
