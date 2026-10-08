# GDQuest VFX reference library

Reference-only shader collection from [godot-4-VFX-assets](https://github.com/gdquest-demos/godot-4-VFX-assets), pinned to `f6034a88877f6ea144ae487694cc8fde82d4da7f`.

The 35 unmodified shaders retain their upstream paths and SHA-256 hashes in `SOURCE.json`. `LICENSE-MIT.txt` preserves the upstream software notice. No texture, model, upstream script, scene, or material is installed in the main game. Nothing is connected to gameplay. All export presets exclude this entire folder.

The complete upstream demo is available locally at `references/gdquest_vfx/upstream/project.godot`, outside the main Godot root. It targets Godot 4.1 / Forward Plus and retains its original mixed-license `LICENSE`. Its image textures and models are CC BY-NC-SA 4.0, so treat them as review references; they are not approved production assets.

Restore both libraries with `tools/Install-GdquestVfxReference.ps1` from the repository root. The installer refuses to overwrite changed copies. See `docs/art/GDQUEST_VFX_REVIEW_2026-10-08.md` for recommendations and runtime evidence.
