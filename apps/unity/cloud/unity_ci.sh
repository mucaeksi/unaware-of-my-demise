#!/usr/bin/env bash
# Batch pipeline for the UOMD Unity client. Usage: bash apps/unity/cloud/unity_ci.sh [import|test|build|all]
#   import : export content bundle + first import/compile + UomdProjectSetup (URP 2D, Android player settings)
#   test   : EditMode tests (C# parity vs TypeScript golden vectors)
#   build  : Android AAB (UOMD_BUILD_APK=1 for APK; UOMD_KEYSTORE_* for release signing)
set -euo pipefail

STEP="${1:-all}"
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
PROJECT="$ROOT/apps/unity"
UNITY_VERSION="$(sed -n 's/^m_EditorVersion: //p' "$PROJECT/ProjectSettings/ProjectVersion.txt" | tr -d '\r')"
UNITY="${UNITY_PATH:-$HOME/Unity/Hub/Editor/$UNITY_VERSION/Editor/Unity}"
LOGS="$PROJECT/Logs/ci"
mkdir -p "$LOGS"

[ -x "$UNITY" ] || { echo "Unity $UNITY_VERSION not found at $UNITY (set UNITY_PATH)"; exit 2; }

run_unity() { # $1 = log name, rest = unity args
  local log="$LOGS/$1.log"; shift
  set +e
  "$UNITY" -batchmode -nographics -projectPath "$PROJECT" -logFile "$log" "$@"
  local code=$?
  set -e
  grep -E "error CS[0-9]+|Scripts have compiler errors|BuildFailedException|Exception:" "$log" | sort -u | head -n 80 || true
  return $code
}

do_import() {
  (cd "$ROOT" && { [ -d node_modules ] || npm ci; } && npm run export:unity)
  run_unity import -executeMethod Uomd.EditorTools.UomdProjectSetup.ApplyBatch
  echo "Import OK. Commit the generated .meta files, ProjectSettings/*.asset, Packages/packages-lock.json and Assets/_UOMD/Settings."
}

do_test() {
  run_unity test -runTests -testPlatform EditMode -testResults "$LOGS/editmode-results.xml"
  echo "EditMode results: $LOGS/editmode-results.xml"
}

do_build() {
  run_unity build -buildTarget Android -executeMethod Uomd.EditorTools.UomdBuild.BuildAndroidBatch
}

case "$STEP" in
  import) do_import ;;
  test) do_test ;;
  build) do_build ;;
  all) do_import; do_test; do_build ;;
  *) echo "unknown step: $STEP"; exit 2 ;;
esac
