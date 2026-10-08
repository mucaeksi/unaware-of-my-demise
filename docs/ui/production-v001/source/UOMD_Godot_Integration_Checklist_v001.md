# Godot UI Integration Checklist v001

## Import
- [ ] Copy `res/ui/` into a feature branch of the real project.
- [ ] Let Godot import all PNG textures.
- [ ] Open `uomd_theme_v001.tres`; resolve any import/parser warnings.
- [ ] Add legally sourced Cinzel and Source Sans 3 files to the project.
- [ ] Assign fonts and weights in Theme.
- [ ] Verify 9-slice margins visually.

## Runtime adapters
- [ ] Connect screen routes to the existing navigation/director layer.
- [ ] Connect PlayerState/wallet/inventory through existing state ownership.
- [ ] Connect story gates to StoryDirector/current story state.
- [ ] Connect authoritative transaction pending/confirmed states.
- [ ] Connect Audio settings to existing AudioDirector buses.
- [ ] Connect accessibility preferences to existing settings persistence.
- [ ] Do not register new duplicate Autoloads where a service already exists.

## Screen construction
- [ ] Entry
- [ ] Shelter
- [ ] Journey / Stage Detail
- [ ] Formation
- [ ] Battle
- [ ] Results
- [ ] Companions / Detail
- [ ] Inventory / Equipment
- [ ] Summon
- [ ] Quests / Inn
- [ ] Records
- [ ] VN
- [ ] Profile / Settings

## Shared states
- [ ] Loading
- [ ] Empty
- [ ] Locked
- [ ] Disabled
- [ ] Error
- [ ] Offline
- [ ] Insufficient Resource
- [ ] Pending
- [ ] Confirmed

## Device QA
- [ ] Compact portrait
- [ ] Base portrait
- [ ] Tall/cutout
- [ ] 48 dp hit targets
- [ ] Large Text
- [ ] Reduced Motion
- [ ] Android Back
- [ ] long English labels/copy
- [ ] grayscale state meaning
- [ ] transactional retry/reopen idempotency

## Production truth
- [ ] Rejected legacy visuals are not imported as active UI reference.
- [ ] Visible UI copy remains English.
- [ ] Japanese VO handling remains separate from visible text.
- [ ] No replacement main-theme music is created.
