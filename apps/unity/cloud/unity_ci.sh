#!/usr/bin/env bash
# Batch pipeline for the UOMD Unity client. Usage: bash apps/unity/cloud/unity_ci.sh [import|test|build|capture|all|return-license]
#   import : export content bundle + first import/compile + UomdProjectSetup (URP 2D, Android player settings)
#   test   : EditMode tests (C# parity vs TypeScript golden vectors)
#   build  : Android AAB (UOMD_BUILD_APK=1 for APK; UOMD_KEYSTORE_* for release signing)
#   capture: Linux player under Xvfb visits every screen and saves PNGs (node tools/publish_unity_screens.mjs publishes them);
#            UOMD_CAPTURE_TIMEOUT (seconds, default 900) stops a player that hangs
# Licence: UNITY_EMAIL + UNITY_PASSWORD (Unity Personal, activated here by the Licensing Client), or UNITY_SERIAL (Pro/Plus),
# or a legacy .ulf as UNITY_LICENSE_B64 / UNITY_LICENSE.
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
  # Unity Personal on a headless machine: the Licensing Client signs in and activates the free edition here
  # (an entitlement copied from another PC is bound to that machine and is rejected).
  local client="$(dirname "$UNITY")/Data/Resources/Licensing/Client/Unity.Licensing.Client"
  if [ -n "${UNITY_EMAIL:-}" ] && [ -n "${UNITY_PASSWORD:-}" ] && [ -z "${UNITY_SERIAL:-}" ] && [ -x "$client" ]; then
    "$client" --activate-all --include-personal --username "$UNITY_EMAIL" --password "$UNITY_PASSWORD" > "$LOGS/activate.log" 2>&1 || {
      echo "Unity Personal activation failed; see $LOGS/activate.log (two-factor sign-in cannot be used headless)"; exit 3; }
    return 0
  fi
  # Unity Personal: the .ulf written by Unity Hub on the owner's machine (GameCI's documented CI route).
  # UNITY_LICENSE_B64 = base64 of the file (one line, safe for .env editors); UNITY_LICENSE = the raw XML.
  if [ -n "${UNITY_LICENSE_B64:-}" ] || [ -n "${UNITY_LICENSE:-}" ]; then
    local ulf="$HOME/.local/share/unity3d/Unity/Unity_lic.ulf"
    mkdir -p "$(dirname "$ulf")"
    if [ -n "${UNITY_LICENSE_B64:-}" ]; then printf '%s' "$UNITY_LICENSE_B64" | base64 -d > "$ulf"; else printf '%s' "$UNITY_LICENSE" > "$ulf"; fi
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

use_maven_retry_proxy() {
  # Cloud sessions share an egress IP that Maven Central rate-limits (429 and fake 404s); Gradle would cache those as
  # "not found". maven_retry_proxy.py fetches from the same official hosts with backoff and a disk cache.
  # UOMD_MAVEN_PROXY=off disables it (for example on a machine with its own Maven mirror).
  [ "${UOMD_MAVEN_PROXY:-}" = off ] && { unset UOMD_MAVEN_PROXY; return 0; }
  local port="${UOMD_MAVEN_PROXY_PORT:-8765}" gradle_home="${GRADLE_USER_HOME:-$HOME/.gradle}"
  if ! curl -s -o /dev/null "http://127.0.0.1:$port/"; then
    python3 "$ROOT/apps/unity/cloud/maven_retry_proxy.py" --port "$port" > "$LOGS/maven-proxy.log" 2>&1 &
    local pid=$!
    trap "kill $pid 2>/dev/null || true" EXIT
    for _ in $(seq 1 20); do curl -s -o /dev/null "http://127.0.0.1:$port/" && break; sleep 0.25; done
  fi
  mkdir -p "$gradle_home/init.d"
  cp "$ROOT/apps/unity/cloud/maven-retry-proxy.init.gradle" "$gradle_home/init.d/uomd-maven-retry-proxy.gradle"
  export UOMD_MAVEN_PROXY="http://127.0.0.1:$port"
}

mirror_java_network_settings() {
  # Unity starts the Gradle daemon with only -Xmx, so JAVA_TOOL_OPTIONS (the session's trust store and HTTPS proxy) never
  # reaches it and TLS through the egress proxy fails (PKIX). Mirror those -D flags into Gradle as systemProp entries,
  # rewritten on every build because the proxy port can change between sessions.
  local props="${GRADLE_USER_HOME:-$HOME/.gradle}/gradle.properties" begin="# >>> uomd unity_ci.sh (generated)" end="# <<< uomd unity_ci.sh"
  mkdir -p "$(dirname "$props")"; touch "$props"
  sed -i "/^$begin\$/,/^$end\$/d" "$props"
  [ -n "${JAVA_TOOL_OPTIONS:-}" ] || return 0
  {
    echo "$begin"
    for flag in $JAVA_TOOL_OPTIONS; do
      case "$flag" in
        -Djavax.net.ssl.trustStore=*|-Djavax.net.ssl.trustStoreType=*|-Djavax.net.ssl.trustStorePassword=*|-Dhttps.proxyHost=*|-Dhttps.proxyPort=*|-Dhttp.nonProxyHosts=*)
          echo "systemProp.${flag#-D}" ;;
      esac
    done
    echo "$end"
  } >> "$props"
}

do_build() {
  use_maven_retry_proxy
  mirror_java_network_settings
  # A Gradle daemon left from an earlier build keeps the proxy port and CA it started with; after the session's proxy
  # restarts that daemon fails TLS (PKIX). Start every build with fresh daemons.
  pkill -f '[G]radleDaemon' 2>/dev/null || true
  run_unity build -buildTarget Android -executeMethod Uomd.EditorTools.UomdBuild.BuildAndroidBatch
  echo "Build OK. Record it for the Control Center with: node tools/record_unity_build.mjs"
}

do_capture() {
  local out="${UOMD_CAPTURE_DIR:-$PROJECT/Builds/Capture}"
  run_unity capture-build -buildTarget StandaloneLinux64 -executeMethod Uomd.EditorTools.UomdBuild.BuildLinuxCaptureBatch
  rm -rf "$out"
  # Software OpenGL under a virtual 1920x1080 display; the player quits by itself after the last screen.
  timeout "${UOMD_CAPTURE_TIMEOUT:-900}" xvfb-run -a -s "-screen 0 1920x1080x24" "$PROJECT/Builds/LinuxCapture/uomd.x86_64" -force-glcore -screen-width 1920 -screen-height 1080 \
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
