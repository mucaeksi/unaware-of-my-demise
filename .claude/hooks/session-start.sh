#!/bin/bash
# Claude Code cloud sessions only: install the pinned workspace dependencies so `npm run verify`, the e2e stack and
# the project MCPs in .mcp.json (uomd-unity-live needs node_modules/tsx, graphify needs its uv package) work at start.
# Idempotent; the container is cached after this hook, so later starts only re-check. Never deploys or pushes.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# package-lock.json is the source of truth (.npmrc: engine-strict, legacy-peer-deps). `npm install` reuses the
# cached node_modules; fall back to a clean install if it would rewrite the lockfile.
lock_backup=$(mktemp)
trap 'rm -f "$lock_backup"' EXIT
cp package-lock.json "$lock_backup"
npm install --no-audit --no-fund --loglevel=error
if ! cmp -s package-lock.json "$lock_backup"; then
  cp "$lock_backup" package-lock.json
  npm ci --no-audit --no-fund --loglevel=error
fi

# Pre-fetch the pinned Graphify package used by the graphify MCP and tools/build_graph.sh.
if command -v uv >/dev/null 2>&1; then
  uv run --no-project --with 'graphifyy[mcp,sql]==0.9.84' python -c 'import graphify' >/dev/null 2>&1 || true
  # The graphify MCP serves graphify-out/graph.json (git-ignored). Build it once (~30 s, no LLM calls); refresh it
  # yourself with tools/build_graph.sh after source changes.
  if [ ! -f graphify-out/graph.json ]; then
    bash tools/build_graph.sh >/dev/null 2>&1 || echo "session-start: graphify index build failed (non-fatal)" >&2
  fi
fi

# Playwright uses the preinstalled Chromium (PLAYWRIGHT_BROWSERS_PATH); never download browsers here.
echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1' >> "${CLAUDE_ENV_FILE:-/dev/null}"
