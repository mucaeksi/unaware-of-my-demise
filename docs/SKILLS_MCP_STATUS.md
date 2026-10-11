# Skills and MCP verification (2026-10-10, Claude Code cloud session)

Real calls were made in this environment; "files exist" was not accepted as proof.

| Tool | Result | Evidence / action |
|---|---|---|
| **Graphify** (MCP `graphify`, pinned `graphifyy==0.9.84`) | **Operational** | `graphify update` built a graph (`graph_stats`, `god_nodes` answered via `project_path`). The default server path `graphify-out/graph.json` does not exist until a graph is built at the repo root: run `uv run --no-project --with "graphifyy[mcp]==0.9.84" graphify update apps packages tools`. Code graph only; semantic doc extraction needs an LLM/API key (not run). |
| **Ponytail** (skill, `ponytail*`) | Loaded (prompt-only skill) | Listed and invokable; no hooks installed. Used as the review/scope guide. |
| **Official Phaser 4 skills** (28) | Present and applied | Phaser 4.2.1 installed from npm; v4 APIs verified against `node_modules/phaser/types` (e.g. `Point` removed, `setTintFill` removed → `setTintMode`). |
| **UI/UX Pro Max** | **Operational** | `search.py --design-system` ran; its generic output (glassmorphism) was overridden by the gothic tokens in `apps/game/src/ui/theme.ts`; its checklist (contrast, focus-visible, reduced motion, touch targets) was applied. |
| **Chrome DevTools MCP** (`chrome-devtools-mcp@1.10.1`) | **Fixed, operational after restart** | Original config failed (no `/opt/google/chrome`, running as root). `tools/mcp_chrome_devtools.sh` resolves Playwright's Chromium and adds root-only sandbox flags; verified over stdio JSON-RPC (30 tools, `new_page`, `evaluate_script`). `.mcp.json` now uses the wrapper (takes effect on the next session start). Playwright with the same Chromium is used for e2e. |
| **Context7** | **Removed** (owner decision 2026-10-10) | `.mcp.json` server, skill and ZIP deleted; bootstrap excludes it. |
| **Cloudflare Security Audit** (`security-audit` skill) | Present; applied as a review checklist | Findings recorded in `docs/SECURITY_REVIEW_2026-10-10.md`. |
| **Cloudflare MCP / Developer Platform MCP** | **Operational (OAuth)** | `whoami`, Workers/D1/R2/Hyperdrive/Access listing, D1 and R2 creation worked. |
| **GitHub MCP** | Operational | Workflow runs and logs readable; skills-bootstrap workflow is green (run 7). |
| Gemini API (proxy-injected credential) | Reachable | Model list returned (image, Lyria 3.5, Veo 3.1 Lite). **No paid generation was performed** (no approved budget yet). |
| Skills bootstrap CI | **Green** | Runs 5 and 7 succeeded; `python tools/skills_doctor.py` → PASS (46 skill files after the 2026-10-10 removals). |
