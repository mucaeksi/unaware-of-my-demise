#!/usr/bin/env bash
# Exports the Android debug APK with the pinned Godot and verifies it (brief G2.3).
# Needs: GODOT (the pinned editor binary), JAVA_HOME (JDK 17), ANDROID_HOME (SDK with platform 36, build-tools 36.1.0,
# NDK 29.0.14206865) and the export templates of game/GODOT_VERSION under ~/.local/share/godot/export_templates.
# Usage: build_android_debug.sh [output.apk]      (default: <repo>/build/uomd-debug.apk)
set -euo pipefail
game_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd "${game_dir}/.." && pwd)"
: "${GODOT:?set GODOT to the pinned Godot editor binary}"
: "${JAVA_HOME:?set JAVA_HOME to a JDK 17}"
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"
out="${1:-${repo_dir}/build/uomd-debug.apk}"

version="$(tr -d '[:space:]' < "${game_dir}/GODOT_VERSION")"        # 4.7.2-stable
template_version="${version/-/.}"                                   # 4.7.2.stable
templates="${HOME}/.local/share/godot/export_templates/${template_version}"
[[ -f "${templates}/android_source.zip" ]] || { echo "export templates ${template_version} are not installed in ${templates}" >&2; exit 2; }

# Editor settings: SDK, JDK and a debug keystore (created once; debug signing only).
config_dir="${XDG_CONFIG_HOME:-${HOME}/.config}/godot"
mkdir -p "${config_dir}"
keystore="${config_dir}/debug.keystore"
if [[ ! -f "${keystore}" ]]; then
  "${JAVA_HOME}/bin/keytool" -genkey -v -keystore "${keystore}" -alias androiddebugkey -storepass android -keypass android \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
fi
major_minor="$(cut -d. -f1,2 <<<"${version%%-*}")"                  # 4.7
cat > "${config_dir}/editor_settings-${major_minor}.tres" <<SETTINGS
[gd_resource type="EditorSettings" format=3]

[resource]
export/android/java_sdk_path = "${JAVA_HOME}"
export/android/android_sdk_path = "${ANDROID_HOME}"
export/android/debug_keystore = "${keystore}"
export/android/debug_keystore_user = "androiddebugkey"
export/android/debug_keystore_pass = "android"
SETTINGS

# Gradle build template (from the engine's own templates; game/android/build is not committed).
build_template="${game_dir}/android/build"
if [[ "$(cat "${game_dir}/android/.build_version" 2>/dev/null || true)" != "${template_version}" ]]; then
  rm -rf "${build_template}"
  mkdir -p "${build_template}"
  unzip -q -o "${templates}/android_source.zip" -d "${build_template}"
  printf '%s' "${template_version}" > "${game_dir}/android/.build_version"
  touch "${build_template}/.gdignore"
fi

mkdir -p "$(dirname "${out}")"
rm -f "${out}"
# The editor plugins must be imported once before an export (GDExtension registration).
"${GODOT}" --headless --path "${game_dir}" --import >/dev/null 2>&1 || "${GODOT}" --headless --path "${game_dir}" --import >/dev/null 2>&1
"${GODOT}" --headless --path "${game_dir}" --export-debug "Android" "${out}"
[[ -f "${out}" ]] || { echo "export did not produce ${out}" >&2; exit 1; }
"${game_dir}/tools/verify_apk.sh" "${out}"
