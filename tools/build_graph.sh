#!/usr/bin/env bash
# Free structural code index; excludes canon/media/vendor skills and never calls an LLM.
set -euo pipefail
cd "$(dirname "$0")/.."
uv run --no-project --with 'graphifyy[mcp,sql]==0.9.84' graphify extract . \
  --code-only --no-dedup --max-workers 2 \
  --exclude .claude --exclude .agents --exclude archive --exclude narrative \
  --exclude reference --exclude skill-sources --exclude content --exclude docs
uv run --offline --no-project --with 'graphifyy[mcp,sql]==0.9.84' \
  graphify cluster-only . --no-label --no-viz
