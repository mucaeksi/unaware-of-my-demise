---
name: uomd-ai-ultra-studio
description: Orchestrate PixiJS v8 + DOM UI live visual inspection (`uomd-pixi-live` MCP) and Google AI Ultra creative/research tools (`uomd-ai-ultra` MCP: Google Flow / Veo 3.1, Project Genie / Genie 3, Gemini Notebook / NotebookLM Plus, Whisk Animate, Lyria, Chirp 3 HD) for Unaware of My Demise without unauthorized credit spend.
---

# UOMD Live Engine MCP & Google AI Ultra Studio Integration

Use this skill whenever inspecting live PixiJS v8 + DOM UI scene changes or preparing/integrating **Google AI Ultra** workflows (**Google Flow**, **Project Genie**, **Gemini Notebook / NotebookLM Plus**, **Whisk Animate**, **Veo 3.1**, **Lyria**, **Chirp 3 HD**) for *Unaware of My Demise*.

## 1. Live PixiJS v8 + DOM UI Inspection (`uomd-pixi-live` MCP)

Implemented in [`tools/mcp_pixi_live.ts`](../../../tools/mcp_pixi_live.ts) and registered in `~/.gemini/config/mcp_config.json`.

- **`pixi_inspect_scene`**: Launches the `@uomd/game` Vite server and headless Chromium (1920×1080), waits for `Services.ready()`, jumps to any scene (`Splash`, `Studio`, `Title`, `Prologue`, `Story`, `Battle`, `Home`, `Summon`, `Roster`, `Character`, `Team`, `Gear`, `Chapters`, `Modes`), optionally clicks `(tapX, tapY)`, dumps the live PixiJS v8 display list (`scene.children.list`) and `#uomd-ui-layer` DOM elements, reports console/WebGL errors, and saves a 1920×1080 PNG screenshot in `.cache/mcp-pixi-shots/`.
- **`pixi_search_docs` & `pixi_get_skill_doc`**: Searches and reads the 6 canonical project engine skills in `.claude/skills/`.
- **`pixi_list_game_assets`**: Lists all compiled and approved assets in `content/base/art/art_manifest.json` and `content/approved_art/`.

Always view the captured screenshot (`view_file`) after modifying UI, layout, typography, or animations so visual regressions are caught immediately.

## 2. Google AI Ultra Ecosystem Bridge (`uomd-ai-ultra` MCP)

Implemented in [`tools/mcp_ai_ultra_bridge.ts`](../../../tools/mcp_ai_ultra_bridge.ts). All tools generate deterministic local bundles in `.cache/ai-ultra/` and **never spend cloud credits automatically without explicit user confirmation**.

| Google AI Ultra Tool | UOMD Integration Role | MCP Tool / Command |
| :--- | :--- | :--- |
| **Google Flow** (`labs.google/fx/tools/flow` — Veo 3.1 + Imagen 4) | 1080p watermark-free cinematics using **Ingredients** (locked character/environment art) and **First/Last Frame** transitions (`PrologueScene` `video_id`, 5★ `First Oath` summon ritual, `Hollow Bell` boss phase cut-ins). Optional browser MCP: `npx -y google-flow-browser-mcp`. | `ai_ultra_export_flow_storyboard` |
| **Project Genie** (`labs.google` — DeepMind Genie 3 World Model) | Interactive 720p@24fps 3D/2.5D world exploration from our 16:9 background plates (`bg_forest_whispering_ash`, `bg_bell_tower_interior`, `Endless Corridor`) to extract multi-plane parallax layers (`fg`, `mid`, `bg`) and camera walk reference clips. | `ai_ultra_prepare_genie_world_seed` |
| **Gemini Notebook / NotebookLM Plus** (`notebooklm.google`) | 500-source zero-hallucination RAG over all `narrative/*.md`, `CHARACTER_BIBLE.md`, `VOICE_CASTING.md`, `BATTLE_SYSTEM.md`, and `prologue.json`. Optional MCP: `npx -y notebooklm-mcp`. | `ai_ultra_export_notebooklm_bundle` |
| **Google Whisk & Whisk Animate** (`labs.google/fx/tools/whisk`) | Locks `Subject` (character) + `Scene` (background) + `Style` (dark gothic anime brushwork) and generates 4-second seamless idle breathing/cloak-wind loops for `HomeScene` (`Sanctum`) and `CharacterScene`. | `ai_ultra_prepare_whisk_recipe` |
| **Lyria (MusicFX DJ) & Chirp 3 HD** | Adaptive dark gothic chamber loops (`bgm_*`) and 20-character voice acting (`voice/*.ogg`) governed by `narrative/VOICE_CASTING.md`. | `google-anime-media` + `tools/media_generate.ts` |
