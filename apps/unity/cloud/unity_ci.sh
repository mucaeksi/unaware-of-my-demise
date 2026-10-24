#!/usr/bin/env bash
# Batch pipeline for the UOMD Unity client. Usage: bash apps/unity/cloud/unity_ci.sh [import|test|build|capture|all|return-license]
#   import : export content bundle + first import/compile + UomdProjectSetup (URP 2D, Android player settings)
#   test   : EditMode tests (C# parity vs TypeScript golden vectors)
#   build  : Android AAB (UOMD_BUILD_APK=1 for APK; UOMD_KEYSTORE_* for release signing)
#   capture: Linux player under Xvfb visits every screen and saves PNGs (apps/unity/cloud/capture_screens.sh publishes them)
# Licence: UNITY_LICENSE (.ulf contents, Unity Personal via Hub) + UNITY_EMAIL/UNITY_PASSWORD, or UNITY_SERIAL (Pro/Plus).
set -euo pipefail

STEP="${1:-all}"
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
PROJECT="$ROOT/apps/unity"
UNITY_VERSION="$(sed -n 's/^m_EditorVersion: //p' "$PROJECT/ProjectSettings/ProjectVersion.txt" | tr -d '\r')"
UNITY="${UNITY_PATH:-}"
for candidate in "$HOME/Unity/Editors/$UNITY_VERSION/Editor/Unity" "$HOME/Unity/Hub/Editor/$UNITY_VERSION/Editor/Unity"; do
  [ -n "$UNITY" ] || { [ -x "$candidate" ] && UNITY="$candidate"; }
done
UNITY="${UNITY:-$HOME/Unity/Editors/$UNITY_VERSION/Editor/Unity}"
LOGS="$PROJECT/Logs/ci"
mkdir -p "$LOGS"

[ -x "$UNITY" ] || { echo "Unity $UNITY_VERSION not found at $UNITY (run apps/unity/cloud/install_unity_linux.sh or set UNITY_PATH)"; exit 2; }

run_unity() { # $1 = log name, rest = unity args
  local log="$LOGS/$1.log"; shift
  set +e
  "$UNITY" -batchmode -nographics -projectPath "$PROJECT" -logFile "$log" "$@"
  local code=$?
  set -e
  grep -E "error CS[0-9]+|Scripts have compiler errors|BuildFailedException|Exception:" "$log" | sort -u | head -n 80 || true
  return $code
}

activate_license() {
  # Unity Personal: the .ulf written by Unity Hub on the owner's machine (GameCI's documented CI route).
  if [ -n "${UNITY_LICENSE:-}" ]; then
    local ulf="$HOME/.local/share/unity3d/Unity/Unity_lic.ulf"
    mkdir -p "$(dirname "$ulf")"
    printf '%s' "$UNITY_LICENSE" > "$ulf"
    chmod 600 "$ulf"
    "$UNITY" -batchmode -quit -nographics -manualLicenseFile "$ulf" -logFile "$LOGS/activate.log" >/dev/null 2>&1 || true
    return 0
  fi
  # Pro/Plus serial from the environment's secrets; no-op when absent (already-activated machine).
  [ -n "${UNITY_SERIAL:-}" ] || return 0
  "$UNITY" -batchmode -quit -nographics -serial "$UNITY_SERIAL" -username "$UNITY_EMAIL" -password "$UNITY_PASSWORD" -logFile "$LOGS/activate.log" || {
    echo "License activation failed; see $LOGS/activate.log"; exit 3; }
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

do_capture() {
  local out="${UOMD_CAPTURE_DIR:-$PROJECT/Builds/Capture}"
  run_unity capture-build -buildTarget StandaloneLinux64 -executeMethod Uomd.EditorTools.UomdBuild.BuildLinuxCaptureBatch
  rm -rf "$out"
  # Software OpenGL under a virtual 1920x1080 display; the player quits by itself after the last screen.
  xvfb-run -a -s "-screen 0 1920x1080x24" "$PROJECT/Builds/LinuxCapture/uomd.x86_64" -force-glcore -screen-width 1920 -screen-height 1080 \
    -screen-fullscreen 0 -logFile "$LOGS/capture-player.log" -uomdCapture "$out"
  echo "Captured: $(wc -l < "$out/capture.txt") screens in $out"
}

[ "$STEP" = return-license ] || activate_license

case "$STEP" in
  return-license) "$UNITY" -batchmode -quit -nographics -returnlicense -username "${UNITY_EMAIL:-}" -password "${UNITY_PASSWORD:-}" -logFile "$LOGS/return.log" ;;
  import) do_import ;;
  test) do_test ;;
  build) do_build ;;
  capture) do_capture ;;
  all) do_import; do_test; do_build ;;
  *) echo "unknown step: $STEP"; exit 2 ;;
esac
