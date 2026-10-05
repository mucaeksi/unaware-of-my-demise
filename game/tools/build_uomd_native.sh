#!/usr/bin/env bash
# Builds the UomdNative Android plugin (Godot Android plugin v2) and copies the AARs into the export addon
# (game/addons/uomd_native/bin, not committed: the Android export builds them first).
# Needs JAVA_HOME (JDK 17), ANDROID_HOME (SDK with platform 36) and Gradle 8.11.1 on PATH (CI: gradle/actions/setup-gradle).
set -euo pipefail
game_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin_dir="${game_dir}/android/plugins/uomd_native"
: "${JAVA_HOME:?set JAVA_HOME to a JDK 17}"
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"
# The AdMob app id (INF-036, owner decision D-18) is public; until the owner's AdMob app exists, Google's published sample
# app id, which only ever serves test ads. Generated, never committed (src/main/res/values/uomd_admob.xml is ignored).
admob_app_id="${ADMOB_APP_ID:-ca-app-pub-3940256099942544~3347511713}"
[[ "${admob_app_id}" =~ ^ca-app-pub-[0-9]{16}~[0-9]{10}$ ]] || { echo "ADMOB_APP_ID must look like ca-app-pub-0000000000000000~0000000000" >&2; exit 2; }
mkdir -p "${plugin_dir}/src/main/res/values"
cat > "${plugin_dir}/src/main/res/values/uomd_admob.xml" <<XML
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="uomd_admob_app_id" translatable="false">${admob_app_id}</string>
</resources>
XML
(cd "${plugin_dir}" && gradle --no-daemon assembleDebug assembleRelease)
mkdir -p "${game_dir}/addons/uomd_native/bin/debug" "${game_dir}/addons/uomd_native/bin/release"
cp "${plugin_dir}/build/outputs/aar/uomd_native-debug.aar" "${game_dir}/addons/uomd_native/bin/debug/"
cp "${plugin_dir}/build/outputs/aar/uomd_native-release.aar" "${game_dir}/addons/uomd_native/bin/release/"
echo "UomdNative AARs updated in ${game_dir}/addons/uomd_native/bin"
