# Technical Preferences — Unaware of My Demise

## Engine & Language

- **Engine**: Godot 4.7.2
- **Language**: GDScript
- **Rendering**: Mobile
- **Physics**: Godot Physics

## Input & Platform

- **Target Platforms**: Android Mobile (portrait)
- **Input Methods**: Touch
- **Primary Input**: Touch
- **Gamepad Support**: None
- **Touch Support**: Full
- **Platform Notes**: Target presentation 1080×1920; design for portrait-first phone UI. iOS may be added later, but Android is the release target for the current plan.

## Naming Conventions

- **Classes**: PascalCase
- **Variables**: snake_case
- **Signals/Events**: past_tense signals
- **Files**: snake_case
- **Scenes/Resources**: snake_case
- **Constants**: SCREAMING_SNAKE

## Performance Budgets

- **Target Framerate**: 60
- **Frame Budget**: 16.67 ms
- **Draw Calls**: To be measured and tuned for the supported Android target range
- **Memory Ceiling**: Measure before setting a hard ceiling

## Testing

- **Framework**: gdUnit4 where applicable, plus headless/project validation and API/admin tests
- **Minimum Coverage**: Project-defined; critical logic must be tested
- **Required Tests**: gacha rules, pity, currency/inventory integrity, networking, API auth, migrations, content/asset validation, Android build validation, regression checks

## Creative / Asset Rules

- Gameplay character visuals: chibi 2D PNG
- Narrative art: detailed character-sheet / light-novel style
- General tone: dark, gloomy, atmospheric
- Initial canonical reference: logo + key art + Fadyme sheet/assets/voice/theme
- Creative generation staging: `narrative/`
- Production promotion: only after provenance/reference/technical validation

## AI Asset Generation

- Images: Gemini API / intended Nano Banana 2 path
- Voice: Gemini TTS, one consistent mid-tier model/configuration
- Music: Gemini Lyria, except owner-controlled main theme
- Never put Gemini credentials in Git

## Forbidden Patterns

- Client-authoritative economy/inventory/gacha state
- Production dependency on Gemini API
- Bulk migration of the Google Drive LEGACY archive
- Destructive modification of LEGACY originals
- Arbitrary executable-code PCK downloads
- Hardcoded user-facing dialogue that bypasses localization/voice mapping
- Untracked generated assets without provenance

## Engine Specialists

- **Primary**: godot-specialist
- **Language/Code Specialist**: godot-gdscript-specialist
- **Shader Specialist**: godot-shader-specialist
- **UI Specialist**: godot-specialist
- **Additional Specialists**: godot-csharp-specialist and godot-gdextension-specialist only when a concrete technical need is verified
- **Routing Notes**: Godot-only project; do not route to Unity/Unreal agents.

## File Extension Routing

| File Type | Specialist |
|---|---|
| `.gd` | godot-gdscript-specialist |
| `.gdshader` / shader files | godot-shader-specialist |
| UI/scene architecture | godot-specialist + ui-programmer |
| `.gdextension` / native extension | godot-gdextension-specialist |
| architecture | godot-specialist + technical-director |
