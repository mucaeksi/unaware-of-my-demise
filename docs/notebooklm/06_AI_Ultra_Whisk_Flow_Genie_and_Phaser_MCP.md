# 06 — Google AI Ultra Ecosystem Integration (NotebookLM Plus, Whisk, Flow, Project Genie) & Phaser 4 Live MCP

## 1. Overview of Active MCP Servers & Workflows
1. **`uomd-phaser-live` (`tools/mcp_phaser_live.ts`):**
   - Automatically syncs `content/base` into `apps/game/public/content/base`, boots a headless Chromium viewport at `1920x1080` against the Vite dev server, jumps directly to any Phaser 4 scene (`Splash`, `Studio`, `Title`, `Prologue`, `Story`, `Battle`, `Finish`, `Home`), captures live PNG screenshots, and returns scene state + console/page error diagnostics.
2. **`uomd-ai-ultra` (`tools/mcp_ai_ultra_bridge.ts`):**
   - `ai_ultra_export_notebooklm_bundle`: Builds and syncs this 6-part NotebookLM Plus Knowledge Hub in `docs/notebooklm/` and `UOMD_NotebookLM_Hub`.
   - `ai_ultra_export_flow_storyboard`: Generates 1080p Veo 3.1 storyboard JSON packages for Google Flow (`prologue`, `first_oath_summon`, `boss_cutin`) using our approved 16:9 stills as First/Last keyframes.
   - `ai_ultra_prepare_genie_world_seed`: Exports spatial world prompts and reference plates for DeepMind Project Genie (`Genie 3`) to extract multi-plane parallax layers.
   - `ai_ultra_prepare_whisk_recipe`: Prepares Subject + Scene + Style lock recipes for Google Whisk and Whisk Animate.

## 2. How to Use This Hub in NotebookLM Plus (`notebooklm.google`)
1. Open **NotebookLM Plus** (`https://notebooklm.google`) and create a notebook named **`Unaware of My Demise — Master Hub`**.
2. Click **Add Source $\rightarrow$ Google Drive** and select the 6 Markdown files inside **`Drive'ım / UOMD_NotebookLM_Hub`** (or upload from `docs/notebooklm/`).
3. Whenever you run `npx tsx tools/build_notebooklm_hub.ts`, both `docs/notebooklm/` and `Drive'ım / UOMD_NotebookLM_Hub` are updated automatically.
