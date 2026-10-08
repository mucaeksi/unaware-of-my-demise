# Unaware of My Demise — Project Context

## Project identity

- Title: **Unaware of My Demise**
- Genre: dark-fantasy mobile online gacha RPG
- Primary platform: Android phones
- Orientation: portrait-only
- Target presentation: 1080×1920
- Client engine: Godot 4.7.2
- Client language: GDScript
- Online architecture: server-authoritative

## Creative identity

The game's overall presentation should be dark, gloomy, atmospheric, dramatic,
and cohesive. Avoid generic bright/cartoon rendering as the default visual
language.

Gameplay uses chibi-style 2D PNG character visuals because this supports
readability, practical animation, rapid content production, and mobile
playability.

Narrative/VN presentation uses detailed character-sheet / light-novel-style art.
The two visual modes are complementary and should not be conflated.

Some adult female characters may intentionally use attractive, lightly revealing
designs. Preserve this only for clearly adult characters and maintain established
character identity. Sable Wren keeps the alluring direction unless an approved
canon decision changes it.

## Canonical reference set

The first locked reference set consists of:

1. logo
2. key art
3. Fadyme character sheet
4. Fadyme visual assets
5. Fadyme voice
6. Fadyme theme

Fadyme is the canonical anchor for later visual and audio consistency.

Owner workflow:

- Owner personally approves the initial reference set.
- After the reference set is marked APPROVED/LOCKED, Claude may generate and
  validate subsequent non-reference assets autonomously against it.
- A new creative asset does not silently override the reference set.
- Conflicts are documented as decision-required items.

Recommended reference location:

`narrative/references/fadyme/`

## Creative generation stack

### Images

Intended image generation: Gemini API using the project's configured
Nano Banana 2 image generation path.

Use one consistent mid-tier image-generation model/configuration wherever
possible so characters do not drift between model families.

### Voice

Japanese voice acting is intended.
Voice assets are generated through Gemini TTS as a development-time service.
Use one consistent mid-tier voice-generation model/configuration per project,
unless a documented technical limitation requires an exception.

### Music

Use Gemini Lyria for the project's generated music score except the main theme,
which is handled by the owner personally.
Fadyme's theme is part of the initial reference set.

Use one consistent mid-tier music model/configuration for generated score assets.

## Character package principle

Treat every production character as a content package containing, as applicable:

- character ID
- display name
- gameplay rarity/role data
- chibi gameplay art
- narrative/detail art
- portrait/UI art
- voice profile
- voice clips
- theme/music references where applicable
- metadata
- provenance
- content version
- generation prompt/reference record

## Narrative staging

Claude-generated creative source material belongs under `narrative/` first.
This includes:

- prompts
- reference images
- generated candidate images
- approved images
- character packages
- voice-generation records
- music-generation records
- creative metadata
- provenance

Technical agents may promote validated assets into the production game content
structure. Creative generation should not scatter untracked files throughout the
technical codebase.

## Legacy visual policy

Legacy visual assets are primarily reference material because the current
creative plan is to regenerate game visuals from scratch.

Do not blindly migrate old character art, portraits, backgrounds, UI art, or
other legacy visuals as production assets.

Instead:

- inspect them
- understand their role
- preserve useful provenance
- use them as reference only when appropriate
- regenerate the production version through the approved creative pipeline

Legacy code/data/tooling may be reusable when evidence supports it.

## Legacy asset automation

Before inventing any new asset automation, search the Drive LEGACY archive for
existing:

- asset naming scripts
- directory rules
- IDs/registries
- metadata formats
- manifests
- versioning
- prompt records
- Gemini/AI generation tools
- import tools
- patch/build integration

Preserve compatible conventions and migrate/refactor rather than discarding them.

## Voice/music-aware narrative implementation

Story scripts and scenes are designed with Japanese dubbing and music in mind.
Where applicable, narrative content needs stable IDs and references for:

- dialogue line
- speaker
- voice clip
- localization key
- timing
- music cue
- SFX cue
- fade/transition point
- skip/fast-forward behavior

The main theme is owner-controlled and must not be replaced automatically.

## Cloud workflow

Normal work occurs through:

Claude Code Cloud → GitHub → CI/CD → Cloudflare/Neon/R2 → Android/PCK/Admin

No permanent local development requirement should be introduced.
