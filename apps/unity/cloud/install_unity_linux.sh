#!/usr/bin/env bash
# Installs the pinned Unity editor + Android Build Support on Linux WITHOUT Unity Hub (cloud containers, CI).
# Usage: bash apps/unity/cloud/install_unity_linux.sh [--no-android]
# Result: $UNITY_ROOT/<version>/Editor/Unity (default UNITY_ROOT=~/Unity/Editors). Idempotent: finished steps are skipped.
# Download URLs come from Unity's public release API for the version in ProjectSettings/ProjectVersion.txt.
# No licence is needed to install; batchmode use needs one (see apps/unity/cloud/README.md and unity_ci.sh).
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
VERSION="$(sed -n 's/^m_EditorVersion: //p' "$ROOT/apps/unity/ProjectSettings/ProjectVersion.txt" | tr -d '\r')"
DEST="${UNITY_ROOT:-$HOME/Unity/Editors}/$VERSION"
EDITOR="$DEST/Editor"
ANDROID="$EDITOR/Data/PlaybackEngines/AndroidPlayer"
WANT_ANDROID=1; [ "${1:-}" = "--no-android" ] && WANT_ANDROID=0

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing tool: $1 (apt-get install -y libarchive-tools cpio unzip xvfb)"; exit 2; }; }
need curl; need tar; need unzip; need python3
[ "$WANT_ANDROID" = 1 ] && { need bsdtar; need cpio; }

RELEASE_JSON="$(curl -fsSL "https://services.api.unity.com/unity/editor/release/v1/releases?version=${VERSION}&platform=LINUX&architecture=X86_64")"
module_url() { # $1 = module id (top level or nested)
  python3 -c '
import json, sys
mods = json.loads(sys.argv[1])["results"][0]["downloads"][0].get("modules", [])
def find(ms):
    for m in ms:
        if m["id"] == sys.argv[2]: return m["url"]
        r = find(m.get("subModules", []))
        if r: return r
print(find(mods) or "")' "$RELEASE_JSON" "$1"
}
EDITOR_URL="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["results"][0]["downloads"][0]["url"])' "$RELEASE_JSON")"

fetch() { curl -fL --retry 3 --retry-delay 5 -sS "$1"; }

if [ ! -x "$EDITOR/Unity" ]; then
  echo "Installing Unity $VERSION editor into $DEST"
  mkdir -p "$DEST"
  fetch "$EDITOR_URL" | tar -xJ -C "$DEST"
fi
echo "editor: $EDITOR/Unity"
[ "$WANT_ANDROID" = 1 ] || exit 0

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

if [ ! -f "$ANDROID/.uomd-module" ]; then
  echo "Installing Android Build Support"
  mkdir -p "$ANDROID"
  fetch "$(module_url android)" > "$TMP/android.pkg"
  # The module ships as a xar .pkg whose Payload is a gzip cpio archive (the same file Unity Hub unpacks on Linux).
  (cd "$TMP" && bsdtar -xf android.pkg)
  payload="$(find "$TMP" -name Payload -type f | head -n1)"
  (cd "$ANDROID" && gzip -dc "$payload" | cpio -idm --quiet)
  # Some payloads nest the files one level deeper.
  if [ ! -d "$ANDROID/Variations" ] && [ -d "$ANDROID/AndroidPlayer" ]; then cp -a "$ANDROID/AndroidPlayer/." "$ANDROID/" && rm -rf "$ANDROID/AndroidPlayer"; fi
  rm -rf "$TMP"/*; touch "$ANDROID/.uomd-module"
fi

if [ ! -x "$ANDROID/OpenJDK/bin/java" ]; then
  echo "Installing Unity OpenJDK"
  mkdir -p "$ANDROID/OpenJDK"
  fetch "$(module_url android-open-jdk-17.0.9+9)" > "$TMP/jdk"
  if unzip -tq "$TMP/jdk" >/dev/null 2>&1; then unzip -q "$TMP/jdk" -d "$ANDROID/OpenJDK"; else tar -xf "$TMP/jdk" -C "$ANDROID/OpenJDK"; fi
  rm -f "$TMP/jdk"
fi

SDK="$ANDROID/SDK"
if [ ! -x "$SDK/cmdline-tools/16.0/bin/sdkmanager" ]; then
  echo "Installing Android SDK command-line tools"
  mkdir -p "$SDK/cmdline-tools"
  fetch "$(module_url android-sdk-command-line-tools-16.0)" > "$TMP/clt.zip"
  unzip -q "$TMP/clt.zip" -d "$TMP/clt" && rm -rf "$SDK/cmdline-tools/16.0" && mv "$TMP/clt/cmdline-tools" "$SDK/cmdline-tools/16.0"
  rm -rf "$TMP/clt" "$TMP/clt.zip"
fi

if [ ! -d "$ANDROID/NDK/toolchains" ]; then
  echo "Installing Android NDK r27c"
  fetch "$(module_url android-ndk-r27c)" > "$TMP/ndk.zip"
  unzip -q "$TMP/ndk.zip" -d "$TMP/ndk" && rm -rf "$ANDROID/NDK" && mv "$TMP"/ndk/android-ndk-* "$ANDROID/NDK"
  rm -rf "$TMP/ndk" "$TMP/ndk.zip"
fi

# Platforms/build-tools match the Unity module list; API 35 is needed by Billing 8 / Credential Manager / Ads 24.
export JAVA_HOME="$ANDROID/OpenJDK"
yes | "$SDK/cmdline-tools/16.0/bin/sdkmanager" --sdk_root="$SDK" --licenses >/dev/null 2>&1 || true
"$SDK/cmdline-tools/16.0/bin/sdkmanager" --sdk_root="$SDK" "platform-tools" "platforms;android-35" "platforms;android-36" "build-tools;34.0.0" "build-tools;35.0.0" "cmake;3.22.1" >/dev/null
echo "android: $ANDROID (SDK, NDK r27c, OpenJDK 17)"
