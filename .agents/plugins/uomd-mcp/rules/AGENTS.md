# UOMD MCP servers (plugin `uomd-mcp`)

This plugin starts the project MCP servers for Antigravity; they are the same servers and pins as `.mcp.json` (Claude Code)
and `.codex/config.toml` (Codex).

- `unityMCP` — MCP for Unity v10.3.0, drives the **open Unity Editor** (`apps/unity`). Read
  `mcpforunity://editor/state` first, then follow `.claude/skills/unity-mcp-orchestrator/UOMD-NOTE.md`. Use it to see what
  your change does: `read_console` after every recompile, `manage_camera` screenshots of the Game view, `run_tests` for
  EditMode. In the Editor: Window → MCP for Unity → Transport **stdio**. Do not press the package's "Antigravity" Configure
  button: it writes a second `unityMCP` entry into the global config.
- `uomd-unity-live` — static project/skill inspection without the Editor.
- `graphify` — code graph; build `graphify-out/graph.json` first with `bash tools/build_graph.sh`.
- `chrome-devtools` — headless Chrome for the Control Center (`apps/admin`) and web evidence.

Only one agent host (Antigravity, Claude Code or Codex) should drive the Editor at a time. If these servers are missing
from Additional Options (...) → MCP Servers, run `python tools/setup_antigravity.py --install-global` and restart Antigravity.
