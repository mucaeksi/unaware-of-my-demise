# Skills and MCP verification (Updated 2026-10-24 for Decision D-31)

> **Owner Decision D-31 (2026-10-24):** All project engineering, **Unity 6 LTS (`apps/unity/`, C#, URP 2D)** migration ([CLAUDE_OPUS_UNITY_HANDOFF](handoff/CLAUDE_OPUS_UNITY_HANDOFF.md)), and **Google Gemini API** asset production belong exclusively to **Claude Opus 5.5** (`claude-opus-5-5` / Claude Code). All 121 skills in `.claude/skills/` and 58 adapters in `.agents/skills/` pass `skills_doctor.py`, `sync_codex_skills.py --check`, and `install_ecc.py --check`. Historical D-23/D-25 web-stage skills and `uomd-unity-live` remain pinned only for lockfile integrity and legacy `apps/game` oracle inspection during Phases U-1..U-5.

## 2026-10-22, Claude Code cloud session (Linux, Node 22.22, commit `ac186f9`)

Real calls, not file presence. Cloud sessions now run [.claude/hooks/session-start.sh](../.claude/hooks/session-start.sh) (registered in `.claude/settings.json`, active only when `CLAUDE_CODE_REMOTE=true`; a no-op on the owner's machine): `npm install` from the pinned lockfile (falls back to `npm ci` and restores the lockfile if npm would rewrite it), pre-fetches the pinned Graphify package and builds `graphify-out/graph.json` if missing. It never deploys or pushes.

| Check | Result |
| --- | --- |
| Skills | 44/44 `.claude/skills/*/SKILL.md` match `.claude/skills-lock.json`; all six pinned ZIPs match their sha256; `bootstrap_skills.py --verify`, `skills_doctor.py` and `install_unity6_skills.py --check` (26 skills = unity-urp-2d 8.22.0) PASS. |
| Codex adapters | `sync_codex_skills.py --check` failed: `a61f1aa` changed the `cloudflare-d1-liveops` adapter without regenerating `.agents/skills-lock.json`. Regenerated; the check passes. |
| `npm run verify` | PASS on a clean Linux clone in about 9 minutes (1,090 tests, content check reproduces 172 files exactly). |
| e2e | `game.spec.ts --project landscape-desktop` 2/2 PASS against the local workerd/D1/R2 stack with the preinstalled Playwright Chromium 1194. |
| `uomd-unity-live` MCP | Failed at session start because `node_modules` did not exist yet (the hook fixes this); after `npm ci` it answers `initialize` and lists its 4 tools over stdio. |
| Graphify MCP | `tools/build_graph.sh`: 4,920 nodes / 13,930 edges / 202 communities in 26 s; `graph_stats` and `query_graph` answered, graph built at HEAD. |
| Chrome DevTools MCP | `new_page` + `evaluate_script` on an isolated data: page; Chrome 141 with WebGL. |
| Proxy services | Gemini model list HTTP 200 (no paid call); Cloudflare account token active, Workers list readable (`uomd-game/admin/ops-staging`). |
| Staging | `/api/v1/health` reports `version.tag` `ac186f9f4ce1` with `world_map_v1`: the failing game Workers Build in the 2026-10-21 handoff (§1.1) is resolved. |

## 2026-10-10, Claude Code cloud session

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
