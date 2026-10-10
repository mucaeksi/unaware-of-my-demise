#!/usr/bin/env bash
# Launches the pinned Chrome DevTools MCP against a locally installed Chromium/Chrome.
# Cloud containers run as root and ship Playwright's Chromium instead of /opt/google/chrome,
# so resolve the executable and add the root-only sandbox flags there (never on a normal user).
set -euo pipefail
exe="${CHROME_PATH:-}"
if [ -z "$exe" ] && [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
  exe="$(ls -d "$PLAYWRIGHT_BROWSERS_PATH"/chromium-*/chrome-linux/chrome 2>/dev/null | sort -V | tail -1 || true)"
fi
args=(--headless --isolated --no-usage-statistics --no-performance-crux)
[ -n "$exe" ] && args+=(--executablePath "$exe")
if [ "$(id -u)" = "0" ]; then
  args+=(--chrome-arg=--no-sandbox --chrome-arg=--disable-setuid-sandbox)
fi
exec npx -y chrome-devtools-mcp@1.10.1 "${args[@]}"
