#!/usr/bin/env bash
# Headless C# compile + test for the engine-free Unity assemblies (no Unity editor or licence needed).
# Usage: bash apps/unity/cloud/logic_test.sh            # build + run EditMode parity tests
#        bash apps/unity/cloud/logic_test.sh --build    # compile only
# Builds apps/unity/Logic/Uomd.Logic.sln, which links the real Assets/ sources under Unity's limits (C# 9, .NET Standard 2.1).
# It does not replace the real Unity compile (unity_ci.sh import): UnityEngine-dependent files are only compiled there.
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
LOGIC="$ROOT/apps/unity/Logic"
DOTNET_VERSION="10.0.402"   # keep in step with Logic/global.json (rollForward: latestFeature)
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
# Persistent MSBuild nodes keep the output pipe open and hang callers that read it.
export MSBUILDDISABLENODEREUSE=1

ensure_dotnet() {
  if command -v dotnet >/dev/null 2>&1 && dotnet --list-sdks | grep -q '^10\.'; then return 0; fi
  export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}" PATH="$HOME/.dotnet:$PATH"
  if [ -x "$HOME/.dotnet/dotnet" ] && "$HOME/.dotnet/dotnet" --list-sdks | grep -q '^10\.'; then return 0; fi
  echo "Installing .NET SDK $DOTNET_VERSION into ~/.dotnet (official dotnet-install.sh)"
  local installer
  installer="$(mktemp)"
  curl -fsSL --retry 3 -o "$installer" https://dot.net/v1/dotnet-install.sh
  bash "$installer" --version "$DOTNET_VERSION" --install-dir "$HOME/.dotnet" >/dev/null
  rm -f "$installer"
}

ensure_dotnet
[ -x "$HOME/.dotnet/dotnet" ] && export PATH="$HOME/.dotnet:$PATH"

# BaseBundleWasExported reads StreamingAssets/uomd_base (git-ignored, produced by the exporter).
if [ ! -f "$ROOT/apps/unity/Assets/StreamingAssets/uomd_base/release.json" ]; then
  (cd "$ROOT" && npm run --silent export:unity >/dev/null)
fi

dotnet build "$LOGIC/Uomd.Logic.sln" -c Release -nodeReuse:false -warnaserror:CS8600,CS8602,CS8603 --nologo -v quiet
[ "${1:-}" = "--build" ] && exit 0
dotnet test "$LOGIC/Uomd.Logic.sln" -c Release --no-build -nodeReuse:false --nologo
