---
name: uomd-ai-ultra-studio
description: Orchestrate Unity 6 LTS bundle/project inspection (uomd-unity-live MCP) and Google Gemini API / AI Ultra creative production tools (uomd-ai-ultra MCP: Google Flow / Veo 3.1, Project Genie / Genie 3, NotebookLM Plus, Whisk Animate, Lyria, Chirp 3 HD) for Unaware of My Demise without unauthorized credit spend.
---

# UOMD Unity 6 Live MCP & Google Gemini / AI Ultra Studio Integration

Use this skill whenever inspecting the Unity 6 LTS client (`apps/unity/`, `StreamingAssets/uomd_base`, C# assemblies, and unit slice pivots via `uomd-unity-live` MCP) or preparing/integrating **Google Gemini API & AI Ultra** workflows (**Imagen 4 / Gemini 2.5 Flash Image**, **Google Flow / Veo 3.1**, **Project Genie**, **NotebookLM Plus**, **Whisk Animate**, **Lyria**, **Chirp 3 HD**) for *Unaware of My Demise*.

## 1. Unity 6 LTS Project & Bundle Inspection (`uomd-unity-live` MCP)

Implemented in [`tools/mcp_unity_live.ts`](../../../tools/mcp_unity_live.ts) and registered in `.mcp.json` and `.codex/config.toml`.

- **`unity_project_status`**: Inspects `apps/unity/` (`ProjectVersion.txt`, the 8 `.asmdef` assemblies under `Assets/_UOMD/Scripts/`, scenes, and `StreamingAssets/uomd_base` sync state).
- **`unity_bundle_status`**: Verifies `apps/unity/Assets/StreamingAssets/uomd_base/unity_export_manifest.json` and `UomdCorePrimitives.g.cs` against `content/base/release_manifest.json`.
- **`unity_inspect_unit_slices`**: Returns the 16-cell (`4×4`) chibi slice specs, top-left vs Unity bottom-left normalized foot pivots (`unity_pivot: { x, y }`), and asset paths for any character or enemy.
- **`unity_skills_search` & `unity_skill_read`**: Searches and reads the canonical Unity 6 LTS and UOMD engine skills in `.claude/skills/`.

## 2. Google AI Ultra Ecosystem Bridge (`uomd-ai-ultra` MCP)

Implemented in [`tools/mcp_ai_ultra_bridge.ts`](../../../tools/mcp_ai_ultra_bridge.ts). All tools generate deterministic local bundles in `.cache/ai-ultra/` and **never spend cloud credits automatically without explicit user confirmation**.

| Google AI Ultra Tool | UOMD Unity 6 Integration Role | MCP Tool / Command |
| :--- | :--- | :--- |
| **Google Flow** (`labs.google/fx/tools/flow` — Veo 3.1 + Imagen 4) | 1080p watermark-free cinematics using **Ingredients** (locked character/environment art) and **First/Last Frame** transitions (`PrologueStageController` `VideoPlayer` `video_id`, 5★ `First Oath` summon ritual, `Hollow Bell` boss phase cut-ins). | `ai_ultra_export_flow_storyboard` |
| **Project Genie** (`labs.google` — DeepMind Genie 3 World Model) | Interactive 720p@24fps 2.5D world exploration from our 16:9 background plates (`bg_forest_whispering_ash`, `bg_bell_tower_interior`, `Endless Corridor`) to extract multi-plane parallax layers (`fg`, `mid`, `bg`) for URP 2D sorting layers. | `ai_ultra_prepare_genie_world_seed` |
| **Gemini Notebook / NotebookLM Plus** (`notebooklm.google`) | 500-source zero-hallucination RAG over all `narrative/*.md`, `CHARACTER_BIBLE.md`, `VOICE_CASTING.md`, `BATTLE_SYSTEM.md`, and `prologue.json`. | `ai_ultra_export_notebooklm_bundle` |
| **Google Whisk & Whisk Animate** (`labs.google/fx/tools/whisk`) | Locks `Subject` (character) + `Scene` (background) + `Style` (dark gothic anime brushwork) and generates reference loops for `Sanctum` (`Home`) and `CharacterDetail` screens. | `ai_ultra_prepare_whisk_recipe` |
| **Lyria (MusicFX DJ) & Chirp 3 HD** | Adaptive dark gothic chamber loops (`bgm_*`) and 20-character voice acting (`voices/*.ogg`) governed by `narrative/VOICE_CASTING.md` and exported to `StreamingAssets/uomd_base/`. | `google-anime-media` + `tools/media_generate.ts` |
