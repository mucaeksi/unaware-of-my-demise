#!/usr/bin/env bash
# Builds the UomdNative Android plugin (Godot Android plugin v2) and copies the AARs into the export addon
# (game/addons/uomd_native/bin, not committed: the Android export builds them first).
# Needs JAVA_HOME (JDK 17), ANDROID_HOME (SDK with platform 36) and Gradle 8.11.1 on PATH (CI: gradle/actions/setup-gradle).
set -euo pipefail
game_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin_dir="${game_dir}/android/plugins/uomd_native"
: "${JAVA_HOME:?set JAVA_HOME to a JDK 17}"
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"
(cd "${plugin_dir}" && gradle --no-daemon assembleDebug assembleRelease)
mkdir -p "${game_dir}/addons/uomd_native/bin/debug" "${game_dir}/addons/uomd_native/bin/release"
cp "${plugin_dir}/build/outputs/aar/uomd_native-debug.aar" "${game_dir}/addons/uomd_native/bin/debug/"
cp "${plugin_dir}/build/outputs/aar/uomd_native-release.aar" "${game_dir}/addons/uomd_native/bin/release/"
echo "UomdNative AARs updated in ${game_dir}/addons/uomd_native/bin"
