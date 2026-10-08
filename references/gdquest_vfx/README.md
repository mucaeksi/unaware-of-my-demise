# Local GDQuest reference project

Run `tools/Install-GdquestVfxReference.ps1` to restore the full pinned GDQuest VFX demo into `upstream/`. Open `upstream/project.godot` as a separate Godot project to inspect its original gallery. Keep the main game editor/runtime open.

The locally restored upstream files are Git-ignored, outside `game/`, and absent from the game's exports. The shaders copied into `game/assets/vfx/gdquest_reference/` are MIT software; original textures and models in this demo are CC BY-NC-SA 4.0. The original LICENSE remains alongside the demo. Full provenance and shader hashes live in the main library's `SOURCE.json`.
