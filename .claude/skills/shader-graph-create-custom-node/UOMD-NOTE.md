# UOMD vendoring note

Vendored unchanged from the official https://github.com/Unity-Technologies/skills (Unity Companion License, pinned commit in
`.claude/skills-lock.json`). Shader Graph comes with URP 17.3 in this project. Battle VFX are data-driven presets
(`content/base/vfx/vfx_presets.json`, `Uomd.Core.Vfx`); a new shader or node is an engine change that ships in the AAB, not
in a content patch. Project skills `uomd-battle`, `unity-urp-2d` and `uomd-unity-engine` win on conflict.
