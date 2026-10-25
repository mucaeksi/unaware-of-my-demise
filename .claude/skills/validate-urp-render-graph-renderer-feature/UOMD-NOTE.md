# UOMD vendoring note

Vendored unchanged from the official https://github.com/Unity-Technologies/skills (Unity Companion License, pinned commit in
`.claude/skills-lock.json`). Use it to review any `ScriptableRendererFeature` added to the URP 2D renderer
(`Assets/_UOMD/Settings/UomdURP2D.asset`, URP 17.3 on Unity 6.3). Project skills `unity-urp-2d` and `uomd-unity-engine` win
on conflict; renderer features must keep the Android frame budget and must not touch deterministic combat code.
